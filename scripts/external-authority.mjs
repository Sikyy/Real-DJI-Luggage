/**
 * 站外权威度与引用域采集 —— 用 Common Crawl 开放网页图，不需要任何 API key。
 *
 * 三个文件、各司其职（口径以 Common Crawl 官方发布说明为准）：
 *
 *   <release>-domain-vertices.txt.gz   ⟨id, 反转域名, 子域数量⟩             ~0.7–1.5 GB
 *   <release>-domain-edges.txt.gz      ⟨from_id, to_id⟩                    ~7–10 GB
 *   <release>-domain-ranks.txt.gz      ⟨harmonicc_pos, harmonicc_val,
 *                                       pr_pos, pr_val, 反转域名, 子域数⟩   ~2–3.3 GB
 *
 *   ⚠ vertices 的第三列是**该域名的子域数量**，不是入链数。
 *     本脚本早期版本曾误把它当作入链数，已修正。
 *
 * 两种模式：
 *   --mode=ranks   （默认）扫 ranks 文件，取对比域名的 PageRank 排名与
 *                  harmonic centrality —— 可横向比较的「域名权重」。
 *   --mode=edges   三趟扫描，取出**真实指向本站的引用域列表**（谁链向了你）。
 *                  需要下载 edges 文件（约 7 GB），耗时较长。
 *   --mode=all     两者都做。
 *
 * 拿不到的部分（本脚本不会假装有）：
 *   - 锚文本、rel/nofollow 属性、页面级链接
 *   - 商业工具（Ahrefs DR / Moz DA）的口径数值
 *   - Search Console 的「链接」报告（该报告不在 API 中，只能人工看界面）
 *
 * 用法：
 *   node scripts/external-authority.mjs
 *   node scripts/external-authority.mjs --mode=edges
 *   node scripts/external-authority.mjs --release=cc-main-2025-may-jun-jul
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
const RELEASE = opt('release', 'cc-main-2026-apr-may-jun')
const MODE = opt('mode', 'ranks')
const SKIP_TRANCO = args.includes('--skip-tranco')
const OWN_DOMAIN = opt('own', 'djiluggage.id')

const GROUPS = {
  own: [OWN_DOMAIN],
  direct_competitors: ['omaska.com', 'hungphat-jsc.com', 'htluggage.com'],
  reference_brands: ['rimowa.com', 'samsonite.com', 'awaytravel.com'],
  calibration: ['wikipedia.org', 'github.com'],
}
const custom = opt('domains', '')
const domains = custom
  ? custom.split(',').map((s) => s.trim()).filter(Boolean)
  : [...new Set(Object.values(GROUPS).flat())]

const rev = (d) => d.split('.').reverse().join('.')
const base = `https://data.commoncrawl.org/projects/hyperlinkgraph/${RELEASE}/domain/${RELEASE}`

/** 流式读取 .gz 文本并逐行回调，不落盘 */
async function streamLines(url, onLine, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(90 * 60 * 1000) })
  if (!res.ok) throw new Error(`${label} 下载失败 ${res.status}`)
  const rl = readline.createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  })
  let n = 0
  const t0 = Date.now()
  for await (const line of rl) {
    n++
    if (n % 50000000 === 0) {
      console.log(`    ${label} ${(n / 1e6).toFixed(0)}M 行（${((Date.now() - t0) / 1000).toFixed(0)}s）`)
    }
    onLine(line, n)
  }
  console.log(`    ${label} 完成：${(n / 1e6).toFixed(1)}M 行，${((Date.now() - t0) / 1000).toFixed(0)}s`)
  return n
}

// ---------------------------------------------------------------- ranks

async function collectRanks() {
  console.log(`\n[1/2] 扫描 domain-ranks（约 2 GB）...`)
  const want = new Map(domains.map((d) => [rev(d), d]))
  const found = new Map()
  const lines = await streamLines(`${base}-domain-ranks.txt.gz`, (line) => {
    if (line.charCodeAt(0) === 35) return // '#'
    // harmonicc_pos \t harmonicc_val \t pr_pos \t pr_val \t host_rev \t n_hosts
    const p = line.split('\t')
    if (p.length < 6) return
    const owner = want.get(p[4])
    if (owner === undefined) return
    found.set(owner, {
      harmonicc_pos: Number(p[0]),
      harmonicc_val: Number(p[1]),
      pagerank_pos: Number(p[2]),
      pagerank_val: Number(p[3]),
      n_hosts: Number(p[5]),
    })
  }, 'ranks')
  return { found, lines }
}

// ---------------------------------------------------------------- edges：真实引用域

async function collectReferringDomains(target) {
  const targetRev = rev(target)
  console.log(`\n[A] 第 1 趟：在 vertices 中定位 ${targetRev} 的节点 id...`)
  let targetId = null
  await streamLines(`${base}-domain-vertices.txt.gz`, (line) => {
    if (targetId !== null) return
    const i = line.indexOf('\t')
    if (i < 0) return
    let j = line.indexOf('\t', i + 1)
    if (j < 0) j = line.length
    if (line.slice(i + 1, j) === targetRev) targetId = line.slice(0, i)
  }, 'vertices#1')

  if (targetId === null) {
    console.log(`  ${target} 不在该版本网页图中 → 没有任何已抓取页面链向它`)
    return { targetId: null, referring: [] }
  }
  console.log(`  ${target} 节点 id = ${targetId}`)

  console.log(`[B] 第 2 趟：扫描 edges（约 7 GB）找出所有指向该 id 的源 id...`)
  const srcIds = new Set()
  await streamLines(`${base}-domain-edges.txt.gz`, (line) => {
    const t = line.indexOf('\t')
    if (t < 0) return
    if (line.slice(t + 1) === targetId) srcIds.add(line.slice(0, t))
  }, 'edges')
  console.log(`  找到 ${srcIds.size} 个不同的引用域 id`)

  if (!srcIds.size) return { targetId, referring: [] }

  console.log(`[C] 第 3 趟：回到 vertices 把源 id 还原成域名...`)
  const names = new Map()
  await streamLines(`${base}-domain-vertices.txt.gz`, (line) => {
    const i = line.indexOf('\t')
    if (i < 0) return
    const id = line.slice(0, i)
    if (!srcIds.has(id)) return
    let j = line.indexOf('\t', i + 1)
    if (j < 0) j = line.length
    names.set(id, line.slice(i + 1, j).split('.').reverse().join('.'))
  }, 'vertices#2')

  const referring = [...names.values()].sort()
  console.log(`  解析出 ${referring.length} 个引用域`)
  return { targetId, referring }
}

// ---------------------------------------------------------------- Tranco

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchTranco(domain) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(3000 * attempt)
    const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${domain}`, { signal: AbortSignal.timeout(25000) })
    if (res.status === 429) continue
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const body = await res.json()
    const ranks = (body.ranks || []).map((r) => r.rank)
    return { rank: ranks.length ? Math.min(...ranks) : null }
  }
  return { error: '429 限流' }
}

async function collectTranco() {
  console.log(`\n[2/2] 查询 Tranco 全球排名...`)
  const out = new Map()
  for (const d of domains) {
    out.set(d, await fetchTranco(d))
    await sleep(1100)
  }
  return out
}

// ---------------------------------------------------------------- 执行

console.log(`Common Crawl 版本: ${RELEASE}`)
console.log(`模式: ${MODE}｜对比域名 ${domains.length} 个`)

let ranks = { found: new Map(), lines: 0 }
let backlinks = null
if (MODE === 'ranks' || MODE === 'all') ranks = await collectRanks()
if (MODE === 'edges' || MODE === 'all') backlinks = await collectReferringDomains(OWN_DOMAIN)
const tranco = SKIP_TRANCO ? new Map() : await collectTranco()

const rows = domains.map((d) => ({
  domain: d,
  group: Object.entries(GROUPS).find(([, l]) => l.includes(d))?.[0] || 'custom',
  ...(ranks.found.get(d) || {}),
  tranco_rank: tranco.get(d)?.rank ?? null,
}))
const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'))

if (MODE === 'ranks' || MODE === 'all') {
  console.log('\n════════ 域名权重对比（Common Crawl 开放网页图）════════')
  console.log('| 分组 | 域名 | PageRank 排名 | harmonic centrality | 子域数 | Tranco |')
  console.log('|---|---|---|---|---|---|')
  const sorted = rows.slice().sort((a, b) => (a.pagerank_pos ?? Infinity) - (b.pagerank_pos ?? Infinity))
  for (const r of sorted) {
    console.log(`| ${r.group} | ${r.domain} | ${n(r.pagerank_pos)} | ${n(r.harmonicc_val)} | ${n(r.n_hosts)} | ${r.tranco_rank ? '#' + n(r.tranco_rank) : '—'} |`)
  }
  const missing = rows.filter((r) => r.pagerank_pos == null).map((r) => r.domain)
  if (missing.length) console.log(`\n未出现在该版本网页图中（无任何已抓取页面链向）: ${missing.join(', ')}`)
}

if (backlinks) {
  console.log('\n════════ 指向本站的引用域（真实数据）════════')
  if (!backlinks.targetId) console.log(`  ${OWN_DOMAIN} 在该版本网页图中不存在 → 引用域数量为 0`)
  else if (!backlinks.referring.length) console.log('  节点存在但没有任何引用域')
  else for (const d of backlinks.referring) console.log(`  ${d}`)
}

// ---------------------------------------------------------------- 落盘

const outDir = path.join(root, '.workbuddy-ai/reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)

const md = []
md.push('# 站外权威度与引用域（Common Crawl 开放网页图）')
md.push('')
md.push(`- 采集时间：${new Date().toISOString()}`)
md.push(`- 版本：\`${RELEASE}\`｜模式：${MODE}`)
md.push('')
md.push('## 指标口径')
md.push('')
md.push('| 字段 | 来源 | 含义 |')
md.push('|---|---|---|')
md.push('| PageRank 排名 | `-domain-ranks` | Common Crawl 在域级全图上算出的 PageRank 位次，越小越强 |')
md.push('| harmonic centrality | `-domain-ranks` | 调和中心性值，越大越接近图中心 |')
md.push('| 子域数 | `-domain-vertices` 第 3 列 | 该 pay-level domain 下有多少个 host。⚠️ **不是入链数** |')
md.push('| Tranco | tranco-list.eu | 全球前 100 万排名，空 = 不在榜内 |')
md.push('')
md.push('**拿不到的**：锚文本、nofollow/rel 属性、页面级链接、Ahrefs DR / Moz DA 口径数值。')
md.push('Search Console 的「链接」报告也不在 API 中，只能人工看界面。')
md.push('')
md.push('## 对比表')
md.push('')
md.push('| 分组 | 域名 | PageRank 排名 | harmonic centrality | 子域数 | Tranco |')
md.push('|---|---|---|---|---|---|')
for (const r of rows.slice().sort((a, b) => (a.pagerank_pos ?? Infinity) - (b.pagerank_pos ?? Infinity))) {
  md.push(`| ${r.group} | ${r.domain} | ${n(r.pagerank_pos)} | ${n(r.harmonicc_val)} | ${n(r.n_hosts)} | ${r.tranco_rank ? '#' + n(r.tranco_rank) : '—'} |`)
}
md.push('')
if (backlinks) {
  md.push('## 指向本站的引用域')
  md.push('')
  if (!backlinks.referring.length) {
    md.push(backlinks.targetId ? '节点存在但没有任何引用域。' : `\`${OWN_DOMAIN}\` 在该版本网页图中不存在，引用域数量为 0。`)
  } else {
    for (const d of backlinks.referring) md.push(`- ${d}`)
  }
  md.push('')
}

const jsonPath = path.join(outDir, `external-authority-${stamp}.json`)
const mdPath = path.join(outDir, `external-authority-${stamp}.md`)
writeFileSync(jsonPath, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  release: RELEASE,
  mode: MODE,
  groups: GROUPS,
  rows,
  ranksScannedLines: ranks.lines,
  referringDomains: backlinks?.referring ?? null,
  targetNodeId: backlinks?.targetId ?? null,
  caveats: [
    'The third column of domain-vertices is the number of hosts, not in-degree.',
    'No anchor text, rel attributes or page-level links are available from this source.',
    'Values are not comparable to Ahrefs DR or Moz DA.',
  ],
}, null, 2))
writeFileSync(mdPath, md.join('\n'))
console.log(`\nJSON: ${path.relative(root, jsonPath)}`)
console.log(`报告: ${path.relative(root, mdPath)}`)
