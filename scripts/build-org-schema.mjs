/**
 * 强化每一处 Organization 结构化数据 —— 主要用于品牌消歧。
 *
 * 背景：本站品牌 "DJI Luggage" 与知名无人机制造商 "DJI" 同名。
 * Search Console 显示 455 次展示来自 "dji hiring" 且零点击，即结果被错误受众看到。
 * schema.org 的 `disambiguatingDescription` 正是为「与同名实体区分」设计的属性。
 *
 * 处理范围：
 *   - 顶层 Organization 块（首页、关于、联系等）：补 disambiguatingDescription
 *     + areaServed（已确认出口市场）+ knowsAbout（业务领域）
 *   - 嵌套的 Organization 对象（Product.manufacturer、JobPosting.hiringOrganization、
 *     BlogPosting.publisher 等）：只补 disambiguatingDescription，避免冗余膨胀
 *
 * 幂等：值已存在且一致则跳过。用法：node scripts/build-org-schema.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.seo-geo', '.workbuddy-ai', '.agents', 'agent', 'sales-kit',
])

// 消歧描述：只陈述「我们是什么」，不主张与任何第三方的关联或非关联关系。
const DISAMBIGUATING_DESCRIPTION =
  'Indonesian luggage and suitcase manufacturer in Bogor, West Java. An OEM and ODM factory producing hard-shell and soft-shell travel luggage for brands, importers and distributors - a luggage manufacturer, not a drone, camera or consumer-electronics company.'

const AREA_SERVED = ['Indonesia', 'China', 'Australia', 'Germany']

const KNOWS_ABOUT = [
  'Luggage manufacturing',
  'OEM manufacturing',
  'ODM product development',
  'Hard-shell suitcase production',
  'Aluminium frame luggage',
  'Export packaging',
]

// 完整邮政地址。工厂全址一直写在 llms.txt 里，但结构化数据此前只有
// 「Bogor, ID」—— 与 Google Business Profile、本地搜索和各类名录对不上，
// 本地实体信号因此偏弱。字段拆法遵循印尼行政区划层级。
const ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Jl. Raya Parung, Desa/Kelurahan Kemang, Kec. Kemang',
  addressLocality: 'Bogor',
  addressRegion: 'West Java',
  postalCode: '16310',
  addressCountry: 'ID',
}

// 公司在 Google Maps / Business Profile 上**已经存在**的列表。
//
// 关键点：列表用的是印尼法人名，与网站品牌名 "DJI Luggage" 不一致。Google 靠
// 名称+地址+电话把网站和商家页认成同一个实体，名字对不上就会削弱这个关联。
// 解法是同时补两个字段：
//   legalName —— schema.org 里专门表示「注册名称」的属性
//   sameAs    —— 声明「这个 URL 指的是同一个实体」
//
// CID 来自用户提供的 Maps 链接：!1s0x2e69c30045c91d6d:0x2582d60d79a048e0
// 用 ?cid=<十进制> 形式，比带一堆参数的原始 URL 稳定。
// ⚠️ 列表名写的是 "PRODUCK"（拼写错误），下面用的是正确拼法；若与 PT 注册名
//    不一致，改这一行即可。
const LEGAL_NAME = 'PT. DJI Travel Product Indonesia'
const SAME_AS = ['https://maps.google.com/?cid=2702958079739185376']

const BLOCK_RE = /(<script type="application\/ld\+json">\s*)([\s\S]*?)(\s*<\/script>)/g

/**
 * 递归强化：顶层 Organization 得到全部三个属性，嵌套的只得到消歧描述。
 * 返回被改动的属性数量。
 */
function enrich(node, isTopLevel = true) {
  let touched = 0

  if (Array.isArray(node)) {
    for (const item of node) touched += enrich(item, false)
    return touched
  }
  if (!node || typeof node !== 'object') return 0

  if (node['@type'] === 'Organization') {
    if (node.disambiguatingDescription !== DISAMBIGUATING_DESCRIPTION) {
      node.disambiguatingDescription = DISAMBIGUATING_DESCRIPTION
      touched++
    }
    if (isTopLevel) {
      const hasArea = Array.isArray(node.areaServed) && node.areaServed.length === AREA_SERVED.length
      const hasKnows = Array.isArray(node.knowsAbout) && node.knowsAbout.length === KNOWS_ABOUT.length
      if (!hasArea) { node.areaServed = AREA_SERVED; touched++ }
      if (!hasKnows) { node.knowsAbout = KNOWS_ABOUT; touched++ }

      const a = node.address
      const addressIncomplete =
        !a ||
        a.streetAddress !== ADDRESS.streetAddress ||
        a.addressRegion !== ADDRESS.addressRegion ||
        a.postalCode !== ADDRESS.postalCode
      if (addressIncomplete) { node.address = { ...ADDRESS }; touched++ }

      // 把网站品牌名与印尼法人名、以及 Google Maps 上那个已存在的列表连起来。
      if (node.legalName !== LEGAL_NAME) { node.legalName = LEGAL_NAME; touched++ }

      const existing = Array.isArray(node.sameAs) ? node.sameAs : []
      const missing = SAME_AS.filter((u) => !existing.includes(u))
      if (missing.length) { node.sameAs = [...existing, ...missing]; touched++ }
    }
  }

  for (const value of Object.values(node)) touched += enrich(value, false)
  return touched
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

const files = walk(root).sort()
const pending = []
let written = 0
let orgsTouched = 0

for (const file of files) {
  const rel = path.relative(root, file)
  const html = readFileSync(file, 'utf8')
  let touched = 0

  const next = html.replace(BLOCK_RE, (full, open, body, close) => {
    let data
    try {
      data = JSON.parse(body)
    } catch {
      return full // 解析不了就原样保留
    }
    const n = enrich(data)
    if (!n) return full
    touched += n
    return `${open}${JSON.stringify(data)}${close}`
  })

  if (!touched) continue
  orgsTouched += touched

  if (CHECK) {
    pending.push(`${rel} (${touched})`)
    continue
  }
  writeFileSync(file, next, 'utf8')
  written++
}

if (CHECK) {
  if (pending.length) {
    console.log(`Organization 结构化数据待强化（${pending.length} 个页面）：`)
    for (const r of pending) console.log(`  ${r}`)
    process.exit(1)
  }
  console.log(`全部页面的 Organization 结构化数据已强化 ✓`)
} else {
  console.log(`共更新 ${written} 个页面 / ${orgsTouched} 处属性；扫描 ${files.length} 个 HTML 文件`)
}
