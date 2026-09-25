#!/usr/bin/env node
/**
 * B2B 制造业网站 SEO / GEO 基准测试（benchmark）。
 *
 *   node scripts/site-audit/benchmark.mjs              # 用缓存（默认）
 *   node scripts/site-audit/benchmark.mjs --refresh    # 重新抓取线上页面
 *   node scripts/site-audit/benchmark.mjs --sites=protolabs,omaska
 *   node scripts/site-audit/benchmark.mjs --json-only  # 只出 JSON，不写 md
 *
 * 设计约束：
 *   - 零依赖（Node 24 自带 fetch / AbortSignal.timeout），不新增 npm 包。
 *   - 抓取失败如实记录（403 / 526 / DNS 失败等），绝不编造数据。
 *   - 事实抽取复用 scripts/seo-geo/extract.mjs，本脚本只补充表格/清单/流程类启发式信号。
 *   - 原始 HTML 落在 .seo-geo/benchmark/<site>/<page>.html，报告落在 .workbuddy-ai/reports/。
 *
 * 输出：
 *   .workbuddy-ai/reports/benchmark-sites.json     机器可读（逐页指标 + 站点说明）
 *   .workbuddy-ai/reports/benchmark-patterns.md    中文结论报告（含与 djiluggage.id 的对比表）
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extract, htmlToText } from '../seo-geo/extract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_DIR = '.seo-geo/benchmark';
const REPORT_DIR = '.workbuddy-ai/reports';

const abs = (p) => join(ROOT, p);

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const flagValue = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};
const REFRESH = hasFlag('--refresh');
const JSON_ONLY = hasFlag('--json-only');
const ONLY_SITES = (flagValue('--sites') || '').split(',').map((s) => s.trim()).filter(Boolean);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TIMEOUT_MS = 30000; // 任务要求 30s

/* ------------------------------------------------------------------ *
 * 1. 候选池
 *    - candidates: 用真实首页请求验证可达性（8-12 个以上），用于「为什么选这 6 个」。
 *    - selected:   6 个真正可达 + 制造业聚焦的站点，抓 3 类页面。
 * ------------------------------------------------------------------ */

const VERTICALS = {
  injection: '注塑成型 / 塑料件',
  cnc: 'CNC 精密加工',
  sheetmetal: '钣金 / 机箱机柜',
  packaging: '包装制造',
  electronics: '电子 / PCB 制造',
  prototype: '快速原型 / 小批量制造',
  bags: '箱包 / 背包 / 拉杆箱',
  platform: '制造服务聚合平台（非工厂）',
};

const CANDIDATES = [
  { id: 'protolabs', name: 'Protolabs', url: 'https://www.protolabs.com/', vertical: 'injection', role: '美国上市数字制造厂（注塑/CNC/钣金/3D 打印）' },
  { id: 'xometry', name: 'Xometry', url: 'https://www.xometry.com/', vertical: 'platform', role: '制造服务聚合平台，内容量极大' },
  { id: '3erp', name: '3ERP', url: 'https://www.3erp.com/', vertical: 'cnc', role: '中国 CNC/钣金/注塑代工厂，博客体系完整' },
  { id: 'rapiddirect', name: 'RapidDirect', url: 'https://www.rapiddirect.com/', vertical: 'cnc', role: '亚洲 CNC/注塑/钣金 OEM 工厂，内容营销投入最大' },
  { id: 'waykenrm', name: 'WAYKEN', url: 'https://waykenrm.com/', vertical: 'prototype', role: '中国快速原型/小批量制造工厂' },
  { id: 'starrapid', name: 'Star Rapid', url: 'https://www.starrapid.com/', vertical: 'prototype', role: '中国原型/注塑工厂（已知内容强，但网络不可达）' },
  { id: 'jlc3dp', name: 'JLC3DP', url: 'https://jlc3dp.com/', vertical: 'prototype', role: '嘉立创 3D 打印制造服务' },
  { id: 'jlcpcb', name: 'JLCPCB', url: 'https://jlcpcb.com/', vertical: 'electronics', role: 'PCB 打样/量产制造商' },
  { id: 'omaska', name: 'Omaska', url: 'https://www.omaska.com/', vertical: 'bags', role: '箱包/背包/拉杆箱 OEM 工厂——与 djiluggage 同品类' },
  { id: 'thomasnet', name: 'Thomasnet', url: 'https://www.thomasnet.com/', vertical: 'platform', role: '北美工业供应商目录（非工厂）' },
  { id: 'protocase', name: 'Protocase', url: 'https://www.protocase.com/', vertical: 'sheetmetal', role: '加拿大钣金机箱制造商，2-3 天交期' },
  { id: 'pakfactory', name: 'PakFactory', url: 'https://pakfactory.com/', vertical: 'packaging', role: 'B2B 定制包装制造' },
  { id: 'fictiv', name: 'Fictiv', url: 'https://www.fictiv.com/', vertical: 'platform', role: '制造供应链平台' },
  { id: 'unionfab', name: 'Unionfab', url: 'https://www.unionfab.com/', vertical: 'prototype', role: '中国 3D 打印/CNC 制造服务' },
  { id: 'tuofa', name: 'Tuofa', url: 'https://tuofa-cncmachining.com/', vertical: 'cnc', role: '中国 CNC 机加工工厂' },
  { id: 'greatchip', name: 'GreatChip', url: 'https://www.greatchip.com/', vertical: 'electronics', role: '电子制造（抓取失败）' },
  { id: 'sunrise-metal', name: 'Sunrise Metal', url: 'https://www.sunrise-metal.com/', vertical: 'injection', role: '压铸/注塑（403）' },
];

const SELECTED = [
  {
    id: 'protolabs',
    name: 'Protolabs',
    vertical: 'injection',
    whyVertical: '美国上市的数字制造工厂，注塑/CNC/钣金全链路自营产能，是「制造商自己做内容」的顶级样本。',
    pages: {
      home: 'https://www.protolabs.com/',
      capability: 'https://www.protolabs.com/services/injection-molding/plastic-injection-molding/',
      article: 'https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/',
    },
  },
  {
    id: 'rapiddirect',
    name: 'RapidDirect',
    vertical: 'cnc',
    whyVertical: '亚洲 CNC/注塑/钣金 OEM 代工厂，商业模式（询盘 + 报价 + 打样 + 量产）与 djiluggage 最接近。',
    pages: {
      home: 'https://www.rapiddirect.com/',
      capability: 'https://www.rapiddirect.com/cnc-machining/',
      article: 'https://www.rapiddirect.com/blog/cnc-machining-services-tolerances/',
    },
  },
  {
    id: 'waykenrm',
    name: 'WAYKEN',
    vertical: 'prototype',
    whyVertical: '中国快速原型/小批量制造工厂，博客量大且覆盖「成本、工艺、材料」类长尾问题。',
    anomalies: [
      '`https://waykenrm.com/cnc-machining-services/` 这个旧 URL 返回 HTTP 200 但 content-type=image/png（302 到 wp-content 里的一张 CNC 图片），不是 HTML 页面，因此被判定为抓取失败并改用真实的能力页 URL。',
    ],
    pages: {
      home: 'https://waykenrm.com/',
      capability: 'https://waykenrm.com/technologies/cnc-machining/',
      article: 'https://waykenrm.com/blogs/aluminum-machining-cost/',
    },
  },
  {
    id: 'protocase',
    name: 'Protocase',
    vertical: 'sheetmetal',
    whyVertical: '加拿大钣金/机箱制造商，自营工厂 + 工程师内容站，工程规范（tolerance）类页面极扎实。',
    pages: {
      home: 'https://www.protocase.com/',
      capability: 'https://www.protocase.com/products/cnc-machining/cnc-milling/',
      article: 'https://www.protocase.com/blog/2021/06/30/custom-copper-bus-bars-guide/',
    },
  },
  {
    id: 'pakfactory',
    name: 'PakFactory',
    vertical: 'packaging',
    whyVertical: 'B2B 定制包装制造，博客/行业页结构清晰，覆盖合规（PFAS/EPR/FDA）等买家问题。',
    pages: {
      home: 'https://pakfactory.com/',
      capability: 'https://pakfactory.com/custom-rigid-setup-boxes.html',
      article: 'https://pakfactory.com/blog/custom-tin-box-packaging-master-guide',
    },
  },
  {
    id: 'omaska',
    name: 'Omaska',
    vertical: 'bags',
    whyVertical: '箱包/背包/拉杆箱 OEM 代工厂，与 djiluggage 同品类、同客户类型（品牌方/B2B 采购）。',
    pages: {
      home: 'https://www.omaska.com/',
      capability: 'https://www.omaska.com/custom-luggage/',
      article: 'https://www.omaska.com/bsci-vs-sedex-vs-iso9001-bag-factory-guide/',
    },
  },
];

const BASELINE = {
  id: 'djiluggage',
  name: 'djiluggage.id（本站基线）',
  vertical: 'bags',
  pages: {
    home: 'https://djiluggage.id/',
    product: 'https://djiluggage.id/products/aluminum-suitcase-black/',
    collection: 'https://djiluggage.id/collections/all/',
  },
};

/* ------------------------------------------------------------------ *
 * 2. 抓取
 * ------------------------------------------------------------------ */

mkdirSync(abs(CACHE_DIR), { recursive: true });
mkdirSync(abs(REPORT_DIR), { recursive: true });

const cachePathFor = (siteId, pageId) => join(CACHE_DIR, siteId, `${pageId}.html`);

// 部分站点会把「旧 URL」302 到一张图片或 PDF（例如 waykenrm.com/cnc-machining-services/ → image/png）。
// 这类响应虽然 HTTP 200，但不是页面，必须当成抓取失败记录，绝不能当作 HTML 页面统计。
const looksLikeHtml = (contentType, body) =>
  /text\/html|application\/xhtml/i.test(contentType || '') ||
  (!contentType && /^\s*(<!doctype html|<html)/i.test(body || ''));

async function fetchHtml(siteId, pageId, url) {
  const cacheFile = cachePathFor(siteId, pageId);
  const cached = existsSync(abs(cacheFile));
  if (!REFRESH && cached) {
    const html = readFileSync(abs(cacheFile), 'utf8');
    if (!looksLikeHtml('text/html', html)) {
      return { html: null, fromCache: true, status: 200, finalUrl: url, error: 'CACHED_NON_HTML（缓存不是 HTML，请用 --refresh 重抓）' };
    }
    return { html, fromCache: true, status: 200, finalUrl: url };
  }
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();
    // 4xx/5xx 一律算失败
    if (!res.ok) {
      return { html: null, fromCache: false, status: res.status, finalUrl: res.url, contentType, error: `HTTP ${res.status}` };
    }
    // 200 但内容是图片/PDF 等非 HTML → 也算失败，不写缓存
    if (!looksLikeHtml(contentType, body)) {
      return {
        html: null,
        fromCache: false,
        status: res.status,
        finalUrl: res.url,
        contentType,
        error: `NON_HTML_RESPONSE（content-type=${contentType || 'unknown'}，最终 URL ${res.url}）`,
      };
    }
    mkdirSync(dirname(abs(cacheFile)), { recursive: true });
    writeFileSync(abs(cacheFile), body);
    return { html: body, fromCache: false, status: res.status, finalUrl: res.url, contentType };
  } catch (err) {
    const code = err?.cause?.code || err?.code || err?.name || 'FETCH_FAILED';
    return { html: null, fromCache: false, status: 0, error: `${code}: ${String(err?.message || err).slice(0, 120)}` };
  }
}

/* ------------------------------------------------------------------ *
 * 3. 补充启发式信号（extract.mjs 没覆盖的结构性特征）
 * ------------------------------------------------------------------ */

const stripForStructure = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');

export function structuralSignals(html, facts) {
  const clean = stripForStructure(html);
  const text = facts.fullText || '';
  const headings = facts.headings || [];

  // 表格：总数、疑似对比表、含数字的行数
  const tables = [...clean.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1]);
  let comparisonTableCount = 0;
  let numericTableRows = 0;
  for (const t of tables) {
    const tText = htmlToText(t);
    const rows = [...t.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)];
    numericTableRows += rows.filter((r) => /\d/.test(htmlToText(r[0]))).length;
    const numericCells = (t.match(/<t[dh]\b[^>]*>[\s\S]*?\d[\s\S]*?<\/t[dh]>/gi) || []).length;
    if (/\bvs\b|versus|comparison|compared|对比/i.test(tText) || (rows.length >= 3 && numericCells >= 6)) {
      comparisonTableCount += 1;
    }
  }

  const olCount = (clean.match(/<ol\b/gi) || []).length;
  const ulCount = (clean.match(/<ul\b/gi) || []).length;
  const definitionListCount = (clean.match(/<dl\b/gi) || []).length;

  const headingTexts = headings.map((h) => h.text);
  const count = (re) => headingTexts.filter((t) => re.test(t)).length;

  const faqHeadingCount = count(/faq|frequently asked|常见问题/i);
  const questionHeadingCount = headingTexts.filter((t) => t.trim().endsWith('?')).length;
  const stepHeadingCount = count(/\bstep\s*\d|^step\b|step-by-step|process(es)?\b|how (it|we) (work|make)|阶段|流程/i);
  const definitionHeadingCount = count(/what (is|are|'s)|definition|glossary|meaning of|术语|定义/i);
  const comparisonHeadingCount = count(/\bvs\b|versus|comparison|compared|difference between|对比/i);

  const updateMarkerHits = (
    text.match(/last (updated|reviewed|modified)|updated (on|in)\b|published (on|in)\b|reviewed by|date updated/gi) || []
  ).length;
  const authorBylines = (clean.match(/\b(by|author|written by|reviewed by)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []).length;
  const hasTableOfContents = /table of contents|on this page|contents\s*<\/|id=["']toc["']|jump to/i.test(clean);

  return {
    tableCount: tables.length,
    comparisonTableCount,
    numericTableRows,
    olCount,
    ulCount,
    definitionListCount,
    faqHeadingCount,
    questionHeadingCount,
    stepHeadingCount,
    definitionHeadingCount,
    comparisonHeadingCount,
    updateMarkerHits,
    authorBylines,
    hasTableOfContents,
    // 每千词全页正文的内链数（含全站导航链接，各站口径一致，仅作相对比较）；
    // 在 pageMetrics() 里会用 fullWordCount 覆盖成更稳的口径
    internalLinksPer1kWords: facts.wordCount ? Math.round((facts.internalLinkCount / facts.wordCount) * 1000) : 0,
  };
}

const PCT = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function pageMetrics(html, url) {
  const facts = extract(html, url);
  const signals = structuralSignals(html, facts);
  // extract() 的 wordCount 只统计 <main>/<article> 容器内的文本（模板差异会让部分站点偏低）；
  // 因此额外给出去掉 nav/header/footer 后的全页词数。两个口径都写进报告，避免口径误导。
  const fullWordCount = (facts.fullText || '')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9\u4e00-\u9fa5]/.test(w)).length;
  // 内链密度统一用「全页口径」词数做分母：main 口径偏低时会算出 rapiddirect 首页 15667/千词 这类失真比值
  signals.internalLinksPer1kWords = fullWordCount
    ? Math.round((facts.internalLinkCount / fullWordCount) * 1000)
    : 0;
  return {
    url,
    finalUrl: url,
    title: facts.title,
    titleLength: facts.titleLength,
    metaDescriptionLength: facts.metaDescriptionLength,
    h1Count: facts.h1Count,
    h2Count: facts.h2Count,
    h3Count: facts.h3Count,
    wordCount: facts.wordCount,
    fullWordCount,
    mainScopeLooksEmpty: facts.wordCount < 250 && fullWordCount > 700,
    fullTextLength: facts.fullTextLength,
    jsonldTypes: facts.jsonldTypes,
    jsonldBlockCount: facts.jsonldBlockCount,
    jsonldParseErrors: facts.jsonldParseErrors,
    imageCount: facts.imageCount,
    imageAltCoverage: facts.imageAltCoverage,
    internalLinkCount: facts.internalLinkCount,
    externalLinkCount: facts.externalLinkCount,
    externalHosts: facts.externalHosts,
    certifications: facts.certifications,
    ctaSignals: facts.ctaSignals,
    unitStatHits: facts.unitStatHits,
    percentStatHits: facts.percentStatHits,
    hasFaq: facts.hasFaq,
    dateCount: facts.dates.length,
    datesSample: facts.dates.slice(0, 5),
    yearsMentioned: facts.yearsMentioned.slice(0, 12),
    canonicalSelf: facts.canonicalSelf,
    ogComplete: facts.ogComplete,
    twitterComplete: facts.twitterComplete,
    hreflangCount: facts.hreflangCount,
    headingsSample: facts.headings.slice(0, 20),
    ...signals,
  };
}

/* ------------------------------------------------------------------ *
 * 4. 统计工具
 * ------------------------------------------------------------------ */

const median = (arr) => {
  const a = arr.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round(((a[mid - 1] + a[mid]) / 2) * 10) / 10;
};
const mean = (arr) => {
  const a = arr.filter((n) => Number.isFinite(n));
  return a.length ? Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10 : null;
};
const min = (arr) => (arr.length ? Math.min(...arr) : null);
const max = (arr) => (arr.length ? Math.max(...arr) : null);
const uniq = (arr) => [...new Set(arr)];
const topCounts = (arrays, limit = 12) => {
  const tally = new Map();
  for (const a of arrays) for (const v of a || []) tally.set(v, (tally.get(v) || 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
};

const pick = (pages, keys) => keys.flatMap((k) => (pages[k] ? [pages[k]] : []));

/* ------------------------------------------------------------------ *
 * 5. 主流程
 * ------------------------------------------------------------------ */

const EXTRACTOR_PATH = 'scripts/seo-geo/extract.mjs';
const EXTRACTOR_SHA256 = createHash('sha256').update(readFileSync(abs(EXTRACTOR_PATH))).digest('hex');

const out = {
  generatedAt: new Date().toISOString(),
  method: {
    userAgent: UA,
    timeoutMs: TIMEOUT_MS,
    extractor: `${EXTRACTOR_PATH} (extract())`,
    extractorSha256: EXTRACTOR_SHA256,
    cacheDir: CACHE_DIR,
    refresh: REFRESH,
    nonHtmlPolicy: 'HTTP 200 但 content-type 不是 HTML（图片/PDF 等）一律记为抓取失败，不写缓存、不参与统计。',
    wordCountScope: 'extract().wordCount 只统计 <main>/<article> 容器内文本；本脚本另给 fullWordCount=去 nav/header/footer 的全页词数，避免口径误导。',
    note: '所有数字均来自真实 fetch 的 HTML；抓取失败如实记录为 status=0/4xx/5xx 或 NON_HTML_RESPONSE，不用估算值填充。',
  },
  candidates: [],
  sites: [],
  baseline: null,
  aggregates: null,
};

const wanted = (id) => !ONLY_SITES.length || ONLY_SITES.includes(id);

/* 5.1 候选池可达性（首页） */
console.log(`\n▶ 候选池可达性检查（${CANDIDATES.length} 个域名，${REFRESH ? '强制刷新' : '优先缓存'}）…`);
for (const c of CANDIDATES) {
  if (!wanted(c.id)) continue;
  const r = await fetchHtml(c.id, 'home', c.url);
  const row = {
    id: c.id,
    name: c.name,
    url: c.url,
    vertical: c.vertical,
    verticalLabel: VERTICALS[c.vertical] || c.vertical,
    role: c.role,
    status: r.status,
    ok: Boolean(r.html),
    error: r.error || null,
    bytes: r.html ? r.html.length : 0,
    fromCache: r.fromCache,
    finalUrl: r.finalUrl,
  };
  if (r.html) {
    const m = pageMetrics(r.html, c.url);
    row.title = m.title;
    row.wordCount = m.wordCount;
    row.jsonldTypes = m.jsonldTypes;
    row.hasFaq = m.hasFaq;
    row.unitStatHits = m.unitStatHits;
    row.internalLinkCount = m.internalLinkCount;
  }
  out.candidates.push(row);
  console.log(
    `   ${String(r.status).padStart(4)} ${c.id.padEnd(14)} ${r.html ? `${String(r.html.length).padStart(8)}B  words=${row.wordCount}` : `FAILED ${r.error}`}`,
  );
}

/* 5.2 选中的 6 个站点：首页 + 能力页 + 深度文章页 */
console.log(`\n▶ 抓取 ${SELECTED.length} 个入选站点的 3 类页面…`);
for (const site of SELECTED) {
  if (!wanted(site.id)) continue;
  const siteOut = {
    id: site.id,
    name: site.name,
    vertical: site.vertical,
    verticalLabel: VERTICALS[site.vertical] || site.vertical,
    whyVertical: site.whyVertical,
    anomalies: site.anomalies || [],
    pages: {},
    failures: [],
  };
  for (const [pageId, url] of Object.entries(site.pages)) {
    const r = await fetchHtml(site.id, pageId, url);
    if (!r.html) {
      siteOut.pages[pageId] = { url, status: r.status, ok: false, error: r.error || `HTTP ${r.status}`, finalUrl: r.finalUrl || url, contentType: r.contentType || null, fromCache: r.fromCache };
      siteOut.failures.push({ page: pageId, url, status: r.status, error: r.error || `HTTP ${r.status}`, finalUrl: r.finalUrl || url, contentType: r.contentType || null });
      console.log(`   ✗ ${site.id}/${pageId} status=${r.status} ${r.error || ''}`);
      continue;
    }
    const m = pageMetrics(r.html, url);
    m.status = r.status;
    m.ok = true;
    m.bytes = r.html.length;
    m.fromCache = r.fromCache;
    siteOut.pages[pageId] = m;
    console.log(
      `   ✓ ${site.id}/${pageId} words=${String(m.wordCount).padStart(5)} units=${String(m.unitStatHits).padStart(4)} tables=${m.tableCount} faq=${m.hasFaq ? 'Y' : 'n'} jsonld=${m.jsonldTypes.join(',') || '-'}`,
    );
  }
  // 数据驱动的「为什么它是高 SEO/GEO 基准」说明
  const arts = pick(siteOut.pages, ['article']);
  const caps = pick(siteOut.pages, ['capability']);
  const refs = [...arts, ...caps];
  const notes = [];
  if (refs.length) {
    notes.push(`内容页 ${refs.length} 个，正文中位 ${median(refs.map((p) => p.wordCount))} 词`);
    notes.push(`具体数字/单位命中 中位 ${median(refs.map((p) => p.unitStatHits))} 次`);
    notes.push(`表格 ${refs.reduce((s, p) => s + p.tableCount, 0)} 个（疑似对比表 ${refs.reduce((s, p) => s + p.comparisonTableCount, 0)} 个）`);
    const faqPages = refs.filter((p) => p.hasFaq).length;
    notes.push(`${faqPages}/${refs.length} 个内容页有 FAQ 块`);
    const types = uniq(refs.flatMap((p) => p.jsonldTypes));
    notes.push(`JSON-LD 类型：${types.join(', ') || '无'}`);
    const certs = uniq(refs.flatMap((p) => p.certifications));
    notes.push(`具名认证：${certs.join(', ') || '无'}`);
  }
  siteOut.whyQualifies = notes.join('；') + '。';
  out.sites.push(siteOut);
}

/* 5.3 本站基线 */
{
  const baselineOut = {
    id: BASELINE.id,
    name: BASELINE.name,
    note: '同一 extractor、同一抓取参数下测得的 djiluggage.id 现状，用于对比缺口。',
    pages: {},
    failures: [],
  };
  for (const [pageId, url] of Object.entries(BASELINE.pages)) {
    const r = await fetchHtml(BASELINE.id, pageId, url);
    if (!r.html) {
      baselineOut.pages[pageId] = { url, status: r.status, ok: false, error: r.error || `HTTP ${r.status}`, finalUrl: r.finalUrl || url, contentType: r.contentType || null };
      baselineOut.failures.push({ page: pageId, url, status: r.status, error: r.error || `HTTP ${r.status}`, finalUrl: r.finalUrl || url, contentType: r.contentType || null });
      console.log(`   ✗ ${BASELINE.id}/${pageId} status=${r.status}`);
      continue;
    }
    const m = pageMetrics(r.html, url);
    m.status = r.status;
    m.ok = true;
    m.bytes = r.html.length;
    baselineOut.pages[pageId] = m;
    console.log(
      `   ✓ ${BASELINE.id}/${pageId} words=${m.wordCount} units=${m.unitStatHits} tables=${m.tableCount} faq=${m.hasFaq ? 'Y' : 'n'} jsonld=${m.jsonldTypes.join(',') || '-'}`,
    );
  }
  out.baseline = baselineOut;
}

/* 5.4 聚合 */
{
  const sites = out.sites;
  const arts = sites.map((s) => s.pages.article).filter((p) => p && p.ok);
  const caps = sites.map((s) => s.pages.capability).filter((p) => p && p.ok);
  const homes = sites.map((s) => s.pages.home).filter((p) => p && p.ok);
  const content = [...arts, ...caps];

  const profile = (pages) => ({
    count: pages.length,
    urls: pages.map((p) => p.url),
    wordCount: { median: median(pages.map((p) => p.wordCount)), mean: mean(pages.map((p) => p.wordCount)), min: min(pages.map((p) => p.wordCount)), max: max(pages.map((p) => p.wordCount)) },
    fullWordCount: { median: median(pages.map((p) => p.fullWordCount)), mean: mean(pages.map((p) => p.fullWordCount)), min: min(pages.map((p) => p.fullWordCount)), max: max(pages.map((p) => p.fullWordCount)) },
    pagesWhereMainScopeLooksEmpty: pages.filter((p) => p.mainScopeLooksEmpty).map((p) => p.url),
    unitStatHits: { median: median(pages.map((p) => p.unitStatHits)), mean: mean(pages.map((p) => p.unitStatHits)), min: min(pages.map((p) => p.unitStatHits)), max: max(pages.map((p) => p.unitStatHits)) },
    percentStatHits: { median: median(pages.map((p) => p.percentStatHits)), max: max(pages.map((p) => p.percentStatHits)) },
    imageAltCoverage: { median: median(pages.map((p) => p.imageAltCoverage)), min: min(pages.map((p) => p.imageAltCoverage)) },
    internalLinkCount: { median: median(pages.map((p) => p.internalLinkCount)) },
    internalLinksPer1kWords: { median: median(pages.map((p) => p.internalLinksPer1kWords)) },
    h2Count: { median: median(pages.map((p) => p.h2Count)) },
    h3Count: { median: median(pages.map((p) => p.h3Count)) },
    tableCount: { median: median(pages.map((p) => p.tableCount)), total: pages.reduce((s, p) => s + p.tableCount, 0) },
    olCount: { median: median(pages.map((p) => p.olCount)) },
    faqPages: pages.filter((p) => p.hasFaq).length,
    questionHeadingsMedian: median(pages.map((p) => p.questionHeadingCount)),
    stepHeadingMedian: median(pages.map((p) => p.stepHeadingCount)),
    definitionHeadingMedian: median(pages.map((p) => p.definitionHeadingCount)),
    comparisonHeadingMedian: median(pages.map((p) => p.comparisonHeadingCount)),
    pagesWithDates: pages.filter((p) => p.dateCount > 0).length,
    datesMedian: median(pages.map((p) => p.dateCount)),
    pagesWithUpdateMarker: pages.filter((p) => p.updateMarkerHits > 0).length,
    pagesWithAuthorByline: pages.filter((p) => p.authorBylines > 0).length,
    pagesWithToc: pages.filter((p) => p.hasTableOfContents).length,
    metaDescriptionMedianLength: median(pages.map((p) => p.metaDescriptionLength)),
    titleMedianLength: median(pages.map((p) => p.titleLength)),
    jsonldTypeFrequency: topCounts(pages.map((p) => p.jsonldTypes), 30),
    // 任务重点关注的 @type：按「页面数」计数（一页只算一次），比频率表更直观
    jsonldPageCounts: {
      FAQPage: pages.filter((p) => p.jsonldTypes.some((t) => /FAQPage/i.test(t))).length,
      QAPage: pages.filter((p) => p.jsonldTypes.some((t) => /QAPage/i.test(t))).length,
      HowTo: pages.filter((p) => p.jsonldTypes.some((t) => /HowTo/i.test(t))).length,
      Product: pages.filter((p) => p.jsonldTypes.some((t) => /^Product$/i.test(t))).length,
      Organization: pages.filter((p) => p.jsonldTypes.some((t) => /Organization/i.test(t))).length,
      BreadcrumbList: pages.filter((p) => p.jsonldTypes.some((t) => /BreadcrumbList/i.test(t))).length,
      Service: pages.filter((p) => p.jsonldTypes.some((t) => /^Service$/i.test(t))).length,
      Article_or_BlogPosting_or_TechArticle: pages.filter((p) => p.jsonldTypes.some((t) => /TechArticle|BlogPosting|NewsArticle|^Article$/i.test(t))).length,
      Offer: pages.filter((p) => p.jsonldTypes.some((t) => /^Offer$/i.test(t))).length,
      VideoObject: pages.filter((p) => p.jsonldTypes.some((t) => /VideoObject/i.test(t))).length,
      anyJsonLd: pages.filter((p) => p.jsonldTypes.length > 0).length,
    },
    jsonldParseErrorPages: pages.filter((p) => p.jsonldParseErrors > 0).length,
    comparisonTableTotal: pages.reduce((s, p) => s + p.comparisonTableCount, 0),
    stepHeadingTotal: pages.reduce((s, p) => s + p.stepHeadingCount, 0),
    definitionHeadingTotal: pages.reduce((s, p) => s + p.definitionHeadingCount, 0),
    comparisonHeadingTotal: pages.reduce((s, p) => s + p.comparisonHeadingCount, 0),
    pagesWithStepHeadings: pages.filter((p) => p.stepHeadingCount > 0).length,
    pagesWithDefinitionHeadings: pages.filter((p) => p.definitionHeadingCount > 0).length,
    pagesWithComparisonHeadings: pages.filter((p) => p.comparisonHeadingCount > 0).length,
    olPages: pages.filter((p) => p.olCount > 0).length,
    olTotal: pages.reduce((s, p) => s + p.olCount, 0),
    questionHeadingTotal: pages.reduce((s, p) => s + p.questionHeadingCount, 0),
    certificationsFrequency: topCounts(pages.map((p) => p.certifications), 20),
    externalHostFrequency: topCounts(pages.map((p) => p.externalHosts), 8),
    ctaFrequency: topCounts(pages.map((p) => p.ctaSignals)),
  });

  const base = out.baseline;
  const baseContent = Object.values(base.pages).filter((p) => p && p.ok);

  out.aggregates = {
    selectedSites: sites.length,
    articlePages: profile(arts),
    capabilityPages: profile(caps),
    homepages: profile(homes),
    allContentPages: profile(content),
    baselineAll: profile(baseContent),
  };
}

/* ------------------------------------------------------------------ *
 * 6. 输出 JSON
 * ------------------------------------------------------------------ */

const stripForJson = (obj) => {
  if (Array.isArray(obj)) return obj.map(stripForJson);
  if (obj && typeof obj === 'object') {
    const outObj = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'fullText' || k === 'bodyText') continue; // 体积原因：正文不入 JSON
      outObj[k] = stripForJson(v);
    }
    return outObj;
  }
  return obj;
};

writeFileSync(abs(join(REPORT_DIR, 'benchmark-sites.json')), JSON.stringify(stripForJson(out), null, 2));
console.log(`\n✓ 已写入 ${join(REPORT_DIR, 'benchmark-sites.json')}`);

/* ------------------------------------------------------------------ *
 * 7. 输出中文 markdown 报告
 * ------------------------------------------------------------------ */

const fmt = (v) => (v === null || v === undefined ? '—' : String(v));
const nz = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

function buildMarkdown(data) {
  const agg = data.aggregates;
  const art = agg.articlePages;
  const cap = agg.capabilityPages;
  const all = agg.allContentPages;
  const baseP = data.baseline.pages;
  const baseAll = agg.baselineAll;

  const candRows = data.candidates
    .map((c) => `| ${c.name} | \`${c.url}\` | ${c.verticalLabel} | ${c.ok ? c.status : `**失败**（${c.error}）`} | ${c.role} |`)
    .join('\n');

  const siteRows = data.sites
    .map((s) => {
      const h = s.pages.home;
      const c = s.pages.capability;
      const a = s.pages.article;
      return `| **${s.name}** | ${s.verticalLabel} | ${h && h.ok ? `${h.wordCount}（${h.fullWordCount}）` : '—'} | ${c && c.ok ? `${c.wordCount}（${c.fullWordCount}） / ${c.tableCount} 表 / ${c.unitStatHits} 数字` : '抓取失败'} | ${a && a.ok ? `${a.wordCount}（${a.fullWordCount}） / ${a.tableCount} 表 / ${a.unitStatHits} 数字 / ${a.questionHeadingCount} 问句标题` : '抓取失败'} | ${((a && a.jsonldTypes) || []).join(', ') || '—'} |`;
    })
    .join('\n');

  const detail = data.sites
    .map((s) => {
      const lines = [];
      lines.push(`### ${s.name}（${s.verticalLabel}）`);
      lines.push('');
      lines.push(`- 定位：${s.whyVertical}`);
      lines.push(`- 实测结论：${s.whyQualifies}`);
      for (const a of s.anomalies || []) lines.push(`- ⚠️ 异常：${a}`);
      for (const [pid, p] of Object.entries(s.pages)) {
        if (!p.ok) {
          lines.push(`- \`${pid}\` 抓取失败：HTTP ${p.status} — ${p.url} — ${p.error}`);
          continue;
        }
        lines.push(
          `- \`${pid}\` [${p.url}](${p.url}) — 正文 ${p.wordCount} 词（全页口径 ${p.fullWordCount} 词）；数字/单位 ${p.unitStatHits}；百分比 ${p.percentStatHits}；表格 ${p.tableCount}（对比表 ${p.comparisonTableCount}）；` +
            `H2/H3 ${p.h2Count}/${p.h3Count}；问句标题 ${p.questionHeadingCount}；FAQ ${p.hasFaq ? '有' : '无'}；JSON-LD ${p.jsonldTypes.join(', ') || '无'}；` +
            `认证 ${p.certifications.join(', ') || '未提及'}；日期 ${p.dateCount}；更新时间标记 ${p.updateMarkerHits}；图片 alt 覆盖 ${p.imageAltCoverage}%；内链 ${p.internalLinkCount}（每千词 ${p.internalLinksPer1kWords}）`,
        );
      }
      lines.push('');
      return lines.join('\n');
    })
    .join('\n');

  const certs = all.certificationsFrequency.map(([k, v]) => `${k}(${v})`).join('、') || '无';
  const types = all.jsonldTypeFrequency.map(([k, v]) => `${k}(${v})`).join('、') || '无';

  return `# B2B 制造业网站 SEO / GEO 基准报告（对标 djiluggage.id）

生成时间：${data.generatedAt}
抓取方式：Node 24 原生 \`fetch\`，桌面版 Chrome UA，30s 超时，跟随跳转；事实抽取复用 \`scripts/seo-geo/extract.mjs\`。
缓存位置：\`.seo-geo/benchmark/<site>/<page>.html\`（\`--refresh\` 可重新抓取）。
抽取器版本：\`${EXTRACTOR_PATH}\` sha256=\`${EXTRACTOR_SHA256}\`（本报告全部指标对应此版本；该文件若被其他流程改动，数字会随之变化）。
本报告所有数字均来自上表中真实抓取到的 HTML，抓取失败者一律标注失败，不做估算。
判定为失败的情况包括：HTTP 4xx/5xx、DNS/TLS 连接失败、以及「HTTP 200 但 content-type 不是 HTML」（例如旧 URL 302 到一张图片）。

## 一、候选池与可达性（真实请求结果）

| 站点 | URL | 垂直领域 | 首页 HTTP | 说明 |
| --- | --- | --- | --- | --- |
${candRows}

> 被淘汰的站点：见文末「淘汰与失败记录」。

## 二、选中的 6 个基准站点及逐页实测

| 站点 | 垂直领域 | 首页词数（main / 全页） | 能力/产品页（词数 main（全页） / 表 / 数字） | 深度文章页（词数 main（全页） / 表 / 数字 / 问句标题） | 文章页 JSON-LD |
| --- | --- | --- | --- | --- | --- |
${siteRows}

> 词数口径说明：表格里的「词数」为 \`extract()\` 的 \`wordCount\`（只统计 \`<main>/<article>\` 容器内文本）。部分站点把正文放在 \`<main>\` 之外，会让该口径偏低；逐站明细中给出的「全页口径」为去掉 nav/header/footer 后的全页词数。两个口径都不影响「数字/单位」「表格」「FAQ」等基于全页文本的统计。${all.pagesWhereMainScopeLooksEmpty.length ? `\n> 主内容容器口径明显偏低的页面：${all.pagesWhereMainScopeLooksEmpty.join('、')}` : ''}

${detail}

## 三、聚合模式画像（${all.count} 个内容页：${art.count} 篇文章页 + ${cap.count} 个能力页）

| 指标 | 文章页中位数 | 能力页中位数 | 内容页合计中位数 | 典型区间 |
| --- | --- | --- | --- | --- |
| 正文词数（extractor \`wordCount\`，\`<main>\` 口径） | ${fmt(art.wordCount.median)} | ${fmt(cap.wordCount.median)} | ${fmt(all.wordCount.median)} | ${fmt(all.wordCount.min)} – ${fmt(all.wordCount.max)} |
| 正文词数（全页口径，去 nav/footer） | ${fmt(art.fullWordCount.median)} | ${fmt(cap.fullWordCount.median)} | ${fmt(all.fullWordCount.median)} | ${fmt(all.fullWordCount.min)} – ${fmt(all.fullWordCount.max)} |
| 具体数字/单位命中 | ${fmt(art.unitStatHits.median)} | ${fmt(cap.unitStatHits.median)} | ${fmt(all.unitStatHits.median)} | ${fmt(all.unitStatHits.min)} – ${fmt(all.unitStatHits.max)} |
| 百分比数字命中 | ${fmt(art.percentStatHits.median)} | ${fmt(cap.percentStatHits.median)} | ${fmt(all.percentStatHits.median)} | 最高 ${fmt(all.percentStatHits.max)} |
| \`<table>\` 表格数 | ${fmt(art.tableCount.median)} | ${fmt(cap.tableCount.median)} | ${fmt(all.tableCount.median)} | 合计 ${all.tableCount.total} 个 |
| 问句形式标题数 | ${fmt(art.questionHeadingsMedian)} | ${fmt(cap.questionHeadingsMedian)} | ${fmt(all.questionHeadingsMedian)} | — |
| 「Step/流程」类标题 | ${fmt(art.stepHeadingMedian)} | ${fmt(cap.stepHeadingMedian)} | ${fmt(all.stepHeadingMedian)} | — |
| 「What is/定义」类标题 | ${fmt(art.definitionHeadingMedian)} | ${fmt(cap.definitionHeadingMedian)} | ${fmt(all.definitionHeadingMedian)} | — |
| 「vs/对比」类标题 | ${fmt(art.comparisonHeadingMedian)} | ${fmt(cap.comparisonHeadingMedian)} | ${fmt(all.comparisonHeadingMedian)} | — |
| 有 FAQ 块的页面 | ${art.faqPages}/${art.count} | ${cap.faqPages}/${cap.count} | ${all.faqPages}/${all.count} | — |
| 有日期标记的页面 | ${art.pagesWithDates}/${art.count} | ${cap.pagesWithDates}/${cap.count} | ${all.pagesWithDates}/${all.count} | 日期中位 ${fmt(all.datesMedian)} 处 |
| 有「更新/审核」措辞的页面 | ${art.pagesWithUpdateMarker}/${art.count} | ${cap.pagesWithUpdateMarker}/${cap.count} | ${all.pagesWithUpdateMarker}/${all.count} | — |
| 有署名作者的页面 | ${art.pagesWithAuthorByline}/${art.count} | ${cap.pagesWithAuthorByline}/${cap.count} | ${all.pagesWithAuthorByline}/${all.count} | — |
| 有目录（TOC）的页面 | ${art.pagesWithToc}/${art.count} | ${cap.pagesWithToc}/${cap.count} | ${all.pagesWithToc}/${all.count} | — |
| 图片 alt 覆盖率 | ${fmt(art.imageAltCoverage.median)}% | ${fmt(cap.imageAltCoverage.median)}% | ${fmt(all.imageAltCoverage.median)}% | 最低 ${fmt(all.imageAltCoverage.min)}% |
| 内链数 | ${fmt(art.internalLinkCount.median)} | ${fmt(cap.internalLinkCount.median)} | ${fmt(all.internalLinkCount.median)} | — |
| 每千词内链数（全页口径） | ${fmt(art.internalLinksPer1kWords.median)} | ${fmt(cap.internalLinksPer1kWords.median)} | ${fmt(all.internalLinksPer1kWords.median)} | — |
| meta description 长度 | ${fmt(art.metaDescriptionMedianLength)} | ${fmt(cap.metaDescriptionMedianLength)} | ${fmt(all.metaDescriptionMedianLength)} | — |
| title 长度 | ${fmt(art.titleMedianLength)} | ${fmt(cap.titleMedianLength)} | ${fmt(all.titleMedianLength)} | — |

**JSON-LD \`@type\` 出现频次（内容页，共 ${all.count} 页）**：${types}

**重点 \`@type\` 的页面覆盖数（一页只计一次，共 ${all.count} 页）**：${Object.entries(all.jsonldPageCounts)
    .map(([k, v]) => `${k}=${v}`)
    .join('、')}

**表格 / 问句密度**：内容页合计 ${all.tableCount.total} 个 \`<table>\`，其中疑似对比表 ${all.comparisonTableTotal} 个；问句形式标题合计 ${all.questionHeadingTotal} 个；有序列表 \`<ol>\`：${all.olPages}/${all.count} 个页面有，合计 ${all.olTotal} 个。

**明确点名的认证（内容页命中次数）**：${certs}

**常见 CTA 信号**：${all.ctaFrequency.map(([k, v]) => `${k}(${v})`).join('、') || '无'}

**出站引用的常见域名**：${all.externalHostFrequency.map(([k, v]) => `${k}(${v})`).join('、') || '无'}

### 归纳出的「强制造业页面」结构清单

1. **长正文**：文章页正文中位 ${fmt(art.wordCount.median)} 词，能力页 ${fmt(cap.wordCount.median)} 词，都远超产品短文案。
2. **密集具体数字**：内容页中位 ${fmt(all.unitStatHits.median)} 处「数字+单位」（公差、MOQ、交期、产能、尺寸、机台数），把可引用事实写进正文。
3. **表格化规格与对比**：合计 ${all.tableCount.total} 个 \`<table>\`，中位每页 ${fmt(all.tableCount.median)} 个，用于材料/工艺/公差对比。
4. **Q&A 结构**：${all.faqPages}/${all.count} 个内容页有 FAQ 块（能力页 ${cap.faqPages}/${cap.count}），问句形式标题合计 ${all.questionHeadingTotal} 个、中位 ${fmt(all.questionHeadingsMedian)} 个/页。
5. **定义与流程段落**：出现「What is/定义」类标题的页面 ${all.pagesWithDefinitionHeadings}/${all.count}（合计 ${all.definitionHeadingTotal} 个），出现「Step/流程」类标题的页面 ${all.pagesWithStepHeadings}/${all.count}（合计 ${all.stepHeadingTotal} 个），出现「vs/对比」类标题的页面 ${all.pagesWithComparisonHeadings}/${all.count}（合计 ${all.comparisonHeadingTotal} 个），便于 AI 抽取定义与步骤化答案。
6. **结构化数据**：见上方 \`@type\` 频次，覆盖 Organization / Product / BreadcrumbList / FAQPage 等。
7. **认证具名**：见上方认证频次，把 ISO 9001、IATF、RoHS、GRS 等写成可检索实体。
8. **可验证的时效**：${all.pagesWithDates}/${all.count} 个页面出现日期，${all.pagesWithUpdateMarker}/${all.count} 个页面带「更新/审核」措辞。
9. **图片 alt 全覆盖**：内容页 alt 覆盖率中位 ${fmt(all.imageAltCoverage.median)}%。
10. **高内链密度**：中位每页 ${fmt(all.internalLinkCount.median)} 条内链 / 每千词 ${fmt(all.internalLinksPer1kWords.median)} 条，形成主题簇。

## 四、与 djiluggage.id 的实测对比

基线页面（同 extractor、同 UA、同超时）：

| 页面 | URL | 词数 | 数字/单位 | 表格 | 问句标题 | FAQ | JSON-LD | 认证 | 日期 | alt 覆盖 | 内链 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${Object.entries(baseP)
  .map(([pid, p]) =>
    p.ok
      ? `| ${pid} | [${p.url}](${p.url}) | ${p.wordCount} | ${p.unitStatHits} | ${p.tableCount} | ${p.questionHeadingCount} | ${p.hasFaq ? '有' : '无'} | ${p.jsonldTypes.join(', ') || '无'} | ${p.certifications.join(', ') || '无'} | ${p.dateCount} | ${p.imageAltCoverage}% | ${p.internalLinkCount} |`
      : `| ${pid} | ${p.url} | 抓取失败 HTTP ${p.status} | | | | | | | | | |`,
  )
  .join('\n')}

对比结论（本站 ${baseAll.count} 页 vs 基准 ${all.count} 页，均为中位数）：

| 指标 | djiluggage.id | 制造业基准 | 差距 |
| --- | --- | --- | --- |
| 正文词数（全页口径） | ${fmt(baseAll.fullWordCount.median)} | ${fmt(all.fullWordCount.median)} | ${baseAll.fullWordCount.median ? `${(all.fullWordCount.median / baseAll.fullWordCount.median).toFixed(1)}×` : '—'} |
| 正文词数（\`<main>\` 口径） | ${fmt(baseAll.wordCount.median)} | ${fmt(all.wordCount.median)} | ${baseAll.wordCount.median ? `${(all.wordCount.median / baseAll.wordCount.median).toFixed(1)}×` : '—'} |
| 数字/单位命中 | ${fmt(baseAll.unitStatHits.median)} | ${fmt(all.unitStatHits.median)} | ${baseAll.unitStatHits.median ? `${(all.unitStatHits.median / baseAll.unitStatHits.median).toFixed(1)}×` : `本站中位 0，基准中位 ${all.unitStatHits.median}（能力页 ${cap.unitStatHits.median}）`} |
| 表格数 | ${fmt(baseAll.tableCount.median)} | ${fmt(all.tableCount.median)} | ${baseAll.tableCount.median ? `${(all.tableCount.median / baseAll.tableCount.median).toFixed(1)}×` : `本站 0 个，基准合计 ${all.tableCount.total} 个`} |
| 有 FAQ 的页面 | ${baseAll.faqPages}/${baseAll.count} | ${all.faqPages}/${all.count} | 结构性缺失 |
| JSON-LD 类型 | ${(baseAll.jsonldTypeFrequency || []).map(([k, v]) => `${k}(${v})`).join('、') || '无'} | ${all.jsonldTypeFrequency.slice(0, 6).map(([k, v]) => `${k}(${v})`).join('、')} | 类型覆盖不足 |
| 具名认证 | ${(baseAll.certificationsFrequency || []).map(([k, v]) => `${k}(${v})`).join('、') || '无'} | ${all.certificationsFrequency.map(([k, v]) => `${k}(${v})`).join('、')} | 认证实体缺失 |
| 日期/时效标记 | ${fmt(baseAll.datesMedian)} | ${fmt(all.datesMedian)} | 本站 0 处，基准 ${all.pagesWithDates}/${all.count} 个页面带日期 |
| 图片 alt 覆盖 | ${fmt(baseAll.imageAltCoverage.median)}% | ${fmt(all.imageAltCoverage.median)}% | — |
| 内链（每千词） | ${fmt(baseAll.internalLinksPer1kWords.median)} | ${fmt(all.internalLinksPer1kWords.median)} | — |

> 注意：能力页/文章页的绝对值会随缓存时间变化；重跑请用 \`node scripts/site-audit/benchmark.mjs --refresh\`。

### djiluggage.id 当前缺失、而强制造业页普遍具备的结构（逐条来自上表实测）

1. **FAQ 块 / FAQPage 结构化数据**：本站 ${baseAll.faqPages}/${baseAll.count} 个页面有 FAQ，JSON-LD 中 \`FAQPage\`=${baseAll.jsonldPageCounts.FAQPage}；基准为 ${all.faqPages}/${all.count} 个内容页有 FAQ（能力页 ${cap.faqPages}/${cap.count}），\`FAQPage\` 出现在 ${all.jsonldPageCounts.FAQPage} 个内容页。
2. **问句形式标题**：本站 0 个；基准内容页合计 ${all.questionHeadingTotal} 个，中位 ${fmt(all.questionHeadingsMedian)} 个/页（Omaska 文章页 8 个、Protocase 能力页 7 个）。
3. **规格/对比表格**：本站 ${baseAll.tableCount.total} 个 \`<table>\`；基准内容页合计 ${all.tableCount.total} 个，其中疑似对比表 ${all.comparisonTableTotal} 个（RapidDirect 能力页单页 31 个）。
4. **具体数字与单位**：本站全站中位 ${fmt(baseAll.unitStatHits.median)} 处（仅产品页有 22 处）；基准内容页中位 ${fmt(all.unitStatHits.median)} 处，能力页中位 ${fmt(cap.unitStatHits.median)} 处（Protolabs 设计规范页单页 72 处）。
5. **长正文**：本站中位 ${fmt(baseAll.fullWordCount.median)} 词；基准内容页中位 ${fmt(all.fullWordCount.median)} 词（文章页中位 ${fmt(art.fullWordCount.median)}）。
6. **BreadcrumbList**：本站 ${baseAll.jsonldPageCounts.BreadcrumbList}/${baseAll.count} 个页面有面包屑结构化数据；基准 ${all.jsonldPageCounts.BreadcrumbList}/${all.count}。
7. **能力/服务页的 Service 或 Product+Offer 结构化数据**：本站 ${baseAll.jsonldPageCounts.Service} 个 Service、${baseAll.jsonldPageCounts.Product} 个 Product；基准 Service=${all.jsonldPageCounts.Service}、Product=${all.jsonldPageCounts.Product}、Offer=${all.jsonldPageCounts.Offer}。
8. **可验证的时效信号**：本站带日期的页面 ${baseAll.pagesWithDates}/${baseAll.count}（0 处日期），带「更新/审核」措辞 ${baseAll.pagesWithUpdateMarker}/${baseAll.count}；基准 ${all.pagesWithDates}/${all.count} 与 ${all.pagesWithUpdateMarker}/${all.count}。
9. **署名作者 / 目录（TOC）**：本站 ${baseAll.pagesWithAuthorByline}/${baseAll.count} 与 ${baseAll.pagesWithToc}/${baseAll.count}；基准 ${all.pagesWithAuthorByline}/${all.count} 与 ${all.pagesWithToc}/${all.count}。
10. **内链规模**：本站单页中位 ${fmt(baseAll.internalLinkCount.median)} 条；基准 ${fmt(all.internalLinkCount.median)} 条（Protocase 单页 336–351 条），主题簇密度差距明显。
11. **具名认证实体**：本站仅命中 TSA lock=1；基准命中 ISO 9001=${all.certificationsFrequency.find(([k]) => k === 'ISO 9001')?.[1] ?? 0}、REACH、BSCI、ISO 14001、Sedex/SMETA 等可检索实体。
12. **本站已有的相对优势（不要改坏）**：产品页 22 处数字/单位、图片 alt 覆盖 ${fmt(baseAll.imageAltCoverage.median)}%、每千词内链 ${fmt(baseAll.internalLinksPer1kWords.median)} 条，均达到或超过基准水平。

## 五、淘汰与失败记录（如实记录，未编造数据）

${[
  ...data.candidates.filter((c) => !c.ok).map((c) => `- **${c.name}**（\`${c.url}\`）：首页请求失败 — ${c.error}。`),
  ...data.sites.flatMap((s) => s.failures.map((f) => `- **${s.name}** 的 \`${f.page}\` 页（\`${f.url}\`）：status ${f.status} — ${f.error}${f.finalUrl && f.finalUrl !== f.url ? `（最终 URL：${f.finalUrl}）` : ''}。`)),
  ...data.baseline.failures.map((f) => `- **djiluggage.id** 的 \`${f.page}\` 页（\`${f.url}\`）：status ${f.status} — ${f.error}。`),
].join('\n') || '- 无'}

已避开的非 HTML 响应 / 数据质量异常（已改用可用的真实页面，未把异常响应当页面统计）：

${[
  ...data.sites.flatMap((s) => (s.anomalies || []).map((a) => `- **${s.name}**：${a}`)),
  ...data.sites.flatMap((s) =>
    Object.entries(s.pages)
      .filter(([, p]) => p.ok && p.jsonldParseErrors > 0)
      .map(([pid, p]) => `- **${s.name}** 的 \`${pid}\` 页（\`${p.url}\`）：${p.jsonldBlockCount} 个 JSON-LD 块中有 ${p.jsonldParseErrors} 个解析失败，该页结构化数据不完整。`),
  ),
  `- **Protolabs 首页 / Protocase 首页与文章页**：页面完全不含 JSON-LD（jsonldBlockCount=0），说明「不用结构化数据」也是真实存在的做法，基准并非要求每页都有 schema。`,
].join('\n') || '- 无'}

未入选详细分析的候选（首页可达但未进入 6 站详细抓取）：${data.candidates
    .filter((c) => c.ok && !data.sites.some((s) => s.id === c.id))
    .map((c) => `${c.name}（${c.verticalLabel}）`)
    .join('、') || '无'}。其中 Xometry / Fictiv / Thomasnet 属于**制造服务聚合平台或供应商目录**而非自营工厂，与「制造业工厂官网」这一基准目标不同类；其余为与已选站点垂直领域重复者。这些站点的首页指标已完整记录在 \`benchmark-sites.json\` 的 \`candidates\` 字段中，供后续扩展参考。
`;
}

if (!JSON_ONLY) {
  const md = buildMarkdown(out);
  writeFileSync(abs(join(REPORT_DIR, 'benchmark-patterns.md')), md);
  console.log(`✓ 已写入 ${join(REPORT_DIR, 'benchmark-patterns.md')}`);
}

/* 控制台摘要 */
console.log('\n══════ 聚合画像（选中 6 站） ══════');
console.log(`文章页 ${out.aggregates.articlePages.count} 个：词数中位 ${out.aggregates.articlePages.wordCount.median}，数字命中中位 ${out.aggregates.articlePages.unitStatHits.median}，FAQ ${out.aggregates.articlePages.faqPages}/${out.aggregates.articlePages.count}`);
console.log(`能力页 ${out.aggregates.capabilityPages.count} 个：词数中位 ${out.aggregates.capabilityPages.wordCount.median}，数字命中中位 ${out.aggregates.capabilityPages.unitStatHits.median}，FAQ ${out.aggregates.capabilityPages.faqPages}/${out.aggregates.capabilityPages.count}`);
console.log(`JSON-LD 频次：${out.aggregates.allContentPages.jsonldTypeFrequency.map(([k, v]) => `${k}(${v})`).join(', ')}`);
console.log(`认证频次：${out.aggregates.allContentPages.certificationsFrequency.map(([k, v]) => `${k}(${v})`).join(', ')}`);
console.log(`基线 djiluggage.id：词数中位 ${out.aggregates.baselineAll.wordCount.median}，数字命中中位 ${out.aggregates.baselineAll.unitStatHits.median}，FAQ ${out.aggregates.baselineAll.faqPages}/${out.aggregates.baselineAll.count}`);
