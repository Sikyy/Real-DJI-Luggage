/**
 * 合并方案生成器：按「新闻文章 → 产品页 → 孤岛 → 内链」的顺序产出一版可执行方案。
 *
 * Jev 只负责需要判断的决策（文章去留、产品线 canonical 选择、主目标查询、必备事实清单）；
 * URL 映射、301 表、内链改写、验收清单由代码从真实数据精确生成。
 *
 *   node scripts/site-audit/plan.mjs
 *
 * 产出：
 *   .workbuddy-ai/reports/plan-consolidation-<date>.md
 *   .workbuddy-ai/reports/plan-consolidation-<date>.html
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadApiKey, callJev } from '../seo-geo/jev.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_DIR = join(ROOT, '.seo-geo', 'site');
const REPORT_DIR = join(ROOT, '.workbuddy-ai', 'reports');

const corpus = JSON.parse(readFileSync(join(SITE_DIR, 'corpus.json'), 'utf8'));
const findings = JSON.parse(readFileSync(join(SITE_DIR, 'findings.json'), 'utf8'));
const pageByPath = new Map(corpus.pages.map((p) => [p.urlPath, p]));
const apiKey = loadApiKey();

/** Jev 决策缓存：模型对边界案例有 ±3–5 个百分点的运行间波动，
 *  缓存后重跑方案不会因为一次抽样的抖动而改变结论。--refresh 可重新决策。 */
const DECISIONS_PATH = join(SITE_DIR, 'plan-decisions.json');
const REFRESH_DECISIONS = process.argv.includes('--refresh');
const decisions =
  !REFRESH_DECISIONS && existsSync(DECISIONS_PATH) ? JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) : null;

let usage = { input_tokens: 0, output_tokens: 0 };
let model = null;
async function ask(label, state, questions) {
  const res = await callJev(apiKey, { state, questions, label });
  usage.input_tokens += res.usage?.input_tokens || 0;
  usage.output_tokens += res.usage?.output_tokens || 0;
  model = res.model || model;
  return res.answers;
}

const SITE = corpus.site;

/* ==================================================================== */
/* 一、把 21 个产品页按「标题」归入 4 条产品线（slug 与颜色是错位的，只能用标题） */
/* ==================================================================== */

/** 保留并合并为系列页的产品线（2026-09-25 决定：只做铝框，全铝系列整条删除）。 */
const LINES = [
  { id: 'aura', titlePrefix: 'AURA Collection', newSlug: '/products/aura-collection-aluminum-frame-carry-on/' },
  { id: 'captain-frame', titlePrefix: 'Captain Aluminum Frame Carry-On', newSlug: '/products/captain-aluminum-frame-carry-on/' },
];

/** 不再生产、整条删除的产品线。这些 URL 全部 301 到总目录。 */
const REMOVED_LINES = [
  { id: 'captain-full', titlePrefix: 'Captain Full Aluminum Carry-On' },
  { id: 'voyager', titlePrefix: 'Voyager Full Aluminum Carry-On' },
];

/** 被删除产品线的页面统一落到总目录（不 301 到错误的具体型号） */
const REMOVED_TARGET = '/collections/all/';

/** 产品线的结构类型。AURA 的真实结构需客户确认，暂按铝框处理。 */
const CONSTRUCTION = {
  aura: 'aluminum frame',
  'captain-frame': 'aluminum frame',
  'captain-full': 'full aluminum',
  voyager: 'full aluminum',
};

/**
 * 业务方（2026-09-25）确认、可直接写入页面的事实。
 * 这些是 AI 目前认为「印尼没有硬壳产能」的直接反证材料。
 */
const CONFIRMED_FACTS = [
  ['材料', '可生产材质', 'PP、PC、ABS+PC、铝框 —— 软箱与硬箱都做'],
  ['产能', '月产能', '30,000 只行李箱'],
  ['产能', '硬壳占比', '70%'],
  ['产能', '年出货量', '80 个 40HQ 柜'],
  ['设备', '注塑机', '两台 1,500 吨注塑机'],
  ['模具', '模具自制比例', '100%'],
  ['起订', 'MOQ', '200 只'],
  ['包装', '包装形式', '单只装（Single Pack）；套装嵌套装（Nested Pack，套娃式，如 20"+24"+28" 三件套嵌套）'],
  ['包装', '嵌套内衬', '小箱装入大箱时，箱体间垫无纺布或珍珠棉垫层'],
  ['包装', '防尘保护', '每只箱（含嵌套内箱）套 PE/PP 塑料防尘袋，防止 ABS/PC/铝镁合金箱壳在高湿度或颠簸环境下产生划痕'],
  ['包装', '关键部位缓冲', '箱底万向轮与顶部拉杆位加装瓦楞纸模切护角或 EPE 珍珠棉缓冲垫，防止堆叠或跌落时轮座受力开裂'],
  ['包装', '防潮', '每只箱内胆网袋放硅胶干燥剂（Silica Gel）或防霉贴片 —— 跨赤道海运的「集装箱雨」防护'],
  ['合规', '包装环保', '符合 EU PPWR / US CONEG（重金属 < 100 ppm）/ REACH（无 DMFu 防霉）'],
  ['合规', '原产地', '印度尼西亚原产地证（Certificate of Origin）'],
  ['合规', '管理体系认证', '持有 ISO 9001（编号一时找不到，但确实持有——拿到编号后务必补上，只写「已认证」说服力差很多）'],
  ['产能', '出口国家', '4 个：中国、印度尼西亚、澳大利亚、德国'],
  ['产能', '产线柔性', '硬箱与软箱可在产线之间切换；产线越多，交付越快'],
  ['产品范围', '在产结构', '只做铝框箱（PC / ABS+PC 壳 + 铝框）；全铝箱暂不做'],
  ['工艺', '铝框加工分工', '挤出与阳极氧化与专业型材厂合作；冲孔、弯框、铆接成框、框壳固定为自有工序'],
  ['质量', '配件测试归属', '轮子、拉杆、锁、拉链等配件由配件厂商按其标准测试并出证'],
  ['商务', '交期', '25–55 天'],
  ['商务', '付款方式', '30% 定金，70% 尾款'],
];

/** 仍然缺失、必须由业务方补充的信息。 */
const STILL_MISSING = [
  ['合规', 'ISO 9001 证书编号与有效期', '确实持有；编号稍后提供（已进 TODO 的 P1）'],
  ['产品', 'Full Aluminum 两个系列的实际结构命名', '已定保留为两个系列页；若实际是铝框结构需改名（已进 TODO 的 P1）'],
  ['质量', 'SGS 测试报告编号', '成品测试已确认送测 SGS、无证书；报告编号可显著增强可信度（已进 TODO 的 P1）'],
  ['工艺', '铝框合金牌号与阳极氧化实测膜厚', '稍后提供（已进 TODO 的 P2）'],
  ['定位', '4 条产品线的外观/结构差异（各一句）', '决定 4 个页面能否各自站住一个词（已进 TODO 的 P2）'],
];

/** 每条产品线的主查询候选。注意：同一结构类型下有两条线，必须互相错开。 */
const QUERY_SETS = {
  aura: [
    'custom aluminum frame luggage collection manufacturer',
    'private label aluminum frame luggage',
    'polycarbonate aluminum frame suitcase factory',
    'design-led aluminum frame luggage OEM',
  ],
  'captain-frame': [
    'aluminum frame carry-on manufacturer',
    'custom aluminum frame carry-on OEM factory',
    'private label carry-on luggage supplier',
    'aluminum frame trolley suitcase manufacturer',
  ],
  'captain-full': [
    'full aluminum suitcase manufacturer',
    'all aluminum luggage OEM factory',
    'custom full aluminum carry-on supplier',
    'aluminum shell suitcase private label',
  ],
  voyager: [
    'premium aluminum carry-on manufacturer',
    'aluminum luggage private label factory',
    'custom aluminum shell suitcase OEM',
    'designer aluminum suitcase manufacturer',
  ],
};

const productPages = corpus.pages.filter((p) => p.urlPath.startsWith('/products/'));
const lines = LINES.map((L) => {
  const members = productPages
    .filter((p) => p.title.startsWith(L.titlePrefix))
    .map((p) => ({
      urlPath: p.urlPath,
      title: p.title,
      color: p.title.slice(L.titlePrefix.length).trim(),
      words: p.wordCount,
      inlinks: corpus.inlinkCounts[p.urlPath] ?? 0,
      originality: findings.thin?.[p.urlPath]?.originality ?? null,
    }));
  return { ...L, members, colors: members.map((m) => m.color) };
});

const removedLines = REMOVED_LINES.map((L) => {
  const members = productPages
    .filter((p) => p.title.startsWith(L.titlePrefix))
    .map((p) => ({ urlPath: p.urlPath, title: p.title, color: p.title.slice(L.titlePrefix.length).trim(), inlinks: corpus.inlinkCounts[p.urlPath] ?? 0 }));
  return { ...L, members };
});

const assigned = lines.reduce((a, l) => a + l.members.length, 0) + removedLines.reduce((a, l) => a + l.members.length, 0);
if (assigned !== productPages.length) {
  console.warn(`⚠ 产品页归属异常：分到 ${assigned} 个，实际 ${productPages.length} 个`);
}

/* ==================================================================== */
/* 二、新闻文章组                                                        */
/* ==================================================================== */

const newsroomGroup = (findings.cannibal?.groups || []).find(
  (g) => g.members.length >= 6 && g.members.every((m) => m.startsWith('/newsroom/')),
);
const articles = (newsroomGroup?.members || []).map((u) => {
  const p = pageByPath.get(u);
  return {
    urlPath: u,
    title: p.title.replace(/\s*[-|]\s*DJI Luggage\s*$/i, '').trim(),
    h1: p.h1[0] || '',
    words: p.wordCount,
    inlinks: corpus.inlinkCounts[u] ?? 0,
    excerpt: p.text.slice(0, 700),
  };
});

/* ==================================================================== */
/* 三、Jev 决策                                                          */
/* ==================================================================== */

if (!decisions) console.log(`\n▶ 决策 1/3：${articles.length} 篇文章的去留 + 中心页选题`);
const articleQuestions = {};
articles.forEach((a, i) => {
  articleQuestions[`fate_${i}`] = {
    type: 'choice',
    instructions: `页面 \`articles[${i}]\` 目前只有 222 词的模板内容，但标题指向一个具体主题。它应该怎么处理？`,
    criteria: {
      'merge-into-hub': '主题不足以独立成篇，把它的要点并入一篇综合指南即可',
      'keep-and-rewrite': '主题对 B2B 买家有独立搜索价值，值得单独重写成一篇文章',
      drop: '主题对本站的买家没有价值，直接删除并 301 到最接近的页面',
    },
  };
  articleQuestions[`demand_${i}`] = {
    type: 'noul',
    instructions: `\`articles[${i}].title\` 这个主题，会被正在寻找行李箱代工厂的品牌方当作独立问题去搜索或询问 AI（而不是只在读到别的文章时顺带了解）。`,
  };
});
articleQuestions.hub_topic = {
  type: 'choice',
  instructions:
    '如果只能保留一篇综合指南作为新闻中心的中心页，以哪个主题为骨架最合适？可以选现有 8 个主题之一，也可以选「把它们合并成一篇代工采购总指南」。',
  criteria: Object.fromEntries([
    ...articles.map((a, i) => [`use:${a.urlPath}`, `以「${a.title}」为主干扩展`]),
    ['new:combined-sourcing-guide', '新建一篇《定制行李箱代工采购总指南》，把 8 个主题作为章节合并进去'],
  ]),
};
if (decisions) console.log('\n▶ 复用上次决策（plan-decisions.json）');
const A1 = decisions?.A1 ?? (await ask('plan:articles', { articles }, articleQuestions));

const articlePlan = articles.map((a, i) => ({
  ...a,
  fate: A1[`fate_${i}`].choice,
  fateConfidence: A1[`fate_${i}`].confidence,
  demand: A1[`demand_${i}`].noul,
}));
const hub = A1.hub_topic.choice;

// 策略收敛：fate（三选一）是粗判断；demand（Noul）直接测量「该主题是否值得独立成篇」。
// 冲突时以 demand 为准，阈值 0.55。保留原始判断以便回溯。
const DEMAND_THRESHOLD = 0.55;
/** 与阈值距离小于此值的文章，单次抽样不足以定论，需人工决定 */
const BORDERLINE_BAND = 0.08;
for (const a of articlePlan) {
  a.fateModel = a.fate;
  if (a.fate === 'keep-and-rewrite' && a.demand < DEMAND_THRESHOLD) a.fate = 'merge-into-hub';
  a.policyAdjusted = a.fate !== a.fateModel;
  a.borderline = Math.abs(a.demand - DEMAND_THRESHOLD) < BORDERLINE_BAND;
}
console.log(
  `   策略收敛：独立成篇 ${articlePlan.filter((a) => a.fate === 'keep-and-rewrite').length} 篇，并入中心页 ${articlePlan.filter((a) => a.fate === 'merge-into-hub').length} 篇`,
);

if (!decisions) console.log(`\n▶ 决策 2/3：4 条产品线的 canonical 与主目标查询`);
const productQuestions = {};
lines.forEach((L, i) => {
  const slugOpts = { [`new:${L.newSlug}`]: `新建干净的系列页 ${L.newSlug}（推荐做法：URL 反映产品线而不是颜色）` };
  for (const m of L.members) slugOpts[`keep:${m.urlPath}`] = `沿用 ${m.urlPath}（标题：${m.title}）`;
  productQuestions[`slug_${i}`] = {
    type: 'choice',
    instructions: `\`lines[${i}]\` 这一组同色系产品页合并后，唯一保留的 canonical URL 应该是哪一个？`,
    criteria: slugOpts,
  };

  // AURA / Captain / Voyager 是本站自有的产品线命名，没有任何搜索量，
  // 也不能拿名称当关键词。主查询必须由「结构类型 + 采购意图/定位」组成。
  // 关键约束：4 个页面会同时上线，主查询必须互不重叠，否则等于一边合并一边制造新的蚕食。
  const opts = QUERY_SETS[L.id];
  productQuestions[`query_${i}`] = {
    type: 'choice',
    instructions: `\`lines[${i}]\`（结构类型：${CONSTRUCTION[L.id]}，颜色：${L.colors.join("、")}）这条产品线页面的主查询应该选哪个？**这 4 个产品线页会同时上线，主查询必须互不重叠**——如果你要选的词已经被另一条线占用，请改选别的。`,
    criteria: Object.fromEntries(opts.map((o) => [o, `主查询候选：「${o}」`])),
  };
});
productQuestions.differentiation_axis = {
  type: 'choice',
  instructions: '这 4 条产品线其实是 2 种结构（铝框 / 全铝）× 2 条线。为了让 4 个页面不互相蚕食，最站得住的差异化轴是哪一个？',
  criteria: {
    'by-construction': '按结构分：铝框一条线、全铝一条线（但这样每种结构只剩一个页面，实际有 4 个页面要安置）',
    'by-price-tier': '按价位带分：入门 / 中端 / 高端（需要客户端提供真实定位）',
    'by-target-market': '按目标市场分：不同地区或渠道（需要客户端提供实际客户结构）',
    'by-product-form': '按产品形态分：登机箱 / 中号 / 大号 / 套装',
    'by-styling': '按外观风格分：经典竖棱 / 平滑包角 / 设计款',
  },
};

const A2 =
  decisions?.A2 ??
  (await ask('plan:products', { lines: lines.map((l) => ({ id: l.id, line: l.titlePrefix, colors: l.colors, new_slug: l.newSlug })) }, productQuestions));

const AXIS_LABELS = {
  'by-construction': '结构',
  'by-price-tier': '价位带',
  'by-target-market': '目标市场',
  'by-product-form': '产品形态',
  'by-styling': '外观风格',
};
const differentiationAxis = A2.differentiation_axis.choice;

const linePlan = lines.map((L, i) => ({
  ...L,
  canonical: A2[`slug_${i}`].choice.replace(/^new:/, '').replace(/^keep:/, ''),
  canonicalIsNew: A2[`slug_${i}`].choice.startsWith('new:'),
  canonicalConfidence: A2[`slug_${i}`].confidence,
  primaryQuery: A2[`query_${i}`].choice,
}));

if (!decisions) console.log(`\n▶ 决策 3/3：产品线页面必备的事实清单`);
const FACT_CANDIDATES = {
  moq: '起订量（按材质/颜色/工艺分档的真实 MOQ）',
  leadtime: '交期（打样天数、量产天数，以及各自的起算条件）',
  capacity: '产能（月产能、产线数、机台数或员工数）',
  dimensions: '尺寸与重量（每个尺寸的长宽高、容积 L、净重 kg）',
  material: '材质规格（铝框壁厚、PC 层厚、轮子材质、锁具型号）',
  customization: '定制选项（logo 工艺、内衬、包装、色卡与打样政策）',
  certification: '认证与检测（ISO 9001、BSCI、Sedex、REACH、TSA 等具名标准）',
  qc: '质量流程（检验道数、AQL 标准、抽检比例、跌落/拉杆测试）',
  sampling: '打样流程（几步、每步耗时、样品费用与退还政策）',
  export: '出口与包装（装箱量、外箱规格、整柜装载量、贸易条款）',
  payment: '付款与贸易条款（定金比例、付款方式、FOB/CIF）',
  cases: '客户与市场（合作品牌类型、主要出口市场、可公开的案例）',
};
const factQuestions = {};
for (const [k, desc] of Object.entries(FACT_CANDIDATES)) {
  factQuestions[`need_${k}`] = {
    type: 'noul',
    instructions: `一条 B2B 铝框行李箱产品线页面，为了让采购方和 AI 都能用它做判断，是否必须写出这项事实：${desc}。`,
    criteria: { true: '缺了它这页就不能用于采购决策', false: '有更好，但不是必备' },
  };
}
const A3 =
  decisions?.A3 ?? (await ask('plan:facts', { note: '为 B2B 铝框行李箱产品线页面判断必备事实' }, factQuestions));
if (!decisions) {
  writeFileSync(
    DECISIONS_PATH,
    JSON.stringify({ decidedAt: new Date().toISOString(), model, usage, A1, A2, A3 }, null, 2),
  );
}

const facts = Object.entries(FACT_CANDIDATES)
  .map(([k, desc]) => ({ k, desc, need: A3[`need_${k}`].noul }))
  .sort((a, b) => b.need - a.need);

// 代码硬检查：4 条线的主查询不得重复，否则合并会制造新的蚕食
const queryCount = {};
for (const L of linePlan) queryCount[L.primaryQuery] = (queryCount[L.primaryQuery] || 0) + 1;
const duplicateQueries = Object.entries(queryCount).filter(([, n]) => n > 1);
if (duplicateQueries.length) {
  console.warn('⚠ 主查询重复：' + duplicateQueries.map(([q, n]) => `${q} ×${n}`).join('；') + ' —— 上线前必须人工错开');
}

/* ==================================================================== */
/* 四、由代码精确生成的映射表                                            */
/* ==================================================================== */

// 产品页 301 表：保留线合并到系列页；删除线落到总目录
const productRedirects = [];
for (const L of removedLines) {
  for (const m of L.members) {
    productRedirects.push({ from: m.urlPath, to: REMOVED_TARGET, color: m.color, line: L.titlePrefix, removed: true });
  }
}
for (const L of linePlan) {
  for (const m of L.members) {
    const target = L.canonicalIsNew ? L.newSlug : L.canonical;
    if (`${SITE}${m.urlPath}/` === `${SITE}${target}` || m.urlPath === target.replace(/\/$/, '')) continue;
    productRedirects.push({ from: m.urlPath, to: target, color: m.color, line: L.titlePrefix });
  }
}

// 新闻文章 301 表
const hubPath = hub.startsWith('use:') ? hub.slice(4) : '/newsroom';
const hubIsNew = hub.startsWith('new:');
const articleRedirects = articlePlan
  .filter((a) => a.fate !== 'keep-and-rewrite')
  .map((a) => ({ from: a.urlPath, to: hubIsNew ? '/newsroom/custom-luggage-sourcing-guide/' : hubPath, fate: a.fate }));
const keptArticles = articlePlan.filter((a) => a.fate === 'keep-and-rewrite');

// 内链计划：两端都存活的可以立即做；指向被吸收页面的需要改写
const absorbed = new Map([
  ...productRedirects.map((r) => [r.from, r.to]),
  ...articleRedirects.map((r) => [r.from, r.to]),
]);
const accepted = (findings.linkCandidates || []).filter((c) => c.worth >= 0.6 && c.relation !== 'unrelated');
const linkPlan = accepted.map((c) => {
  const fromAbsorbed = absorbed.has(c.from);
  const toAbsorbed = absorbed.has(c.to);
  return {
    ...c,
    fromFinal: absorbed.get(c.from) || c.from,
    toFinal: absorbed.get(c.to) || c.to,
    action: fromAbsorbed || toAbsorbed ? 'rewrite-after-merge' : 'do-now',
  };
});
const doNow = linkPlan.filter((l) => l.action === 'do-now' && l.fromFinal !== l.toFinal);
const rewriteLater = linkPlan.filter((l) => l.action === 'rewrite-after-merge');

// 导航与筛选页
const filterPages = corpus.pages.filter((p) => p.urlPath.startsWith('/newsroom/filters/')).map((p) => p.urlPath);
const navLinksToFilters = corpus.links.filter((l) => filterPages.includes(l.to));
const newsroomInlinks = corpus.inlinkCounts['/newsroom'] ?? 0;

/* ==================================================================== */
/* 五、输出                                                              */
/* ==================================================================== */

const md = [];
const P = (s = '') => md.push(s);

P(`# djiluggage.id 内容合并方案`);
P();
P(`生成于 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 判断模型 ${model || 'jev-latest'} · 数据源 \`.seo-geo/site/\``);
P();
P(`> 本方案只描述**改什么、改成什么、验收看什么**，不直接修改站点文件。`);
P(`> 所有 URL 与 301 映射由代码从真实页面数据生成；需要判断的部分（文章去留、产品线 canonical、必备事实）由 Jev 给出并标注置信度。`);
P(`> **凡标记「需你提供」的数字，本方案不编造**——站点上目前不存在这些事实，必须由业务方给出后才能写入。`);
P();

P(`## 0 · 执行顺序与依赖`);
P();
P(`| 顺序 | 阶段 | 为什么必须在这个位置 | 产出 |`);
P(`|---|---|---|---|`);
P(`| 1 | 8 篇文章合并/重写 | 它们互相蚕食且是模板文；先定去留，才知道哪些内链值得建 | 1 篇中心页 + ${articleRedirects.length} 条 301 |`);
P(`| 2 | 21 个产品页合并为 4 个产品线页 | 占全站 URL 的 46%，是薄内容的主体 | 4 个系列页 + ${productRedirects.length} 条 301 |`);
P(`| 3 | 修 \`/newsroom\` 孤岛与 3 个筛选页 | 必须在 1 之后：中心页定下来才能决定导航指向 | 导航与 ${navLinksToFilters.length} 条内链改向 |`);
P(`| 4 | 新增内链 | 必须在 1、2 之后：否则会把链接加到将要消失的 URL 上 | ${doNow.length} 条现在就能做，${rewriteLater.length} 条需改写 |`);
P();
P(`依赖关系是硬的：**第 4 步的 ${rewriteLater.length} 条建议里，有一端是待合并页面**。先做内链再做合并，等于把工作量投在即将 301 的 URL 上。`);
P();
P(`**已定决策（2026-09-25）：** 接受 21 个产品 URL 合并为 4 个（${productRedirects.length} 条 301）；新闻文章按独立需求阈值收敛为 4 篇保留 + 4 篇并入中心页。`);
P();
P(`### 0.1 前提：不同 AI 引擎对「印尼能不能做硬箱」给出相反答案`);
P();
P(`本轮 AI 可见性实测里，两个引擎在被问到「东南亚/印尼有哪些 OEM 行李箱工厂」时，给出一致判断：`);
P();
P(`> For Indonesia specifically, dedicated export-scale luggage OEM factories are less visible than Thailand and Vietnam, particularly for injection-molded hard-shell suitcases. … If your product is a hard-shell suitcase, Thailand or Vietnam is likely the more practical first route.`);
P(`> —— gpt-5.6-terra，p2`);
P();
P(`> If you need polycarbonate or ABS hard-shell luggage, confirm their molding capability before proceeding; many Indonesian bag factories specialize in soft luggage rather than molded cases.`);
P(`> —— gpt-5.6-luna，p2（唯一被它推荐的印尼工厂是软箱厂）`);
P();
P(`**Gemini 的答案正好相反**：它认为印尼是承接中国/台湾箱包产业转移的重要阵地，产业带在西爪哇（万隆、唐格朗、梳邦）与中爪哇（三宝垄），并点名了 PT. Lee Der Industrial、PT. Gajah Tunggal Group 这类中资/台资背景、给 Samsonite / American Tourister / Tumi 代工的大厂。`);
P();
P(`**把两者合起来看，结论是**：三家引擎唯一的共识是「本站不在候选集里」。codex 型引擎认为印尼缺硬壳产能，需要产能证据；Gemini 型引擎知道印尼能做，但只认识大型中资/台资厂，需要的是「在印尼硬箱供给图谱里被识别为具体实体」。两类引擎要的东西不同，落到内容上是同一件事。`);
P();
P(`**这对本方案的直接影响**：如果只按第 1–4 阶段把页面写深写全，本站仍然不会进入任何一类引擎的候选集。所以每个新页面都必须额外承担一件事——**用可引用的事实证明「印尼的硬壳产能存在且可验证」**：`);
P();
P(`| 要证明的事 | 具体写成什么 | 为什么是它 |`);
P(`|---|---|---|`);
P(`| 硬壳产线真实存在 | 注塑机台数与吨位、铝框加工工序、模具自制或外协比例 | 直接回应「confirm their molding capability」这句话 |`);
P(`| 硬壳产量有规模 | 月产能（只数）、硬壳占比、出口国家数与年出货量 | 回应「export-scale … less visible」 |`);
P(`| 零部件配套完整 | 轮子、拉杆、锁具的供应来源与是否自有工序 | 回应「component sourcing may be less integrated」 |`);
P(`| 质量可验证 | 检验道数、AQL、跌落/拉杆/行走测试标准与报告 | 硬壳的主要失效点，也是买家最担心的地方 |`);
P(`| 合规与出口记录 | 认证编号、原产地证与主要出口市场 | AI 引用时最需要「可溯源」的事实 |`);
P();
P(`**这同时是一个没有被占据的定位。** 英文语料里几乎没有「印尼本土硬箱代工厂」的成型内容，而泰国/越南/中国的同类内容已经饱和；Gemini 已经承认印尼这个产地可行，缺的只是「谁在做」。第 0.2 节已确认的那批数据，正是填这个位置的原料。`);
P();
P();

/* ---------------- 0.2 已确认事实 ---------------- */
P(`## 0.2 · 已确认事实（业务方提供，可直接写进页面）`);
P();
P(`这些数据是第 1、2 阶段所有页面的原料，也是回应「印尼没有硬壳产能」的直接证据。`);
P();
P(`| 类别 | 事实 | 内容 |`);
P(`|---|---|---|`);
for (const [cat, key, val] of CONFIRMED_FACTS) P(`| ${cat} | ${key} | ${val} |`);
P();
P(`### 这批数据里最有价值的三条`);
P();
P(`1. **MOQ 200 只。** 这是全站最硬的差异化事实。它正好对应 AI 提问 p5「小批量铝框登机箱找哪家」——那一题 AI 没有推荐任何具体工厂，只给了产区。`);
P(`2. **月产能 30,000 只 + 70% 硬壳 + 年出货 80 个 40HQ。** 三个数字互相印证，可以直接反驳 AI 那句「export-scale factories are less visible」。`);
P(`3. **包装与防潮那一段。** 「跨赤道海运的集装箱雨 → 内胆网袋放硅胶干燥剂」是本轮所有素材里最像 AI 答案的一条：具体、有因果、可被整段摘引。这类内容正是基准站（Omaska 3,883 词文章、Protolabs 设计规范页）用来被引用的东西。`);
P();
P(`> 注意措辞纪律：以上数据只能按业务方给的原文写，不要换算、不要外推。例如「80 个 40HQ」不要写成「约 200 万只」。`);
P();

/* ---------------- 0.3 文案草稿 ---------------- */
P(`## 0.3 · 文案草稿（可直接写进页面，英文）`);
P();
P(`站点是英文站，所以下面直接给可用的英文表述；中文是给你核对事实用的，不要上线。`);
P();
P(`### 产能与材料（放在首页与 4 个系列页的开头）`);
P();
P(`> We manufacture both soft-shell and hard-shell luggage in Indonesia — PP, PC, ABS+PC, and aluminum-frame — with a monthly capacity of 30,000 units, of which roughly 70% are hard-shell. We ship around 80 × 40HQ containers a year to four markets: China, Indonesia, Australia, and Germany.`);
P();
P(`中文核对：软箱与硬箱都做；材质 PP、PC、ABS+PC、铝框；月产能 30,000 只；硬壳占比约 70%；年出货约 80 个 40HQ；出口中国、印尼、澳大利亚、德国。`);
P();
P(`> Our production lines can switch between hard-shell and soft-shell runs, and we hold ISO 9001 certification. Moulds are made in-house — 100% of them — which is what lets us take on new shapes without waiting on a third party.`);
P();
P(`中文核对：产线可在硬箱/软箱之间切换；持有 ISO 9001；模具 100% 自制。`);
P();
P(`### 起订与商务条件（放在每个系列页的规格区与 FAQ）`);
P();
P(`> **MOQ:** 200 units. **Lead time:** 25–55 days. **Payment:** 30% deposit, 70% balance.`);
P();
P(`中文核对：MOQ 200 只；交期 25–55 天；30% 定金 / 70% 尾款。`);
P();
P(`> 注意：页面上原有的「Sample lead time 7–15 working days / Bulk lead time 35–55 days」与本次给的「25–55 天」不一致。上线前必须二选一，否则同一页面上出现两个互相矛盾的交期，会同时伤害买家信任与结构化数据一致性。`);
P();
P(`### 出口包装（这一整段建议原样保留，它是最像 AI 答案的内容）`);
P();
P(`> **Packaging options.** Cases ship either as single packs or as nested packs — for example a 20\"+24\"+28\" three-piece set nested into one another. When smaller cases go inside larger ones, we place non-woven fabric or EPE foam between the shells.`);
P();
P(`> Every case, including the nested inner cases, goes into a PE/PP polybag. This matters more than it sounds: unprotected ABS, PC, and aluminium-magnesium shells pick up scuff marks under high humidity or during rough handling.`);
P();
P(`> At the two points that take the most load — the base of the spinner wheels and the top of the telescopic handle — we add die-cut corrugated corner guards or EPE foam pads, so that stacking or a drop does not crack the wheel housing.`);
P();
P(`> For sea freight crossing the equator, condensation inside the container ("container rain") is a real risk. Every case carries silica gel desiccant or an anti-mould patch in its interior mesh pocket.`);
P();
P(`> All packaging materials comply with EU PPWR, US CONEG (heavy metals < 100 ppm), and REACH (no DMFu anti-mould agents).`);
P();
P(`中文核对：单只装 / 套娃式嵌套装（20\"+24\"+28\"）；箱间无纺布或珍珠棉；每只含嵌套内箱套 PE/PP 防尘袋（防潮防刮）；
轮座与拉杆位加瓦楞纸模切护角或 EPE 缓冲（防堆叠/跌落开裂）；内胆网袋放硅胶干燥剂或防霉贴片（跨赤道海运集装箱雨）；
包装材料符合 EU PPWR / US CONEG（重金属 <100ppm）/ REACH（无 DMFu）。`);
P();
P(`> 为什么这段值得原样上：它是具体、有因果、可被整段摘引的技术内容。基准里被引用最多的页面（Omaska 3,883 词文章、Protolabs 设计规范页）靠的就是这类段落。`);
P();

P(`## 0.4 · 质量与测试（可直接上线的文案，英文）`);
P();
P(`> 这一段是**按行业真实标准与品牌公开协议**写的，不是凭空编的。每个数字后面都标了来源标准号。`);
P(`> 但有一条硬规则：**上线前必须逐项确认你们确实在做这些测试**。写了不做的测试，一旦被买家要求出示报告就无法收场。`);
P();
P(`### 先记住两件事，否则会写错`);
P();
P(`1. **行李箱行业没有统一的国际（ISO/IEC）产品标准。** 中国用 QB/T 2155-2018（轻工行业标准），台湾用 CNS 15331:2018，德国 GS 用 EK5/TA2:2011，测试机构用 SATRA 的 TM 系列方法。不存在「旅行箱 ISO 标准」这种东西。`);
P(`2. **QB/T 的滚筒冲击（QB/T 4116）与塑料箱面落球冲击（QB/T 2918）明确「不适用于金属材质硬箱」。** 所以铝框箱不能套用塑料硬箱的测试项，必须走铝框专项（铝口硬度、盐雾、开合寿命）。这一点很多同业文案都写错了。`);
P();
P(`### 英文文案（建议作为独立的 Quality and Testing 区块，或系列页的 FAQ）`);
P();
P(`> **Who tests what.** Component-level testing is carried out and certified by the manufacturers of those components. Wheels and casters, trolley assemblies and handles, locks and zippers all arrive with their own test documentation, which we can supply on request. Testing of the assembled case is a separate matter and is described below.`);
P();
P(`> **How the finished case is tested.** Finished cases are sent to SGS for testing against QB/T 2155-2018, the Chinese luggage standard, together with the SATRA TM methods used by international brands. Aluminium-frame models follow a separate schedule, because the standard tumble and falling-weight tests for plastic shells are explicitly not applicable to metal cases.`);
P();
P(`> **Trolley and handles.** Trolley and handle assemblies are tested by their manufacturers. The telescopic trolley is cycled 3,000 times at 15 to 25 cycles per minute depending on handle length, with a five-minute pause every 1,000 cycles, and must finish with no deformation, jamming, or loosening. The top handle and side handle each take 300 impact cycles, and the trolley 500 cycles on cases under 610 mm - each cycle lifting the loaded case 150 mm and releasing it at 20 cycles per minute. On the assembled case we separately lift and hold the loaded case by its handle to check static strength.`);
P();
P(`> **Wheels.** A two-wheel case runs 8 km on a cement-drum rig and then 4 km on a conveyor rig with raised cleats. A four-wheel case runs 8 km, then 2 km, then 2 km. Wheel wear must stay within 2 mm, with no cracking at the wheel housing or axle and no loss of free rotation. We also run the case down 25 consecutive steps at 200 mm step height under load.`);
P();
P(`> **Drop and impact (plastic shells).** The case is conditioned at 18 to 25 degrees Celsius for at least an hour, then released from 900 mm onto a 45-graded steel plate: once handle-up and once side-handle-up. The shell, case mouth and frame must not crack; wheels, axles and housings must survive; the lock must still open. For cold-weather behaviour the case is conditioned at minus 12 degrees Celsius for four hours and dropped from 90 cm, five times on the base, once on every other face, and once on each of the four side edges.`);
P();
P(`> **Stacking.** A hard case is pressed uniformly for four continuous hours: 40 kg on cases from 535 to 660 mm, 60 kg on cases from 685 to 835 mm. The shell must not deform or collapse, and the case must still open and close normally.`);
P();
P(`> **Aluminium frame specifics.** The frame is bent from extruded profile and riveted closed, not welded. Frame hardness is specified in QB/T 2155-2018 itself: the aluminium case mouth is tested by Brinell hardness to GB/T 231.1 and must reach at least 40 HWB. Anodising is the standard finish, with an oxide film of 10 to 12 micrometres. Salt-spray testing follows QB/T 3826 - 16 hours for the case, with the zipper pull tested separately - and must leave no more than three corrosion points, each no larger than one square millimetre.`);
P();
P(`> **Locks and closures.** Locks and zippers are tested by their manufacturers. Lock durability is checked after the case-level rolling, impact and drop tests rather than before, then cycled through 300 openings and closings using ten different code combinations. Zippers are cycled 200 times and must finish with no missing or misaligned teeth. Where a TSA lock is fitted, it carries the Travel Sentry red-diamond mark recognised by screening authorities in more than 80 countries.`);
P();
P(`> **Climate.** Cases go through three environmental cycles of 98 percent relative humidity at 38 degrees Celsius for 24 hours, then 65 degrees Celsius for 24 hours, then minus 12 degrees Celsius for 24 hours. Hardware is additionally held at 98 percent humidity and 38 degrees Celsius for 240 hours and checked for oxidation, damage, and flaking.`);
P();
P(`> **Colour and finish.** Rubbing colour fastness is tested dry and wet, to grade 4 and grade 3 respectively. Where a fabric is specified as abrasion resistant, it is tested on a Martindale rig at 9 kPa for 7,000 rubs.`);
P();
P(`> **How the load figures are set.** The drop, rolling and impact tests are not run at arbitrary weights. QB/T 2155-2018 sets a specified load by case size: 8 kg at 18 inches, 12 kg at 19 to 21 inches, 14 kg at 22 to 24 inches, 16 kg at 25 to 28 inches, 20 kg at 29 to 31 inches, and 24 kg at 32 inches, excluding the weight of the case itself.`);
P();
P(`> **Soft-shell construction.** Where a sewn panel carries load, stitching strength is tested on a 100 by 30 mm specimen at a pull rate of 100 mm per minute and must reach at least 240 N.`);
P();
P(`> **Restricted substances.** Case and lining materials are tested for free formaldehyde at no more than 300 mg per kg and for decomposable aromatic amines at no more than 30 mg per kg. Packaging materials additionally comply with EU PPWR, US CONEG (heavy metals under 100 ppm) and REACH (no DMFu anti-mould agents).`);
P();
P(`> **Transport.** Shipping performance follows ASTM D4169 and ASTM D999 for container vibration, and ISO 4180 for test-schedule compilation.`);
P();
P(`### 中文对照（给你核对，不要上线）`);
P();
P(`| 测试项 | 数字 | 来源标准 |`);
P(`|---|---|---|`);
P(`| 拉杆耐疲劳 | 3,000 次，15/20/25 次每分，每 1,000 次停 5 分钟 | QB/T 2155-2018 |`);
P(`| 提把振荡冲击 | 硬箱提把 300 次、侧提把 300 次、拉杆 500 次（<610mm）/300 次（>610mm）；提升 150mm、20 次每分 | QB/T 2155-2018 |`);
P(`| 行走 | 两轮：水泥辊 8km + 传送带 4km；四轮：8+2+2km；走轮磨损 ≤2mm | QB/T 2155-2018 |`);
P(`| 跌落 | 18–25℃ 预处理 ≥1h，900mm 落 45 号钢板，提把朝上 1 次 + 侧提把朝上 1 次 | QB/T 2155-2018 |`);
P(`| 低温跌落 | −12±2℃ 预处理 4h，90cm 跌落：底面 5 次 + 其余每面 1 次 + 4 条侧棱各 1 次 | CNS 15331:2018 |`);
P(`| 静压 | 535–660mm 负重 40kg；685–835mm 负重 60kg；连续 4h | T/XGXB 001—2025 |`);
P(`| 铝口硬度 | ≥40 HBW（布氏，按 GB/T 231.1） | T/XGXB 001—2025 |`);
P(`| 盐雾 | 腐蚀点 ≤3 个且单个 ≤1mm²；阳极氧化验收 48h | T/XGXB 001—2025 / 工厂实践 |`);
P(`| 开合寿命 | 合页 5,000 次（公共采购规格） | 印度 MHA 规格 |`);
P(`| 锁耐用 | 行走/冲击/跌落/滚筒之后再做，300 次、10 组乱码 | T/XGXB 001—2025 |`);
P(`| 拉链 | 200 次无掉牙错牙（部分采购规格要求 5,000 次） | 消委会 2024 / MHA |`);
P(`| 环境循环 | 3 个循环：98%RH@38℃ 24h → 65℃ 24h → −12℃ 24h | 印度 MHA 规格 |`);
P(`| 五金耐湿 | 98%RH@38℃ × 240h 无氧化起皮 | 印度 MHA 规格 |`);
P(`| 摩擦色牢度 | 干擦 ≥4 级、湿擦 ≥3 级 | QB/T 2155-2018 |`);
P(`| 阳极氧化膜厚 | 10–12 μm | 佛山铝型材厂公开规格 |`);
P(`| 规定负重 | 18 寸→8kg；19–21 寸→12kg；22–24 寸→14kg；25–28 寸→16kg；29–31 寸→20kg；32 寸→24kg（不含箱自重） | QB/T 2155-2018 表 5 |`);
P(`| 铝合金箱口硬度 | ≥40 HWB（布氏，按 GB/T 231.1）—— 这是 QB/T 2155-2018 本身的要求 | QB/T 2155-2018 |`);
P(`| 盐雾 | 16 h（拉链头只测拉片） | QB/T 2155-2018 |`);
P(`| 缝合强度 | ≥240 N（100×30mm 试样，100mm/min） | QB/T 2155-2018 |`);
P(`| 有害物质 | 游离甲醛 ≤300 mg/kg；可分解芳香胺 ≤30 mg/kg | QB/T 2155-2018 |`);
P(`| 箱锁耐用 | 100 次（QB/T 2155-2018 基线）；团标 AAA 300 次 | QB/T 2155-2018 / T/XGXB 001—2025 |`);
P();
P(`### ⚠️ 以下标准号严禁出现在文案里（业界常见误引，已逐条核实）`);
P();
P(`| 被误用的编号 | 它实际上是什么 |`);
P(`|---|---|`);
P(`| SATRA「STM 302 / 305 / 307 / 308 / 501 / 551」 | **不存在。** SATRA 只用 TM 编号；箱包方法只有 TM241–TM249。SATRA 官方目录里「STM」字符串出现 0 次。 |`);
P(`| ASTM F1975 | 自行车儿童拖车标准 |`);
P(`| ISO 8114:1990 | 纺织机械锭子术语（已于 2024 年撤销） |`);
P(`| EN 12546-2 | 食品保温袋/保温箱 |`);
P(`| EN 17278:2021 | 车辆加注设备 |`);
P(`| ASTM F2028 | 肩关节盂植入物（**Bureau Veritas 官网自己引错了，不要转抄**） |`);
P(`| GB/T 35262-2017 | PVC 塑料回收料的表征特性 |`);
P(`| **团体标准的分级值** | 拉杆 4500/4000/3500 次、铝口硬度 45/40/35 HBW 这类分级值，是团体标准（T/XGXB、T/BYFZFS）自己加的，**不是 QB/T 2155-2018 的规定**。要么标团标号，要么不要写。 |`);
P(`| **QB/T 2155-2004 的旧数值** | 负重 14/18/20/22/28/30 kg、耐冲击 300 mm、落球钢球 φ100mm/500mm 都是 **2004 版**的数值，现行版是 2018。混用会被懂行的人一眼看穿。 |`);
P(`| **ASTM D4169 的保证等级** | 该标准 2022 版是否取消了保证等级选择存在资料冲突，未购买标准正文前不要做任何保证等级声明。 |`);
P();
P(`### 需要你确认的三件事`);
P();
P(`- [x] 配件测试归属：**配件厂商做**（已确认），文案已改为由配件制造商出证。`);
P(`- [x] 成品测试：**送测 SGS**（已确认）。文案已改为 sent to SGS。`);
P(`- [x] **不写「认证」**：明确没有证书，所以文案只说 tested by SGS，绝不能说 certified。这是必须守住的措辞边界。`);
P(`- [ ] 向 SGS 索取**测试报告编号**并写进页面。测试报告与证书不同，但报告编号同样可核实——「Report No. XXXXX」比「tested by SGS」有力得多，而且这是零成本的提升。`);
P(`- [ ] 上面每一项成品测试，有没有**没做**的？没做的要从文案里删掉。`);
P(`- [ ] 合页开合寿命你们的实际标准是多少次（行业里从 5,000 到 15,000 都有，我们不能替你选）。`);
P(`- [ ] 是否配 TSA 锁？如果配，是 Travel Sentry 认证锁还是普通海关锁（这决定能不能写 red-diamond 那句）。`);
P();

P(`## 0.5 · 铝框箱生产工艺（可直接上线的文案，英文）`);
P();
P(`> 这段描述的是**行业真实的铝框箱产线**，来自中国专利全文、政府环评文件（含真实设备清单）与铝型材厂公开规格。`);
P(`> 有一个结论与很多同业的说法相反，必须先说：**铝框是铆接成框的，不是焊接的。** 检索到的量产专利里「铆接成框」被明确记载，焊接只作为全铝箱箱体接缝的替代方案出现。文案里不要写 welding。`);
P();
P(`### 英文文案`);
P();
P(`> **How an aluminium-frame case is built.** The frame and the shell are made on separate lines and only meet at assembly.`);
P();
P(`> **1. Profile extrusion (partner plant).** We work with specialist aluminium profile extruders. Billet is heated and pressed through a die into the frame profile, then straightened, cut to length and age-hardened. Structural frames and trolley tubes use 6000-series alloys, typically 6061 or 6063 in T6 temper.`);
P();
P(`> **2. Cutting.** The profile is cut to twice the case length plus twice the width, plus the arc length of each bend.`);
P();
P(`> **3. Punching.** Mounting holes for the latches, hinges and corner fixings are punched. A rotating fixture lets the frame be indexed and punched on several faces in one set-up, which is what keeps the hole pattern aligned.`);
P();
P(`> **4. Bending.** A dedicated bending die forms the straight profile into a radiused rectangle, with both the front and rear bars bent in the same pass so that the bend angles and the distances between them stay accurate.`);
P();
P(`> **5. Closing the frame.** The profile ends are riveted to close the frame. Production frames are riveted, not welded.`);
P();
P(`> **6. Surface treatment (partner plant).** Anodising is specified at an oxide film of 10 to 12 micrometres. Brushing, sandblasting, polishing and powder coating are also available. Frame colour can be matched to a Pantone reference before the finishing stage.`);
P();
P(`> **7. Shell forming.** For PC and ABS+PC shells, sheet is extruded at 240 to 250 degrees Celsius, dried, preheated in an oven at around 100 degrees Celsius, then vacuum-formed at around 135 degrees Celsius and trimmed and drilled. Full-aluminium shells are instead deep-drawn from aluminium sheet on a large hydraulic press.`);
P();
P(`> **8. Frame to shell.** The shell and frame are joined with rivets or self-tapping screws driven into captive nuts, with the screw heads recessed so they sit below the frame surface.`);
P();
P(`> **9. Hardware.** Hinges and the lock are installed on the holes punched in step 3. On integrated designs the lock body and the handle share a single housing, which removes a separate handle-fitting operation.`);
P();
P(`> **10. Wheels and trolley.** Casters are mounted to the base by rivets or screws; the trolley is bolted to the shell and then concealed by the lining, so no fastener is visible from inside the case.`);
P();
P(`> **11. Lining.** Lining is cut and sewn in-house. It is either glued into the shell, or held by an extruded plastic clip sewn into the lining edge that snaps into a channel on the frame — the second method removes the gluing and edge-trimming steps and makes the lining replaceable.`);
P();
P(`> **12. Final assembly and testing.** Shell, frame, lining, wheels, trolley, lock and trim are assembled on a line, then the case goes to the test schedule above.`);
P();
P(`### 自有 vs 外协（这一节决定文案能怎么写）`);
P();
P(`| 工序 | 行业实际情况 | 能不能写「自有」 |`);
P(`|---|---|---|`);
P(`| 铝型材挤出 | **通常外协。** 证据：箱包厂的环评设备清单里有吸塑机、注塑机、抽板机、针车、铆钉机、冲孔机，**没有挤压机、没有阳极氧化线**，且环评明确「不涉及酸洗、喷涂等排放异味工序」；同时市面上存在专营箱包铝型材的挤压厂（年产 2000 吨级）。 | 除非你有挤压线，否则写「我们与专业型材厂合作」 |`);
P(`| 阳极氧化 / 喷涂 | **通常外协**，在型材厂一体化完成（挤出 + 氧化是打包服务）。 | 同上 |`);
P(`| 冲孔 | 自有（箱包厂普遍有冲孔机多台） | ✅ |`);
P(`| 弯框 | 自有（箱包厂用专用铝条弯框机） | ✅ |`);
P(`| 铆接成框 | 自有 | ✅ |`);
P(`| 箱壳抽板 / 吸塑 | 自有（环评中抽板车间、吸塑车间均属本厂） | ✅ |`);
P(`| 切边打孔 | 自有（切边打孔一体机） | ✅ |`);
P(`| 铝框与箱壳固定 | 自有（打铆钉机 + 手持电动打螺丝机） | ✅ |`);
P(`| 内衬缝制 | 自有（大型厂针车可上百台） | ✅ |`);
P(`| 总装与质检 | 自有（组装线与试验室：振荡冲击试验机、恒温恒湿箱、跌落试验机、拉杆测试机） | ✅ |`);
P();
P(`### 查不到、因此不能写的三件事`);
P();
P(`1. **不要写「铝框四角采用焊接工艺」。** 没有任何来源支持量产铝框箱的框角焊接；专利里是铆接。`);
P(`2. **不要写「采用角件/角码加强」。** 独立角件只见于铝合金工具箱/设备箱，未能核实用于旅行箱；箱包专利用的是连续弯制条料 + 圆角。`);
P(`3. **不要写具体的圆角半径数值**（如 3–5 cm），除非你们自己的模具图纸确认——那是 RIMOWA 专利里的数值，不是行业通用值。`);
P();
P(`### 需要你确认`);
P();
P(`- [x] 挤出与阳极氧化：**与专业型材厂合作**（已确认），文案已改为 partner plant。`);
P(`- [ ] 冲孔 / 弯框 / 铆接成框 / 铝框与箱壳固定，这四道是否都在自己厂内？`);
P(`- [ ] 铝框合金牌号用的是什么（6061 / 6063 / 5052）？阳极氧化膜厚实测多少？`);
P(`- [x] 全铝箱：**暂不做**（已确认）。但站上有 7 个页面叫 Captain / Voyager Full Aluminum——见第 2 节红框提示。`);
P();

P(`## 0.6 · 内容草稿进度`);
P();
P(`英文正文草稿已写在 **.workbuddy-ai/reports/content-drafts-2026-09-25.md**，可直接取用。当前进度：`);
P();
P(`| 页面 | 已完成 | 目标 | 状态 |`);
P(`|---|---|---|---|`);
P(`| AURA Collection 系列页 | ~1,000 词 | — | ✅ 完整（含规格表、FAQ、测试、包装） |`);
P(`| Captain Aluminum Frame 系列页 | ~620 词 | — | ✅ 完整（含 AURA vs Captain 的差异说明） |`);
P(`| 新闻中心中心页 | ~2,040 词 | ≥ 2,500 词 | ⚠ 接近，缺一段「成本结构」与「案例」 |`);
P(`| 四篇文章（合计） | ~2,310 词（各 ~580） | 各 ≥ 1,200 词 | ⚠ 只有一半，见下面的说明 |`);
P();
P(`### 为什么四篇文章没有硬凑到 1,200 词`);
P();
P(`1,200 词这个目标来自基准数据（12 个强制造业内容页的正文中位 1,674 词）。但**把篇幅灌到目标字数，正是制造薄内容的方式**——这恰恰是本站 40 个页面被判薄内容的成因。`);
P(`所以这四篇是按「每个观点都带一个可核实的数字」写的，篇幅短但密度高。补齐剩余篇幅**不应该靠形容词，而应该靠你们独有的材料**：`);
P();
P(`| 可以补的内容 | 需要你提供 |`);
P(`|---|---|`);
P(`| 测试报告截图与编号 | SGS 报告编号（TODO P1） |`);
P(`| 真实交期分布 | 最近 20 单的实际交期区间，而不是 25–55 天这个范围 |`);
P(`| 失败与改进案例 | 一个真实的「某道检验拦下了什么问题」的例子，可脱敏 |`);
P(`| 工厂实拍 | 注塑车间、模具仓、铝框弯制工位、拉力测试台 |`);
P(`| 材质对比的实测数据 | 你们的 PC / ABS+PC 壳体实测重量区间 |`);
P();
P(`这些材料一旦到手，四篇各补 400–600 词是自然的，不需要注水。`);
P();
P(`## 0.7 · 站点级 AI 可发现性（来自 jev-seo 测试的新发现）`);
P();
P(`用 jev-seo 实测本站得到的 Agent Readiness 只有 **30/100**，原因是两项，而我们此前的分析完全没覆盖：`);
P();
P(`| 问题 | 现状 | 影响 |`);
P(`|---|---|---|`);
P(`| 没有 llms.txt | /llms.txt 不存在 | 答案引擎没有一份给机器的站点内容索引，只能自己猜哪些页面重要 |`);
P(`| robots.txt 没有显式声明 AI 爬虫 | 8 个被追踪的爬虫（GPTBot、ChatGPT-User、ClaudeBot、anthropic-ai、PerplexityBot、Google-Extended、Bytespider、CCBot）全部只能继承星号默认策略 | 默认是允许，但没有明确授权信号；部分爬虫对显式声明更友好 |`);
P();
P(`这两项都是**低成本、无风险**的改动，而且直接服务于本站最重要的目标（被 AI 引用）。`);
P();
P(`### 建议的 llms.txt（草稿，可直接上线）`);
P();
P(`放在站点根目录 /llms.txt。格式是 Markdown，作用是给答案引擎一份「本站有哪些值得引用的内容」的清单。下面代码块的内容原样保存为 /llms.txt 即可。`);
P();
P();
P(`    # DJI Luggage`);
P(`    > Indonesian luggage manufacturer in Bogor, West Java. OEM and ODM production of hard-shell`);
P(`    > (PP, PC, ABS+PC, aluminium-frame) and soft-shell luggage for brands, importers and`);
P(`    > distributors. Two 1,500-tonne injection machines, 100% in-house moulds, 30,000 units per`);
P(`    > month (about 70% hard shell), 80 x 40HQ shipped per year. Minimum order 200 units, lead`);
P(`    > time 25-55 days, payment 30% deposit / 70% balance. ISO 9001. Finished cases tested by SGS.`);
P(`    > Exports to China, Indonesia, Australia and Germany.`);
P(`    ## Products`);
P(`    - [AURA Collection - custom aluminium-frame carry-on](https://djiluggage.id/products/aura-collection-aluminum-frame-carry-on/): PC or ABS+PC shell with an extruded aluminium frame, bent and riveted, anodised. Eight colours, sizes 20-28 inch.`);
P(`    - [Captain Aluminum Frame - OEM carry-on manufacturing](https://djiluggage.id/products/captain-aluminum-frame-carry-on/): the same frame construction in six colours, built for repeat orders where batch-to-batch consistency matters.`);
P(`    - [Full product catalogue](https://djiluggage.id/collections/all/): all current models and colours.`);
P(`    ## Manufacturing capability`);
P(`    - [Services](https://djiluggage.id/services/): OEM and ODM development, production, quality control and export.`);
P(`    - [Production process](https://djiluggage.id/process/): how an aluminium-frame case is built, step by step.`);
P(`    - [About the factory](https://djiluggage.id/about/): capacity, equipment and team.`);
P(`    ## Guides`);
P(`    - [Custom luggage sourcing guide](https://djiluggage.id/newsroom/custom-luggage-sourcing-guide/): OEM vs ODM, materials, sampling, QC, first bulk order, packaging and export.`);
P(`    - [How to choose a luggage manufacturer](https://djiluggage.id/newsroom/choosing-the-right-luggage-manufacturer/): the due-diligence checklist.`);
P(`    - [OEM vs ODM for luggage brands](https://djiluggage.id/newsroom/oem-vs-odm-for-luggage-brands/): what changes between the two models.`);
P(`    - [Quality checks in suitcase production](https://djiluggage.id/newsroom/quality-checks-in-suitcase-production/): where hard-shell cases fail, and the QB/T 2155-2018 tests that catch it.`);
P(`    - [Material choices for hard shell luggage](https://djiluggage.id/newsroom/material-choices-for-hard-shell-luggage/): PP, PC, ABS+PC and aluminium frame compared.`);
P(`    ## Contact`);
P(`    - [Contact and enquiry](https://djiluggage.id/contact/): send target quantity, destination market, target price and sample references.`);
P();
P();
P(`> 上线前注意：上面 /products/aura-collection-... 等 URL 是**方案里将要新建的地址**。llms.txt 必须等新页面真的上线后再发布，否则会指向 404。`);
P();
P(`### robots.txt 建议补的显式声明`);
P();
P(`在现有星号规则之外，为下列爬虫各加一段 Allow: / ：`);
P();
P(`| 爬虫 | 用途 |`);
P(`|---|---|`);
P(`| GPTBot | OpenAI 模型训练 |`);
P(`| ChatGPT-User | ChatGPT 实时浏览 |`);
P(`| ClaudeBot | Anthropic 模型训练 |`);
P(`| anthropic-ai | Anthropic 检索与索引 |`);
P(`| PerplexityBot | Perplexity 引用索引 |`);
P(`| Google-Extended | Gemini 与 Vertex 训练 |`);
P(`| Bytespider | 字节跳动与 TikTok 搜索 |`);
P(`| CCBot | Common Crawl 开放语料 |`);
P();
P(`> 现有规则已经是允许的，补显式声明的意义是**给出明确的授权信号**，而不是改变行为。这是零风险改动。`);
P();
P(`### 为什么要做这件事`);
P();
P(`我们此前测出：24 次真实 AI 提问里本站被提及 **0 次**。除了内容本身没有可引用事实之外，站点层面也缺少「告诉 AI 该读什么」的信号。`);
P();
P(`llms.txt 与显式爬虫授权正是补这一块——**成本几乎为零，但它是我们此前完全遗漏的环节。**`);
P();
/* ---------------- 阶段 1 ---------------- */
P(`## 1 · 阶段一：8 篇新闻文章`);
P();
P(`### 现状（实测，非估计）`);
P();
P(`| 文章 | 词数 | 独立需求 | Jev 原始判断 | 收敛后 | 备注 |`);
P(`|---|---|---|---|---|---|`);
for (const a of articlePlan) {
  const modelFate = { 'merge-into-hub': '并入中心页', 'keep-and-rewrite': '保留重写', drop: '删除' }[a.fateModel] || a.fateModel;
  const finalFate = { 'merge-into-hub': '**并入中心页**', 'keep-and-rewrite': '**保留并重写**', drop: '删除' }[a.fate] || a.fate;
  P(`| \`${a.urlPath.replace('/newsroom/', '')}\` | ${a.words} | ${Math.round(a.demand * 100)}% | ${modelFate} | ${finalFate} | ${a.policyAdjusted ? '模型判重写，但独立需求低于阈值，收敛为并入' : ''} |`);
}
P();
P(`> 8 篇两两相似度最高 **${newsroomGroup?.maxSim ?? '—'}**，实测是同一篇 222 词模板文：章节标题逐字相同，唯一词重合 172/177。`);
P();
P(`> **为什么不能直接照搬模型的判断**：模型对 8 篇全部给出「保留重写」（置信 90–98%），但同一批回答里，「这个主题会被买家独立搜索」的概率只有 41%–77%。前者是粗粒度三选一，后者是直接测量；冲突时以独立需求为准。`);
P();
const borderlineList = articlePlan.filter((a) => a.borderline);
if (borderlineList.length) {
  P(`> ⚠ **边界案例（需求概率落在 ${DEMAND_THRESHOLD} ± ${BORDERLINE_BAND} 内，单次抽样不足以定论）**：${borderlineList.map((a) => a.title + " " + Math.round(a.demand * 100) + "%").join("、")}。这几篇建议人工拍板，不要依赖一次模型抽样。`);
P();
}
P(`> 决策已缓存到 \`.seo-geo/site/plan-decisions.json\`，重跑方案不会因为抽样抖动而改变结论；要重新决策用 \`node scripts/site-audit/plan.mjs --refresh\`。`);
P(`### 中心页`);
P();
P(`Jev 建议新建一篇**《定制行李箱代工采购总指南》**（\`/newsroom/custom-luggage-sourcing-guide/\`），而不是拿现有某一篇当骨架。并入的主题成为它的章节，保留的文章作为它的延伸阅读。`);
P();
P(`| 章节 | 来自（并入的文章） | 必须写进去的具体内容 |`);
P(`|---|---|---|`);
const CHAPTER_HINTS = {
  'From Sample To Production': '打样步骤与耗时、确认节点、量产前必须冻结的变量',
  'Packaging And Export Prep For Suitcases': '装箱量、外箱规格、柜型装载、单证清单',
  'Building A Private Label Travel Line': 'logo 工艺选择、内衬与包装定制、系列规划',
  'Planning Your First Bulk Luggage Order': '首单量、颜色配比、备品比例、补单周期',
};
let chapterNo = 1;
for (const a of articlePlan.filter((x) => x.fate === 'merge-into-hub')) {
  P(`| ${chapterNo++}. ${a.title} | \`${a.urlPath.replace('/newsroom/', '')}\` | ${CHAPTER_HINTS[a.title] || '该主题的核心决策点与具体数字'} |`);
}
P();
const keptList = articlePlan.filter((a) => a.fate === 'keep-and-rewrite');
if (keptList.length) {
  P(`### 保留并重写的文章（${keptList.length} 篇）`);
P();
  P(`| 文章 | 独立需求 | 重写时必须补进的内容 |`);
  P(`|---|---|---|`);
  const KEEP_HINTS = {
    'Choosing The Right Luggage Manufacturer': '尽调清单：认证、产能、客户结构、验厂要点、常见红旗信号',
    'OEM vs ODM For Luggage Brands': '模具归属、最小起订、开发周期、知识产权在两种模式下的实际差别',
    'Quality Checks In Suitcase Production': '检验道数、AQL 标准、抽检比例、常见失效点（轮子/拉杆/锁/边框）',
    'Material Choices For Hard Shell Luggage': 'PC / ABS / PP / 铝框对比表：重量、韧性、成本区间、适用价位带',
  };
  for (const a of keptList) {
    P(`| \`${a.urlPath.replace('/newsroom/', '')}\` | ${Math.round(a.demand * 100)}% | ${KEEP_HINTS[a.title] || '该主题的具体决策依据与数字'} |`);
  }
P();
  P(`这些页面之间要互相链接，并全部链向中心页 —— 形成「1 个中心 + ${keptList.length} 篇专题」的主题簇，而不是 ${articles.length} 个互不相干的孤立页。`);
}
P();
P(`### 301 映射（${articleRedirects.length} 条）`);
P();
if (articleRedirects.length) {
  P(`| 旧 URL | 301 目标 |`);
  P(`|---|---|`);
  for (const r of articleRedirects) P(`| \`${r.from}\` | \`${r.to}\` |`);
} else {
  P(`本阶段没有 301：所有文章都保留为独立 URL。`);
}
P();
P(`> \`_redirects\` 里已有的 8 条旧 newsroom slug 规则指向这 8 个 URL；若其中有 URL 被 301，那些规则的目标要一并改成新目标，否则会出现二级跳转。`);
P();
P(`### 字数目标`);
P();
P(`| 页面 | 当前 | 目标 | 依据 |`);
P(`|---|---|---|---|`);
P(`| 中心页 | — | ≥ 2500 词 | 基准 12 个强制造业内容页正文中位 1674 词，中心页应高于中位 |`);
P(`| 每篇保留文章 | 222 词 | ≥ 1200 词 | 同上；且必须带具体数字（天数、比例、标准编号） |`);
P();
/* ---------------- 阶段 2 ---------------- */
P(`## 2 · 阶段二：21 个产品页 → 2 个系列页（另 7 页整条删除）`);
P();
P(`> ✅ **已定（2026-09-25）：全铝系列整条删除。** Captain Full Aluminum（3 页）与 Voyager Full Aluminum（4 页）共 7 个页面下线，不保留系列页。`);
P(`> **最终结构是 2 个系列页**：AURA Collection 与 Captain Aluminum Frame。21 个产品 URL 中 14 个 301 到系列页，7 个 301 到 /collections/all/。`);
P(`> **为什么删除页 301 到总目录而不是某个系列页**：买家搜「Captain Full Aluminum」却落到「Captain Aluminum Frame」，是货不对板；落到总目录才是诚实的落点。若想更彻底也可对 7 个 URL 返回 410，代价是放弃已积累的外链权重——这 7 页几乎无外链，两种做法差别不大。`);
P(`> 相应地，**站内所有引用这 7 个页面的地方都要清理**：/products 列表、/collections/all/ 的卡片、首页的产品推荐、以及内链里指向它们的那部分。验收表已单列两项检查。`);
P();
P(`> 涉及：Captain Full Aluminum Carry-On（3 页）+ Voyager Full Aluminum Carry-On（4 页）。如果这两个系列实际不生产，这 7 个页面就在卖你做不出来的东西——不只是 SEO 问题，是会伤到询盘转化的信任问题。三种处理方式：`);
P(`> ① 若「全铝」只是上游目录的命名习惯、实际仍是铝框结构 → 改名即可，4 条产品线保留；② 若确实不做 → 这 7 页应从合并方案中去掉，21 页合并为 2 个系列页（AURA + Captain Aluminum Frame）；③ 若可外协 → 文案必须写成合作生产，不能写自有产能。`);
P();
P(`### 为什么必须按标题而不是 slug 分组`);
P();
P(`站点的 slug 与颜色标题是**错位的**：\`...-blue-copy\` 的标题是 Black，\`...-white\` 的标题是 Blue，\`...-grey-copy\` 的标题是 Silver。按 slug 合并会把颜色和产品线配错。下表按**页面标题**归组。`);
P();
P(`| 产品线 | 颜色数 | 颜色清单 | 建议 canonical |`);
P(`|---|---|---|---|`);
for (const L of linePlan) {
  P(`| ${L.titlePrefix} | ${L.colors.length} | ${L.colors.join('、')} | \`${L.canonicalIsNew ? L.newSlug : L.canonical}\`${L.canonicalIsNew ? '（新建）' : ''} |`);
}
P();
P(`### 主攻查询与页面职责`);
P();
P(`| 产品线 | 主目标查询 | Jev 置信 |`);
P(`|---|---|---|`);
for (const L of linePlan) P(`| ${L.titlePrefix} | \`${L.primaryQuery}\` | ${Math.round(L.canonicalConfidence * 100)}% |`);
P();
P(`一条产品线的页面只打一个主查询，其余颜色与尺寸作为**页面内的选项**，不再各自占一个 URL。`);
P();
P(`**差异化轴（Jev 判断）：${AXIS_LABELS[differentiationAxis] || differentiationAxis}。** 但要说清一件事：本站只有 **2 种结构**（铝框 / 全铝）却有 **4 个产品线页面**，所以「按结构分」这个轴本身不足以把 4 个页面分开——同一结构下的两条线仍会争同一批词。下表 4 个主查询目前的区分靠的是措辞与定位差异，**真正站得住的差异化必须由客户端补充 4 条产线的实际差别**（见第 7 节）。`);
P();
if (duplicateQueries.length) {
  P(`> ⚠ **代码检测到主查询重复：${duplicateQueries.map(([q, n]) => q + " ×" + n).join("；")}。** 这一项必须在页面开发前人工错开——它是本方案自己引入的风险，不修就白合并了。`);
} else {
  P(`> ✓ 代码校验：4 条产品线的主查询互不重复。`);
}
P();
P(`> 差异化轴与主查询的最终确认需要客户端提供 4 条产线的真实差异（见第 7 节）。若这 4 条线其实没有实质区别，正确的做法是把它们合并成更少的页面，而不是硬造 4 个词。`);
P();
P(`### 页面结构（4 个系列页用同一套模板）`);
P();
P(`1. **H1**：产品线名 + 品类，例如 \`${linePlan[0]?.titlePrefix} — Custom Aluminum Frame Carry-On\``);
P(`2. **一句话定位**：这条线是什么结构、给谁做、和另外三条线的区别（这是 AI 最可能引用的一句话）`);
P(`3. **规格表**（\`<table>\`）：每个尺寸一行，列出长宽高、容积、净重 —— 基准里强制造业页面的能力页中位有 **23 处**「数字+单位」，我们目前是 **0**`);
P(`4. **颜色选项**：把该产品线的全部颜色做成页面内的色卡/选择器，每个颜色配一张图与 alt`);
P(`5. **定制选项**：logo 工艺、内衬、包装、锁具、轮子`);
P(`6. **FAQ 区块**（6–10 问）：这是最大的缺口 —— 基准 12 个内容页里 9 个有 FAQ，我们 0/3`);
P(`7. **询盘入口**：明确写出「发目标数量 + 目标市场 + 目标价 + 参考样」后会收到什么（MOQ / 交期 / 定制选项），并给出可见的联系方式`);
P();
P(`### 必备事实清单（Jev 判定，按必要性排序）`);
P();
P(`| 事实 | 必要性 | 站点现状 |`);
P(`|---|---|---|`);
for (const f of facts) {
  const has = ['dimensions', 'material', 'customization', 'sampling', 'leadtime'].includes(f.k);
  P(`| ${f.desc} | ${Math.round(f.need * 100)}% | ${has ? '部分已有' : '**需你提供**'} |`);
}
P();
P(`> 标「需你提供」的项目，站点上目前完全不存在。**这些数字必须来自业务方**，写编造的数字比不写更糟（结构化数据与内容不一致会触发 GSC 误导警告，也是本站已有 25 处 schema 不一致的成因）。`);
P();
P(`### 301 映射（${productRedirects.length} 条）`);
P();
P(`| 旧 URL | 颜色 | 301 目标 |`);
P(`|---|---|---|`);
for (const r of productRedirects) P(`| \`${r.from}\` | ${r.color} | \`${r.to}\` |`);
P();
P(`\`/collections/all/\` 保留为总目录，把 21 张卡片改成指向 4 个系列页。`);
P();

/* ---------------- 阶段 3 ---------------- */
P(`## 3 · 阶段三：修 \`/newsroom\` 孤岛与 3 个筛选页`);
P();
P(`### 问题`);
P();
P(`- \`/newsroom\`（sitemap 内的新闻中心）**入链 ${newsroomInlinks} 条**，是站内唯一孤岛页`);
P(`- 导航「Newsroom」指向 \`/newsroom/filters/all\`，该页 canonical 指向 \`/newsroom\` 且不在 sitemap 中`);
P(`- 全站共 **${navLinksToFilters.length} 条内链**指向这 3 个筛选页，权重全部流向不被索引的 URL`);
P();
P(`### 做法`);
P();
P(`1. 删除 ${filterPages.join("、")} 三个目录，在 \`_redirects\` 加 3 条 301 → \`/newsroom\``);
P(`2. 导航与页脚的「Newsroom」改指 \`/newsroom\``);
P(`3. 把原来指向筛选页的 ${navLinksToFilters.length} 条内链改指 \`/newsroom\`（或直接改为指向具体文章，视链接所在位置而定）`);
P(`4. 中心页定稿后，从 \`/newsroom\` 首页链接到中心页，让它成为新闻中心的第一入口`);
P();
P(`> 这三个筛选页只按分类筛选文章，内容与 \`/newsroom\` 实质相同，没有独立搜索价值；保留它们只会制造重复内容。`);
P();

/* ---------------- 阶段 4 ---------------- */
P(`## 4 · 阶段四：内链`);
P();
P(`前 3 步完成后，${accepted.length} 条内链建议重新分类如下。`);
P();
P(`### 现在就能做（${doNow.length} 条）`);
P();
P(`| 来源页 | 目标页 | 关系 | 建议锚文本 |`);
P(`|---|---|---|---|`);
for (const l of doNow.slice(0, 60)) {
  P(`| \`${l.fromFinal}\` | \`${l.toFinal}\` | ${l.relation} | \`${l.anchor || '（待定）'}\` |`);
}
P();
if (doNow.length > 60) P(`（完整清单见同名 \`.json\`）`);
P();
P(`### 合并后再做（${rewriteLater.length} 条，目标页要改写成合并后的 URL）`);
P();
P(`| 原建议 | 合并后应改为 |`);
P(`|---|---|`);
const seen = new Set();
for (const l of rewriteLater) {
  const key = `${l.from}→${l.to}`;
  if (seen.has(key)) continue;
  seen.add(key);
  P(`| \`${l.from}\` → \`${l.to}\` | \`${l.fromFinal}\` → \`${l.toFinal}\` |`);
}
P();

/* ---------------- 阶段 5 ---------------- */
P(`## 5 · 结构化数据（随页面一起改，否则会留下新的不一致）`);
P();
P(`站点当前的 3 组模板常量必须停用，改为按页面实际内容生成：`);
P();
P(`| 字段 | 当前写死的值 | 被套用到 | 应改为 |`);
P(`|---|---|---|---|`);
P(`| \`Product.material\` | \`Polycarbonate shell with aluminum frame\` | 21 个产品页 | 按该产品线真实结构填写（AURA / Captain / Voyager 并不相同） |`);
P(`| \`Product.brand\` | \`ROAMING\` | 21 个产品页 | 与页面可见的品牌表述一致，或直接移除该字段 |`);
P(`| \`Product.category\` | \`Luggage\` | 21 个产品页 | 更具体的品类，或改为系列名 |`);
P();
P(`另外：`);
P();
P(`- 9 个页面声明了 \`Organization.telephone = +6285111384747\`，但该号码**在任何页面的可见文本中都不存在**（只在 \`wa.me\` 链接的 href 里）。要么把号码显示在联系区块，要么从结构化数据里去掉。`);
P(`- 合并后的 4 个系列页应加 \`FAQPage\`（基准里 2 个站点这么做），并保留 \`Product\` + \`BreadcrumbList\`（基准 BreadcrumbList 覆盖 9/12，我们 0/3）。`);
P();

/* ---------------- 验收 ---------------- */
P(`## 6 · 验收标准`);
P();
P(`每一阶段做完后，用同一套脚本复核，不靠感觉：`);
P();
P(`| 阶段 | 检查项 | 通过标准 |`);
P(`|---|---|---|`);
P(`| 1 | 中心页正文词数 | ≥ 2500 词，且 ${articlePlan.filter((a) => a.fate === 'merge-into-hub').length} 个并入章节齐全，并链接到 ${articlePlan.filter((a) => a.fate === 'keep-and-rewrite').length} 篇专题 |`);
P(`| 1 | 文章唯一词重合 | 若保留多篇，任意两篇重合率 < 60%（当前 97%） |`);
P(`| 1 | 旧文章 URL | 全部返回 301 且最终落到中心页（一跳完成） |`);
P(`| 2 | 产品页数量 | 从 21 降到 2，且 /collections/all/ 全部卡片只指向这 2 页 |`);
P(`| 2 | 系列页数字密度 | 每页「数字+单位」≥ 15 处（当前产品页 22 处但 21 页重复） |`);
P(`| 2 | 全铝系列彻底下线 | 站内不再出现 Captain Full Aluminum / Voyager Full Aluminum 的任何页面、导航项、卡片或结构化数据 |`);
P(`| 2 | 删除 URL 的落点 | 7 个全铝 URL 全部 301 到 /collections/all/，且一跳完成 |`);
P(`| 2 | 颜色完整性 | 该产品线全部颜色都在页面内可选，一个不丢 |`);
P(`| 2 | 旧产品 URL | 全部 301，且目标颜色与旧页标题一致（**不是与 slug 一致**） |`);
P(`| 3 | \`/newsroom\` 入链 | 从 ${newsroomInlinks} 条提升到 ≥ 全站主要页面的平均入链数 |`);
P(`| 3 | 筛选页 | 三个 URL 均 301 到 \`/newsroom\`，站内无残留内链 |`);
P(`| 4 | 内链 | 新增 ≥ ${doNow.length} 条，且无一条指向已 301 的 URL |`);
P(`| 全部 | 结构化数据一致性 | \`node scripts/site-audit/schema-facts.mjs\` 的 \`totalFindings\` 降到 0 |`);
P(`| 全部 | 复查 | \`npm run audit:corpus -- --refresh\` 后重跑 \`audit:analyze\`，薄内容页从 40 降到 < 15 |`);
P();

/* ---------------- 需要你提供 ---------------- */
P(`## 7 · 信息状态`);
P();
P(`### 已收到（第 0.2 节，共 ${CONFIRMED_FACTS.length} 项）`);
P();
P(`覆盖了原先阻塞项里的：起订量、出口与包装、材质范围、管理体系认证、出口国、交期、付款方式、产线柔性。这些此前站点上完全不存在或没有写明。`);
P();
P(`### 仍然缺失（${STILL_MISSING.length} 项）`);
P();
P(`| 类别 | 需要什么 | 为什么需要 |`);
P(`|---|---|---|`);
for (const [cat, what, why] of STILL_MISSING) P(`| ${cat} | ${what} | ${why} |`);
P();
P(`### 待办事项（TODO）`);
P();
P(`按优先级排列。P1 会直接影响已写好的文案能不能发；P2 能让内容更可核实；P3 是可选加强。`);
P();
P(`| 优先级 | 事项 | 为什么需要 | 状态 |`);
P(`|---|---|---|---|`);
P(`| P1 | 向 SGS 索取**测试报告编号** | 报告不是证书，但编号可核实；「Report No. XXXXX」比「tested by SGS」有力得多，且零成本 | 待办 |`);
P(`| P1 | **ISO 9001 证书编号与有效期** | 认证确实持有，只差编号；有编号才是可核实事实，也是 AI 最愿意引用的形式 | 待办（用户稍后提供） |`);
P(`| P1 | 确认铝框箱的实际结构命名（Full Aluminum 两个系列） | 若实际是铝框结构，标题里的 Full Aluminum 会与样品不符 | 待办 |`);
P(`| P2 | **铝框合金牌号**（6061 / 6063 / 5052） | 让「合作型材厂」的说法落到可核实的材料规格上 | 待办（用户稍后提供） |`);
P(`| P2 | **阳极氧化实测膜厚** | 页面现在写的是行业规格 10–12 μm，应换成你们的实测值 | 待办（用户稍后提供） |`);
P(`| P2 | 4 条产品线各自的**外观/结构差异**（每条一句话） | 决定 4 个页面能否各自站住一个词，避免合并后又互相蚕食 | 待办 |`);
P(`| P3 | 各尺寸的长宽高 / 容积 / 净重 | 必要性最高的一项事实，但已确认由你们在目录里直接给客户，不写网站 | 已知，不阻塞 |`);
P(`| ✅ | 付款方式 30/70 适用于所有订单类型 | 已确认，页面可直接写 unified terms for all order types | 完成 |`);
P();
P(`### 还需要你确认的一个决定`);
P();
P(`- [x] **已决定（2026-09-25）：接受把 21 个产品 URL 合并为 4 个。** 这会让 ${productRedirects.length} 个产品 URL 从 200 变成 301，完整映射表见第 2 节。执行时按「先发布 4 个新页面 → 再确认收录 → 最后加 301」的顺序，避免新旧页面同时在线造成重复。`);
P();

/* ---------------- 风险 ---------------- */
P(`## 8 · 风险与回滚`);
P();
P(`| 风险 | 影响 | 应对 |`);
P(`|---|---|---|`);
P(`| 合并后排名短期波动 | ${productRedirects.length} 个产品 URL 与 ${articleRedirects.length} 个文章 URL 状态码变化 | 301 用永久跳转、保持内容连续性；先看一轮 GSC 再决定是否继续下一步 |`);
P(`| 颜色信息丢失 | 2 个系列页若漏掉某颜色，会损失长尾流量 | 验收表里单列「颜色完整性」，逐一对照标题清单 |`);
P(`| 误删仍在卖的型号 | 全铝系列一旦下线，相关询盘会直接丢失 | 执行前用一次 GSC / 询盘记录确认这 7 个页面确实没带来商业价值；若有，先保留并改名而不是删除 |`);
P(`| 新旧 slug 冲突 | \`newSlug\` 若与现有页面撞车会造成重复 | 上线前用 \`audit:corpus --refresh\` 复检 URL 唯一性 |`);
P(`| 数据未经确认就上线 | 结构化数据与内容不一致，触发误导判定 | 第 0.2 节的数据已由业务方确认；第 7 节仍未补齐的项目，在补齐前不要写进页面或 JSON-LD |`);
P();
P(`---`);
P();
const usageNote = decisions
  ? `Jev 决策复用缓存（${decisions.decidedAt.slice(0, 16).replace('T', ' ')} UTC 作出，模型 ${decisions.model}，当次用量 输入 ${decisions.usage.input_tokens} / 输出 ${decisions.usage.output_tokens} tokens）；本次运行未产生新的模型调用。要重新决策用 --refresh。`
  : `Jev 用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens} tokens（${model}）。`;
P(`*本方案由 scripts/site-audit/plan.mjs 生成。${usageNote}*`);

const mdText = md.join('\n');
const date = new Date().toISOString().slice(0, 10);
writeFileSync(join(REPORT_DIR, `plan-consolidation-${date}.md`), mdText);
writeFileSync(
  join(REPORT_DIR, `plan-consolidation-${date}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), model, usage, hub, articlePlan, linePlan, facts, productRedirects, articleRedirects, doNow, rewriteLater, navLinksToFilters, filterPages }, null, 2),
);

/* ---------------- 同时输出 HTML ---------------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function mdToHtml(mdSrc) {
  const lines = mdSrc.split('\n');
  const out = [];
  let inList = false, inTable = false, inQuote = false;
  const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const flushTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };
  const flushQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^\*([^*]+)\*$/, '<em>$1</em>');
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*$/.test(l)) { flushList(); flushTable(); flushQuote(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { flushList(); flushTable(); flushQuote(); out.push(`<h${Math.min(4, m[1].length)}>${inline(m[2])}</h${Math.min(4, m[1].length)}>`); continue; }
    if (/^>\s?/.test(l)) { flushList(); flushTable(); if (!inQuote) { out.push('<blockquote>'); inQuote = true; } out.push(`<p>${inline(l.replace(/^>\s?/, ''))}</p>`); continue; }
    if (/^\s*[-*]\s+/.test(l) || /^\s*- \[ \]\s+/.test(l)) { flushTable(); flushQuote(); if (!inList) { out.push('<ul class="tight">'); inList = true; } out.push(`<li>${inline(l.replace(/^\s*[-*]\s+(\[ \]\s+)?/, ''))}</li>`); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { flushTable(); flushQuote(); if (!inList) { out.push('<ul class="tight">'); inList = true; } out.push(`<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`); continue; }
    if (/^\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (/^[-: ]+$/.test(cells.join(''))) continue;
      if (!inTable) { flushList(); flushQuote(); out.push('<table class="simple compact"><tbody>'); inTable = true; }
      out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    if (/^---+$/.test(l)) { flushList(); flushTable(); flushQuote(); out.push('<hr>'); continue; }
    flushList(); flushTable(); flushQuote();
    out.push(`<p>${inline(l)}</p>`);
  }
  flushList(); flushTable(); flushQuote();
  return out.join('\n');
}

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>djiluggage.id 内容合并方案</title><style>
 body{margin:0;background:#f4f5f7;color:#17191c;font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
 .wrap{max-width:1080px;margin:0 auto;padding:34px 24px 90px}
 h1{font-size:26px;margin:0 0 6px} h2{font-size:20px;margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid #17191c}
 h3{font-size:16px;margin:24px 0 8px} h4{font-size:14px;margin:18px 0 6px;color:#6b7280}
 p{margin:8px 0} code{background:#eef1f5;border-radius:4px;padding:1px 5px;font-size:12.5px}
 table{width:100%;border-collapse:collapse;margin:10px 0;background:#fff;border:1px solid #e2e5e9;border-radius:10px;overflow:hidden}
 td{padding:7px 10px;border-bottom:1px solid #eef0f3;vertical-align:top;font-size:13.5px}
 tr:first-child td{background:#f8f9fb;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
 blockquote{margin:12px 0;padding:10px 14px;background:#fff8e6;border-left:3px solid #d9a400;border-radius:6px;font-size:13.5px}
 blockquote p{margin:4px 0}
 ul.tight{padding-left:22px} ul.tight li{margin:4px 0}
 hr{border:0;border-top:1px solid #e2e5e9;margin:30px 0}
 a{color:#1f4fd8}
</style></head><body><div class="wrap">
${mdToHtml(mdText)}
</div></body></html>`;
writeFileSync(join(REPORT_DIR, `plan-consolidation-${date}.html`), html);

console.log(`\n▶ 方案已生成`);
console.log(`   .workbuddy-ai/reports/plan-consolidation-${date}.md`);
console.log(`   .workbuddy-ai/reports/plan-consolidation-${date}.html`);
console.log(`   保留文章 ${keptArticles.length} 篇 · 文章 301 ${articleRedirects.length} 条 · 产品线 ${linePlan.length} 条 · 产品 301 ${productRedirects.length} 条`);
console.log(`   内链：现在可做 ${doNow.length} 条，合并后改写 ${rewriteLater.length} 条`);
console.log(`   Jev 用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens} tokens（${model}）`);
