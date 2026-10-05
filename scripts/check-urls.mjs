/**
 * 批量检查一组 URL 的真实可达性 —— 专门用来复核 GSC 报的问题 URL。
 *
 * 为什么需要它：GSC 的「未找到 (404)」清单只给出 URL 和上次抓取日期，
 * 不告诉你现在是什么状态。而这些 URL 里最坑的一种是「301 之后仍是 404」——
 * 表面有重定向，实际是死胡同。这个脚本跟随完整重定向链，把这种情形单独标出来。
 *
 * 输入格式（自动识别）：
 *   · GSC 导出的 CSV（表头含「网址」列，如 `网址,上次抓取日期`）
 *   · 纯文本，每行一个 URL
 *   · 不传参数则读取 sitemap.xml
 *
 * 用法：
 *   node scripts/check-urls.mjs <file>
 *   node scripts/check-urls.mjs --base http://127.0.0.1:8791 <file>   # 查本地预览
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

const args = process.argv.slice(2)
const baseIdx = args.indexOf('--base')
const BASE = baseIdx >= 0 ? args[baseIdx + 1].replace(/\/+$/, '') : null
const fileArg = (() => {
  // --base 后面那一个是它的取值，不算文件参数。baseIdx 为 -1 时不能拿 0 去比，
  // 否则第一个位置参数会被当成 --base 的值吃掉（第一版就踩了这个坑）。
  const consumed = baseIdx >= 0 ? [baseIdx, baseIdx + 1] : []
  return args.find((a, i) => !a.startsWith('--') && !consumed.includes(i))
})()

function loadUrls() {
  if (!fileArg) {
    const xml = readFileSync(path.join(root, 'sitemap.xml'), 'utf8')
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  }
  const raw = readFileSync(path.resolve(fileArg), 'utf8')
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const isCsv = lines[0]?.includes(',') && /网址|url|URL/.test(lines[0])

  const urls = []
  for (const line of lines) {
    if (isCsv) {
      if (/^网址|^url/i.test(line)) continue // 表头
      // 表格 CSV：第 1 列是 URL。用简单切分即可，GSC 导出不含带逗号的 URL。
      const first = line.split(',')[0].replace(/^"|"$/g, '').trim()
      if (/^https?:\/\//i.test(first)) urls.push(first)
    } else if (/^https?:\/\//i.test(line)) {
      urls.push(line)
    }
  }
  return urls
}

const toLocal = (u) => (BASE ? u.replace(/^https?:\/\/djiluggage\.id/i, BASE) : u)

async function probe(url) {
  const target = toLocal(url)
  const chain = []
  let current = target
  for (let hop = 0; hop <= 6; hop++) {
    let res
    try {
      res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    } catch (err) {
      return { status: 0, chain, error: err.message }
    }
    chain.push(res.status)
    const loc = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !loc) return { status: res.status, chain }
    current = new URL(loc, current).toString()
  }
  return { status: -1, chain, error: '重定向超过 6 跳' }
}

const urls = loadUrls()
console.log(`检查 ${urls.length} 个 URL${BASE ? `（base=${BASE}）` : ''}\n`)

const rows = []
for (const url of urls) {
  const { status, chain, error } = await probe(url)
  rows.push({ url, status, hops: Math.max(0, chain.length - 1), chain, error })
  const short = url.replace(/^https?:\/\/djiluggage\.id/i, '') || '/'
  const flag = status === 200 ? '✓' : status === 404 || status === 410 ? '✗' : '!'
  const hops = chain.length > 1 ? ` (${chain.join('→')})` : ''
  console.log(`  ${flag} ${String(status).padEnd(5)} ${short}${hops}${error ? '  ' + error : ''}`)
}

// 分类统计。两个维度要正交，否则同一行会被数两次：
//   · 失败且经过重定向  → 「301 之后仍是 404」，白费一次抓取往返，最该修
//   · 失败且没有重定向  → 干脆的 404
const ok = rows.filter((r) => r.status === 200)
const failed = rows.filter((r) => r.status !== 200)
const failedViaRedirect = failed.filter((r) => r.hops > 0)
const failedDirect = failed.filter((r) => r.hops === 0)

console.log(`\n=== 汇总 ===`)
console.log(`  终点 200          : ${ok.length}`)
console.log(`  终点非 200        : ${failed.length}`)
console.log(`    ├ 重定向后仍非 200: ${failedViaRedirect.length}   ← 最该修（表面有跳转，实际死胡同）`)
console.log(`    └ 直接 404/410    : ${failedDirect.length}`)

if (failedViaRedirect.length) {
  console.log(`\n  重定向链但终点失败的：`)
  for (const r of failedViaRedirect) {
    console.log(`    ! ${r.url.replace(/^https?:\/\/djiluggage\.id/i, '')}  (${r.chain.join('→')})`)
  }
}

if (failed.length) {
  console.error(`\n存在未修好的 URL（${failed.length} 个）`)
  process.exit(1)
}
console.log('\n全部 URL 最终可达 ✓')
