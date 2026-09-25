/**
 * 站点审计第二阶段（对应需求 5、6）。
 *
 *   5 Content audits → 每个 URL 归入 keep / update / merge / remove
 *   6 Redirect maps  → 旧 URL 映射到最佳新 URL，并标出不确定项
 *
 * 依赖 analyze.mjs 产出的 .seo-geo/site/findings.json。
 *
 *   node scripts/site-audit/audit.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadApiKey, callJev } from '../seo-geo/jev.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_DIR = join(ROOT, '.seo-geo', 'site');
const abs = (p) => join(ROOT, p);

const corpus = JSON.parse(readFileSync(join(SITE_DIR, 'corpus.json'), 'utf8'));
const findings = JSON.parse(readFileSync(join(SITE_DIR, 'findings.json'), 'utf8'));
const pages = corpus.pages;
const pageByPath = new Map(pages.map((p) => [p.urlPath, p]));
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
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const simOf = new Map(corpus.similar.map((s) => [`${s.a}→${s.b}`, s.score]));
const sim = (a, b) => simOf.get(`${a}→${b}`) ?? simOf.get(`${b}→${a}`) ?? 0;
const neighbours = (url, n = 3) =>
  pages
    .filter((q) => q.urlPath !== url)
    .map((q) => ({ q, s: sim(url, q.urlPath) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n);

/* ==================================================================== */
/* 5. Content audit                                                       */
/* ==================================================================== */

const VERDICT_CRITERIA = {
  keep: '保留：页面有独有价值、意图清晰、内容站得住，无需改动',
  update: '更新：选题和意图是对的，但内容需要补充/修正/加深后才能发挥作用',
  merge: '合并：本页与站内另一页争夺同一意图，应把有价值的部分并入那页并 301 过去',
  remove: '移除：没有独有价值，也不值得并入他处，应删除并妥善处理 URL',
};

const ISSUE_CRITERIA = {
  healthy: '没有明显问题',
  thin: '内容太薄，缺少实质信息',
  template: '模板化内容，换标题即可套用到别页',
  'duplicate-intent': '与站内其他页面争夺同一搜索意图',
  'intent-mismatch': '标题/结构承诺的意图与正文实际内容不符',
  outdated: '内容陈旧，缺少时效信号或已被现状取代',
  'weak-links': '孤岛页或几乎收不到内链，站内权重无法到达',
  'low-value': '主题对 B2B 买家价值低，占用抓取与权重',
  'schema-risk': '结构化数据与页面内容不一致，存在被判定误导的风险',
};

console.log(`▶ [5] Content audit：${pages.length} 个 URL 归类`);
const batches = chunk(pages, 6);
const audits = {};
for (const [i, batch] of batches.entries()) {
  const questions = {};
  const neighboursByIndex = {};
  batch.forEach((p, j) => {
    const nb = neighbours(p.urlPath, 3);
    neighboursByIndex[j] = nb.map((x) => x.q.urlPath);
    const nbCriteria = Object.fromEntries(nb.map((x) => [x.q.urlPath, `${x.q.urlPath}｜${x.q.title}（相似度 ${x.s.toFixed(2)}）`]));
    questions[`verdict_${j}`] = {
      type: 'choice',
      instructions: `综合给出的全部证据，决定 \`items[${j}]\` 这个 URL 的处置。依据包括原创性得分、意图标签、同质分组裁决、内链情况与结构化数据风险。`,
      criteria: VERDICT_CRITERIA,
    };
    questions[`issue_${j}`] = {
      type: 'choice',
      instructions: `\`items[${j}]\` 最主要的单一问题是哪一个？`,
      criteria: ISSUE_CRITERIA,
    };
    questions[`merge_target_${j}`] = {
      type: 'choice',
      instructions: `如果 \`items[${j}]\` 的处置是 merge 或 remove，最合适的承接页面是哪一个（数据里已给出站内最相似的候选）？如果不是 merge/remove，请选 not-applicable。真正的决定由代码依据 \`verdict\` 使用，所以请如实回答。`,
      criteria: { 'not-applicable': '本页不需要合并到别处', ...nbCriteria },
    };
  });
  const ans = await ask(
    `audit:${i}`,
    {
      items: batch.map((p) => {
        const thin = findings.thin?.[p.urlPath] || {};
        const intent = findings.intent?.[p.urlPath] || {};
        const group = (findings.cannibal?.groups || []).find((g) => g.members.includes(p.urlPath));
        const schema = (findings.schema || []).find((s) => s.url === p.urlPath);
        return {
          url: p.urlPath,
          in_sitemap: p.inSitemap,
          title: p.title,
          h1: p.h1,
          word_count: p.wordCount,
          text_excerpt: p.text.slice(0, 1000),
          originality_score_0_4: thin.originality ?? null,
          reads_as_template: thin.templateGenerated ?? null,
          buyer_value_probability: thin.buyerValue ?? null,
          intent_implied: intent.implied ?? null,
          intent_served: intent.served ?? null,
          intent_mismatch_probability: intent.mismatch ?? null,
          cannibal_group: group ? group.id : null,
          cannibal_group_size: group ? group.members.length : null,
          cannibal_similarity: group ? group.maxSim : null,
          cannibal_recommended_action: group ? group.action : null,
          inlinks: corpus.inlinkCounts[p.urlPath] ?? 0,
          internal_links_out: p.internalLinkCount,
          schema_node_types: schema ? schema.nodeTypes : [],
          schema_consistency_0_4: schema ? schema.consistency : null,
          schema_unsupported_claim: schema ? schema.hasUnsupportedClaim : null,
        };
      }),
    },
    questions,
  );
  batch.forEach((p, j) => {
    const verdict = ans[`verdict_${j}`].choice;
    const target = ans[`merge_target_${j}`].choice;
    audits[p.urlPath] = {
      verdict,
      verdictConfidence: ans[`verdict_${j}`].confidence,
      verdictProbabilities: ans[`verdict_${j}`].probabilities,
      primaryIssue: ans[`issue_${j}`].choice,
      mergeTarget: target === 'not-applicable' ? null : target,
      mergeTargetConfidence: ans[`merge_target_${j}`].confidence,
      mergeCandidates: neighboursByIndex[j],
    };
  });
  console.log(`  ✓ 批次 ${i + 1}/${batches.length}`);
}

const tally = audits && Object.values(audits).reduce((acc, a) => ((acc[a.verdict] = (acc[a.verdict] || 0) + 1), acc), {});
console.log(`  归类结果：${Object.entries(tally).map(([k, v]) => `${k}=${v}`).join('  ')}`);

/* ==================================================================== */
/* 6. Redirect map                                                        */
/* ==================================================================== */

console.log('\n▶ [6] Redirect map');

const tokens = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
const jaccard = (a, b) => {
  const A = tokens(a);
  const B = tokens(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
};

/** 旧 URL（不在当前语料里）→ 按词面相似度选候选 */
function candidatesFor(oldPath, n = 4) {
  return pages
    .map((p) => ({ p, s: Math.max(jaccard(oldPath, p.urlPath), jaccard(oldPath, p.title)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n);
}

// 6a. 现有 301 规则是否指向最佳目标（只看有真实语义的规则，机械前缀规则由代码判定）
const meaningful = corpus.legacy.filter(
  (l) => !/^\/(zh|id|en)(\/|$)/.test(l.from) && l.from !== '/platform' && l.status === 301,
);
const uniqueOld = [...new Map(meaningful.map((l) => [l.from, l])).values()];
console.log(`  校验 ${uniqueOld.length} 条有语义的旧 URL 规则`);

const verdicts = [];
for (const [i, group] of chunk(uniqueOld, 10).entries()) {
  const questions = {};
  group.forEach((l, j) => {
    const cands = candidatesFor(l.from, 4);
    const criteria = { 'no-good-match': '当前站内没有合适的承接页面，保留 404 或 410 更诚实' };
    for (const c of cands) criteria[c.p.urlPath] = `${c.p.urlPath}｜${c.p.title}（词面相似度 ${c.s.toFixed(2)}）`;
    criteria[`__current:${l.to}`] = `当前规则指向的目标：${l.to}`;
    questions[`best_target_${j}`] = {
      type: 'choice',
      instructions: `旧 URL \`olds[${j}].from\`（原主题可由路径推断）应该 301 到哪个页面最合适？可以从候选里选，也可以选当前规则的目标，或判定没有合适目标。`,
      criteria,
    };
    questions[`uncertain_${j}`] = {
      type: 'noul',
      instructions: `把 \`olds[${j}].from\` 映射到任何现有页面都是勉强的：旧页面的主题在站内已经不存在对应内容，这个 301 更像是在掩盖内容缺失。`,
    };
    questions[`preserve_${j}`] = {
      type: 'noul',
      instructions: `\`olds[${j}].from\` 所承载的主题，对今天的 B2B 行李箱买家仍有搜索价值，值得重新创作内容而不是单纯 301。`,
    };
  });
  const ans = await ask(
    `redirect:${i}`,
    {
      olds: group.map((l) => {
        const cur = pageByPath.get(l.to.replace(/\/$/, ''));
        return {
          from: l.from,
          current_rule_target: l.to,
          current_target_title: cur ? cur.title : '（该目标不在当前语料中）',
          current_target_in_sitemap: cur ? cur.inSitemap : null,
        };
      }),
    },
    questions,
  );
  group.forEach((l, j) => {
    const raw = ans[`best_target_${j}`].choice;
    const chosen = raw.startsWith('__current:') ? raw.slice(10) : raw;
    verdicts.push({
      from: l.from,
      currentRuleTarget: l.to,
      bestTarget: chosen === 'no-good-match' ? null : chosen,
      agreesWithCurrentRule: chosen === l.to,
      confidence: ans[`best_target_${j}`].confidence,
      probabilities: ans[`best_target_${j}`].probabilities,
      uncertain: ans[`uncertain_${j}`].noul,
      worthRecreating: ans[`preserve_${j}`].noul,
      kind: 'legacy-rule',
    });
  });
  console.log(`  ✓ 批次 ${i + 1}`);
}

// 6b. 内容审计判定为 merge/remove 的页面 → 给出建议 301 目标
const needsRedirect = Object.entries(audits).filter(([, a]) => a.verdict === 'merge' || a.verdict === 'remove');
const proposed = needsRedirect.map(([url, a]) => ({
  from: url,
  verdict: a.verdict,
  target: a.mergeTarget,
  confidence: a.mergeTargetConfidence,
  candidates: a.mergeCandidates,
  kind: 'proposed-from-audit',
}));

const redirects = {
  legacyRuleReview: verdicts,
  proposedFromAudit: proposed,
  mechanical: corpus.legacy
    .filter((l) => !meaningful.some((m) => m.from === l.from))
    .map((l) => ({ from: l.from, to: l.to, status: l.status, note: '地区前缀/机械规则，无需语义判断' })),
  reviewQueue: [
    ...verdicts.filter((v) => v.confidence < 0.55 || v.uncertain >= 0.5).map((v) => ({ ...v, reason: '低置信或模型认为映射勉强' })),
    ...proposed
      .filter((p) => !p.target || (p.confidence ?? 0) < 0.55)
      .map((p) => ({ ...p, reason: '审计建议合并/移除，但没有高置信承接页面' })),
  ],
};

findings.audits = audits;
findings.redirects = redirects;
findings.auditGeneratedAt = new Date().toISOString();
findings.usage = {
  input_tokens: (findings.usage?.input_tokens || 0) + usage.input_tokens,
  output_tokens: (findings.usage?.output_tokens || 0) + usage.output_tokens,
};
writeFileSync(join(SITE_DIR, 'findings.json'), JSON.stringify(findings, null, 2));

console.log(`\n▶ 写入 .seo-geo/site/findings.json`);
console.log(`  需人工复核的映射：${redirects.reviewQueue.length} 条`);
console.log(`  建议新增 301：${proposed.length} 条`);
console.log(`  Jev 用量：输入 ${usage.input_tokens} / 输出 ${usage.output_tokens} tokens（${model}）`);
