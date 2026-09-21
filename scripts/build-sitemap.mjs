/**
 * 从各页面的 <link rel="canonical"> 生成 sitemap.xml。
 *
 * 之所以不手写：sitemap 手写必然漂移（这次就漏了全部 21 个产品页 + collections）。
 * 以 canonical 为唯一来源，还能顺带把 x.html 与 x/index.html 这类孪生页自动去重
 * （两者 canonical 相同），以及自动排除 canonical 指向别处的筛选视图页。
 *
 * 用法：node scripts/build-sitemap.mjs [--check]
 *   --check  只比对，不写入；有差异时以非零码退出
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.workbuddy-ai', 'assets', 'scripts', 'functions', 'workers', 'agent'])
const SKIP_FILES = new Set(['article-template.html', 'career-template.html', '404.html'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
    } else if (entry.name.endsWith('.html') && !SKIP_FILES.has(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// 依路径给 priority（Google 已忽略该字段，但保持原格式便于人工阅读）
function priorityFor(urlPath) {
  if (urlPath === '/') return '1.0'
  if (urlPath === '/privacy-policy') return '0.3'
  if (urlPath.startsWith('/products/')) return '0.7'
  if (urlPath.startsWith('/newsroom/')) return '0.6'
  if (urlPath.startsWith('/careers/')) return '0.5'
  return '0.8'
}

function lastmodFor(file) {
  const d = statSync(file).mtime
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const seen = new Map() // canonical path -> { file }
for (const file of walk(root)) {
  const html = readFileSync(file, 'utf8')
  const m = html.match(/<link rel="canonical" href="https:\/\/djiluggage\.id([^"]*)"/)
  if (!m) {
    console.warn('跳过（无 canonical）:', path.relative(root, file))
    continue
  }
  const urlPath = m[1]
  // 已有则保留更"规范"的那个源文件（优先非 .html 形态）
  if (!seen.has(urlPath)) seen.set(urlPath, { file })
}

const entries = [...seen.entries()].sort((a, b) => {
  if (a[0] === '/') return -1
  if (b[0] === '/') return 1
  return a[0].localeCompare(b[0])
})

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    ([urlPath, { file }]) => `  <url>
    <loc>https://djiluggage.id${urlPath}</loc>
    <lastmod>${lastmodFor(file)}</lastmod>
    <priority>${priorityFor(urlPath)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

const target = path.join(root, 'sitemap.xml')
const current = (() => {
  try { return readFileSync(target, 'utf8') } catch { return '' }
})()

console.log(`从 ${walk(root).length} 个 HTML 页面解析出 ${entries.length} 个唯一 canonical URL`)

if (CHECK) {
  if (current === xml) {
    console.log('sitemap.xml 已是最新 ✓')
    process.exit(0)
  }
  console.log('sitemap.xml 与页面不一致，需要重新生成')
  process.exit(1)
}

writeFileSync(target, xml, 'utf8')
console.log('已写入 sitemap.xml')
console.log('\nURL 清单：')
for (const [urlPath] of entries) console.log('  ', urlPath)
