/**
 * 给全站每个 HTML 页面注入 Google Tag Manager 容器代码。
 *
 * 注入位置（遵循 Google 官方要求）：
 *   1. <head> 内尽可能靠上：紧接 <meta charset> 之后（charset 必须在最前 1024 字节内，故置于其后）
 *   2. 紧跟起始 <body ...> 标记之后：<noscript> 回退 iframe
 *
 * 幂等：已包含容器 ID 的页面会跳过，可重复执行。
 *
 * 用法：node scripts/build-analytics.mjs [--check]
 *   --check  只列出仍缺 GTM 的页面，不改文件；有缺失时以非零码退出
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

// GTM 容器 ID。换容器时只改这里，然后重跑本脚本即可。
const GTM_ID = 'GTM-5X3JF2HN'

// 不参与注入的目录（与 build-pages.mjs 的发布范围保持一致，另加本地工具目录）
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.seo-geo', '.workbuddy-ai', '.agents', 'agent', 'sales-kit',
])

const HEAD_SNIPPET = `  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${GTM_ID}');</script>
  <!-- End Google Tag Manager -->
`

const BODY_SNIPPET = `  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
`

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    const info = statSync(full)
    if (info.isDirectory()) walk(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

/** 在 charset 之后插入 head 片段；找不到 charset 就退回到 <head> 之后 */
function injectHead(html) {
  const charset = html.match(/[ \t]*<meta charset="UTF-8">[^\n]*\n/)
  if (charset) {
    const at = charset.index + charset[0].length
    return html.slice(0, at) + HEAD_SNIPPET + html.slice(at)
  }
  const head = html.match(/<head>\s*\n/)
  if (!head) return null
  const at = head.index + head[0].length
  return html.slice(0, at) + HEAD_SNIPPET + html.slice(at)
}

function injectBody(html) {
  const body = html.match(/<body[^>]*>/)
  if (!body) return null
  const at = body.index + body[0].length
  return html.slice(0, at) + '\n' + BODY_SNIPPET + html.slice(at)
}

const files = walk(root).sort()
const missing = []
const noAnchor = []
let written = 0

for (const file of files) {
  const rel = path.relative(root, file)
  const html = readFileSync(file, 'utf8')

  if (html.includes(GTM_ID)) continue // 幂等：已装

  const withHead = injectHead(html)
  if (withHead === null) { noAnchor.push(rel); continue }
  const withBody = injectBody(withHead)
  if (withBody === null) { noAnchor.push(rel); continue }

  if (CHECK) { missing.push(rel); continue }

  writeFileSync(file, withBody, 'utf8')
  written++
  console.log(`  已注入 ${rel}`)
}

if (CHECK) {
  if (missing.length) {
    console.log(`仍缺 GTM（${missing.length}）：`)
    for (const r of missing) console.log(`  ${r}`)
    process.exit(1)
  }
  console.log(`全部 ${files.length} 个页面都已带 GTM ${GTM_ID} ✓`)
} else {
  console.log(`\n共注入 ${written} 个页面（其余已存在，已跳过）；扫描 ${files.length} 个 HTML 文件`)
}

if (noAnchor.length) {
  console.log(`\n⚠ 找不到 <head> 或 <body> 锚点，已跳过 ${noAnchor.length} 个：`)
  for (const r of noAnchor) console.log(`  ${r}`)
}
