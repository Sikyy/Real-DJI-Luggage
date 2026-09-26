/**
 * 站点审计的 Jev 判断层（对应需求 1-7）。
 *
 *   1 Internal links   → 内链候选配对 + 锚文本选择
 *   2 Cannibalization  → 同质聚类/高相似对的处置裁决
 *   3 Thin content     → 每页原创性与实质度打分
 *   4 Search intent    → 每页「意图应有」vs「实际服务」的标签与错配
 *   5 Content audits   → 每个 URL 的 keep / update / merge / remove
 *   6 Redirect maps    → 旧 URL → 最佳新 URL，并标注不确定项
 *   7 Schema           → 结构化数据声明与页面实际内容是否一致
 *
 * 所有事实（相似度、链接图、schema 字段、HTTP 状态）由 corpus.mjs 用代码算好，
 * 这里只把「这对买家/对搜索引擎意味着什么」交给 Jev。
 *
 *   node scripts/site-audit/analyze.mjs [--only=links,intent,...]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as siteDir from './site-dir.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadApiKey, callJev } from '../seo-geo/jev.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { SITE_DIR, LABEL } = siteDir;
const abs = (p) => join(ROOT, p);

const argv = process.argv.slice(2);
const ONLY = (argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);

const SAMPLE = Number((argv.find((a) => a.startsWith('--sample=')) || '').slice(9)) || 0;
/** --pages=/a,/b 只重跑这些 URL（结果按 URL 合并进已有 findings，不动其他页） */
const PAGES_FILTER = (argv.find((a) => a.startsWith('--pages=')) || '')
  .slice(8)
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const corpus = JSON.parse(readFileSync(join(SITE_DIR, 'corpus.json'), 'utf8'));
const pages = PAGES_FILTER.length
  ? corpus.pages.filter((p) => PAGES_FILTER.includes(p.urlPath))
  : SAMPLE
    ? corpus.pages.slice(0, SAMPLE)
    : corpus.pages;
const pageByPath = new Map(corpus.pages.map((p) => [p.urlPath, p]));
const apiKey = loadApiKey();

const usageTotal = { input_tokens: 0, output_tokens: 0 };
let model = null;

async function ask(label, state, questions) {
  const res = await callJev(apiKey, { state, questions, label });
  usageTotal.input_tokens += res.usage?.input_tokens || 0;
  usageTotal.output_tokens += res.usage?.output_tokens || 0;
  model = res.model || model;
  return res.answers;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const digest = (p, chars = 2200) => ({
  url: p.urlPath,
  title: p.title,
  meta_description: p.metaDescription,
  h1: p.h1,
  headings: p.headings.slice(0, 10).map((h) => `${'#'.repeat(h.level)} ${h.text}`),
  word_count: p.wordCount,
  text: p.text.slice(0, chars),
});

const findings = {
  generatedAt: new Date().toISOString(),
  site: corpus.site,
  counts: {
    pages: pages.length,
    sitemapPages: pages.filter((p) => p.inSitemap).length,
    links: corpus.links.length,
    similarPairs: corpus.similar.length,
    clusters: corpus.clusters.length,
    legacyUrls: corpus.legacy.length,
  },
};

const outPath = join(SITE_DIR, 'findings.json');
if (existsSync(outPath)) Object.assign(findings, JSON.parse(readFileSync(outPath, 'utf8')));
findings.generatedAt = new Date().toISOString();
findings.counts = { pages: pages.length, sitemapPages: pages.filter((p) => p.inSitemap).length, links: corpus.links.length, similarPairs: corpus.similar.length, clusters: corpus.clusters.length, legacyUrls: corpus.legacy.length };

/* ==================================================================== */
/* 3. Thin content —— 原创性与实质度                                      */
/* ==================================================================== */

const ORIGINALITY_LEVELS = [
  '近乎模板：换掉标题后内容与站内其他页几乎一致，没有本页独有的信息',
  '明显偏薄：只有泛泛而谈的介绍，没有任何这一页特有的具体内容',
  '尚可但有大量套话：有本页专属信息，但被通用表述稀释',
  '扎实：以本页专有的细节为主，套话比例低',
  '高度原创：通篇是本页独有的具体信息，几乎没有可被复制到别页的段落',
];

if (want('thin')) {
  console.log('\n▶ [3] Thin content：逐页原创性打分');
  const batches = chunk(pages, 8);
  findings.thin = { ...(findings.thin || {}) };
  for (const [i, batch] of batches.entries()) {
    const questions = {};
    batch.forEach((p, j) => {
      questions[`originality_${j}`] = {
        type: 'score',
        instructions: `评估 \`pages[${j}]\` 的原创性与实质度：内容是这一页独有的，还是可以整体复制到同站任何同类页面上？参考 \`pages[${j}].word_count\` 与 \`pages[${j}].text\`。`,
        criteria: ORIGINALITY_LEVELS,
      };
      questions[`template_generated_${j}`] = {
        type: 'noul',
        instructions: `\`pages[${j}].text\` 读起来像是模板批量生成的（换掉标题和日期就能套用到别的页面），而不是为这个主题专门写的。`,
        criteria: { true: '读起来就是模板产物', false: '读起来是为该主题专门写的' },
      };
      questions[`buyer_value_${j}`] = {
        type: 'noul',
        instructions: `一个正在评估行李箱代工厂的 B2B 买家读完 \`pages[${j}].text\` 后，能获得任何可用于决策的具体信息。`,
      };
    });
    const ans = await ask(`thin:${i}`, { pages: batch.map((p) => digest(p)) }, questions);
    batch.forEach((p, j) => {
      findings.thin[p.urlPath] = {
        originality: ans[`originality_${j}`].score,
        originalityConfidence: ans[`originality_${j}`].confidence,
        templateGenerated: ans[`template_generated_${j}`].noul,
        buyerValue: ans[`buyer_value_${j}`].noul,
      };
    });
    console.log(`  ✓ 批次 ${i + 1}/${batches.length}：${batch.map((p) => p.urlPath).join(', ').slice(0, 90)}…`);
  }
  const weak = Object.entries(findings.thin).filter(([, v]) => v.originality < 2.25);
  console.log(`  偏薄页面（原创性 <2.25）：${weak.length} 个`);
}

/* ==================================================================== */
/* 4. Search intent —— learn / compare / buy + 错配                        */
/* ==================================================================== */

const INTENT_CRITERIA = {
  learn: '想弄明白某件事怎么做/是什么（how-to、概念、指南、行业知识）',
  compare: '在多个供应商或方案之间做对比与筛选（vs、对比、选型、评估清单）',
  buy: '准备下单或询盘，要找具体产品、规格与联系方式（产品页、报价、定制选项）',
  trust: '在核实这家公司是否真实可靠（关于我们、工厂、认证、案例、招聘）',
  navigate: '只是想找到某个已知入口（目录、集合页、筛选页、联系页）',
};

if (want('intent')) {
  console.log('\n▶ [4] Search intent：应有意图 vs 实际服务意图');
  const batches = chunk(pages, 8);
  findings.intent = { ...(findings.intent || {}) };
  for (const [i, batch] of batches.entries()) {
    const questions = {};
    batch.forEach((p, j) => {
      questions[`implied_${j}`] = {
        type: 'choice',
        instructions: `只看 \`pages[${j}].title\`、\`pages[${j}].meta_description\` 与 \`pages[${j}].headings\`：搜索引擎会把这个页面排给哪一类查询？`,
        criteria: INTENT_CRITERIA,
      };
      questions[`served_${j}`] = {
        type: 'choice',
        instructions: `只看 \`pages[${j}].text\` 的正文：这个页面实际上满足的是哪一类意图？`,
        criteria: INTENT_CRITERIA,
      };
      questions[`mismatch_${j}`] = {
        type: 'noul',
        instructions: `\`pages[${j}]\` 的标题/结构所承诺的意图，与正文实际满足的意图不一致，会让搜索者点进来却发现内容不对路。`,
      };
    });
    const ans = await ask(`intent:${i}`, { pages: batch.map((p) => digest(p, 1600)) }, questions);
    batch.forEach((p, j) => {
      findings.intent[p.urlPath] = {
        implied: ans[`implied_${j}`].choice,
        served: ans[`served_${j}`].choice,
        mismatch: ans[`mismatch_${j}`].noul,
        impliedConfidence: ans[`implied_${j}`].confidence,
        servedConfidence: ans[`served_${j}`].confidence,
      };
    });
    console.log(`  ✓ 批次 ${i + 1}/${batches.length}`);
  }
}

/* ==================================================================== */
/* 2. Cannibalization —— 同质页面裁决                                      */
/* ==================================================================== */

if (want('cannibal')) {
  console.log('\n▶ [2] Cannibalization：同质聚类裁决');

  // 代码先算好：聚类成员 + 组内最高相似对
  const groups = corpus.clusters.map((members, idx) => ({
    id: `group_${idx}`,
    members,
    maxSim: Math.max(
      0,
      ...corpus.similar.filter((s) => members.includes(s.a) && members.includes(s.b)).map((s) => s.score),
    ),
    pairCount: corpus.similar.filter((s) => members.includes(s.a) && members.includes(s.b)).length,
  }));
  groups.sort((a, b) => b.maxSim - a.maxSim);

  const criteria = {};
  for (const g of groups) {
    criteria[g.id] = g.members
      .map((m) => {
        const p = pageByPath.get(m);
        return `- ${m}｜${p.title}｜${p.wordCount} 词｜${p.h1[0] || ''}`;
      })
      .join('\n');
  }

  const questions = {
    severity: {
      type: 'score',
      instructions:
        '对 `groups` 里的每一组，判断「同一站内多个页面争夺同一搜索意图」的严重程度。0 = 完全不同的意图，4 = 明显是同一意图的重复页面。',
      criteria: [
        '意图互不相同，不构成竞争',
        '有轻微重叠但不影响彼此排名',
        '部分重叠，长期会互相稀释',
        '明显同一意图，正在互相蚕食',
        '几乎完全同一意图的重复页面，必须合并',
      ],
    },
  };
  // 每组的处置裁决：合并到某个成员 / 保留但分化 / 全部保留
  const groupChoices = {};
  for (const g of groups) {
    const opts = { keep_all_differentiate: '保留全部，但必须给每个页面划出互不重叠的主题与关键词' };
    for (const m of g.members) opts[`merge_into:${m}`] = `把其余页面合并进 ${m}（该页作为唯一保留的 canonical，其余 301 过去）`;
    opts.remove_all_but_best = '只保留其中最有价值的一个（由你在此选项中说明），其余删除而不是合并';
    groupChoices[`action_${g.id}`] = {
      type: 'choice',
      instructions: `针对 ${g.id}（成员见 \`groups\` 中该组），最合适的处置是？`,
      criteria: opts,
    };
    groupChoices[`reason_${g.id}`] = {
      type: 'noul',
      instructions: `${g.id} 的成员之所以高度相似，是因为它们本质上在回答同一个搜索问题，而不是因为分属不同产品线的合理差异化。`,
    };
  }

  const ans = await ask(
    'cannibal',
    {
      groups: groups.map((g) => ({
        id: g.id,
        member_count: g.members.length,
        max_similarity: g.maxSim,
        pairs_above_0_3: g.pairCount,
        members: g.members.map((m) => digest(pageByPath.get(m), 700)),
      })),
    },
    { ...questions, ...groupChoices },
  );

  findings.cannibal = {
    groups: groups.map((g) => ({
      ...g,
      severity: ans.severity.score,
      action: ans[`action_${g.id}`].choice,
      actionConfidence: ans[`action_${g.id}`].confidence,
      sameQuestion: ans[`reason_${g.id}`].noul,
    })),
  };
  for (const g of findings.cannibal.groups) {
    console.log(`  ${g.id} (${g.members.length} 页, 相似 ${g.maxSim}) → ${g.action}`);
  }
}

/* ==================================================================== */
/* 1. Internal links —— 配对判断 + 锚文本选择                              */
/* ==================================================================== */

if (want('links')) {
  console.log('\n▶ [1] Internal links：候选配对');

  const linked = new Set(corpus.links.map((l) => `${l.from}→${l.to}`));
  const simOf = new Map(corpus.similar.map((s) => [`${s.a}→${s.b}`, s.score]));
  const sim = (a, b) => simOf.get(`${a}→${b}`) ?? simOf.get(`${b}→${a}`) ?? 0;

  // 候选：每页取相似度最高的 5 个「尚未链接」目标
  const candidates = [];
  for (const p of pages) {
    const ranked = corpus.pages
      .filter((q) => q.urlPath !== p.urlPath && !linked.has(`${p.urlPath}→${q.urlPath}`))
      .map((q) => ({ q, s: sim(p.urlPath, q.urlPath) }))
      .filter((x) => x.s > 0.18)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
    for (const r of ranked) candidates.push({ from: p.urlPath, to: r.q.urlPath, sim: r.s });
  }
  console.log(`  候选配对 ${candidates.length} 组（去重后）`);

  const keptLinks = PAGES_FILTER.length
    ? (findings.linkCandidates || []).filter((c) => !PAGES_FILTER.includes(c.from))
    : [];
  findings.linkCandidates = keptLinks;
  const batches = chunk(candidates, 36);
  for (const [i, batch] of batches.entries()) {
    const questions = {};
    batch.forEach((c, j) => {
      const a = pageByPath.get(c.from);
      const b = pageByPath.get(c.to);
      questions[`worth_${j}`] = {
        type: 'noul',
        instructions: `一个正在读 \`pairs[${j}].from\`（标题：${a.title}）的读者，会不会有真实理由点进 \`pairs[${j}].to\`（标题：${b.title}）？即这条链接对读者有用，而不是为了 SEO 硬塞。`,
        criteria: {
          true: '读者在此处确实会想去看看那个页面',
          false: '两个主题关系牵强，或者链接会打断读者当前的任务',
        },
      };
      questions[`relation_${j}`] = {
        type: 'choice',
        instructions: `\`pairs[${j}].from\` 与 \`pairs[${j}].to\` 之间最准确的关系是？`,
        criteria: {
          'next-step': '读者读完前者自然要去做后者这件事（例如看完文章去问价）',
          'detail': '后者是前者提到的某个东西的更详细版本',
          'prerequisite': '后者是理解前者所需的前置知识',
          'alternative': '两者是同类替代选择，适合互相导流',
          'unrelated': '没有实质关系',
        },
      };
    });
    const ans = await ask(
      `links:${i}`,
      { pairs: batch.map((c) => ({ from: c.from, to: c.to, similarity: c.sim, from_text: pageByPath.get(c.from).text.slice(0, 700), to_summary: digest(pageByPath.get(c.to), 500) })) },
      questions,
    );
    batch.forEach((c, j) => {
      findings.linkCandidates.push({
        from: c.from,
        to: c.to,
        similarity: Number(c.sim.toFixed(3)),
        relation: ans[`relation_${j}`].choice,
        worth: ans[`worth_${j}`].noul,
      });
    });
    console.log(`  ✓ 批次 ${i + 1}/${batches.length}`);
  }

  // 只对「值得」的配对挑锚文本（从候选里选，不让模型生成）
  const accepted = findings.linkCandidates.filter((c) => c.worth >= 0.6 && c.relation !== 'unrelated' && !c.anchor);
  console.log(`  值得建链的配对 ${accepted.length} 组，开始选锚文本`);

  const anchorOf = (p) => {
    const t = p.title.replace(/\s*[-|｜]\s*DJI Luggage\s*$/i, '').trim();
    const opts = [t, p.h1[0], p.h1[0] ? p.h1[0].toLowerCase() : null, p.urlPath.split('/').filter(Boolean).pop().replace(/-/g, ' ')]
      .filter(Boolean)
      .map((s) => s.trim());
    return [...new Set(opts)].slice(0, 4);
  };

  const batches2 = chunk(accepted, 18);
  for (const [i, batch] of batches2.entries()) {
    const questions = {};
    const anchors = {};
    batch.forEach((c, j) => {
      const opts = anchorOf(pageByPath.get(c.to));
      anchors[j] = opts;
      questions[`anchor_${j}`] = {
        type: 'choice',
        instructions: `在 \`pairs[${j}].from\` 里为指向 \`pairs[${j}].to\` 的链接挑一个最自然、对读者最清楚的锚文本。只能从候选中选，不要造新词。`,
        criteria: Object.fromEntries(opts.map((o) => [o, `锚文本候选：「${o}」`])),
      };
    });
    const ans = await ask(
      `anchor:${i}`,
      { pairs: batch.map((c) => ({ from: c.from, to: c.to, from_context: pageByPath.get(c.from).text.slice(0, 500), to_title: pageByPath.get(c.to).title })) },
      questions,
    );
    batch.forEach((c, j) => {
      c.anchor = ans[`anchor_${j}`].choice;
      c.anchorConfidence = ans[`anchor_${j}`].confidence;
      c.anchorCandidates = anchors[j];
    });
    console.log(`  ✓ 锚文本批次 ${i + 1}/${batches2.length}`);
  }
  findings.linkCandidates = findings.linkCandidates.sort((a, b) => b.worth - a.worth || b.similarity - a.similarity);
}

/* ==================================================================== */
/* 7. Schema —— 结构化数据 vs 页面实际                                     */
/* ==================================================================== */

if (want('schema')) {
  console.log('\n▶ [7] Schema：声明与页面事实比对');
  const targets = corpus.schema.filter((s) => s.nodes.length);
  const batches = chunk(targets, 8);
  const schemaMap = new Map((findings.schema || []).map((x) => [x.url, x]));
  findings.schema = [...schemaMap.values()];
  for (const [i, batch] of batches.entries()) {
    const questions = {};
    batch.forEach((s, j) => {
      const p = pageByPath.get(s.urlPath);
      questions[`consistent_${j}`] = {
        type: 'score',
        instructions: `把 \`items[${j}].claims\`（页面 JSON-LD 里的结构化数据声明）与 \`items[${j}].page\`（页面实际内容）对照，评估两者的吻合程度。`,
        criteria: [
          '结构化数据与页面明显矛盾或凭空多出事实',
          '有多处声明在页面上找不到依据',
          '大体一致，但个别字段页面上没有对应内容',
          '所有声明都能在页面上找到依据',
          '声明与页面完全吻合，且比页面更简洁准确地概括了页面',
        ],
      };
      questions[`unsupported_${j}`] = {
        type: 'noul',
        instructions: `\`items[${j}].claims\` 中存在页面上无法印证的具体声明（例如材料、品牌、尺寸、日期、数量、职位地点）。`,
        criteria: { true: '存在无法印证的声明', false: '所有声明都能在页面上找到依据' },
      };
      questions[`risky_${j}`] = {
        type: 'choice',
        instructions: `如果 \`items[${j}].claims\` 与页面不一致，最可能被搜索引擎判定为哪类问题？`,
        criteria: {
          none: '没有不一致',
          'wrong-facts': '结构化数据里的事实是错的（会误导）',
          'over-claimed': '结构化数据夸大了页面实际提供的东西',
          stale: '结构化数据过期（日期、数量、职位已变）',
          'template-leak': '结构化数据是模板套用的，与当前页面主题不符',
        },
      };
    });
    const ans = await ask(
      `schema:${i}`,
      {
        items: batch.map((s) => ({
          url: s.urlPath,
          parse_errors: s.parseErrors,
          claims: s.nodes.map((n) => ({ type: n.type, ...n.fields })),
          page: {
            title: pageByPath.get(s.urlPath).title,
            h1: pageByPath.get(s.urlPath).h1,
            meta_description: pageByPath.get(s.urlPath).metaDescription,
            text: pageByPath.get(s.urlPath).text.slice(0, 1800),
          },
        })),
      },
      questions,
    );
    batch.forEach((s, j) => {
      const entry = {
        url: s.urlPath,
        nodeTypes: [...new Set(s.nodes.map((n) => n.type))],
        parseErrors: s.parseErrors,
        consistency: ans[`consistent_${j}`].score,
        hasUnsupportedClaim: ans[`unsupported_${j}`].noul,
        riskType: ans[`risky_${j}`].choice,
      };
      const at = findings.schema.findIndex((x) => x.url === entry.url);
      if (at >= 0) findings.schema[at] = entry;
      else findings.schema.push(entry);
    });
    console.log(`  ✓ 批次 ${i + 1}/${batches.length}`);
  }
}

/* ==================================================================== */
/* 5 + 6. Content audit 与 Redirect map 需要前序结果，放到 audit.mjs       */
/* ==================================================================== */

writeFileSync(outPath, JSON.stringify(findings, null, 2));
console.log(`\n▶ 判断完成，写入 ${relative(ROOT, join(SITE_DIR, 'findings.json'))}`);
console.log(`  Jev 用量：输入 ${usageTotal.input_tokens} / 输出 ${usageTotal.output_tokens} tokens（${model}）`);
