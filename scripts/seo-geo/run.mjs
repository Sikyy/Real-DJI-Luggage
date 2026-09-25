#!/usr/bin/env node
/**
 * SEO / GEO 对比分析主流程。
 *
 *   node scripts/seo-geo/run.mjs                  # 全流程（抓取走缓存）
 *   node scripts/seo-geo/run.mjs --refresh        # 重新抓取线上页面
 *   node scripts/seo-geo/run.mjs --reuse-pages    # 复用逐页 Jev 答案，只重跑分层/全局判断与报告
 *   node scripts/seo-geo/run.mjs --only-fetch     # 只抓取与抽取，不调用 Jev
 *   node scripts/seo-geo/run.mjs --pages a,b      # 只跑指定页面 id
 *
 * 分工：抓取与事实抽取由代码完成（extract.mjs），语义判断交给 Jev（jev.mjs）。
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES, LAYERS, CACHE_DIR, REPORT_DIR } from './config.mjs';
import { extract } from './extract.mjs';
import {
  loadApiKey, callJev, mapLimit, buildPageQuestions, buildPageState,
  buildLayerQuestions, buildLayerState, buildGlobalQuestions, GLOBAL_QUERY,
} from './jev.mjs';
import { buildReportHtml } from './report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const flagValue = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const REFRESH = hasFlag('--refresh');
const REUSE_PAGES = hasFlag('--reuse-pages') || hasFlag('--reuse-jev');
const ONLY_FETCH = hasFlag('--only-fetch');
const REPORT_ONLY = hasFlag('--report-only');
const ONLY_PAGES = (flagValue('--pages') || '').split(',').map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(flagValue('--concurrency') || 3);

const abs = (p) => join(ROOT, p);
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const layerById = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
const targets = PAGES.filter((p) => !ONLY_PAGES.length || ONLY_PAGES.includes(p.id)).map((p) => ({
  ...p,
  layerLabel: layerById[p.layer].label,
  query: layerById[p.layer].query,
}));

mkdirSync(abs(CACHE_DIR), { recursive: true });
mkdirSync(abs(REPORT_DIR), { recursive: true });

const sumUsage = (a, b) => ({
  input_tokens: (a?.input_tokens || 0) + (b?.input_tokens || 0),
  output_tokens: (a?.output_tokens || 0) + (b?.output_tokens || 0),
});

/* ------------------------------- 1. 抓取 ------------------------------- */

async function fetchPage(page) {
  const cachePath = abs(join(CACHE_DIR, `${page.id}.html`));
  if (!REFRESH && existsSync(cachePath)) {
    return { html: readFileSync(cachePath, 'utf8'), fromCache: true };
  }
  const res = await fetch(page.url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  writeFileSync(cachePath, html);
  return { html, fromCache: false, finalUrl: res.url, status: res.status };
}

console.log(`\n▶ 抓取 ${targets.length} 个页面（并发 ${CONCURRENCY}）…`);
const fetched = await mapLimit(targets, CONCURRENCY, async (page) => {
  try {
    const r = await fetchPage(page);
    console.log(`  ${r.fromCache ? '缓存' : '下载'}  ${page.id.padEnd(20)} ${page.url}`);
    return { page, html: r.html, error: null };
  } catch (err) {
    console.log(`  ✗ 失败  ${page.id.padEnd(20)} ${err.message}`);
    return { page, html: null, error: err.message };
  }
});

/* ------------------------------ 2. 抽取 ------------------------------ */

const facts = {};
for (const item of fetched) {
  if (!item.html) continue;
  try {
    facts[item.page.id] = extract(item.html, item.page.url);
  } catch (err) {
    console.log(`  ✗ 抽取失败 ${item.page.id}: ${err.message}`);
  }
}

writeFileSync(abs(join(CACHE_DIR, '..', 'extracted.json')), JSON.stringify(facts, null, 2));

const okPages = targets.filter((p) => facts[p.id]);
console.log(`\n▶ 抽取完成：${okPages.length}/${targets.length} 页`);
for (const p of okPages) {
  const f = facts[p.id];
  console.log(
    `  ${p.id.padEnd(20)} ${String(f.wordCount).padStart(5)} 词  H1×${f.h1Count}  JSON-LD ${f.jsonldTypes.join(',') || '—'}  alt ${f.imageAltCoverage}%  FAQ ${f.hasFaq ? 'Y' : 'N'}  认证 ${f.certifications.length}`,
  );
}

if (ONLY_FETCH) {
  console.log('\n（--only-fetch：跳过 Jev）');
  process.exit(0);
}

/* ------------------------------ 3. Jev ------------------------------ */

const jevPath = abs(join(CACHE_DIR, '..', 'jev-results.json'));

// --report-only：直接复用已保存的 Jev 答案重新生成报告，不产生任何模型调用。
if (REPORT_ONLY) {
  if (!existsSync(jevPath)) throw new Error('没有可复用的 ' + jevPath + '，请先跑一次完整分析');
  const jev = JSON.parse(readFileSync(jevPath, 'utf8'));
  const d = new Date().toISOString().slice(0, 10);
  const name = `seo-geo-${d}`;
  writeFileSync(abs(join(REPORT_DIR, `${name}.html`)), buildReportHtml({ pages: okPages, facts, jev, layers: LAYERS, globalQuery: GLOBAL_QUERY, generatedAt: new Date().toISOString() }));
  writeFileSync(abs(join(REPORT_DIR, `${name}.json`)), JSON.stringify({ generatedAt: new Date().toISOString(), pages: okPages, facts, jev }, null, 2));
  console.log(`\n▶ 报告已重新生成（--report-only，无模型调用）\n  ${join(REPORT_DIR, name + '.html')}\n`);
  process.exit(0);
}

const digest = (p, n) => ({
  id: p.id,
  owner: p.owner,
  url: p.url,
  layerLabel: p.layerLabel,
  title: facts[p.id].title,
  excerpt: facts[p.id].bodyText.slice(0, n),
});

/** 逐页：14 个 Score + 5 个 Noul，一次请求问完。 */
async function runPages(apiKey) {
  console.log(`\n▶ 调用 Jev 分析 ${okPages.length} 个页面…`);
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = null;
  const pages = {};
  const answers = await mapLimit(okPages, CONCURRENCY, async (page) => {
    const res = await callJev(apiKey, {
      state: buildPageState(page, facts[page.id]),
      questions: buildPageQuestions(),
      label: page.id,
    });
    usage = sumUsage(usage, res.usage);
    model = res.model || model;
    const avgOf = (prefix) => {
      const v = Object.entries(res.answers).filter(([k]) => k.startsWith(prefix)).map(([, x]) => x.score);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    console.log(`  ✓ ${page.id.padEnd(20)} SEO ${avgOf('seo_').toFixed(2)}/4  GEO ${avgOf('geo_').toFixed(2)}/4`);
    return [page.id, res.answers];
  });
  for (const [id, a] of answers) pages[id] = a;
  return { pages, usage, model };
}

/** 分层跨页对比：每层 3 个 Choice。 */
async function runLayers(apiKey) {
  console.log('\n▶ 跨页对比（每层 3 个 Choice）…');
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = null;
  const layers = {};
  for (const layer of LAYERS) {
    const candidates = okPages
      .filter((p) => p.layer === layer.id)
      .map((p) => ({
        id: p.id,
        owner: p.owner,
        url: p.url,
        layerLabel: p.layerLabel,
        title: facts[p.id].title,
        metaDescription: facts[p.id].metaDescription,
        headings: facts[p.id].headings.slice(0, 10).map((h) => `${'#'.repeat(h.level)} ${h.text}`),
        wordCount: facts[p.id].wordCount,
        jsonldTypes: facts[p.id].jsonldTypes,
        certifications: facts[p.id].certifications,
        hasFaq: facts[p.id].hasFaq,
        unitStatHits: facts[p.id].unitStatHits,
        excerpt: facts[p.id].bodyText.slice(0, 2500),
      }));
    if (candidates.length < 2) continue;
    const res = await callJev(apiKey, {
      state: buildLayerState(layer, candidates),
      questions: buildLayerQuestions(candidates),
      label: `layer:${layer.id}`,
    });
    usage = sumUsage(usage, res.usage);
    model = res.model || model;
    layers[layer.id] = res.answers;
    console.log(
      `  ✓ ${layer.id.padEnd(10)} 最佳搜索页 ${res.answers.best_seo_page.choice} / 最佳 AI 来源 ${res.answers.best_geo_source.choice}`,
    );
  }
  return { layers, usage, model };
}

/**
 * 全局问题跑两次：短上下文（每页 1,200 字）与长上下文（每页 4,000 字）。
 * 两次结果一并呈现——上下文长度会让判断翻转，翻转本身就是「差距很小」的证据。
 */
async function runGlobal(apiKey) {
  let usage = { input_tokens: 0, output_tokens: 0 };
  const shortList = okPages.map((p) => digest(p, 1200));
  const richList = okPages.map((p) => digest(p, 4000));

  console.log('\n▶ 全局：谁能被引用回答「定制铝框行李箱代工」…');
  const shortRes = await callJev(apiKey, {
    state: { query: GLOBAL_QUERY, candidates: shortList },
    questions: buildGlobalQuestions(shortList),
    label: 'global:short',
  });
  usage = sumUsage(usage, shortRes.usage);
  console.log(
    `  短上下文 → ${shortRes.answers.single_best_source.choice}（置信度 ${Math.round(shortRes.answers.single_best_source.confidence * 100)}%）`,
  );

  console.log('▶ 复核：同一问题换用更完整正文…');
  const richRes = await callJev(apiKey, {
    state: { query: GLOBAL_QUERY, candidates: richList },
    questions: buildGlobalQuestions(richList, { rich: true }),
    label: 'global:rich',
  });
  usage = sumUsage(usage, richRes.usage);
  console.log(
    `  长上下文 → ${richRes.answers.single_best_source.choice}（置信度 ${Math.round(richRes.answers.single_best_source.confidence * 100)}%）`,
  );

  return {
    global: shortRes.answers,
    globalRich: richRes.answers,
    usage,
    model: richRes.model || shortRes.model,
  };
}

let jevResults;
if (REUSE_PAGES && existsSync(jevPath)) {
  const prev = JSON.parse(readFileSync(jevPath, 'utf8'));
  const apiKey = loadApiKey();
  console.log('\n▶ 复用逐页 Jev 答案，重跑分层与全局判断');
  const L = await runLayers(apiKey);
  const G = await runGlobal(apiKey);
  jevResults = {
    pages: prev.pages,
    layers: L.layers,
    global: G.global,
    globalRich: G.globalRich,
    model: G.model || L.model || prev.model,
    usage: sumUsage(sumUsage(prev.usage, L.usage), G.usage),
    generatedAt: new Date().toISOString(),
  };
} else {
  const apiKey = loadApiKey();
  const P = await runPages(apiKey);
  const L = await runLayers(apiKey);
  const G = await runGlobal(apiKey);
  jevResults = {
    pages: P.pages,
    layers: L.layers,
    global: G.global,
    globalRich: G.globalRich,
    model: G.model || L.model || P.model,
    usage: sumUsage(sumUsage(P.usage, L.usage), G.usage),
    generatedAt: new Date().toISOString(),
  };
}

writeFileSync(jevPath, JSON.stringify(jevResults, null, 2));
console.log(
  `\n  Jev 用量：输入 ${jevResults.usage.input_tokens} / 输出 ${jevResults.usage.output_tokens} tokens（${jevResults.model}）`,
);

/* ------------------------------ 4. 报告 ------------------------------ */

const date = new Date().toISOString().slice(0, 10);
const baseName = `seo-geo-${date}`;
const html = buildReportHtml({
  pages: okPages,
  facts,
  jev: jevResults,
  layers: LAYERS,
  globalQuery: GLOBAL_QUERY,
  generatedAt: new Date().toISOString(),
});
writeFileSync(abs(join(REPORT_DIR, `${baseName}.html`)), html);
writeFileSync(
  abs(join(REPORT_DIR, `${baseName}.json`)),
  JSON.stringify({ generatedAt: new Date().toISOString(), pages: okPages, facts, jev: jevResults }, null, 2),
);

console.log(`\n▶ 报告已生成`);
console.log(`  ${join(REPORT_DIR, `${baseName}.html`)}`);
console.log(`  ${join(REPORT_DIR, `${baseName}.json`)}\n`);
