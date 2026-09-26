/**
 * 把 Google Search Console 数据交给 Jev（TypeSafe System One）判断下一步该做什么。
 *
 * 设计遵循 TypeSafe 的构建规范：
 *   - 代码负责事实：GSC 数字、内容长度、候选动作清单，全部由本地数据拼装
 *   - Jev 只负责判断：这些数字对「一个 B2B 买家是否可能下单」意味着什么
 *   - 所有问题**原子化**并放在**同一次请求**里并行评估（互不可见，不会互相污染）
 *   - 候选动作各问一个 Score，**共用同一套等级描述**，因此分数可直接横向比较排序
 *   - 代码再按概率、置信度组合排序，并标注置信度不足的项
 *
 * 用法：
 *   node scripts/gsc-to-jev.mjs                 # 用最新的 .seo-geo/gsc/*.json
 *   node scripts/gsc-to-jev.mjs <文件>          # 指定 GSC JSON
 *   node scripts/gsc-to-jev.mjs --repeat 2      # 重复评估，检查自洽性
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadApiKey, callJev } from './seo-geo/jev.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = process.argv.slice(2)
const repeatIdx = args.indexOf('--repeat')
const REPEAT = repeatIdx >= 0 ? Number(args[repeatIdx + 1] || 2) : 1
const fileArg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a))

// ---------------------------------------------------------------- 读 GSC 数据

function latestGscFile() {
  const dir = path.join(root, '.seo-geo/gsc')
  if (!existsSync(dir)) throw new Error('找不到 .seo-geo/gsc/，请先运行 npm run gsc')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) throw new Error('.seo-geo/gsc/ 里没有 JSON，请先运行 npm run gsc')
  return path.join(dir, files[files.length - 1])
}

const gscPath = fileArg ? path.resolve(root, fileArg) : latestGscFile()
const gsc = JSON.parse(readFileSync(gscPath, 'utf8'))

// 站内内容事实：文章正文词数（代码负责，不交给模型猜）
function newsroomWordCounts() {
  const dir = path.join(root, 'newsroom')
  const out = []
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name, 'index.html')
    if (!existsSync(file)) continue
    const html = readFileSync(file, 'utf8')
    if (!html.includes('<article class="article-body">')) continue
    const body = html.split('<article class="article-body">')[1].split('</article>')[0]
    const words = body.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').trim().split(/\s+/).filter(Boolean).length
    out.push({ slug: name, body_words: words })
  }
  return out
}

const stripOrigin = (u) => String(u).replace(/^https?:\/\/[^/]+/, '') || '/'

const state = {
  site: {
    domain: 'djiluggage.id',
    business: 'Indonesian B2B luggage manufacturer in Bogor, West Java. OEM and ODM hard-shell and soft-shell suitcases for brands, importers and distributors.',
    brand_note: 'The site is branded "DJI Luggage". "DJI" is also the widely known drone manufacturer (Da-Jiang Innovations).',
    commercial_terms: 'MOQ 200 units, lead time 25-55 days, monthly capacity 30,000 units, two 1,500-tonne injection machines, 100% in-house moulds, ships to China, Indonesia, Australia and Germany.',
    export_markets: ['China', 'Indonesia', 'Australia', 'Germany'],
  },
  measurement_window: {
    start: gsc.range?.startDate,
    end: gsc.range?.endDate,
    note: 'This window ends before the site changes shipped on 2026-09-25 and 2026-09-26, so it is a pre-change baseline.',
  },
  totals: {
    clicks: gsc.totals?.clicks ?? 0,
    impressions: gsc.totals?.impressions ?? 0,
    ctr: Number((gsc.totals?.ctr ?? 0).toFixed(4)),
    average_position: Number((gsc.totals?.position ?? 0).toFixed(1)),
  },
  queries: (gsc.byQuery || []).map((r) => ({
    query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Number(r.position.toFixed(1)),
  })),
  pages: (gsc.byPage || []).map((r) => ({
    page: stripOrigin(r.keys[0]), clicks: r.clicks, impressions: r.impressions, position: Number(r.position.toFixed(1)),
  })),
  query_page: (gsc.byQueryPage || []).map((r) => ({
    query: r.keys[0], page: stripOrigin(r.keys[1]), clicks: r.clicks, impressions: r.impressions, position: Number(r.position.toFixed(1)),
  })),
  countries: (gsc.byCountry || []).map((r) => ({ country: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
  devices: (gsc.byDevice || []).map((r) => ({ device: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
  site_content: {
    newsroom_articles: newsroomWordCounts(),
    note: 'Every newsroom article is the same near-identical length; they differ mostly by slug and headings.',
  },
  already_shipped: [
    'llms.txt for AI answer engines',
    'AI crawler policy in robots.txt',
    'Product pages renamed away from "Full Aluminum" to "Zipperless Aluminum Frame"',
    '134-167 word fact-dense answer blocks added to home, about, services, process, contact, products',
    'Schema fix for 21 product pages, and h1-h3 heading skips fixed site-wide',
    'Sitemap regenerated with fresh lastmod dates',
  ],
}

// ---------------------------------------------------------------- 候选动作

const ACTIONS = {
  expand_oem_vs_odm_article: 'Expand /newsroom/oem-vs-odm-for-luggage-brands/ from 177 words to 1,200+ words using the confirmed factory facts.',
  expand_quality_checks_article: 'Expand /newsroom/quality-checks-in-suitcase-production/ to 1,200+ words with concrete test standards and numbers.',
  expand_choosing_manufacturer_article: 'Expand /newsroom/choosing-the-right-luggage-manufacturer/ to 1,200+ words with concrete evaluation criteria.',
  strengthen_homepage_indonesia: 'Strengthen the homepage around the Indonesia-manufacturer topic, where it already ranks 2.0 for "indonesia luggage".',
  rewrite_remaining_articles: 'Rewrite the remaining five 177-word newsroom articles to 1,200+ words each.',
  optimize_careers_for_brand_query: 'Optimise /careers/ further for the "dji hiring" query that produces 455 impressions and zero clicks.',
  clarify_brand_disambiguation: 'Add explicit on-site text clarifying that DJI Luggage is a luggage manufacturer, not the drone company, to reduce mismatched traffic.',
  build_offsite_authority: 'Work on off-site authority such as supplier directories, industry listings and backlinks.',
  build_product_line_pages: 'Consolidate the 21 near-duplicate product colour pages into product-line pages, as previously planned.',
  stop_and_measure: 'Change nothing further and wait for the next Search Console window to measure the shipped changes.',
}

// 所有候选动作共用同一套等级描述，分数才能横向比较
const IMPACT_LEVELS = [
  {
    what: 'Could actively harm qualified B2B inquiries',
    signals: ['attracts or reinforces the wrong audience', 'dilutes topical focus', 'makes the site look less like a manufacturer'],
  },
  {
    what: 'No meaningful change in qualified B2B inquiries',
    signals: ['the work does not touch any query or page that a buyer could reach'],
  },
  {
    what: 'Marginal or unproven effect',
    signals: ['plausible but indirect', 'depends on factors outside this work', 'too early or too small to move rankings'],
  },
  {
    what: 'Moderate, likely effect on qualified inquiries',
    signals: ['targets a page already associated with commercial queries', 'addresses a specific diagnosed weakness'],
  },
  {
    what: 'Strong, direct effect on qualified inquiries',
    signals: ['targets a page close to page one for a query a buyer would actually type', 'removes a blocker that explains current positions'],
  },
]

const N = (instructions, criteria) => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) })

const questions = {
  // --- 诊断：这批数字到底意味着什么 ---
  traffic_is_wrong_audience: N(
    'Do `queries` and `query_page` indicate that the large impression counts for "dji hiring", "dji career" and "dji recruitment" come from people looking for a different company than `site.business`?',
    {
      true: { what: 'The searchers most likely want the drone company or another employer, not a luggage manufacturer', examples: ['455 impressions from Indonesia for "dji hiring" with zero clicks'] },
      false: { what: 'The searchers plausibly want DJI Luggage itself', not_for: 'Traffic that merely lands on the careers page' },
    },
  ),
  totals_overstate_visibility: N(
    'Do `totals` overstate how commercially visible `site` is, once `queries` and `query_page` are taken into account?',
    {
      true: { what: 'The headline totals are dominated by impressions of little commercial value', examples: ['590 impressions and position 11.2 driven by "dji hiring"'] },
      false: { what: 'The headline totals fairly represent commercial visibility' },
    },
  ),
  commercial_queries_have_buyer_intent: N(
    'Do the non-brand queries in `query_page` such as "custom luggage manufacturer", "odm luggage manufacturer" and "private label luggage testing" express B2B sourcing intent from someone who could place a manufacturing order?',
    {
      true: { what: 'A brand, importer or sourcing manager could plausibly type this while looking for a factory', examples: ['custom luggage manufacturer', 'private label luggage testing'] },
      false: { what: 'The searcher is a consumer or is looking for something else', not_for: 'Job-seeker queries' },
    },
  ),
  thin_content_explains_positions: N(
    'Given `site_content.newsroom_articles` shows every article at the same short length, and `query_page` shows those same articles ranking between position 70 and 93 for commercial queries, is thin content the primary explanation for those positions?',
    {
      true: { what: 'The pages are relevant enough to be matched but too thin to rank well', examples: ['177-word article at position 84 for "luggage quality assurance"'] },
      false: { what: 'Thin content is not the main reason; authority, competition or intent fit matter more' },
    },
  ),
  indonesia_signal_is_real: N(
    'Does `query_page` show the homepage at position 2.0 for "indonesia luggage", and does that indicate the site can realistically compete for Indonesia-focused commercial queries?',
    {
      true: { what: 'The site already ranks near the top for an Indonesia-relevant commercial query', examples: ['position 2.0 for "indonesia luggage"'] },
      false: { what: 'The single impression makes this signal too weak to act on' },
    },
  ),
  articles_cannibalise: N(
    'Do the eight near-identical newsroom articles in `site_content.newsroom_articles` compete with one another for the same commercial queries rather than each owning a distinct topic?',
    {
      true: { what: 'Several articles cover overlapping ground and split relevance', examples: ['two articles both matched to third-party testing queries'] },
      false: { what: 'Each article targets a genuinely distinct topic and does not overlap' },
    },
  ),
  product_pages_dilute_or_help: N(
    'Given `pages` shows product URLs attracting very few impressions while the newsroom attracts more, are the 21 near-duplicate colour product pages a meaningful drag on the site right now?',
    {
      true: { what: 'They materially dilute crawl focus or relevance', examples: ['21 colour variants of four products'] },
      false: { what: 'They are not a meaningful drag compared with the content problems', not_for: 'Any page that simply gets few impressions' },
    },
  ),
  brand_name_is_a_constraint: N(
    'Does `site.brand_note` describe a brand-name collision serious enough that it constrains how buyers and search engines interpret this site as a luggage manufacturer?',
    {
      true: { what: 'The DJI name meaningfully interferes with being understood as a luggage maker', examples: ['searchers expecting a drone company'] },
      false: { what: 'The collision only affects job-seeker traffic and not buyer understanding' },
    },
  ),

  // --- 候选动作各自打分（共用等级，可横向比较）---
  ...Object.fromEntries(Object.entries(ACTIONS).map(([id, description]) => [
    `impact__${id}`,
    {
      type: 'score',
      instructions: {
        question: 'If `action` is carried out, what effect would it have on qualified B2B inquiries reaching `site` within about three months?',
        action: description,
        inspect: ['`totals`', '`queries`', '`pages`', '`query_page`', '`site_content`', '`already_shipped`'],
        focus: 'Judge effect on qualified buyer inquiries, not on total impressions or rankings for their own sake.',
      },
      criteria: IMPACT_LEVELS,
    },
  ])),

  // --- 单一最高杠杆动作 ---
  next_action: {
    type: 'choice',
    instructions: {
      question: 'Which single action should be done next, before any of the others?',
      focus: 'Pick the one with the best expected effect per unit of effort, given the evidence in `query_page` and `pages`.',
      constraint: 'Assume the site owner can only commit roughly one week of work before the next measurement.',
    },
    criteria: ACTIONS,
  },
  workstream_priority: {
    type: 'choice',
    instructions: {
      question: 'Over the next 30 days, which class of work should dominate?',
      focus: 'Choose the category most likely to produce qualified buyer inquiries.',
    },
    criteria: {
      deepen_existing_content: 'Expand the thin pages that are already matched to commercial queries.',
      add_new_topics: 'Publish additional pages for commercial queries the site does not yet address at all.',
      offsite_authority: 'Build off-site signals: directories, listings, links, industry references.',
      technical_and_schema: 'Further technical and structured-data work.',
      ai_answer_visibility: 'Work aimed at AI answer engines and generative visibility rather than classic search.',
      brand_and_positioning: 'Address how the business names and positions itself, including the brand-name collision.',
    },
  },
  measurement_in_2_weeks: N(
    'Given `measurement_window` ends before the shipped changes, would a new Search Console pull about two weeks after those changes be informative enough to judge whether they worked?',
    {
      true: { what: 'Two weeks is enough to see a direction on these queries' },
      false: { what: 'The data would still be too noisy or too early; a longer wait is needed', not_for: 'Waiting simply because it is cautious' },
    },
  ),
  expects_quick_win: N(
    'Do `queries` and `query_page` suggest that any single content change could produce a noticeable jump in clicks within three months?',
    {
      true: { what: 'The site is close enough on some commercial query that one strong page could break through', examples: ['a page at position 32 that already gets 53 impressions'] },
      false: { what: 'Positions are too far from page one for one change to matter', not_for: 'Believing growth requires many months regardless of evidence' },
    },
  ),
}

// ---------------------------------------------------------------- 调用

const apiKey = loadApiKey()

async function runOnce(label) {
  const res = await callJev(apiKey, { state, questions, label })
  return res
}

console.log(`GSC 数据: ${path.relative(root, gscPath)}`)
console.log(`区间: ${state.measurement_window.start} → ${state.measurement_window.end}`)
console.log(`问题数: ${Object.keys(questions).length}（含 ${Object.keys(ACTIONS).length} 个候选动作打分）`)
console.log(`调用 ${REPEAT} 次...\n`)

const runs = []
for (let i = 0; i < REPEAT; i++) {
  runs.push(await runOnce(`第 ${i + 1} 次`))
  if (i < REPEAT - 1) await new Promise((r) => setTimeout(r, 800))
}

const a = runs[0].answers
const pctFmt = (p) => `${(p * 100).toFixed(0)}%`
const bar = (p, w = 20) => '█'.repeat(Math.round(p * w)).padEnd(w, '·')

// --- 诊断 ---
console.log('════════ 一、Jev 对这批数据的诊断（Noul：概率即「是」的可能性）════════')
const DIAGNOSTIC = [
  ['traffic_is_wrong_audience', 'dji hiring 那批流量来自想找别家公司的人'],
  ['totals_overstate_visibility', '总曝光/平均排名高估了真实商业可见度'],
  ['commercial_queries_have_buyer_intent', '商业类查询确实是买家在找工厂'],
  ['thin_content_explains_positions', '内容太薄是排名 70-93 的主因'],
  ['indonesia_signal_is_real', '「indonesia luggage 排第 2」是可用信号'],
  ['articles_cannibalise', '8 篇同质文章在互相蚕食'],
  ['product_pages_dilute_or_help', '21 个颜色页构成实质拖累'],
  ['brand_name_is_a_constraint', 'DJI 撞名构成品牌层面约束'],
  ['measurement_in_2_weeks', '改后 2 周拉数就足以判断'],
  ['expects_quick_win', '存在可短期突破的单点'],
]
for (const [id, zh] of DIAGNOSTIC) {
  const v = a[id]?.noul ?? 0
  console.log(`  ${bar(v)} ${pctFmt(v).padStart(4)}  ${zh}`)
}

// --- 候选动作排序 ---
console.log('\n════════ 二、候选动作排序（Score 0-4，共用等级因此可比）════════')
const scored = Object.keys(ACTIONS).map((id) => {
  const ans = a[`impact__${id}`]
  return { id, action: ACTIONS[id], score: ans?.score ?? 0, confidence: ans?.confidence ?? 0, probs: ans?.probabilities }
}).sort((x, y) => y.score - x.score)

for (const s of scored) {
  const flag = s.confidence < 0.5 ? '  ⚠ 低置信' : s.confidence < 0.8 ? '  · 中置信' : '  ✓ 高置信'
  console.log(`  ${s.score.toFixed(2)}/4  置信 ${s.confidence.toFixed(2)}${flag}`)
  console.log(`         ${s.id}`)
  console.log(`         ${s.action.slice(0, 96)}`)
}

// --- Choice 结果 ---
console.log('\n════════ 三、Jev 选的「下一步」（Choice + 概率分布）════════')
for (const [id, zh] of [['next_action', '单一最高杠杆动作'], ['workstream_priority', '未来 30 天的重心']]) {
  const ans = a[id]
  if (!ans) continue
  console.log(`\n  【${zh}】→ ${ans.choice}   （置信 ${ans.confidence.toFixed(2)}）`)
  for (const [opt, p] of Object.entries(ans.probabilities).sort((x, y) => y[1] - x[1])) {
    if (p <= 0.001) continue
    console.log(`      ${bar(p, 16)} ${pctFmt(p).padStart(4)}  ${opt}`)
  }
}

// --- 自洽性 ---
let stableCount = 0
let totalQ = 0
const unstable = []
if (runs.length > 1) {
  console.log('\n════════ 四、自洽性检查（重复评估）════════')
  for (const id of Object.keys(questions)) {
    const vals = runs.map((r) => {
      const ans = r.answers[id]
      return ans?.type === 'noul' ? ans.noul : ans?.type === 'score' ? ans.score : ans?.choice
    })
    totalQ++
    const stable = typeof vals[0] === 'number' ? Math.abs(Math.max(...vals) - Math.min(...vals)) <= 0.35 : new Set(vals).size === 1
    if (stable) stableCount++
    else {
      unstable.push(id)
      console.log(`  ⚠ 不稳定 ${id}: ${vals.map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join('  vs  ')}`)
    }
  }
  console.log(`  稳定 ${stableCount}/${totalQ}（数值项容差 0.35，类别项要求完全一致）`)
}

// --- 落盘 ---
const outDir = path.join(root, '.workbuddy-ai/reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)

// Markdown 版本，便于人工阅读与逐次对比
const md = []
md.push('# Jev 对 GSC 数据的判断')
md.push('')
md.push(`- 数据源：\`${path.relative(root, gscPath)}\``)
md.push(`- 区间：**${state.measurement_window.start} → ${state.measurement_window.end}**`)
md.push(`- 模型：\`${runs[0].model}\`｜评估次数：${runs.length}`)
md.push(`- 评估时间：${new Date().toISOString()}`)
md.push('')
md.push('## 一、诊断（Noul，数值为「是」的概率）')
md.push('')
md.push('| 判断 | 概率 | 含义 |')
md.push('|---|---|---|')
for (const [id, zh] of DIAGNOSTIC) md.push(`| \`${id}\` | ${pctFmt(a[id]?.noul ?? 0)} | ${zh} |`)
md.push('')
md.push('## 二、候选动作排序（Score 0–4，共用等级故可比）')
md.push('')
md.push('| 排名 | 分数 | 置信 | 动作 | 说明 |')
md.push('|---|---|---|---|---|')
scored.forEach((s, i) => md.push(`| ${i + 1} | ${s.score.toFixed(2)} | ${s.confidence.toFixed(2)} | \`${s.id}\` | ${s.action.replace(/\|/g, '\\|')} |`))
md.push('')
md.push('## 三、Choice 结果（含概率分布）')
md.push('')
for (const [id, zh] of [['next_action', '单一最高杠杆动作'], ['workstream_priority', '未来 30 天重心']]) {
  const ans = a[id]
  if (!ans) continue
  md.push(`### ${zh} → \`${ans.choice}\`（置信 ${ans.confidence.toFixed(2)}）`)
  md.push('')
  md.push('| 选项 | 概率 |')
  md.push('|---|---|')
  for (const [opt, p] of Object.entries(ans.probabilities).sort((x, y) => y[1] - x[1])) {
    if (p <= 0.001) continue
    md.push(`| \`${opt}\` | ${pctFmt(p)} |`)
  }
  md.push('')
}
if (runs.length > 1) {
  md.push('## 四、自洽性')
  md.push('')
  md.push(`重复评估 ${runs.length} 次，**${stableCount}/${totalQ}** 项判定一致（数值项容差 0.35，类别项要求完全一致）。`)
  if (unstable.length) {
    md.push('')
    md.push(`不稳定的项：${unstable.map((u) => `\`${u}\``).join('、')}`)
  }
  md.push('')
}
md.push('## 五、交给 Jev 的事实状态')
md.push('')
md.push('```json')
md.push(JSON.stringify(state, null, 2))
md.push('```')

const jsonPath = path.join(outDir, `gsc-jev-judgment-${stamp}.json`)
const mdPath = path.join(outDir, `gsc-jev-judgment-${stamp}.md`)
writeFileSync(jsonPath, JSON.stringify({
  gscSource: path.relative(root, gscPath),
  model: runs[0].model,
  judgedAt: new Date().toISOString(),
  state,
  questions,
  runs: runs.map((r) => ({ answers: r.answers, usage: r.usage })),
}, null, 2))
writeFileSync(mdPath, md.join('\n'))

const usage = runs.reduce((acc, r) => ({
  input_tokens: acc.input_tokens + (r.usage?.input_tokens || 0),
  output_tokens: acc.output_tokens + (r.usage?.output_tokens || 0),
}), { input_tokens: 0, output_tokens: 0 })
console.log(`\n模型: ${runs[0].model} | 累计 ${usage.input_tokens} 输入 / ${usage.output_tokens} 输出 tokens`)
console.log(`完整结果: ${path.relative(root, jsonPath)}`)
console.log(`可读报告: ${path.relative(root, mdPath)}`)
