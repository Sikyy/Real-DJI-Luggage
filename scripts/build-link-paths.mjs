/**
 * 把站内链接统一成「目录型页面带结尾斜杠」的规范形态。
 *
 * 背景：Cloudflare Pages 会把 /contact 这类无斜杠路径 301/308 到 /contact/。
 * 站内链接若写成无斜杠形态，每次点击都会多一次重定向往返，而且 Googlebot
 * 从原始 HTML 里发现的是非规范 URL —— GSC 的「网页会自动重定向」那一桶
 * 因此长期偏高。site.js 只在运行时改写 href，爬虫看到的静态 HTML 没变。
 *
 * 这里在源码层面修正，让静态 HTML 与 dist 产物天然一致，不依赖 JS。
 *
 * 判定规则（与 site.js 的 stripLocalePrefix 保持一致）：
 *   · /                     → 跳过（根路径本来就没有斜杠）
 *   · 已带结尾斜杠           → 跳过
 *   · /cdn-cgi/…            → 跳过（Cloudflare 的边缘端点，不是页面）
 *   · 最后一段含「.」        → 跳过（.svg/.xml/.txt/.woff2 等静态文件）
 *   · 其余                  → 补上结尾斜杠，保留 ?query 与 #hash
 *
 * 用法：
 *   node scripts/build-link-paths.mjs           dry-run，列出会改动的文件
 *   node scripts/build-link-paths.mjs --check   仅比对，有差异时退出码 1
 *   node scripts/build-link-paths.mjs --apply   写回源文件
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')
const APPLY = process.argv.includes('--apply')

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.workbuddy-ai', 'assets', 'scripts', 'functions', 'workers', 'agent', 'product-images'])
const SKIP_FILES = new Set(['article-template.html', 'career-template.html'])

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

/** 返回规范化后的 href；不需要改动时返回 null。 */
export function normalizeHref(value) {
  if (!value.startsWith('/')) return null
  const cuts = [value.indexOf('#'), value.indexOf('?')].filter((i) => i >= 0)
  const cut = cuts.length ? Math.min(...cuts) : value.length
  const pathname = value.slice(0, cut)
  const rest = value.slice(cut)

  if (pathname === '/' || pathname === '') return null
  if (pathname.endsWith('/')) return null
  if (pathname.startsWith('/cdn-cgi/')) return null

  const last = pathname.slice(pathname.lastIndexOf('/') + 1)
  if (last.includes('.')) return null
  return `${pathname}/${rest}`
}

const HREF_RE = /href="(\/[^"]*)"/g

function rewrite(html) {
  let changed = 0
  const next = html.replace(HREF_RE, (match, value) => {
    const fixed = normalizeHref(value)
    if (!fixed) return match
    changed++
    return `href="${fixed}"`
  })
  return { next, changed }
}

const files = walk(root)
let totalChanged = 0
const touched = []

for (const file of files) {
  const html = readFileSync(file, 'utf8')
  const { next, changed } = rewrite(html)
  if (!changed) continue
  totalChanged += changed
  touched.push({ file: path.relative(root, file), changed })
  if (APPLY) writeFileSync(file, next, 'utf8')
}

console.log(
  `${APPLY ? 'APPLY' : CHECK ? 'CHECK' : 'DRY-RUN'}：扫描 ${files.length} 个 HTML，` +
    `${touched.length} 个文件 / ${totalChanged} 条站内链接需要补结尾斜杠`,
)
for (const t of touched.sort((a, b) => b.changed - a.changed)) {
  console.log(`  ${String(t.changed).padStart(4)}  ${t.file}`)
}

if (CHECK && totalChanged) {
  console.error('\n存在无结尾斜杠的站内链接，请运行：node scripts/build-link-paths.mjs --apply')
  process.exit(1)
}
