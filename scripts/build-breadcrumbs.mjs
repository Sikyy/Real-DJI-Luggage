/**
 * 为每个页面注入 BreadcrumbList 结构化数据。
 *
 * 层级由页面自己的 canonical 路径推导，不用手写：
 *   /                                   → 不注入（首页无需面包屑）
 *   /about                              → Home > About
 *   /products/aluminum-suitcase-black/  → Home > Products > AURA Collection Black
 *   /careers/export-sales-coordinator/  → Home > Careers > Export Sales Coordinator
 *
 * 只把「确实存在页面的」路径段计入层级，避免出现指向 404 的面包屑节点。
 * 节点名称优先取该页的真实 <h1>，取不到才回退到路径段美化的名字。
 *
 * 幂等：已含 BreadcrumbList 的页面会跳过。
 * 用法：node scripts/build-breadcrumbs.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.seo-geo', '.workbuddy-ai', '.agents', 'agent', 'sales-kit',
])
const SKIP_FILES = new Set(['404.html'])
const MARKER = '"@type":"BreadcrumbList"'

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

const unescapeHtml = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")

/** 取页面 H1 文本，作为面包屑节点名 */
function pageName(html, fallback) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  if (m) {
    const text = unescapeHtml(m[1]
      .replace(/<span[^>]*arrow[^>]*>[\s\S]*?<\/span>/gi, ' ')  // 去掉装饰箭头
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '))
      .replace(/&[a-zA-Z]+;/g, ' ')   // 其余具名实体（&darr; &mdash; 等）去掉
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ').trim()
    if (text) return text
  }
  const title = html.match(/<title>([^<]*)<\/title>/)
  if (title) {
    const t = unescapeHtml(title[1]).replace(/\s*[|\-–—]\s*DJI Luggage\s*$/i, '').trim()
    if (t) return t
  }
  return fallback
}

const pretty = (seg) => seg
  .replace(/-/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())

// ---------------------------------------------------------------- 建索引

const files = walk(root).filter((f) => !SKIP_FILES.has(path.basename(f))).sort()
const byPath = new Map()   // canonical path → { file, html }

for (const file of files) {
  const html = readFileSync(file, 'utf8')
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1]
  if (!canonical) continue
  let p
  try { p = new URL(canonical).pathname } catch { continue }
  p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  if (p.length > 1) p = p.replace(/\/$/, '')
  if (!byPath.has(p)) byPath.set(p, { file, html })
}

const ORIGIN = 'https://djiluggage.id'

console.log(`已建立路径索引：${byPath.size} 个唯一路径`)

// ---------------------------------------------------------------- 生成并注入

const pending = []
let written = 0
let skippedNoCanonical = 0

for (const file of files) {
  const rel = path.relative(root, file)
  const html = readFileSync(file, 'utf8')

  if (html.includes(MARKER)) continue // 幂等

  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1]
  if (!canonical) { skippedNoCanonical++; continue }

  let p
  try { p = new URL(canonical).pathname } catch { skippedNoCanonical++; continue }
  p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  if (p.length > 1) p = p.replace(/\/$/, '')

  if (p === '/') continue // 首页不需要面包屑

  const segments = p.split('/').filter(Boolean)
  const items = [{ name: 'Home', url: `${ORIGIN}/` }]

  for (let i = 1; i <= segments.length; i++) {
    const prefix = '/' + segments.slice(0, i).join('/')
    const isLast = i === segments.length
    const entry = byPath.get(prefix)

    if (isLast) {
      // 当前页：一级栏目页用规则化名称（About / Careers / Products）；
      // 更深层页面用其自身 H1（如 "Export Sales Coordinator"）。
      // 避免 "Careers That Move You Forward." 这类标语被写进面包屑。
      const name = i === 1 ? pretty(segments[i - 1]) : pageName(html, pretty(segments[i - 1]))
      items.push({ name: name.replace(/[.。]+$/, ''), url: `${ORIGIN}${prefix}` })
    } else if (entry) {
      // 中间层只在该路径确实有页面时才计入，名称用规则化段落名
      items.push({ name: pretty(segments[i - 1]), url: `${ORIGIN}${prefix}` })
    }
  }

  if (items.length < 2) continue

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }

  if (CHECK) { pending.push(`${rel} (${items.length} 层)`); continue }

  const block = `  <script type="application/ld+json">\n  ${JSON.stringify(schema)}\n  </script>\n`
  writeFileSync(file, html.replace('</head>', `${block}</head>`), 'utf8')
  written++
}

if (CHECK) {
  if (pending.length) {
    console.log(`仍缺 BreadcrumbList 的页面（${pending.length}）：`)
    for (const r of pending.slice(0, 20)) console.log(`  ${r}`)
    process.exit(1)
  }
  console.log('所有页面都已带 BreadcrumbList ✓')
} else {
  console.log(`共注入 ${written} 个页面（首页与已存在的已跳过）`)
  if (skippedNoCanonical) console.log(`⚠ ${skippedNoCanonical} 个页面无 canonical，已跳过`)
}
