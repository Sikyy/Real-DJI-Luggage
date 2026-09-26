/**
 * 把「剩下三项内容工作」的事实交给 Jev 判断。
 *
 * 设计遵循 TypeSafe 的构建规范：代码负责事实（从仓库里确定性抽取），
 * Jev 只负责「这对买家 / 对搜索意味着什么」的判断。所有问题放在一次请求里
 * 批量提问 —— 并行问题更便宜也更快。
 *
 *   npm run remaining:jev
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadApiKey, callJev } from './seo-geo/jev.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const SITE = 'https://djiluggage.id'

/* ---------------------------------------------------------------- 事实抽取 */

const read = (p) => readFileSync(path.join(root, p), 'utf8')
const txt = (t, re, i = 1) => {
  const m = t.match(re)
  return m ? m[i].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null
}
const wordCount = (t) =>
  t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/).filter(Boolean).length

function pageFacts(rel) {
  const t = read(rel)
  return {
    path: '/' + rel.replace(/index\.html$/, ''),
    title: txt(t, /<title>([\s\S]*?)<\/title>/),
    h1: txt(t, /<h1[^>]*>([\s\S]*?)<\/h1>/),
    words: wordCount(t),
    canonical: (t.match(/rel="canonical" href="([^"]*)"/) || [, null])[1],
  }
}

const newsroomPages = [
  'newsroom/index.html',
  'newsroom/filters/all/index.html',
  'newsroom/filters/insights/index.html',
  'newsroom/filters/news/index.html',
].map(pageFacts)

const colourPages = [
  'products/roaming-all-aluminum-zipperless-luggage-grey-1/index.html',
  'products/roaming-all-aluminum-zipperless-luggage-grey-copy/index.html',
  'products/roaming-all-aluminum-zipperless-luggage-silver-black-copy/index.html',
  'products/roaming-all-aluminum-zipperless-luggage-silver-copy/index.html',
].map(pageFacts)

// 上一步 Jev 判断的产物（相似度与聚类）
const findingsPath = path.join(root, '.seo-geo', 'site', 'findings.json')
const findings = existsSync(findingsPath) ? JSON.parse(readFileSync(findingsPath, 'utf8')) : null
const groups = findings?.cannibal?.groups ?? []
const groupFor = (needle) => groups.find((g) => g.members.some((m) => m.includes(needle))) ?? null

const linkCandidates = (findings?.linkCandidates ?? []).slice(0, 10).map((c) => ({
  from: c.from,
  to: c.to,
  anchor: c.anchor ?? c.anchorText ?? null,
  worth: c.worth ?? null,
}))

// 站内入链：/newsroom/ 是否真的孤立
const htmlFiles = ['index.html', 'about/index.html', 'services/index.html', 'products/index.html']
const inboundToNewsroom = htmlFiles.filter((f) => /href="\/newsroom\/"/.test(read(f))).length
const footerInsightsTarget = (read('index.html').match(/href="(\/newsroom[^"]*)"[^>]*>\s*INSIGHTS/i) || [, null])[1]

const state = {
  site: {
    business:
      'DJI Luggage is an Indonesian luggage and suitcase factory in Bogor, West Java. It manufactures for brands, importers and distributors. Minimum order 200 units per specification.',
    pages_indexed: 51,
    just_completed:
      'Internal URLs were normalised to one trailing-slash form. No dead links remain and all 48 internal page links return 200 with no redirects.',
  },
  measurement: {
    last_search_console_window: '27 Aug - 23 Sep 2026: 5 clicks, 590 impressions, CTR 0.85%, average position 11.2',
    note: '78.5% of impressions came from people searching for a different company ("dji hiring", "dji career"), landing on /careers/ with zero clicks. Commercial queries produced about 16 impressions at positions 47-93.',
    next_window_available: 'mid-to-late October 2026',
    owner_capacity: 'roughly one week of work before the next measurement',
  },
  newsroom_group: {
    note:
      'Four pages that render the same article listing. All four declare the same canonical, so search engines already treat them as one page.',
    pages: newsroomPages,
    inbound_internal_links_to_newsroom_index: inboundToNewsroom,
    footer_insights_link_points_to: footerInsightsTarget,
    earlier_jev_judgment: groupFor('filters/all')
      ? {
          action: groupFor('filters/all').action,
          confidence: groupFor('filters/all').actionConfidence,
          max_similarity: groupFor('filters/all').maxSim,
          members: groupFor('filters/all').members,
        }
      : null,
  },
  colour_variant_group: {
    note:
      'Four pages for one product line (Voyager Zipperless Aluminum Frame Carry-On, 24 inch), one page per colourway. The slug names are legacy misnames and do not match the colour on the page. The body copy is identical across all four; only the colour word differs.',
    pages: colourPages.map((p, i) => ({
      ...p,
      colour_on_page: ['Grey', 'Silver', 'Black', 'Black Silver'][i],
      slug_implies: ['grey', 'grey', 'silver-black', 'silver'],
    })),
    owner_constraint: 'The owner requires existing URLs to be preserved, so slugs cannot simply be renamed.',
    earlier_jev_judgment: groupFor('silver-black-copy')
      ? {
          action: groupFor('silver-black-copy').action,
          confidence: groupFor('silver-black-copy').actionConfidence,
          max_similarity: groupFor('silver-black-copy').maxSim,
          members: groupFor('silver-black-copy').members,
        }
      : null,
  },
  internal_link_candidates: {
    count: findings?.linkCandidates?.length ?? null,
    note:
      'Pairs an earlier Jev pass judged worth linking, with an anchor text suggestion for each. Examples below.',
    examples: linkCandidates,
  },
}

/* ---------------------------------------------------------------- 问题 */

const N = (instructions, criteria) => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) })

// Score 的等级必须是数组：索引即分值，0 = 最低
const LEVELS = [
  { what: 'No measurable effect on qualified buyer inquiries within 90 days', signals: ['does not touch a page or query a buyer could reach'] },
  { what: 'A small effect, hard to detect against normal variation', signals: ['only affects pages with no commercial queries'] },
  { what: 'A modest effect that might show in search data within 90 days', signals: ['improves pages that already receive some impressions'] },
  { what: 'A clear improvement in how the pages are matched to commercial queries', signals: ['targets pages a sourcing buyer would plausibly search for'] },
  { what: 'A change likely to produce a visible improvement in qualified buyer inquiries', signals: ['removes a real obstacle between a buyer and an enquiry'] },
]

const questions = {
  // ---------- newsroom 组 ----------
  filters_serve_distinct_need: N(
    'Looking at `newsroom_group.pages`, do the three /newsroom/filters/* pages give a visitor anything that `/newsroom/` does not?',
    {
      true: { what: 'A filter page shows a genuinely different, useful subset', examples: ['a page showing only hiring news'] },
      false: { what: 'They show the same listing as /newsroom/ under a different URL', examples: ['/newsroom/filters/all is byte-comparable to /newsroom/'] },
    },
  ),
  newsroom_orphan_matters: N(
    '`newsroom_group` shows /newsroom/ receives no internal links (`inbound_internal_links_to_newsroom_index`), while the footer INSIGHTS link points at /newsroom/filters/all/. Is that a problem worth fixing?',
    {
      true: { what: 'The page a buyer would consider authoritative for the article index is not reachable from site navigation' },
      false: { what: 'Since the filter pages canonicalise to /newsroom/, the distinction does not matter in practice' },
    },
  ),
  // ---------- 颜色变体组 ----------
  colour_pages_are_distinct_products: N(
    'Given `colour_variant_group.pages`, are these four pages distinct sellable colourways, rather than one product duplicated four times?',
    {
      true: { what: 'A buyer could reasonably want one specific colour and not the others', examples: ['a page whose title is the Black variant'] },
      false: { what: 'They are the same offer repeated, and the colour word is the only difference that matters to a buyer' },
      not_for: 'Deciding whether the body copy should differ',
    },
  ),
  merging_colour_pages_loses_products: N(
    'If the four pages in `colour_variant_group` were merged into a single page, would the site lose products a buyer might otherwise have found?',
    {
      true: { what: 'Colour availability is a real purchase criterion, so merging removes discoverable options' },
      false: { what: 'One page covering all colours serves the buyer just as well' },
    },
  ),
  identical_copy_is_problem: N(
    'The four colour pages carry identical body copy (`words` is 854-856 on each). Is that shared copy a duplicate-content problem worth fixing?',
    {
      true: { what: 'Four pages competing on the same text are weaker than four pages that each say something specific about their colourway' },
      false: { what: 'Colour variant pages are expected to share copy, and the canonical/parent structure handles it' },
    },
  ),
  // ---------- 内链 ----------
  internal_links_worth_now: N(
    '`internal_link_candidates` holds pairs a previous pass judged worth linking, each with an anchor suggestion. Is acting on them worth a week of the owner\'s time right now?',
    {
      true: { what: 'Internal linking is cheap and compounds with the pages already published', examples: ['linking an OEM vs ODM article to the OEM and ODM service pages'] },
      false: { what: 'The effect is too small, or other work has a better return first' },
    },
  ),
  all_candidates_look_manipulative: N(
    'Would adding every pair in `internal_link_candidates` at once read as manipulative or spammy to a search engine or to a buyer?',
    {
      true: { what: 'Adding that many links in one pass, especially between near-identical pages, looks engineered' },
      false: { what: 'Adding them is normal editorial practice at this scale' },
    },
  ),
  // ---------- 时机 ----------
  wait_for_measurement: N(
    'Given `measurement` (the last Search Console window was before the recent URL and CTA work, and the next window is mid-to-late October), should the remaining content work wait for that data?',
    {
      true: { what: 'Acting now would confuse the reading of changes already shipped, so waiting has real value' },
      false: { what: 'These edits are independent of what the next window would show, so waiting costs time for little gain' },
    },
  ),

  // ---------- Choice ----------
  newsroom_consolidation: {
    type: 'choice',
    instructions: {
      question: 'What should happen to the newsroom listing pages?',
      focus: 'The four pages in `newsroom_group` render the same listing and share one canonical.',
      constraint: 'The owner wants buyers to reach the article index from the footer, and wants no page to 404.',
    },
    criteria: {
      keep_newsroom_redirect_filters: 'Keep /newsroom/ as the only listing and 301 the three filter URLs to it.',
      keep_filters_all_redirect_newsroom: 'Treat /newsroom/filters/all/ as the listing, point the footer there, and 301 /newsroom/ to it.',
      make_filters_real: 'Keep all four but give each filter page genuinely different content for its category.',
      keep_all_unchanged: 'Leave the four pages as they are; the shared canonical is enough.',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },
  colour_page_action: {
    type: 'choice',
    instructions: {
      question: 'What should happen to the four colour-variant product pages?',
      focus: 'Same product line, four colourways, identical body copy, legacy slug names that do not match the colour.',
      constraint: '`colour_variant_group.owner_constraint` forbids renaming URLs without a redirect.',
    },
    criteria: {
      keep_urls_differentiate_copy: 'Keep every URL and rewrite the body so each colourway page says something of its own.',
      keep_urls_add_spec_table: 'Keep every URL and add the per-colour specification and ordering detail that is currently missing.',
      merge_into_one_page: 'Consolidate to one page and 301 the other three.',
      rename_slugs_with_redirects: 'Rename the misleading slugs and redirect the old URLs to the new ones.',
      leave_unchanged: 'Do nothing; colour variants sharing copy is acceptable.',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },
  link_scope: {
    type: 'choice',
    instructions: {
      question: 'If internal links are added, how many of the candidates should be used?',
      focus: 'Weigh the value of the links against the risk of the pass looking engineered.',
      constraint: 'Assume the owner can spend at most a few hours on this.',
    },
    criteria: {
      all_candidates: 'Add every pair suggested.',
      top_by_worth: 'Add only the highest-value pairs, roughly the top quarter.',
      hub_to_article_only: 'Add only links that connect an article to the service or product page it explains.',
      none: 'Skip internal linking for now.',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },
  next_item: {
    type: 'choice',
    instructions: {
      question: 'Of the work still outstanding, which single item should be done first?',
      focus: 'Pick the one with the best expected effect per unit of effort, given `measurement`.',
      constraint: 'Assume roughly one week of work before the next measurement.',
    },
    criteria: {
      newsroom_consolidation: 'Resolve the four duplicate listing pages.',
      colour_copy_differentiation: 'Make the four colour pages distinct or add their missing specification detail.',
      internal_links: 'Add the suggested internal links.',
      measure_first: 'Ship nothing further and wait for the next Search Console window.',
      uncertain: 'The evidence does not support one of these over the others.',
    },
  },

  // ---------- 可比的价值打分（共用等级，因此可以横向排序）----------
  value__newsroom_consolidation: { type: 'score', instructions: { question: 'How much would resolving the duplicate newsroom listing pages move qualified buyer inquiries in the next 90 days?', inspect: ['newsroom_group', 'measurement'], focus: 'Judge effect on qualified buyer inquiries, not on tidiness.' }, criteria: LEVELS },
  value__colour_copy: { type: 'score', instructions: { question: 'How much would differentiating the four colour-variant product pages move qualified buyer inquiries in the next 90 days?', inspect: ['colour_variant_group', 'measurement'], focus: 'Judge effect on qualified buyer inquiries, not on tidiness.' }, criteria: LEVELS },
  value__internal_links: { type: 'score', instructions: { question: 'How much would adding the suggested internal links move qualified buyer inquiries in the next 90 days?', inspect: ['internal_link_candidates', 'measurement'], focus: 'Judge effect on qualified buyer inquiries, not on tidiness.' }, criteria: LEVELS },
  value__measure_first: { type: 'score', instructions: { question: 'How much would waiting for the next Search Console window, and shipping nothing further, move qualified buyer inquiries in the next 90 days?', inspect: ['measurement'], focus: 'Judge effect on qualified buyer inquiries, not on tidiness.' }, criteria: LEVELS },
}

/* ---------------------------------------------------------------- 调用 */

const apiKey = loadApiKey()
console.log(`问题数: ${Object.keys(questions).length}`)
console.log('state 规模:', JSON.stringify(state).length, '字符')

const res = await callJev(apiKey, { state, questions, label: 'remaining-items' })
const a = res.answers ?? res
const model = res.model ?? '(未返回)'
const usage = res.usage ?? {}

/* ---------------------------------------------------------------- 输出 */

const lines = []
const P = (s = '') => { lines.push(s); console.log(s) }

P(`# 剩余内容工作 — Jev 判断`)
P()
P(`生成时间：${new Date().toISOString()} · 模型：${model}`)
if (usage.input_tokens) P(`用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens ?? '?'} tokens`)
P()

P(`## 一、是/否判断（Noul，数值 = 「是」的概率）`)
P()
const NOULS = [
  ['filters_serve_distinct_need', '过滤页是否提供了 /newsroom/ 没有的东西'],
  ['newsroom_orphan_matters', '「/newsroom/ 无入链而页脚指向 filters/all」是否值得修'],
  ['colour_pages_are_distinct_products', '四个颜色页是否为不同可售款式'],
  ['merging_colour_pages_loses_products', '合并颜色页是否会丢掉产品'],
  ['identical_copy_is_problem', '四页正文完全相同是否是值得修的重复内容问题'],
  ['internal_links_worth_now', '现在做内链是否值得'],
  ['all_candidates_look_manipulative', '一次性加满所有内链是否显得刻意'],
  ['wait_for_measurement', '剩余内容工作是否应等下一次 GSC 数据'],
]
for (const [id, zh] of NOULS) {
  const v = a[id]?.noul
  if (v == null) continue
  const bar = '█'.repeat(Math.round(v * 20)).padEnd(20, '·')
  P(`- **${zh}**：\`${bar}\` ${(v * 100).toFixed(0)}%`)
}
P()

P(`## 二、方案选择（Choice，含概率分布）`)
P()
for (const [id, zh] of [
  ['newsroom_consolidation', 'newsroom 四个列表页怎么处理'],
  ['colour_page_action', '四个颜色页怎么处理'],
  ['link_scope', '内链加多少'],
  ['next_item', '下一步先做哪一项'],
]) {
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

P(`## 三、90 天价值打分（Score 0-4，共用等级因此可比）`)
P()
const scored = [
  ['value__newsroom_consolidation', '处理 newsroom 重复列表页'],
  ['value__colour_copy', '颜色页差异化 / 补规格'],
  ['value__internal_links', '补内链'],
  ['value__measure_first', '先不动，等数据'],
].map(([id, zh]) => ({ zh, score: a[id]?.score ?? 0, conf: a[id]?.confidence ?? 0 }))
  .sort((x, y) => y.score - x.score)
for (const s of scored) P(`- **${s.score.toFixed(2)}/4**（置信 ${s.conf.toFixed(2)}）  ${s.zh}`)
P()

const outDir = path.join(root, '.workbuddy-ai', 'reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
writeFileSync(path.join(outDir, `remaining-items-jev-${stamp}.md`), lines.join('\n') + '\n')
writeFileSync(
  path.join(outDir, `remaining-items-jev-${stamp}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), model, usage, state, questions: Object.keys(questions), answers: a }, null, 2),
)
console.log(`\n写入 .workbuddy-ai/reports/remaining-items-jev-${stamp}.md`)
