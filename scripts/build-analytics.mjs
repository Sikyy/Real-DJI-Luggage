/**
 * 给全站每个 HTML 页面注入 Google Tag Manager 容器代码 + Consent Mode v2 同意机制。
 *
 * 注入位置（遵循 Google 官方要求）：
 *   1. <head> 内尽可能靠上，紧接 <meta charset> 之后（charset 必须位于最前 1024 字节内，故置于其后），依次为：
 *        a. Consent Mode v2 默认值脚本 —— 必须在 GTM 之前执行，否则默认值来不及生效
 *        b. 同意横幅样式表
 *        c. GTM 容器代码
 *   2. 紧跟起始 <body ...> 标记之后：GTM <noscript> 回退 iframe
 *   3. 紧邻 </body> 之前：同意横幅标记 + 横幅脚本
 *
 * 幂等：每个片段独立检测、独立注入，可重复执行；
 *       已装 GTM 的页面再跑一次，只会补上缺失的同意机制片段。
 *
 * 用法：node scripts/build-analytics.mjs [--check]
 *   --check  只列出仍缺片段的页面，不改文件；有缺失时以非零码退出
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

// GTM 容器 ID。换容器时只改这里，然后重跑本脚本即可。
const GTM_ID = 'GTM-5X3JF2HN'
// 同意选择在 localStorage 中的键名（同时用 consent.js 与 <head> 默认值脚本读写）
const CONSENT_KEY = 'dji_consent_v1'
// 静态资源版本号：改动 consent.css / consent.js 后需要递增，以绕过长期缓存
const ASSET_VERSION = '20260925a'

// 不参与注入的目录（与 build-pages.mjs 的发布范围保持一致，另加本地工具目录）
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.seo-geo', '.workbuddy-ai', '.agents', 'agent', 'sales-kit',
])

// ---------------------------------------------------------------- 注入片段

// 默认全部 denied；只有用户点击 Accept 才把 analytics_storage 升为 granted。
// ad_* 永远保持 denied —— 本站不投放广告。
const CONSENT_DEFAULT = `  <!-- Consent Mode v2 defaults (must run before Google Tag Manager) -->
  <script>(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
  gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
  try{if(localStorage.getItem('${CONSENT_KEY}')==='granted'){gtag('consent','update',{analytics_storage:'granted'})}}catch(e){}})();</script>
  <!-- End Consent Mode v2 defaults -->
`

const CONSENT_CSS = `  <link rel="stylesheet" href="/consent.css?v=${ASSET_VERSION}">
`

const GTM_HEAD = `  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${GTM_ID}');</script>
  <!-- End Google Tag Manager -->
`

const GTM_NOSCRIPT = `  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
`

const CONSENT_BANNER = `  <!-- Cookie consent banner -->
  <div id="cookieBanner" class="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent" hidden>
    <div class="cookie-banner-inner">
      <p class="cookie-banner-text">We use cookies for analytics, to understand how this site is used. You can accept or decline. See our <a href="/privacy-policy">Privacy Policy</a>.</p>
      <div class="cookie-banner-actions">
        <button type="button" class="cookie-btn" data-consent="denied">Decline</button>
        <button type="button" class="cookie-btn cookie-btn-accept" data-consent="granted">Accept</button>
      </div>
    </div>
  </div>
  <script src="/consent.js?v=${ASSET_VERSION}"></script>
  <!-- End cookie consent banner -->
`

/**
 * 片段定义。
 *   anchor: 'head'          → 紧接 <meta charset> 之后（保持顺序：默认值 → 样式表 → GTM）
 *           'body-open'     → 紧跟 <body ...> 之后
 *           'body-close'    → 紧邻 </body> 之前
 *   marker: 用于判断该片段是否已存在
 */
const PIECES = [
  { name: 'Consent Mode v2 defaults', anchor: 'head', marker: `localStorage.getItem('${CONSENT_KEY}')`, html: CONSENT_DEFAULT },
  { name: 'consent.css', anchor: 'head', marker: `/consent.css?v=${ASSET_VERSION}`, html: CONSENT_CSS },
  { name: 'GTM container', anchor: 'head', marker: GTM_ID, html: GTM_HEAD },
  { name: 'GTM noscript', anchor: 'body-open', marker: 'Google Tag Manager (noscript)', html: GTM_NOSCRIPT },
  { name: 'consent banner', anchor: 'body-close', marker: 'id="cookieBanner"', html: CONSENT_BANNER },
]

// ---------------------------------------------------------------- 注入逻辑

function anchorIndex(html, anchor) {
  if (anchor === 'head') {
    const charset = html.match(/[ \t]*<meta charset="UTF-8">[^\n]*\n/)
    if (charset) return charset.index + charset[0].length
    const head = html.match(/<head>\s*\n/)
    return head ? head.index + head[0].length : -1
  }
  if (anchor === 'body-open') {
    const body = html.match(/<body[^>]*>/)
    return body ? body.index + body[0].length + 1 : -1
  }
  const close = html.indexOf('</body>')
  return close
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------- 执行

const files = walk(root).sort()
const incomplete = []
const unanchored = []
let written = 0

for (const file of files) {
  const rel = path.relative(root, file)
  let html = readFileSync(file, 'utf8')
  const before = html
  const added = []

  // 按锚点分组，同一锚点的缺失片段一次性拼接后插入，
  // 这样 head 内的相对顺序恒为 PIECES 中声明的顺序：默认值 → 样式表 → GTM。
  for (const anchor of ['head', 'body-open', 'body-close']) {
    const missing = PIECES.filter((p) => p.anchor === anchor && !html.includes(p.marker))
    if (!missing.length) continue

    const at = anchorIndex(html, anchor)
    if (at < 0) {
      for (const p of missing) unanchored.push(`${rel} (${p.name})`)
      continue
    }

    html = html.slice(0, at) + missing.map((p) => p.html).join('') + html.slice(at)
    added.push(...missing.map((p) => p.name))
  }

  if (html === before) continue

  if (CHECK) { incomplete.push(`${rel} — 缺 ${added.join(', ')}`); continue }

  writeFileSync(file, html, 'utf8')
  written++
  console.log(`  已注入 ${rel}  [${added.join(', ')}]`)
}

if (CHECK) {
  if (incomplete.length) {
    console.log(`仍缺注入片段的页面（${incomplete.length}）：`)
    for (const r of incomplete) console.log(`  ${r}`)
    process.exit(1)
  }
  console.log(`全部 ${files.length} 个页面都已带 GTM ${GTM_ID} + Consent Mode v2 ✓`)
} else {
  console.log(`\n共更新 ${written} 个页面（其余已完整，已跳过）；扫描 ${files.length} 个 HTML 文件`)
}

if (unanchored.length) {
  console.log(`\n⚠ 找不到锚点，已跳过 ${unanchored.length} 处：`)
  for (const r of unanchored) console.log(`  ${r}`)
}
