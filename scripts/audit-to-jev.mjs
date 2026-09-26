/**
 * 把第三方 SEO 审计报告交给 Jev 判断，并产出改进计划。
 *
 * 关键原则：**不把未经验证的审计主张直接喂给模型**。
 * 每条主张都先经本地/线上实测，把「已证实 / 误报 / 已过期」如实写进 state，
 * 再让 Jev 判断「在这样一组事实下，该做什么」。
 *
 * 用法：
 *   node scripts/audit-to-jev.mjs
 *   node scripts/audit-to-jev.mjs --repeat 2
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadApiKey, callJev } from './seo-geo/jev.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = process.argv.slice(2)
const REPEAT = args.includes('--repeat') ? Number(args[args.indexOf('--repeat') + 1] || 2) : 1

// ---------------------------------------------------------------- 读最新 GSC 基线

function latestGsc() {
  const dir = path.join(root, '.seo-geo/gsc')
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) return null
  return JSON.parse(readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
}
const gsc = latestGsc()

// ---------------------------------------------------------------- 核实后的状态

const state = {
  site: {
    domain: 'djiluggage.id',
    business: 'Indonesian B2B luggage manufacturer in Bogor, West Java. OEM and ODM hard-shell and soft-shell suitcases for brands, importers and distributors.',
    brand_note: 'Branded "DJI Luggage"; "DJI" also names a well-known drone manufacturer.',
    confirmed_facts: 'MOQ 200 units, lead time 25-55 days, monthly capacity 30,000 units, two 1,500-tonne injection machines, 100% in-house moulds, ships to China, Indonesia, Australia and Germany.',
  },
  site_age: {
    first_commit: '2026-06-01',
    age_months: 4,
    note: 'The site is about four months old. It is not an established domain underperforming; it is a new domain.',
  },

  audit_under_review: {
    source: 'third-party basic SEO audit dated 2026-09-26',
    headline_score: '68/100 self-described heuristic',
    crawl: '18 of a maximum 20 pages',
    claimed_issues: [
      {
        id: 'www_522',
        claim: 'https://www.djiluggage.id/ returns HTTP 522 while the apex host works.',
        verification: 'CONFIRMED-TRUE',
        detail: 'Live test: www returns 522, apex returns 200, http:// apex 301s to https:// apex. Both hostnames resolve to the same Cloudflare IPs, so DNS is fine; the www hostname simply has no origin attached, i.e. it is not configured as a custom domain on the hosting project.',
      },
      {
        id: 'contact_email_404',
        claim: 'The contact page email protection link returns 404.',
        verification: 'FALSE-POSITIVE',
        detail: 'The /cdn-cgi/l/email-protection path is injected by Cloudflare email obfuscation at the edge. The source uses mailto: links and no page references that path. This was already investigated and dismissed earlier.',
      },
      {
        id: 'newsroom_template_duplication',
        claim: 'Multiple newsroom articles use a highly repeated body template.',
        verification: 'CONFIRMED-TRUE',
        detail: 'All 8 newsroom articles are exactly 177 words and share the same section outline.',
      },
      {
        id: 'product_naming_material_conflict',
        claim: 'Product pages mix "Full Aluminum" naming with "Polycarbonate material" copy, so buyers cannot tell the real material.',
        verification: 'STALE-ALREADY-FIXED',
        detail: 'Fixed on 2026-09-25. Pages were renamed to "Zipperless Aluminum Frame" and the material line now reads "polycarbonate shell with a riveted aluminum frame". Live check shows zero occurrences of "Full Aluminum" on those pages.',
      },
      {
        id: 'landing_pages_missing',
        claim: 'Core SEO landing pages are missing: /luggage-manufacturer/, /luggage-oem-odm/, /private-label-luggage/, /aluminum-frame-luggage/, /aluminum-luggage/, /luggage-manufacturer-indonesia/.',
        verification: 'TRUE-BUT-UNBUILT',
        detail: 'These URLs do not exist. Whether they are the right next investment is the question.',
      },
      {
        id: 'unverifiable_technical_items',
        claim: 'robots, sitemap, canonical, meta description, Schema and Lighthouse values could not be confirmed.',
        verification: 'FALSE-POSITIVE-METHOD-LIMIT',
        detail: 'All exist and were verified independently: robots.txt with an explicit AI-crawler policy, a 43-entry sitemap, a canonical on every page, meta descriptions on every page, and Organization/Product/JobPosting/BlogPosting JSON-LD across 57 pages. The audit tool simply could not read them.',
      },
      {
        id: 'email_link_is_main_internal_link_issue',
        claim: 'The main internal-linking problem is the email protection link.',
        verification: 'MISLEADING',
        detail: 'Internal linking is otherwise sound; that single link is a Cloudflare artifact, not a broken link.',
      },
    ],
  },

  found_by_me_and_missed_by_the_audit: {
    capacity_self_contradiction: {
      severity_note: 'This is on one page, in two visible places, and the numbers differ by 4.5x.',
      evidence: [
        'about page: "80k units annual luggage capacity"',
        'about page: "Annual capacity: 80k units"',
        'about page answer block: "monthly capacity of 30,000 units"',
        '30,000 units per month is 360,000 units per year',
      ],
      status: 'unresolved - the owner has not yet said which figure is correct',
    },
    other_unverified_claims_on_same_page: ['10+ Years Experience', '75 Employees', '300 Production Details Tracked'],
  },

  search_console_baseline: gsc ? {
    window: `${gsc.range?.startDate} to ${gsc.range?.endDate}`,
    note: 'Entirely before the 2026-09-25/26 changes.',
    clicks: gsc.totals?.clicks,
    impressions: gsc.totals?.impressions,
    ctr: Number((gsc.totals?.ctr ?? 0).toFixed(4)),
    average_position: Number((gsc.totals?.position ?? 0).toFixed(1)),
    brand_collision: 'Roughly 463 of 590 impressions (about 78%) come from "dji hiring", "dji career" and "dji recruitment", all landing on /careers with zero clicks.',
    commercial_queries: (gsc.byQuery || [])
      .filter((r) => !/^dji /i.test(r.keys[0]))
      .map((r) => ({ query: r.keys[0], impressions: r.impressions, position: Number(r.position.toFixed(1)) })),
  } : { note: 'no GSC data available' },

  already_shipped_this_week: [
    'llms.txt with a name-disambiguation section',
    'Explicit AI crawler policy in robots.txt',
    '134-167 word fact-dense answer blocks on home, about, services, process, contact and products',
    'Organization disambiguatingDescription, areaServed and knowsAbout across 50 pages',
    '/careers retitled to name luggage manufacturing and Bogor, Indonesia',
    'Structured-data bug fixes and Product JSON-LD regenerated for 21 product pages',
    'Heading-level skips fixed site-wide',
    'Google Tag Manager plus Consent Mode v2 and a cookie banner',
    'Sitemap regenerated with fresh lastmod dates',
  ],
}

// ---------------------------------------------------------------- 候选动作

const ACTIONS = {
  fix_www_522: 'Attach www.djiluggage.id to the hosting project (or 301 it to the apex) so it stops returning 522.',
  resolve_capacity_numbers: 'Decide the correct capacity figure and make the about page state one number consistently.',
  expand_existing_articles: 'Expand /newsroom/oem-vs-odm-for-luggage-brands/ and /newsroom/choosing-the-right-luggage-manufacturer/ from 177 to 1,200+ words each.',
  rewrite_all_eight_articles: 'Rewrite all eight newsroom articles to 1,200+ words each.',
  build_audit_landing_pages: 'Build the six core landing pages the audit lists: luggage-manufacturer, luggage-oem-odm, private-label-luggage, aluminum-frame-luggage, aluminum-luggage, luggage-manufacturer-indonesia.',
  add_breadcrumblist_schema: 'Add BreadcrumbList structured data.',
  run_pagespeed_and_fix: 'Measure real Core Web Vitals with PageSpeed Insights and act on the results.',
  build_market_pages: 'Build country and market pages for Indonesia, Australia and the United States.',
  build_offsite_authority: 'Work on off-site authority: B2B directories, industry associations, Indonesian export listings.',
  rewrite_homepage_meta_and_h1: 'Adopt the audit-suggested homepage title, meta description and H1 wording.',
  fix_contact_email_link: 'Change how the email address is rendered on the contact page.',
  wait_and_measure: 'Change nothing further and wait for the next Search Console window.',
}

// 所有动作共用同一套等级描述，分数才能横向比较
const IMPACT_LEVELS = [
  { what: 'Could actively harm qualified B2B inquiries', signals: ['attracts the wrong audience', 'publishes numbers a buyer could catch as inconsistent', 'dilutes focus'] },
  { what: 'No meaningful change in qualified B2B inquiries', signals: ['does not touch a query or page a buyer could reach', 'fixes something that is not actually broken'] },
  { what: 'Marginal or unproven effect', signals: ['plausible but indirect', 'depends on factors outside this work'] },
  { what: 'Moderate, likely effect on qualified inquiries', signals: ['addresses a specific diagnosed weakness', 'targets a page already associated with commercial queries'] },
  { what: 'Strong, direct effect on qualified inquiries', signals: ['removes a blocker that explains current positions', 'creates a page a buyer would actually search for'] },
]

const N = (instructions, criteria) => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) })

const questions = {
  // --- 一、对审计报告本身的判断 ---
  audit_true_issues_outweigh_false_ones: N(
    'Across `audit_under_review.claimed_issues`, do the confirmed-true findings (www 522 and newsroom duplication) represent the substance of the audit, with the rest being false positives, stale findings or method limits?',
    {
      true: { what: 'The audit is right about two things and wrong or stale about the rest' },
      false: { what: 'The false or stale findings are numerous enough to undermine the audit overall' },
    },
  ),
  audit_score_is_trustworthy: N(
    'Given that several of the audit\'s headline issues are false positives, stale, or acknowledged method limits, is `audit_under_review.headline_score` a trustworthy summary of `site`?',
    {
      true: { what: 'The score is a fair summary despite the individual errors' },
      false: { what: 'The score should not be used as a target or a progress measure', not_for: 'Believing any third-party score is worthless' },
    },
  ),
  www_522_is_real_risk: N(
    'Does `audit_under_review.claimed_issues[0]` describe a genuine indexing and signal-consolidation risk for `site`, rather than a cosmetic hosting detail?',
    {
      true: { what: 'A second failing hostname can fragment signals and block crawlers that try it', examples: ['www returns 522 while the apex returns 200'] },
      false: { what: 'Nothing links to the www hostname, so it cannot cause real harm' },
    },
  ),
  capacity_contradiction_damages_buyers: N(
    'Does `found_by_me_and_missed_by_the_audit.capacity_self_contradiction` describe something a sourcing manager evaluating `site` would notice and treat as a credibility problem?',
    {
      true: { what: 'A buyer comparing capacity figures on one page would question the factory\'s reliability', examples: ['80k units annual next to 30,000 units monthly on the same page'] },
      false: { what: 'Buyers would not compare those two statements', not_for: 'Considering accuracy generally unimportant' },
    },
  ),
  capacity_contradiction_harms_ai_entities: N(
    'Does `found_by_me_and_missed_by_the_audit.capacity_self_contradiction` risk causing AI answer engines to state an incorrect capacity for `site`?',
    {
      true: { what: 'Conflicting figures invite a model to either pick the wrong one or hedge', examples: ['two different annual capacity figures on one page'] },
      false: { what: 'Models would reconcile or ignore the conflict' },
    },
  ),
  landing_pages_would_outrank_existing: N(
    'Would the six landing pages in `audit_under_review.claimed_issues[4]` be likely to rank for their target queries, given `site_age` and `search_console_baseline`?',
    {
      true: { what: 'New focused pages can rank even on a young site when the query is specific and the content is factual' },
      false: { what: 'On a four-month-old site without external authority, new commercial pages would sit far below page one', not_for: 'Opposing new pages in general' },
    },
  ),
  expanding_beats_creating: N(
    'Given `search_console_baseline.commercial_queries` shows existing pages already matched to commercial queries at positions 47 to 93, would expanding those pages produce results sooner than publishing new landing pages for the same themes?',
    {
      true: { what: 'Existing matched pages already have relevance; depth is the missing ingredient' },
      false: { what: 'Fresh dedicated pages would outperform deeper versions of existing general pages' },
    },
  ),
  site_age_dominates_the_diagnosis: N(
    'Does `site_age` mean that most current ranking and traffic weakness should be attributed to domain age and missing external authority, rather than to on-page defects?',
    {
      true: { what: 'A four-month-old domain with no external authority is expected to rank poorly regardless of on-page quality' },
      false: { what: 'On-page defects are the dominant cause even on a young domain' },
    },
  ),
  audit_landing_pages_are_cannibalisation_risk: N(
    'Could building all six of the audit\'s landing pages create pages that compete with each other for the same queries, the way `site` already has near-identical newsroom articles?',
    {
      true: { what: 'Several of the six cover overlapping intent and would split relevance', examples: ['aluminum-frame-luggage next to aluminum-luggage next to luggage-oem-odm'] },
      false: { what: 'Each targets a distinct query with distinct intent' },
    },
  ),

  // --- 二、候选动作打分（共用等级，可横向比较）---
  ...Object.fromEntries(Object.entries(ACTIONS).map(([id, description]) => [
    `impact__${id}`,
    {
      type: 'score',
      instructions: {
        question: 'If `action` is carried out, what effect would it have on qualified B2B inquiries reaching `site` within about three months?',
        action: description,
        inspect: ['`site`', '`site_age`', '`audit_under_review`', '`search_console_baseline`', '`already_shipped_this_week`'],
        focus: 'Judge effect on qualified buyer inquiries, not on audit scores or rankings for their own sake.',
      },
      criteria: IMPACT_LEVELS,
    },
  ])),

  // --- 三、决策 ---
  next_action: {
    type: 'choice',
    instructions: {
      question: 'Which single action should be done first, before any of the others?',
      focus: 'Best expected effect per unit of effort, given the verified state rather than the audit\'s own priority list.',
    },
    criteria: ACTIONS,
  },
  landing_pages_timing: {
    type: 'choice',
    instructions: {
      question: 'When, if ever, should the audit\'s six landing pages be built?',
      focus: 'Choose the timing that fits `site_age` and the current content state.',
    },
    criteria: {
      build_now: 'Build them immediately, ahead of other content work.',
      after_expanding_existing: 'First deepen the pages already matched to commercial queries, then build these.',
      only_the_two_or_three_best: 'Build only the strongest two or three of the six, and skip the overlapping ones.',
      after_external_authority: 'Wait until the domain has some external authority, otherwise they will not rank.',
      never_these_pages: 'These particular URLs are the wrong targeting and should be replaced by a different set.',
    },
  },
  thirty_day_workstream: {
    type: 'choice',
    instructions: {
      question: 'Over the next 30 days, which class of work should dominate?',
      focus: 'Choose the category most likely to produce qualified buyer inquiries at this stage of the domain.',
    },
    criteria: {
      fix_defects: 'Fix the specific verified defects: the www host and the contradictory capacity figures.',
      deepen_content: 'Expand the thin pages already matched to commercial queries.',
      new_landing_pages: 'Publish new commercial landing pages.',
      offsite_authority: 'Build off-site signals: directories, associations, listings, links.',
      measurement_first: 'Stabilise measurement and instrumentation before doing more content work.',
    },
  },
  capacity_figure_is_monthly_correct: N(
    'Given `site.confirmed_facts` states a monthly capacity of 30,000 units, is the "80k units annual" figure on the about page most likely the one that should change?',
    {
      true: { what: 'The confirmed monthly figure is authoritative and the annual figure is the error', not_for: 'Assuming without checking' },
      false: { what: 'The annual figure may be the correct one and the monthly figure wrong' },
    },
  ),
  should_measure_before_more_changes: N(
    'Given that substantial changes shipped on 2026-09-25/26 and no post-change Search Console window exists yet, would making another large batch of changes now make it impossible to attribute results?',
    {
      true: { what: 'Stacking changes without a measurement window destroys attribution' },
      false: { what: 'Changes can be stacked freely and still interpreted' },
    },
  ),
}

// ---------------------------------------------------------------- 调用

const apiKey = loadApiKey()
console.log(`问题数: ${Object.keys(questions).length}（含 ${Object.keys(ACTIONS).length} 个候选动作打分）`)
console.log(`调用 ${REPEAT} 次...\n`)

const runs = []
for (let i = 0; i < REPEAT; i++) {
  runs.push(await callJev(apiKey, { state, questions, label: `第 ${i + 1} 次` }))
  if (i < REPEAT - 1) await new Promise((r) => setTimeout(r, 800))
}

const a = runs[0].answers
const pct = (p) => `${(p * 100).toFixed(0)}%`
const bar = (p, w = 20) => '█'.repeat(Math.round(p * w)).padEnd(w, '·')

const DIAGNOSTIC = [
  ['audit_true_issues_outweigh_false_ones', '审计的实质就是那两条真问题，其余是误报/过期/方法限制'],
  ['audit_score_is_trustworthy', '那份 68/100 的分数可信、可用作目标'],
  ['www_522_is_real_risk', 'www 522 是真实的索引与信号风险'],
  ['capacity_contradiction_damages_buyers', '产能数字自相矛盾会损伤买家信任'],
  ['capacity_contradiction_harms_ai_entities', '产能矛盾会让 AI 引擎报错数字'],
  ['landing_pages_would_outrank_existing', '新建那 6 个落地页能在当前站龄下排上去'],
  ['expanding_beats_creating', '扩写现有页比新建页更快见效'],
  ['site_age_dominates_the_diagnosis', '当前排名弱主要应归因于站龄与缺外链'],
  ['audit_landing_pages_are_cannibalisation_risk', '那 6 个落地页彼此会互相蚕食'],
  ['capacity_figure_is_monthly_correct', '应改的是 80k 年产能（月产能为准）'],
  ['should_measure_before_more_changes', '再堆改动会破坏归因'],
]

console.log('════════ 一、Jev 对审计报告与现状的诊断 ════════')
for (const [id, zh] of DIAGNOSTIC) {
  const v = a[id]?.noul ?? 0
  console.log(`  ${bar(v)} ${pct(v).padStart(4)}  ${zh}`)
}

console.log('\n════════ 二、候选动作排序（Score 0-4，共用等级故可比）════════')
const scored = Object.keys(ACTIONS).map((id) => {
  const ans = a[`impact__${id}`]
  return { id, action: ACTIONS[id], score: ans?.score ?? 0, confidence: ans?.confidence ?? 0 }
}).sort((x, y) => y.score - x.score)
for (const s of scored) {
  const flag = s.confidence < 0.5 ? '⚠ 低置信' : s.confidence < 0.8 ? '· 中置信' : '✓ 高置信'
  console.log(`  ${s.score.toFixed(2)}/4  置信 ${s.confidence.toFixed(2)} ${flag}  ${s.id}`)
}

console.log('\n════════ 三、决策（Choice）════════')
for (const [id, zh] of [['next_action', '第一步做什么'], ['landing_pages_timing', '落地页何时做'], ['thirty_day_workstream', '30 天重心']]) {
  const ans = a[id]
  if (!ans) continue
  console.log(`\n  【${zh}】→ ${ans.choice}（置信 ${ans.confidence.toFixed(2)}）`)
  for (const [o, p] of Object.entries(ans.probabilities).sort((x, y) => y[1] - x[1])) {
    if (p <= 0.001) continue
    console.log(`      ${bar(p, 16)} ${pct(p).padStart(4)}  ${o}`)
  }
}

if (runs.length > 1) {
  console.log('\n════════ 四、自洽性 ════════')
  let stable = 0
  const unstable = []
  for (const id of Object.keys(questions)) {
    const vals = runs.map((r) => {
      const x = r.answers[id]
      return x?.type === 'noul' ? x.noul : x?.type === 'score' ? x.score : x?.choice
    })
    const ok = typeof vals[0] === 'number'
      ? Math.abs(Math.max(...vals) - Math.min(...vals)) <= 0.35
      : new Set(vals).size === 1
    if (ok) stable++
    else { unstable.push(id); console.log(`  ⚠ 不稳定 ${id}: ${vals.map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join(' vs ')}`) }
  }
  console.log(`  稳定 ${stable}/${Object.keys(questions).length}`)
}

// ---------------------------------------------------------------- 落盘

const outDir = path.join(root, '.workbuddy-ai/reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
const jsonPath = path.join(outDir, `audit-jev-judgment-${stamp}.json`)
writeFileSync(jsonPath, JSON.stringify({
  model: runs[0].model,
  judgedAt: new Date().toISOString(),
  state,
  questions,
  runs: runs.map((r) => ({ answers: r.answers, usage: r.usage })),
}, null, 2))

const md = []
md.push('# Jev 对第三方 SEO 审计的判断')
md.push('')
md.push(`- 模型：\`${runs[0].model}\`｜评估 ${runs.length} 次｜${new Date().toISOString()}`)
md.push('- 前提：审计的每条主张都已先经实测核实，再交给模型')
md.push('')
md.push('## 一、诊断（Noul，数值为「是」的概率）')
md.push('')
md.push('| 判断 | 概率 | 含义 |')
md.push('|---|---|---|')
for (const [id, zh] of DIAGNOSTIC) md.push(`| \`${id}\` | ${pct(a[id]?.noul ?? 0)} | ${zh} |`)
md.push('')
md.push('## 二、候选动作排序（Score 0–4）')
md.push('')
md.push('| 排名 | 分数 | 置信 | 动作 |')
md.push('|---|---|---|---|')
scored.forEach((s, i) => md.push(`| ${i + 1} | ${s.score.toFixed(2)} | ${s.confidence.toFixed(2)} | \`${s.id}\` |`))
md.push('')
md.push('## 三、决策')
md.push('')
for (const [id, zh] of [['next_action', '第一步做什么'], ['landing_pages_timing', '落地页何时做'], ['thirty_day_workstream', '30 天重心']]) {
  const ans = a[id]
  if (!ans) continue
  md.push(`### ${zh} → \`${ans.choice}\`（置信 ${ans.confidence.toFixed(2)}）`)
  md.push('')
  md.push('| 选项 | 概率 |')
  md.push('|---|---|')
  for (const [o, p] of Object.entries(ans.probabilities).sort((x, y) => y[1] - x[1])) {
    if (p <= 0.001) continue
    md.push(`| \`${o}\` | ${pct(p)} |`)
  }
  md.push('')
}
md.push('## 四、交给 Jev 的事实状态')
md.push('')
md.push('```json')
md.push(JSON.stringify(state, null, 2))
md.push('```')
const mdPath = path.join(outDir, `audit-jev-judgment-${stamp}.md`)
writeFileSync(mdPath, md.join('\n'))

console.log(`\n模型: ${runs[0].model}`)
console.log(`JSON: ${path.relative(root, jsonPath)}`)
console.log(`报告: ${path.relative(root, mdPath)}`)
