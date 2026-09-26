/**
 * 把「商业词排名」的真实情况交给 Jev 判断。
 *
 * 事实全部从 GSC 原始 JSON 读取，不硬编码；同时把「新商业页面的发布时间晚于
 * 统计窗口」这一层事实一并交给它，避免它把「0 展示」误读为「失败」。
 *
 *   npm run commercial:jev
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadApiKey, callJev } from './seo-geo/jev.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const gscDir = path.join(root, '.seo-geo', 'gsc')
const latest = readdirSync(gscDir).filter((f) => f.endsWith('.json')).sort().pop()
const gsc = JSON.parse(readFileSync(path.join(gscDir, latest), 'utf8'))

const clean = (u) => String(u).replace(/^https?:\/\/djiluggage\.id/, '') || '/'
const BRAND = /dji|hiring|career|recruit/i

const commercialQueries = gsc.byQuery
  .filter((r) => !BRAND.test(r.keys[0]))
  .map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: Number(r.position.toFixed(1)) }))
  .sort((a, b) => a.position - b.position)

const commercialQueryPage = gsc.byQueryPage
  .filter((r) => !BRAND.test(r.keys[0]))
  .map((r) => ({ query: r.keys[0], page: clean(r.keys[1]), impressions: r.impressions, position: Number(r.position.toFixed(1)) }))
  .sort((a, b) => a.position - b.position)

const brandRows = gsc.byQuery.filter((r) => BRAND.test(r.keys[0]))
const brandImpressions = brandRows.reduce((n, r) => n + r.impressions, 0)

// 按主题把商业词归类，交给 Jev 时说明分类依据是查询措辞
const clusterOf = (q) => {
  const s = q.toLowerCase()
  if (/quality|testing|test\b|assurance|control/.test(s)) return 'quality_control_and_testing'
  if (/oem|odm|manufacturer|private label|exporter/.test(s)) return 'sourcing_and_manufacturing'
  if (/indonesia/.test(s)) return 'origin'
  return 'other'
}
const clusters = {}
for (const q of commercialQueries) {
  const c = clusterOf(q.query)
  clusters[c] ??= { queries: [], impressions: 0 }
  clusters[c].queries.push(q.query)
  clusters[c].impressions += q.impressions
}
for (const c of Object.values(clusters)) c.positions = commercialQueries.filter((q) => clusterOf(q.query) === c.queries[0] && false)

const commercialImpressions = commercialQueries.reduce((n, q) => n + q.impressions, 0)

const state = {
  site: {
    business:
      'DJI Luggage is an Indonesian luggage and suitcase factory in Bogor, West Java, selling to brands, importers and distributors. Minimum order 200 units per specification, lead time 25-55 days.',
    domain_age: 'The site has been live since about June 2026, so roughly four months.',
  },
  measurement: {
    window: gsc.range,
    totals: gsc.totals,
    page_count_with_impressions: gsc.byPage.length,
    query_count_with_impressions: gsc.byQuery.length,
    next_window_available: 'mid-to-late October 2026',
  },
  brand_collision: {
    note: 'Impressions from people searching for a different company.',
    impressions: brandImpressions,
    share_of_all_impressions: Number((brandImpressions / gsc.totals.impressions).toFixed(3)),
    queries: brandRows.map((r) => ({ query: r.keys[0], impressions: r.impressions, position: Number(r.position.toFixed(1)) })),
  },
  commercial_queries: {
    note: 'Every query in the window that is not brand-collision traffic. Each one appeared only once or twice.',
    impressions: commercialImpressions,
    clicks: commercialQueries.reduce((n, q) => n + q.clicks, 0),
    queries: commercialQueries,
    query_page: commercialQueryPage,
    clusters,
  },
  pages_published_after_the_window: {
    note:
      'These pages were written to serve exactly these commercial queries. Their file dates are 2026-09-26, after the window closed on 2026-09-23, and search console shows zero impressions for every one of them. Their performance is therefore not yet measured.',
    pages: [
      { path: '/services/luggage-oem/', words: 730, targets: 'OEM manufacturing queries' },
      { path: '/services/luggage-odm/', words: 622, targets: 'ODM manufacturing queries' },
      { path: '/services/private-label-luggage/', words: 659, targets: 'private label queries' },
      { path: '/products/pc-abs-luggage/', words: 439, targets: 'material queries' },
      { path: '/products/pp-luggage/', words: 428, targets: 'material queries' },
      { path: '/products/aluminum-frame-luggage/', words: 500, targets: 'aluminium frame queries' },
      { path: '/compliance/', words: 1735, targets: 'packaging, chemical and testing compliance' },
    ],
  },
  pages_that_did_receive_the_commercial_impressions: [
    { path: '/newsroom/quality-checks-in-suitcase-production/', words: 279, received: 'four quality-control queries' },
    { path: '/newsroom/choosing-the-right-luggage-manufacturer/', words: 1480, received: 'five testing, sourcing and exporter queries' },
    { path: '/newsroom/oem-vs-odm-for-luggage-brands/', words: 1384, received: 'two OEM/ODM queries' },
    { path: '/', words: 468, received: 'custom luggage manufacturer, indonesia luggage' },
  ],
}

const N = (instructions, criteria) => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) })
const LEVELS = [
  { what: 'No measurable effect on qualified buyer inquiries within 90 days' },
  { what: 'A small effect, hard to detect against normal variation' },
  { what: 'A modest effect that might show in search data within 90 days' },
  { what: 'A clear improvement in how the pages are matched to commercial queries' },
  { what: 'A change likely to produce a visible improvement in qualified buyer inquiries' },
]

const questions = {
  commercial_sample_is_usable: N(
    '`commercial_queries` holds every non-brand query in the window, and each appeared once or twice. Is that enough evidence to decide which commercial content to build next?',
    {
      true: { what: 'The queries point at a real content gap even at these volumes', examples: ['seven of twelve mention quality control or testing'] },
      false: { what: 'At one or two impressions each, the set is noise and cannot steer content decisions' },
    },
  ),
  testing_cluster_is_real: N(
    '`commercial_queries.clusters.quality_control_and_testing` collects the queries about quality control, assurance and third-party testing. Is that a real opportunity for this factory, or an artifact of a handful of impressions?',
    {
      true: { what: 'Testing and quality control is something buyers genuinely source for, and the factory can evidence it', examples: ['QB/T 2155-2018 drop, wheel, stacking and salt-spray tests'] },
      false: { what: 'The queries are too few and too scattered to indicate demand this factory can win' },
    },
  ),
  pages_postdate_window: N(
    'Given `pages_published_after_the_window`, is it correct that the commercial pages cannot be judged from this window, because they did not exist while it was being measured?',
    {
      true: { what: 'Zero impressions for those pages is expected, not evidence that they failed' },
      false: { what: 'The pages existed long enough that zero impressions already indicates a problem' },
    },
  ),
  rebuild_before_measuring: N(
    'Would building further commercial pages now, before the newly published ones have been measured, make the next reading harder to interpret?',
    {
      true: { what: 'Two overlapping changes would make it impossible to attribute any movement' },
      false: { what: 'Content additions are independent and can be read separately' },
    },
  ),
  quality_page_is_the_gap: N(
    'Is a dedicated quality-control and testing service page the clearest content gap, given that the queries already arriving are matched to a 279-word article and a compliance page about regulations?',
    {
      true: { what: 'Buyers are asking a service question and the site answers it with an article or a compliance page' },
      false: { what: 'The compliance page and the article already cover it well enough' },
    },
  ),
  head_terms_realistic: N(
    'Can a four-month-old factory site realistically compete in the near term for head commercial terms such as "custom luggage manufacturer", which currently sits at position 59?',
    {
      true: { what: 'Head terms are held by directories and long-established manufacturers, so a new domain will not reach them soon' },
      false: { what: 'The site can reach page one for head terms within a reasonable period of content work' },
    },
  ),

  commercial_priority: {
    type: 'choice',
    instructions: {
      question: 'What is the single best next move to raise commercial visibility?',
      focus: 'Weigh the content gap against the fact that the pages built for it are still unmeasured.',
      constraint: 'Assume roughly one week of work, and that the next search window opens in about three weeks.',
    },
    criteria: {
      build_quality_control_page: 'Publish a dedicated quality-control and third-party testing service page.',
      expand_compliance_page: 'Fold a quality-control service section into the existing compliance page instead of a new URL.',
      expand_thin_qc_article: 'Expand the 279-word quality-checks article into a substantial page.',
      wait_for_window: 'Ship nothing further and read the next window first.',
      strengthen_homepage: 'Focus on the homepage, which already ranks 2.0 for "indonesia luggage".',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },
  realistic_target: {
    type: 'choice',
    instructions: {
      question: 'Over the next six months, what should the site aim to rank for?',
      focus: 'Judge against a four-month-old domain in a category held by established factories and directories.',
      constraint: 'The owner would rather have a few qualified enquiries than traffic.',
    },
    criteria: {
      long_tail_specific: 'Specific, low-competition phrases such as "private label luggage testing" or "aluminium frame luggage manufacturer".',
      mid_tail: 'Mid-competition phrases such as "odm luggage manufacturer" or "luggage factory indonesia".',
      head_terms: 'Head phrases such as "custom luggage manufacturer" or "luggage manufacturer".',
      origin_led: 'Queries tied to Indonesian origin, where the homepage is already at position 2.0.',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },

  value__build_quality_control_page: { type: 'score', instructions: { question: 'How much would a dedicated quality-control and testing service page move qualified buyer inquiries within 90 days?', inspect: ['commercial_queries', 'pages_published_after_the_window'], focus: 'Judge effect on qualified buyer inquiries.' }, criteria: LEVELS },
  value__expand_compliance_page: { type: 'score', instructions: { question: 'How much would folding quality-control services into the existing compliance page move qualified buyer inquiries within 90 days?', inspect: ['commercial_queries'], focus: 'Judge effect on qualified buyer inquiries.' }, criteria: LEVELS },
  value__expand_thin_qc_article: { type: 'score', instructions: { question: 'How much would expanding the 279-word quality-checks article move qualified buyer inquiries within 90 days?', inspect: ['commercial_queries', 'pages_that_did_receive_the_commercial_impressions'], focus: 'Judge effect on qualified buyer inquiries.' }, criteria: LEVELS },
  value__wait_for_window: { type: 'score', instructions: { question: 'How much would waiting for the next search window, and shipping nothing further, move qualified buyer inquiries within 90 days?', inspect: ['measurement', 'pages_published_after_the_window'], focus: 'Judge effect on qualified buyer inquiries.' }, criteria: LEVELS },
}

const apiKey = loadApiKey()
console.log(`GSC 文件: ${latest}`)
console.log(`问题数: ${Object.keys(questions).length} · state ${JSON.stringify(state).length} 字符`)

const res = await callJev(apiKey, { state, questions, label: 'commercial-visibility' })
const a = res.answers ?? res
const model = res.model ?? '(未返回)'
const usage = res.usage ?? {}

const lines = []
const P = (s = '') => { lines.push(s); console.log(s) }
P(`# 商业词排名 — Jev 判断`)
P()
P(`生成时间：${new Date().toISOString()} · 模型：${model}`)
if (usage.input_tokens) P(`用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens ?? '?'} tokens`)
P()
P(`## 一、是/否判断（数值 = 「是」的概率）`)
P()
for (const [id, zh] of [
  ['commercial_sample_is_usable', '这 16 次商业展示够不够用来决定做什么内容'],
  ['testing_cluster_is_real', '测试/质检簇是真实机会还是少量展示的假象'],
  ['pages_postdate_window', '新商业页确实无法用本窗口评价'],
  ['rebuild_before_measuring', '现在就再建商业页会让下一次读数更难解释'],
  ['quality_page_is_the_gap', '专属质检服务页是最明显的内容缺口'],
  ['head_terms_realistic', '四个月的站能竞争 head 商业词'],
]) {
  const v = a[id]?.noul
  if (v == null) continue
  P(`- **${zh}**：\`${'█'.repeat(Math.round(v * 20)).padEnd(20, '·')}\` ${(v * 100).toFixed(0)}%`)
}
P()
P(`## 二、方案选择`)
P()
for (const [id, zh] of [['commercial_priority', '下一步该做什么'], ['realistic_target', '六个月的目标关键词层级']]) {
  const ans = a[id]
  if (!ans) continue
  P(`### ${zh}`)
  P()
  P(`**Jev 选择：\`${ans.choice}\`**（置信 ${(ans.confidence ?? 0).toFixed(2)}）`)
  P()
  for (const [opt, p] of Object.entries(ans.probabilities ?? {}).sort((x, y) => y[1] - x[1])) {
    if (p <= 0.001) continue
    P(`- \`${'█'.repeat(Math.round(p * 20)).padEnd(20, '·')}\` ${(p * 100).toFixed(0).padStart(3)}%  ${opt}`)
  }
  P()
}
P(`## 三、90 天价值打分（0-4，可比）`)
P()
for (const s of [
  ['value__build_quality_control_page', '新建质检服务页'],
  ['value__expand_compliance_page', '并入合规页'],
  ['value__expand_thin_qc_article', '扩写质检文章'],
  ['value__wait_for_window', '先等下一次数据'],
].map(([id, zh]) => ({ zh, score: a[id]?.score ?? 0, conf: a[id]?.confidence ?? 0 })).sort((x, y) => y.score - x.score)) {
  P(`- **${s.score.toFixed(2)}/4**（置信 ${s.conf.toFixed(2)}）  ${s.zh}`)
}
P()

const outDir = path.join(root, '.workbuddy-ai', 'reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
writeFileSync(path.join(outDir, `commercial-visibility-jev-${stamp}.md`), lines.join('\n') + '\n')
writeFileSync(path.join(outDir, `commercial-visibility-jev-${stamp}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), model, usage, state, answers: a }, null, 2))
console.log(`\n写入 .workbuddy-ai/reports/commercial-visibility-jev-${stamp}.md`)
