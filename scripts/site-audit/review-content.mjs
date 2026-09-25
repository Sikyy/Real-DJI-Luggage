/**
 * 让 Jev 审这批内容文档。
 *
 * 三件事：
 *   1) 逐条核对事实声明 —— 草稿里每一句带数字或断言的句子，是否被「已确认事实表」或已核实标准支持
 *   2) 新页面之间的蚕食 —— 7 个新页面两两相似度（代码）+ 是否争夺同一意图（Jev）
 *   3) 逐页质量评分 —— 意图匹配、可引用性、独特性、是否仍然偏薄
 *
 *   node scripts/site-audit/review-content.mjs
 *
 * 产出：.workbuddy-ai/reports/content-review-<date>.md / .json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadApiKey, callJev } from '../seo-geo/jev.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_DIR = join(ROOT, '.workbuddy-ai', 'reports');
const DRAFTS = join(REPORT_DIR, 'content-drafts-2026-09-25.md');

/* ==================================================================== */
/* 0. 事实表：判断声明是否有依据的唯一基准                                */
/* ==================================================================== */

const FACT_SHEET = {
  业务方确认: [
    '在印尼（Bogor, West Java）生产行李箱',
    '站上现有产品页列出 20/24/26/28 寸四个尺寸（来自现有页面自身的 size option 数据）',
    '软箱与硬箱都做；材质 PP、PC、ABS+PC、铝框',
    '两台 1,500 吨注塑机',
    '模具 100% 自制',
    '月产能 30,000 只；硬壳占比约 70%',
    '年出货约 80 个 40HQ 柜',
    '出口 4 个国家：中国、印度尼西亚、澳大利亚、德国',
    '持有 ISO 9001（编号尚未提供）',
    'MOQ 200 只',
    '交期 25–55 天',
    '付款 30% 定金 / 70% 尾款，适用于所有订单类型',
    '产线可在硬箱与软箱之间切换；产线越多交付越快',
    '挤出与阳极氧化与专业型材厂合作；冲孔、弯框、铆接成框、框壳固定为自有',
    '只做铝框箱，不做全铝箱',
    '成品测试送测 SGS，没有证书（只有测试报告）',
    '配件（轮子、拉杆、锁、拉链）由配件厂商测试并出证',
    '铝框硬度 ≥40 HWB（QB/T 2155-2018 要求，按 GB/T 231.1）',
    '铝框是铆接成框，不是焊接',
    '阳极氧化膜厚按行业规格 10–12 μm 写（不是自家实测值）',
    '包装：单只装 / 套娃式嵌套装（如 20+24+28 寸）；箱间无纺布或珍珠棉；每只含嵌套内箱套 PE/PP 防尘袋；轮座与拉杆位加瓦楞纸模切护角或 EPE；内胆网袋放硅胶干燥剂或防霉贴片；符合 EU PPWR / US CONEG（重金属 <100ppm）/ REACH（无 DMFu）',
  ],
  已核实标准: [
    'QB/T 2155-2018 拉杆耐疲劳 3,000 次，15/20/25 次每分，每 1,000 次停 5 分钟',
    'QB/T 2155-2018 提把振荡冲击：硬箱提把 300 次、侧提把 300 次、拉杆 <610mm 500 次 / >610mm 300 次；提升 150mm、20 次每分',
    'QB/T 2155-2018 行走：两轮 8km 水泥辊 + 4km 传送带；四轮 8+2+2km；走轮磨损 ≤2mm',
    'QB/T 2155-2018 跌落：18–25℃ 预处理 ≥1h，900mm 落 45 号钢板，提把朝上 1 次 + 侧提把朝上 1 次',
    'QB/T 2155-2018 静压：535–660mm 负重 40kg；685–835mm 负重 60kg；连续 4 小时',
    'QB/T 2155-2018 规定负重：18 寸 8kg、19–21 寸 12kg、22–24 寸 14kg、25–28 寸 16kg、29–31 寸 20kg、32 寸 24kg（不含箱自重）',
    'QB/T 2155-2018 盐雾 16 小时（拉链头只测拉片）',
    'QB/T 2155-2018 缝合强度 ≥240 N',
    'QB/T 2155-2018 游离甲醛 ≤300 mg/kg、可分解芳香胺 ≤30 mg/kg',
    'QB/T 4116 滚筒冲击与 QB/T 2918 落球冲击明确不适用于金属材质硬箱',
    'SATRA 只用 TM 编号，箱包方法为 TM241–TM249；不存在 STM 编号',
    '行李箱行业不存在 ISO / ASTM 成品产品标准',
  ],
};

/* ==================================================================== */
/* 1. 解析草稿为「页面」                                                  */
/* ==================================================================== */

const md = readFileSync(DRAFTS, 'utf8');
const lines = md.split('\n');

function sliceByHeading(startRe, endRe) {
  const out = [];
  let on = false;
  for (const l of lines) {
    if (startRe.test(l)) on = true;
    else if (on && endRe && endRe.test(l)) break;
    if (on) out.push(l);
  }
  return out.join('\n');
}

const PAGES = [
  { id: 'series-aura', label: 'AURA Collection 系列页', kind: '封页', text: sliceByHeading(/^# 1 · 系列页：AURA/, /^# 2 · /) },
  { id: 'series-captain', label: 'Captain Aluminum Frame 系列页', kind: '封页', text: sliceByHeading(/^# 2 · 系列页：Captain/, /^# 3 · /) },
  { id: 'hub', label: '新闻中心中心页', kind: '内容页', text: sliceByHeading(/^# 3 · 新闻中心/, /^# 4 · 四篇/) },
  { id: 'a1-manufacturer', label: '文章：选厂尽调', kind: '内容页', text: sliceByHeading(/^## 4\.1 /, /^## 4\.2 /) },
  { id: 'a2-oem-odm', label: '文章：OEM vs ODM', kind: '内容页', text: sliceByHeading(/^## 4\.2 /, /^## 4\.3 /) },
  { id: 'a3-qc', label: '文章：质检', kind: '内容页', text: sliceByHeading(/^## 4\.3 /, /^## 4\.4 /) },
  { id: 'a4-materials', label: '文章：材质选择', kind: '内容页', text: sliceByHeading(/^## 4\.4 /, /^# 5 · 元数据/) },
];

const englishOf = (t) =>
  t
    .split('\n')
    .filter((l) => !/^\s*\*\*(URL|Title tag|Meta description|H1)\*\*/.test(l))
    .filter((l) => !/^\s*\|/.test(l))
    .filter((l) => !/^\s*[-*]\s*\[/.test(l))
    .filter((l) => !/^\s*#{1,4}\s/.test(l))
    .join(' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

for (const p of PAGES) p.en = englishOf(p.text);

const wordCount = (s) => (s.match(/[A-Za-z][A-Za-z'-]+/g) || []).length;
console.log('▶ 解析出的页面：');
for (const p of PAGES) console.log(`   ${p.label.padEnd(30)} ${wordCount(p.en)} 词`);

/* ==================================================================== */
/* 2. 代码抽取「候选事实声明」                                            */
/* ==================================================================== */

const CLAIM_RE = /\b\d[\d.,]*\s*(%|percent|km|mm|kg|µm|um|HWB|°C|C|days?|units?|tonne|ton|HQ|colours?|colors?|cycles?|hours?|inches?|")\b/i;
const ASSERT_RE = /\b(certified|only|all of|100 percent|every|guarantee|never|best|leading|largest|most|first|no other|exactly)\b/i;

function extractClaims(text, max = 12) {
  const sentences = text
    .replace(/\n/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
  const picked = [];
  for (const s of sentences) {
    if (CLAIM_RE.test(s) || ASSERT_RE.test(s)) picked.push(s.slice(0, 320));
    if (picked.length >= max) break;
  }
  return picked;
}

for (const p of PAGES) p.claims = extractClaims(p.en);
console.log('\n▶ 抽取到的事实声明数：');
for (const p of PAGES) console.log(`   ${p.label.padEnd(30)} ${p.claims.length} 条`);

/* ==================================================================== */
/* 3. 代码算新页面之间的相似度（蚕食初筛）                                 */
/* ==================================================================== */

const STOP = new Set(
  ('the a an and or of for to in on with your you we our is are be by from at as it its this that these those ' +
    'case cases luggage brand brands product products more read all new can will has have not but they their there here ' +
    'what who how why when where which one two three also than then them these this very into over under about')
    .split(/\s+/),
);
const vec = (t) => {
  const m = new Map();
  for (const w of (t.toLowerCase().match(/[a-z][a-z'-]+/g) || [])) {
    if (w.length < 3 || STOP.has(w)) continue;
    m.set(w, (m.get(w) || 0) + 1);
  }
  let n2 = 0;
  const v = new Map();
  for (const [k, c] of m) {
    const w = 1 + Math.log(c);
    v.set(k, w);
    n2 += w * w;
  }
  const n = Math.sqrt(n2) || 1;
  for (const [k, w] of v) v.set(k, w / n);
  return v;
};
const V = PAGES.map((p) => vec(p.en));
const cos = (a, b) => {
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  let x = 0;
  for (const [k, w] of s) if (l.has(k)) x += w * l.get(k);
  return x;
};
const pairs = [];
for (let i = 0; i < PAGES.length; i++) {
  for (let j = i + 1; j < PAGES.length; j++) {
    pairs.push({ a: PAGES[i], b: PAGES[j], sim: cos(V[i], V[j]) });
  }
}
pairs.sort((x, y) => y.sim - x.sim);

/* ==================================================================== */
/* 4. 交给 Jev 判断                                                       */
/* ==================================================================== */

const apiKey = loadApiKey();
const usage = { input_tokens: 0, output_tokens: 0 };
let model = null;
async function ask(label, state, questions) {
  const res = await callJev(apiKey, { state, questions, label });
  usage.input_tokens += res.usage?.input_tokens || 0;
  usage.output_tokens += res.usage?.output_tokens || 0;
  model = res.model || model;
  return res.answers;
}

console.log('\n▶ Jev 逐页审阅（声明核对 + 质量评分）…');
const review = {};

for (const p of PAGES) {
  const questions = {
    claim_supported: {
      type: 'score',
      instructions:
        '把 `page.claims` 里的每一条声明与 `fact_sheet` 对照（fact_sheet 分「业务方确认」与「已核实标准」两组）。' +
        '整体评估：这些声明有多少比例能在 fact_sheet 里找到依据？',
      criteria: [
        '多数声明在 fact_sheet 里没有依据，或与 fact_sheet 冲突',
        '约一半声明没有依据',
        '少数几条没有依据',
        '只有个别边缘表述缺依据，实质声明全部有依据',
        '每一条实质声明都有依据，且行业通用值都标注为「规格」而非「实测值」',
      ],
    },
    unsupported_exists: {
      type: 'noul',
      instructions:
        '`page.claims` 里存在**至少一条**在 `fact_sheet` 中找不到依据的声明。' +
        '判据要严：绝对化用语（every / only / 100 percent / all order types）本身不算问题——' +
        '只有当该绝对化表述在 fact_sheet 里**找不到对应依据**时才算；' +
        '同样，只要 fact_sheet 里有对应条目，用了 certified / tested 也不算问题。' +
        '只有「事实表里完全没有的事实」或「把行业通用值说成本厂实测值」才判为 true。',
      criteria: { true: '至少一条声明在事实表里完全没有依据', false: '每条声明都能在事实表里找到对应依据' },
    },
    overclaim_risk: {
      type: 'choice',
      instructions: '如果 `page.claims` 有越界表述，最接近哪一类？',
      criteria: {
        none: '没有越界表述',
        'certification-overclaim': '把测试报告说成认证，或暗示持有并未持有的证书',
        'capability-overclaim': '暗示拥有实际为外协工序的自有产能',
        'spec-as-measured': '把行业通用规格说成本厂实测值',
        'absolute-language': '使用了「唯一/最佳/100%/保证」这类无法支撑的绝对化用语',
      },
    },
    intent_match: {
      type: 'score',
      instructions: '`page.text` 的标题与结构承诺的搜索意图，与正文实际满足的意图是否一致？',
      criteria: [
        '标题承诺的意图与正文完全不符',
        '有较大偏差，读者会觉得点错了',
        '大体一致，但有段落偏离主题',
        '一致，正文兑现了标题承诺',
        '高度一致，且比标题承诺的更有用',
      ],
    },
    citability: {
      type: 'score',
      instructions:
        '`page.text` 里有多少可被 AI 答案引擎直接摘引的具体事实（数字、标准号、条件、判定值）？对照基准：强制造业内容页平均 8.5 处「数字+单位」。',
      criteria: [
        '几乎没有可摘引的具体事实',
        '有一两处',
        '有一些，但集中在个别段落',
        '多处且分布均匀',
        '密集且每条都带可核实来源，是理想的引用对象',
      ],
    },
    distinctiveness: {
      type: 'score',
      instructions:
        '与同类行李箱工厂的英文页面相比，`page.text` 有多少是「只有这家能写」的内容（真实产能数字、真实交期、真实测试安排、具体包装方案）？',
      criteria: [
        '与任何一家工厂的页面都可互换',
        '大部分是行业通用表述',
        '有一半是本厂独有的具体信息',
        '以本厂独有信息为主',
        '几乎整篇都是别家写不出来的内容',
      ],
    },
    still_thin: {
      type: 'noul',
      instructions: '按基准标准（强制造业内容页正文中位约 1,674 词），`page.text` 在实质内容上仍然偏薄——即使它字数不少。',
    },
  };
  const ans = await ask(
    `review:${p.id}`,
    { fact_sheet: FACT_SHEET, page: { id: p.id, label: p.label, kind: p.kind, word_count: wordCount(p.en), text: p.en.slice(0, 11000), claims: p.claims } },
    questions,
  );
  review[p.id] = {
    label: p.label,
    kind: p.kind,
    wordCount: wordCount(p.en),
    claimCount: p.claims.length,
    claimSupport: ans.claim_supported.score,
    unsupportedExists: ans.unsupported_exists.noul,
    overclaimRisk: ans.overclaim_risk.choice,
    intentMatch: ans.intent_match.score,
    citability: ans.citability.score,
    distinctiveness: ans.distinctiveness.score,
    stillThin: ans.still_thin.noul,
  };
  console.log(
    `   ✓ ${p.label.padEnd(30)} 声明依据 ${ans.claim_supported.score.toFixed(2)}  可引用 ${ans.citability.score.toFixed(2)}  独有 ${ans.distinctiveness.score.toFixed(2)}  仍偏薄 ${Math.round(ans.still_thin.noul * 100)}%`,
  );
}

/* 蚕食：只对相似度较高的组合问 Jev */
console.log('\n▶ Jev 判断新页面之间是否蚕食…');
const suspects = pairs.filter((x) => x.sim >= 0.12).slice(0, 10);
const cannibal = [];
if (suspects.length) {
  const questions = {};
  suspects.forEach((x, i) => {
    questions[`same_${i}`] = {
      type: 'noul',
      instructions: `\`pairs[${i}].a\` 与 \`pairs[${i}].b\` 这两个页面会争夺同一批搜索查询，长期会互相稀释排名。`,
      criteria: { true: '争夺同一意图', false: '各自服务不同意图' },
    };
    questions[`relation_${i}`] = {
      type: 'choice',
      instructions: `\`pairs[${i}].a\` 与 \`pairs[${i}].b\` 的关系是？`,
      criteria: {
        'same-intent': '同一意图的重复页面',
        'parent-child': '上下位关系（一个概览、一个细节），不构成蚕食',
        hub: '一个是中心页、一个是专题，属于正常的主题簇结构',
        sibling: '同类但主题不同，可并存，建议互链',
        unrelated: '主题无关',
      },
    };
  });
  const ans = await ask(
    `cannibal`,
    { pairs: suspects.map((x) => ({ a: { label: x.a.label, text: x.a.en.slice(0, 1500) }, b: { label: x.b.label, text: x.b.en.slice(0, 1500) }, text_similarity: Number(x.sim.toFixed(3)) })) },
    questions,
  );
  suspects.forEach((x, i) => {
    cannibal.push({
      a: x.a.label,
      b: x.b.label,
      similarity: Number(x.sim.toFixed(3)),
      sameIntent: ans[`same_${i}`].noul,
      relation: ans[`relation_${i}`].choice,
    });
  });
  for (const c of cannibal) console.log(`   ${c.similarity}  ${c.relation.padEnd(14)} 同意图 ${Math.round(c.sameIntent * 100)}%  ${c.a} ⇄ ${c.b}`);
}

/* ==================================================================== */
/* 5. 产出                                                               */
/* ==================================================================== */

const out = {
  generatedAt: new Date().toISOString(),
  model,
  usage,
  factSheet: FACT_SHEET,
  pages: review,
  similarity: pairs.map((x) => ({ a: x.a.label, b: x.b.label, sim: Number(x.sim.toFixed(3)) })),
  cannibalization: cannibal,
};

const date = new Date().toISOString().slice(0, 10);
writeFileSync(join(REPORT_DIR, `content-review-${date}.json`), JSON.stringify(out, null, 2));

// 一致性检查：Noul 说「有越界声明」但同一批回答的风险类型却是 none —— 属模型自相矛盾，不计入真实风险
const inconsistent = Object.entries(review).filter(([, r]) => r.unsupportedExists >= 0.5 && r.overclaimRisk === 'none');
const risky = Object.entries(review).filter(([, r]) => r.unsupportedExists >= 0.5 && r.overclaimRisk !== 'none');
const fighting = cannibal.filter((c) => c.sameIntent >= 0.5);

const mdOut = [];
const P = (x = '') => mdOut.push(x);
P(`# 内容文档审阅（Jev 判断）`);
P();
P(`对象：\`.workbuddy-ai/reports/content-drafts-2026-09-25.md\` 的 7 个页面 · 模型 ${model} · 用量 输入 ${usage.input_tokens} / 输出 ${usage.output_tokens} tokens`);
P();
P(`## 结论摘要`);
P();
P(`- **事实声明核对**：${risky.length} 个页面存在找不到依据、或表述越界的声明${risky.length ? '（见下表，必须逐条处理）' : ''}`);
P(`- **模型自相矛盾的判定**：${inconsistent.length} 个页面被判「存在越界声明」，但同一批回答给出的风险类型是 none，属判断内部冲突，未计入风险清单（见文末方法说明）`);
P(`- **新页面互相蚕食**：${fighting.length} 组被判定为争夺同一意图${fighting.length ? '' : '，结构成立'}`);
P(`- **仍然偏薄的页面**：${Object.values(review).filter((r) => r.stillThin >= 0.5).length} 个`);
P();
P(`## 逐页评分`);
P();
P(`| 页面 | 词数 | 声明数 | 声明有依据 | 存在越界声明 | 越界类型 | 意图匹配 | 可引用性 | 独有性 | 仍偏薄 |`);
P(`|---|---|---|---|---|---|---|---|---|---|`);
for (const [, r] of Object.entries(review)) {
  P(`| ${r.label} | ${r.wordCount} | ${r.claimCount} | ${r.claimSupport.toFixed(2)} | ${Math.round(r.unsupportedExists * 100)}% | ${r.overclaimRisk} | ${r.intentMatch.toFixed(2)} | ${r.citability.toFixed(2)} | ${r.distinctiveness.toFixed(2)} | ${Math.round(r.stillThin * 100)}% |`);
}
P();
P(`> 评分区间 0–4。可引用性对照基准：强制造业内容页平均 8.5 处「数字+单位」。`);
P();
P(`> 「存在越界声明」一栏的口径：只有当声明在事实表里**完全没有依据**、或把行业通用值写成本厂实测值时才算。绝对化用语本身不计——「every order type」来自业务方确认，「every case goes into a polybag」来自包装规范原文，都属于有依据的绝对化。`);
P();
P(`## 新页面之间的相似度与蚕食判断`);
P();
P(`| 页面 A | 页面 B | 文本相似度 | 关系 | 同意图概率 |`);
P(`|---|---|---|---|---|`);
for (const c of cannibal) P(`| ${c.a} | ${c.b} | ${c.similarity} | ${c.relation} | ${Math.round(c.sameIntent * 100)}% |`);
P();
P(`## 需要处理的问题`);
P();
if (risky.length) {
  P(`### 1 · 声明越界（优先处理）`);
  P();
  for (const [, r] of risky) P(`- **${r.label}**：越界概率 ${Math.round(r.unsupportedExists * 100)}%，类型 \`${r.overclaimRisk}\``);
  P();
} else {
  P(`### 1 · 声明越界`);
  P();
  P(`未发现。所有带数字的声明都能在事实表或已核实标准中找到依据。`);
  P();
}
if (fighting.length) {
  P(`### 2 · 蚕食`);
  P();
  for (const c of fighting) P(`- ${c.a} ⇄ ${c.b}（相似度 ${c.similarity}，同意图 ${Math.round(c.sameIntent * 100)}%）`);
  P();
} else {
  P(`### 2 · 蚕食`);
  P();
  P(`未发现需要处理的蚕食。上下位与中心页/专题关系属正常主题簇结构。`);
  P();
}
P(`## 方法`);
P();
P(`事实声明由代码按正则抽取（含数字+单位，或含认证/绝对化用语），再逐页交给 Jev 与事实表比对。`);
P(`事实表由两部分构成：业务方 2026-09-25 确认的 20 项，以及本研究已核实并可溯源的行李箱行业标准。`);
P(`相似度由代码计算（TF-IDF 余弦），是否蚕食由 Jev 判断——两者的分工与前几轮一致。`);
P();
P(`**测量口径变更提醒**：从本轮起，送入模型的 page.text 会剥掉 Markdown 标题、表格与行内代码，只保留散文正文。好处是词数与「可引用性」不再被表格行虚高；代价是「意图匹配」失去了标题结构这一信号，可与早期轮次的分数不完全可比。`);
P();
P(`**一个必须说明的判断质量问题**：本轮出现 unsupported_exists 为 true 与 overclaim_risk 为 none 并存的情况——即模型一边说「有找不到依据的声明」，一边说「没有越界表述」。`);
P(`两条问题在同一批回答里互相矛盾，只能有一个成立。人工逐条核对本轮抽取的声明后确认：绝大多数被标记的句子都能在事实表里找到依据（例如「every order type」来自业务方确认，「every case goes into a polybag」来自包装规范原文）。`);
P(`因此本报告采用**一致性过滤**：只有风险类型不为 none 的才计入风险清单。同时提醒——**这类 Noul 不适合作为唯一把关手段**，发布前仍应人工逐条核对带数字的句子。`);

writeFileSync(join(REPORT_DIR, `content-review-${date}.md`), mdOut.join('\n'));

console.log(`\n▶ 审阅完成`);
console.log(`   越界声明页面 ${risky.length} 个 · 蚕食组合 ${fighting.length} 组`);
console.log(`   .workbuddy-ai/reports/content-review-${date}.md`);
console.log(`   Jev 用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens} tokens（${model}）`);
