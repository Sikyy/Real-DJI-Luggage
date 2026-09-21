/**
 * 给缺少结构化数据的页面注入 JSON-LD。
 *
 * 覆盖：
 *   - 产品页   → Product（含 manufacturer / brand / material / category；不含 offers，
 *                因为这是 B2B 定制品，没有真实售价，编一个价格会误导且触发 GSC 警告）
 *   - 新闻文章 → BlogPosting
 *   - 职位页   → JobPosting（可进 Google Jobs）
 *   - collections/all → CollectionPage + ItemList
 *
 * 数据全部来自页面自身（title / description / og:image / canonical / 内联数据），
 * 不引入第二份真相。已有 JSON-LD 的页面会跳过。
 *
 * 用法：node scripts/build-structured-data.mjs [--check]
 *   --check  只列出仍缺结构化数据的页面，不改文件；有缺失时以非零码退出
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')
const SITE = 'https://djiluggage.id'
const ORG = { '@type': 'Organization', name: 'DJI Luggage', url: `${SITE}/` }

const read = (p) => readFileSync(path.join(root, p), 'utf8')
const pick = (html, re) => (html.match(re) || [])[1] || ''
const meta = (html, prop) => pick(html, new RegExp(`<meta property="${prop}" content="([^"]*)"`))
const nameMeta = (html, name) => pick(html, new RegExp(`<meta name="${name}" content="([^"]*)"`))

function unescapeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
}

/** "9.01.25" / "11.05.2025" → "2025-09-01"（格式为 月.日.年） */
function toIso(mdy) {
  const m = String(mdy || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (!m) return null
  const [, mm, dd, yy] = m
  return `${yy.length === 2 ? '20' + yy : yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

// ---------------------------------------------------------------- 各类 schema
function productSchema(rel) {
  const html = read(rel)
  const gallery = [...new Set(
    [...html.matchAll(/\/assets\/products\/roaming-catalog\/[^"']+?\.(?:png|jpg|jpeg|webp)/g)].map((m) => SITE + m[0]),
  )].slice(0, 8)
  const sizeList = [...new Set([...html.matchAll(/data-size-option[^>]*>([^<]+)</g)].map((m) => m[1]))]

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: unescapeHtml(pick(html, /<h1 class="product-title">(.*?)<\/h1>/s)),
    description: unescapeHtml(nameMeta(html, 'description')),
    image: gallery.length ? gallery : [meta(html, 'og:image')],
    url: pick(html, /<link rel="canonical" href="([^"]*)"/),
    brand: { '@type': 'Brand', name: 'ROAMING' },
    manufacturer: ORG,
    category: 'Luggage',
    material: 'Polycarbonate shell with aluminum frame',
    additionalProperty: sizeList.map((v) => ({ '@type': 'PropertyValue', name: 'Available size', value: v })),
  }
}

function newsSchema(rel) {
  const html = read(rel)
  const slug = path.basename(path.dirname(rel))
  const i = html.search(new RegExp(`"${slug}":\\s*\\{`))
  const seg = i >= 0 ? html.slice(i, i + 500) : ''
  const f = (k) => unescapeHtml((seg.match(new RegExp(`${k}:\\s*"([^"]*)"`)) || [])[1] || '')
  const iso = toIso(f('date'))
  const url = pick(html, /<link rel="canonical" href="([^"]*)"/)

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: f('title'),
    description: unescapeHtml(nameMeta(html, 'description')),
    image: [meta(html, 'og:image')],
    ...(iso ? { datePublished: iso, dateModified: iso } : {}),
    author: { '@type': 'Organization', name: f('author') || 'DJI Luggage Team' },
    publisher: {
      '@type': 'Organization',
      name: 'DJI Luggage',
      logo: { '@type': 'ImageObject', url: `${SITE}/assets/og/dji-luggage-og.jpg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  }
}

function jobSchema(rel, jobs) {
  const slug = path.basename(path.dirname(rel))
  const job = jobs[slug]
  if (!job) return null
  const iso = toIso(job.date)
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: `<p>${unescapeHtml(job.description)}</p><p>${unescapeHtml(job.basicIntro)}</p>`,
    ...(iso ? { datePosted: iso } : {}),
    employmentType: 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: 'DJI Luggage', sameAs: `${SITE}/` },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Bogor',
        addressRegion: 'West Java',
        addressCountry: 'ID',
      },
    },
    url: pick(read(rel), /<link rel="canonical" href="([^"]*)"/),
  }
}

function collectionSchema(rel) {
  const html = read(rel)
  const items = [...html.matchAll(
    /<a class="catalog-card" href="(\/products\/[^"]+?)">[\s\S]*?<h2 class="catalog-card-title">([^<]*)<\/h2>/g,
  )]
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'All Collections',
    description: unescapeHtml(nameMeta(html, 'description')),
    url: pick(html, /<link rel="canonical" href="([^"]*)"/),
    isPartOf: { '@type': 'WebSite', name: 'DJI Luggage', url: `${SITE}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: unescapeHtml(m[2]),
        url: SITE + m[1],
      })),
    },
  }
}

// ---------------------------------------------------------------- 待处理清单
const jobSrc = read('career-detail.js')
const jobs = eval(`(${jobSrc.match(/const jobs = (\{[\s\S]*?\n  \});/)[1]})`)

const targets = []
for (const d of readdirSync(path.join(root, 'products'), { withFileTypes: true })) {
  if (d.isDirectory() && existsSync(path.join(root, 'products', d.name, 'index.html'))) {
    targets.push([`products/${d.name}/index.html`, productSchema])
  }
}
for (const d of readdirSync(path.join(root, 'newsroom'), { withFileTypes: true })) {
  if (d.isDirectory() && d.name !== 'filters' && existsSync(path.join(root, 'newsroom', d.name, 'index.html'))) {
    targets.push([`newsroom/${d.name}/index.html`, newsSchema])
  }
}
for (const slug of Object.keys(jobs)) {
  if (existsSync(path.join(root, 'careers', slug, 'index.html'))) {
    targets.push([`careers/${slug}/index.html`, (rel) => jobSchema(rel, jobs)])
  }
}
targets.push(['collections/all/index.html', collectionSchema])

// ---------------------------------------------------------------- 执行
const missing = []
let written = 0
for (const [rel, build] of targets) {
  if (read(rel).includes('application/ld+json')) continue
  const schema = build(rel)
  if (!schema) continue
  if (CHECK) {
    missing.push([rel, schema['@type']])
    continue
  }
  const script = `  <script type="application/ld+json">\n  ${JSON.stringify(schema)}\n  </script>`
  writeFileSync(path.join(root, rel), read(rel).replace('</head>', `${script}\n</head>`), 'utf8')
  written++
  console.log(`  已注入 ${schema['@type'].padEnd(15)} ${rel}`)
}

if (CHECK) {
  if (missing.length) {
    console.log(`仍缺结构化数据的页面（${missing.length}）：`)
    for (const [rel, t] of missing) console.log(`  ${rel.padEnd(58)} 待注入 ${t}`)
    process.exit(1)
  }
  console.log('所有目标页面都已带结构化数据 ✓')
} else {
  console.log(`\n共注入 ${written} 个页面（其余已存在，已跳过）`)
}
