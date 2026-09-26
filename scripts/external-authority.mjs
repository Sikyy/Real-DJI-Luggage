/**
 * 站外权威度数据采集 —— 用免费源补齐「外链 / 域名权重」。
 *
 * 两个数据源，都不需要任何 API key：
 *
 *   1. Common Crawl 网页图（domain 级 vertices）
 *      每行格式：nodeId <TAB> 域名 <TAB> 入链域名数
 *      入链域名数 = 在整个 Common Crawl 图里有多少个不同域名链向它，
 *      是一个可直接横向比较的「域名权威度」代理指标。
 *      文件很大（数百 MB 到 1.4 GB），采用流式解压 + 逐行匹配，不落盘。
 *
 *   2. Tranco 全球排名（免密钥 API）
 *      域名不在前 100 万则返回空 ranks，本身就是有意义的信号。
 *
 * 诚实说明：这不是 Ahrefs / SEMrush 级别的外链明细。
 *   - 拿不到「谁链向了你」「锚文本」「链接类型」
 *   - 入链数是 Common Crawl 图内的计数，与商业工具的 DR/DA 口径不同
 *   要外链明细仍需付费工具或 Search Console 的链接报告（该报告不在 API 中，只能人工看界面）。
 *
 * 用法：
 *   node scripts/external-authority.mjs                       # 默认域名集
 *   node scripts/external-authority.mjs --release=cc-main-2024-aug-sep-oct
 *   node scripts/external-authority.mjs --domains=a.com,b.com --skip-tranco
 */
import { createGunzip } from 'node:zlib'
import { Readable } from 'node:stream'
import readline from 'node:readline'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const RELEASE = opt('release', 'cc-main-2025-may-jun-jul')
const SKIP_TRANCO = args.includes('--skip-tranco')

// 域名集：我们是 own；direct 是同业代工厂（真正的对标）；
// reference 是消费品牌（体量参照）；calibration 用于验证指标量纲是否合理。
const GROUPS = {
  own: ['djiluggage.id'],
  direct_competitors: ['omaska.com', 'hungphat-jsc.com', 'htluggage.com'],
  reference_brands: ['rimowa.com', 'samsonite.com', 'awaytravel.com'],
  calibration: ['wikipedia.org', 'github.com'],
}
const custom = opt('domains', '')
const domains = custom
  ? custom.split(',').map((s) => s.trim()).filter(Boolean)
  : [...new Set(Object.values(GROUPS).flat())]

const reverseDomain = (d) => d.split('.').reverse().join('.')

console.log(`Common Crawl 版本: ${RELEASE}`)
console.log(`对比域名 ${domains.length} 个: ${domains.join(', ')}\n`)

// ---------------------------------------------------------------- 1) Common Crawl 入链域名数

const verticesUrl = `https://data.commoncrawl.org/projects/hyperlinkgraph/${RELEASE}/domain/${RELEASE}-domain-vertices.txt.gz`

// 同时匹配「反转」与「原样」两种写法，让数据本身告诉我们文件用的是哪种
const targets = new Map()
for (const d of domains) {
  targets.set(reverseDomain(d), d)
  targets.set(d, d)
}

async function scanCommonCrawl() {
  console.log(`开始流式扫描网页图（不落盘）...`)
  const res = await fetch(verticesUrl, { signal: AbortSignal.timeout(45 * 60 * 1000) })
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${verticesUrl}`)

  const rl = readline.createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  })

  const inDegree = new Map()   // domain -> in-degree
  const matchedAs = new Map()  // domain -> 'reversed' | 'verbatim'
  let lines = 0
  const t0 = Date.now()

  for await (const line of rl) {
    lines++
    if (lines % 20000000 === 0) {
      console.log(`  已扫描 ${(lines / 1e6).toFixed(0)}M 行（${((Date.now() - t0) / 1000).toFixed(0)}s）`)
    }
    // 快速跳过：目标行一定含 TAB 且长度有限
    const i = line.indexOf('\t')
    if (i < 0) continue
    const j = line.indexOf('\t', i + 1)
    if (j < 0) continue
    const name = line.slice(i + 1, j)
    const owner = targets.get(name)
    if (owner === undefined) continue
    const degree = Number(line.slice(j + 1))
    if (!Number.isFinite(degree)) continue
    // 同一域名两种写法都命中时取较大值
    if ((inDegree.get(owner) ?? -1) < degree) inDegree.set(owner, degree)
    matchedAs.set(owner, name === reverseDomain(owner) ? 'reversed' : 'verbatim')
  }

  console.log(`  扫描完成：${(lines / 1e6).toFixed(1)}M 行，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  // 自校验：至少一个 calibration 域名命中，才说明域名列格式判断正确
  const calib = GROUPS.calibration.map((d) => inDegree.get(d)).filter((v) => v != null)
  console.log(`  格式自校验：calibration 域名命中 ${calib.length}/${GROUPS.calibration.length}（${calib.join(', ')}）`)
  console.log(`  域名列写法：${[...new Set(matchedAs.values())].join(', ') || '无命中'}\n`)
  return { inDegree, matchedAs, lines }
}

// ---------------------------------------------------------------- 2) Tranco 排名

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchTranco(domain) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(3000 * attempt)
    const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${domain}`, {
      signal: AbortSignal.timeout(25000),
    })
    if (res.status === 429) continue
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const body = await res.json()
    const ranks = (body.ranks || []).map((r) => r.rank)
    return { rank: ranks.length ? Math.min(...ranks) : null, lists: ranks.length }
  }
  return { error: '429 限流' }
}

async function collectTranco() {
  console.log('查询 Tranco 全球排名（逐域名、带退避）...')
  const out = new Map()
  for (const d of domains) {
    const r = await fetchTranco(d)
    out.set(d, r)
    const shown = r.rank ? `#${r.rank.toLocaleString('en-US')}` : r.error ? `错误 ${r.error}` : '不在前 100 万'
    console.log(`  ${d.padEnd(22)} ${shown}`)
    await sleep(1200)
  }
  console.log('')
  return out
}

// ---------------------------------------------------------------- 执行

const cc = await scanCommonCrawl()
const tranco = SKIP_TRANCO ? new Map() : await collectTranco()

const rows = domains.map((d) => ({
  domain: d,
  group: Object.entries(GROUPS).find(([, list]) => list.includes(d))?.[0] || 'custom',
  in_degree_domains: cc.inDegree.get(d) ?? null,
  tranco_rank: tranco.get(d)?.rank ?? null,
  tranco_error: tranco.get(d)?.error ?? null,
}))

const own = rows.find((r) => r.group === 'own')
const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'))

console.log('════════ 站外权威度对比 ════════')
console.log('| 分组 | 域名 | Common Crawl 入链域名数 | Tranco 排名 |')
console.log('|---|---|---|---|')
for (const r of rows.sort((a, b) => (b.in_degree_domains ?? -1) - (a.in_degree_domains ?? -1))) {
  console.log(`| ${r.group} | ${r.domain} | ${fmt(r.in_degree_domains)} | ${r.tranco_rank ? '#' + fmt(r.tranco_rank) : '—'} |`)
}

if (own?.in_degree_domains != null) {
  const direct = rows.filter((r) => r.group === 'direct_competitors' && r.in_degree_domains != null)
  const median = direct.length
    ? direct.map((r) => r.in_degree_domains).sort((a, b) => a - b)[Math.floor(direct.length / 2)]
    : null
  console.log('')
  console.log(`我们（djiluggage.id）入链域名数：${fmt(own.in_degree_domains)}`)
  if (median != null) {
    console.log(`直接竞品中位数：${fmt(median)}  →  差距 ${own.in_degree_domains >= median ? '领先' : '落后'} ${fmt(Math.abs(median - own.in_degree_domains))}`)
  }
}

// ---------------------------------------------------------------- 落盘

const outDir = path.join(root, '.workbuddy-ai/reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)

const md = []
md.push('# 站外权威度数据（免费源）')
md.push('')
md.push(`- 采集时间：${new Date().toISOString()}`)
md.push(`- Common Crawl 版本：\`${RELEASE}\``)
md.push(`- 扫描行数：${(cc.lines / 1e6).toFixed(1)}M`)
md.push('')
md.push('## 指标口径（重要）')
md.push('')
md.push('- **Common Crawl 入链域名数**：在整个 Common Crawl 网页图里，有多少个不同域名链向该域名。可横向比较，但口径与 Ahrefs DR / Moz DA 不同，**不能直接换算**。')
md.push('- **Tranco 排名**：全球前 100 万站点排名。空值 = 不在榜内。')
md.push('- **拿不到的部分**：谁链向了你、锚文本、链接类型、nofollow 比例。这些需要付费工具，或 Search Console 的「链接」报告（该报告**不在 API 中**，只能人工看界面）。')
md.push('')
md.push('## 对比表')
md.push('')
md.push('| 分组 | 域名 | Common Crawl 入链域名数 | Tranco 排名 |')
md.push('|---|---|---|---|')
for (const r of rows.sort((a, b) => (b.in_degree_domains ?? -1) - (a.in_degree_domains ?? -1))) {
  md.push(`| ${r.group} | ${r.domain} | ${fmt(r.in_degree_domains)} | ${r.tranco_rank ? '#' + fmt(r.tranco_rank) : '—'} |`)
}
md.push('')
md.push('## 格式自校验')
md.push('')
md.push(`calibration 域名（wikipedia.org、github.com）命中 ${GROUPS.calibration.filter((d) => cc.inDegree.get(d) != null).length}/${GROUPS.calibration.length}。`)
md.push(`域名列写法：${[...new Set(cc.matchedAs.values())].join(', ') || '无命中'}。命中 calibration 说明指标量纲可信。`)

const jsonPath = path.join(outDir, `external-authority-${stamp}.json`)
const mdPath = path.join(outDir, `external-authority-${stamp}.md`)
writeFileSync(jsonPath, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  release: RELEASE,
  scannedLines: cc.lines,
  groups: GROUPS,
  rows,
  calibrationMatched: GROUPS.calibration.filter((d) => cc.inDegree.get(d) != null),
  domainColumnForm: [...new Set(cc.matchedAs.values())],
  limitation: 'Common Crawl in-degree is a comparable proxy, not a backlink list. Individual referring domains, anchor text and link attributes are not available from this source.',
}, null, 2))
writeFileSync(mdPath, md.join('\n'))
console.log(`\nJSON: ${path.relative(root, jsonPath)}`)
console.log(`报告: ${path.relative(root, mdPath)}`)
