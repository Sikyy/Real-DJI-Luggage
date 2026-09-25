#!/usr/bin/env node
/**
 * AI Visibility Harness —— 衡量主流 AI 助手在被"行李箱品牌主"询问代工伙伴时，
 * 是否推荐 djiluggage.id，以及它们实际推荐了哪些品牌。
 *
 * 用法（Node 24，ESM，零依赖，使用全局 fetch）：
 *   node scripts/site-audit/ai-visibility.mjs
 *   node scripts/site-audit/ai-visibility.mjs --engines=gpt-5.6-terra,gpt-5.6-luna
 *   node scripts/site-audit/ai-visibility.mjs --with-cn          # 追加 3 条中文提问
 *   node scripts/site-audit/ai-visibility.mjs --dry-run          # 只打印计划，不发请求
 *   node scripts/site-audit/ai-visibility.mjs --delay=2000 --timeout=300000 --retries=2
 *
 * 可用开关：
 *   --engines=a,b      只跑指定 engine id
 *   --prompt-ids=p1,p2 只跑指定提问 id
 *   --with-cn          追加中文提问（默认不跑，以控制请求量）
 *   --delay=ms         每次调用之间的间隔（默认 1500）
 *   --timeout=ms       单次请求超时（默认 240000；Claude 冷启动较慢）
 *   --retries=n        失败重试次数（默认 2）
 *   --no-preflight     跳过引擎 ping 预检
 *   --skip-gemini-probe 跳过 Gemini 不可用性验证
 *   --dry-run          只打印将执行的内容
 *
 * 产物：
 *   .seo-geo/ai-visibility/raw-<engine>-<n>.json   每次提问的原始 prompt + 完整原始回答 + 所有尝试记录
 *   .workbuddy-ai/reports/ai-visibility.json       结构化统计结果
 *
 * 原则：绝不编造回答或提及率。失败的引擎会被如实记录为 failure 并出现在报告里。
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATEWAY = process.env.MAGPIE_URL || 'http://127.0.0.1:3425';
const RAW_DIR = '.seo-geo/ai-visibility';
const REPORT_FILE = '.workbuddy-ai/reports/ai-visibility.json';

const abs = (p) => join(ROOT, p);

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
/** 同时支持 `--flag=value` 与 `--flag value` 两种写法。 */
const flagValue = (f, dflt = null) => {
  const inline = argv.find((a) => a.startsWith(`${f}=`));
  if (inline) return inline.slice(f.length + 1) || dflt;
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const num = (v, dflt) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

const OPT = {
  engines: (flagValue('--engines') || '').split(',').map((s) => s.trim()).filter(Boolean),
  promptIds: (flagValue('--prompt-ids') || '').split(',').map((s) => s.trim()).filter(Boolean),
  withCn: hasFlag('--with-cn'),
  delayMs: num(flagValue('--delay', '1500'), 1500),
  timeoutMs: num(flagValue('--timeout', '240000'), 240000),
  retries: num(flagValue('--retries', '2'), 2),
  preflight: !hasFlag('--no-preflight'),
  geminiProbe: !hasFlag('--skip-gemini-probe'),
  dryRun: hasFlag('--dry-run'),
  reanalyze: hasFlag('--reanalyze'),
  probeEngines: hasFlag('--probe-engines'),
};

/* ------------------------------------------------------------------ *
 * 提问集（刻意中性：绝不在提问里出现 djiluggage.id 或任何品牌名，
 * 否则测的就不是"自然推荐"而是"指名检索"）
 * ------------------------------------------------------------------ */
const PROMPTS = [
  {
    id: 'p1',
    angle: 'a) 铝框定制代工（英文）',
    lang: 'en',
    text: 'Who can manufacture custom aluminum-frame suitcases for my new luggage brand?',
  },
  {
    id: 'p2',
    angle: 'b) 东南亚/印尼 OEM 工厂（英文）',
    lang: 'en',
    text: 'Find me an OEM luggage factory in Southeast Asia or Indonesia.',
  },
  {
    id: 'p3',
    angle: 'c) 私标硬壳代工厂（英文）',
    lang: 'en',
    text: 'I need a private-label hard-shell luggage manufacturer, who should I contact?',
  },
  {
    id: 'p4',
    angle: 'd) 亚洲代工厂横向比较（英文）',
    lang: 'en',
    text: 'Compare custom luggage manufacturers in Asia for a startup brand.',
  },
  {
    id: 'p5',
    angle: 'e) 小批量铝框登机箱（英文）',
    lang: 'en',
    text: 'What is the best luggage factory for small-batch aluminum carry-on production?',
  },
  {
    id: 'c1',
    angle: 'a-cn) 铝框代工工厂推荐（中文）',
    lang: 'zh',
    text: '我想做一个新的行李箱品牌，需要找能代工铝框行李箱的工厂，有哪些工厂可以推荐？',
  },
  {
    id: 'c2',
    angle: 'b-cn) 东南亚/印尼 OEM 工厂（中文）',
    lang: 'zh',
    text: '东南亚或者印尼有哪些可以做 OEM 行李箱代工的工厂？',
  },
  {
    id: 'c3',
    angle: 'e-cn) 小批量铝框登机箱（中文）',
    lang: 'zh',
    text: '小批量生产铝框登机箱，找哪家工厂比较合适？',
  },
];

/* ------------------------------------------------------------------ *
 * 引擎配置
 * ------------------------------------------------------------------ */
const ENGINES = [
  {
    id: 'gpt-5.6-terra',
    model: 'codex/gpt-5.6-terra',
    label: 'GPT-5.6 Terra (codex)',
    role: 'primary',
  },
  {
    id: 'gpt-5.6-luna',
    model: 'codex/gpt-5.6-luna',
    label: 'GPT-5.6 Luna (codex)',
    role: 'primary',
  },
  {
    id: 'claude-sonnet-4-5',
    model: 'claude/claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5 (claude)',
    role: 'optional-extra',
  },
  // Gemini 于 2026-09-25 10:47 起在网关可用（模型命名空间为 google/models/*）。
  // gemini-3.5-flash 实测可调用；pro 偶发 429，失败会被如实记录而不是丢弃。
  {
    id: 'gemini-3.5-flash',
    model: 'google/models/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash (google)',
    role: 'primary',
  },
  {
    id: 'gemini-3.1-pro-preview',
    model: 'google/models/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview (google)',
    role: 'primary',
  },
];

/** 明确不被期望可用、但要留下证据的引擎（Gemini 未在该网关注册）。 */
const UNAVAILABLE_PROBES = [
  // 历史记录：2026-09-25 10:47 之前，Gemini 未注册在该网关，以下 ID 全部 404。
  // 现在正确的命名空间是 google/models/*，保留这些探测用于记录变更、避免误判。
  { id: 'legacy-gemini-prefix', model: 'gemini/gemini-2.5-pro', endpoint: '/v1/chat/completions', body: { model: 'gemini/gemini-2.5-pro', messages: [{ role: 'user', content: 'ping' }] } },
  { id: 'gemini-native-bare-id', model: 'gemini-2.5-pro', endpoint: '/v1beta/models/gemini-2.5-pro:generateContent', body: { contents: [{ parts: [{ text: 'ping' }] }] } },
  { id: 'gemini-now-available', model: 'google/models/gemini-3.5-flash', endpoint: '/v1/chat/completions', body: { model: 'google/models/gemini-3.5-flash', messages: [{ role: 'user', content: 'ping' }] } },
];

/* ------------------------------------------------------------------ *
 * 品牌识别规则（全部显式、可审计）
 * ------------------------------------------------------------------ */
const TARGET = {
  name: 'djiluggage.id',
  /** 严格别名：bare "DJI" 一律不计（会与大疆误命中），必须带 luggage。 */
  aliases: [
    { alias: 'djiluggage', re: /\bdjiluggage\b/gi },
    { alias: 'djiluggage.id', re: /\bdjiluggage\.id\b/gi },
    { alias: 'DJI Luggage', re: /\bdji[\s-]+lugg?age\b/gi },
    { alias: 'DJI Luggage (连写)', re: /\bdjiluggage\b/gi },
  ],
  note: 'bare "DJI" 不计入（无人机品牌误命中风险）。',
};

const COMPETITORS = [
  { name: 'OMASKA', confidence: 'high', re: [/\bomaska\b/gi, /\bomaska\.com\b/gi] },
  { name: 'Hùng Phát / Hung Phat', confidence: 'high', re: [/hùng\s*phát/gi, /\bhung\s*phat\b/gi, /\bhungphat[-.]?jsc\b/gi] },
  { name: 'Greatchip / HT Luggage', confidence: 'high', re: [/\bgreatchip\b/gi, /\bht[\s-]*luggage\b/gi, /\bhtluggage\b/gi] },
  { name: 'Roaming Luggage', confidence: 'high', re: [/\broaming[\s-]*luggage\b/gi, /\broamingluggage\b/gi] },
  { name: 'Rimowa', confidence: 'high', re: [/\brimowa\b/gi] },
  { name: 'Level8', confidence: 'high', re: [/\blevel\s?8\b/gi] },
  { name: 'Monos', confidence: 'high', re: [/\bmonos\b/gi] },
  { name: 'Arlo Skye', confidence: 'high', re: [/\barlo\s*skye\b/gi] },
  { name: 'Travelpro', confidence: 'high', re: [/\btravelpro\b/gi] },
  { name: 'Away', confidence: 'ambiguous', ambiguousWhy: '常见英文单词，需上下文（行李/品牌语境）确认', re: [/\bAway\b/g] },
  { name: 'July', confidence: 'ambiguous', ambiguousWhy: '常见英文单词/月份，需上下文确认', re: [/\bJuly\b/g] },
];

const AMBIGUOUS_CONTEXT = /\b(luggage|suitcase|carry-?on|hardshell|hard-shell|brand|brands|maker|manufacturer|competitor|competitors|similar to|like|vs\.?|Team|Founded)\b/i;

/** 判断一段文本是否处于"供应商/品类"语境（用于粗体名、标题名的置信度过滤）。 */
const SUPPLIER_CONTEXT = /(luggage|suitcase|carry-?on|hardshell|hard-shell|manufactur|factor(?:y|ies)|OEM|ODM|private[-\s]?label|supplier|brand|bags?\b|travel goods|China|Vietnam|Indonesia|Thailand|India|Taiwan|Korea|Japan|Canada|Germany|Malaysia|Philippines|Singapore)/i;

/** 标题/粗体里常见的非品牌句型词，出现即丢弃。 */
const HEADING_STOP = new Set([
  'what', 'where', 'when', 'how', 'why', 'which', 'who', 'find', 'include', 'contact', 'ask',
  'verify', 'use', 'choose', 'compare', 'avoid', 'next', 'steps', 'summary', 'overview', 'key',
  'tips', 'checklist', 'red', 'flags', 'before', 'you', 'your', 'location', 'website', 'business',
  'products', 'website:', 'type', 'best', 'for', 'the', 'potential', 'additional', 'other', 'sample',
  'subject', 'typical', 'rough', 'where', 'how', 'questions', 'question', 'note', 'notes',
]);

/** 平台 / 参考站点：识别为域名但不当作"被推荐的供应商品牌"。 */
const NON_BRAND_DOMAINS = new Set([
  'google.com', 'youtube.com', 'wikipedia.org', 'linkedin.com', 'reddit.com', 'facebook.com',
  'instagram.com', 'x.com', 'twitter.com', 'medium.com', 'gmail.com', 'outlook.com', 'shopify.com',
  'alibaba.com', 'aliexpress.com', 'made-in-china.com', 'globalsources.com', 'dhgate.com',
  'indiamart.com', 'tradeindia.com', 'ec21.com', 'eworldtrade.com', 'thomasnet.com', 'importyeti.com',
  'panjiva.com', 'upwork.com', 'fiverr.com', 'taobao.com', '1688.com', 'amazon.com', 'iso.org',
  'tuv.com', 'bsigroup.com', 'sedex.com', 'openai.com', 'anthropic.com', 'claude.ai', 'chatgpt.com',
]);

/** 抽取"额外品牌"时要过滤的通用词/地名/自述词。 */
const GENERIC_TOKENS = new Set([
  'manufacturers', 'manufacturer', 'factories', 'factory', 'suppliers', 'supplier', 'companies',
  'company', 'brands', 'brand', 'makers', 'maker', 'producers', 'producer', 'vendors', 'vendor',
  'oem', 'odm', 'private label', 'private-label', 'china', 'vietnam', 'viet nam', 'indonesia',
  'thailand', 'india', 'taiwan', 'hong kong', 'south korea', 'japan', 'malaysia', 'philippines',
  'southeast asia', 'asia', 'europe', 'usa', 'united states', 'germany', 'canada', 'singapore',
  'alibaba', 'made-in-china', 'amazon', 'google', 'the', 'i', 'you', 'your', 'we', 'they', 'this',
  'that', 'these', 'those', 'there', 'however', 'additionally', 'first', 'second', 'third', 'finally',
  'note', 'important', 'budget', 'moq', 'quality', 'sample', 'samples', 'shipping', 'logistics',
  'sourcing', 'trade', 'export', 'import', 'design', 'prototype', 'prototyping', 'tooling', 'molds',
  'moulds', 'certification', 'compliance', 'iso', 'iso 9001', 'bsci', 'sedex', 'walmart', 'costco',
  'target', 'etc', 'and', 'or', 'tier 1', 'tier 2', 'tier', 'asia-based', 'china-based',
  'vietnam-based', 'indonesia-based', 'european', 'american', 'western', 'professional', 'custom',
  'premium', 'luxury', 'high-end', 'mid-range', 'established', 'reputable', 'experienced', 'local',
  'large', 'small', 'many', 'most', 'some', 'several', 'other', 'others', 'recommended',
  'top', 'best', 'leading', 'major', 'key', 'main', 'new', 'next', 'same', 'such', 'including',
  'tier-1', 'tier-2', 'direct', 'online', 'global', 'international',
  // 平台 / 展会 / 认证 / 材料 / 贸易术语：不是"被推荐的供应商品牌"
  'globalsources', 'global sources', 'made-in-china', 'alibaba', 'aliexpress', 'canton fair',
  'dhgate', 'indiamart', 'thomasnet', 'importyeti', 'panjiva', 'eworldtrade', 'tradeindia',
  'ec21', 'amazon', 'shopify', 'bsci', 'smeta', 'sedex', 'iso 9001', 'iso9001', 'reach',
  'oeko-tex', 'gots', 'wrap', 'icti', 'sa8000', 'tsa', 'fob', 'cif', 'exw', 'lcl', 'fcl',
  'moq', 'rfq', 'po', 'pi', 'tt', 'lc', 'pc', 'abs', 'pp', 'pu', 'eva', 'pe', 'pa', 'tpu',
  'usb', 'usd', 'eur', 'cny', 'idr', 'vnd', 'ce', 'fda', 'astm', 'qc', 'qa', 'b2b', 'b2c',
  'grs', 'rcs', 'proposition 65', 'california proposition 65', 'iso 14001', 'iso 45001',
]);

/** 目录站 / 行业协会 / 展会 / 验货机构：会在回答里出现，但不是"被推荐的代工品牌"。 */
const NON_SUPPLIER_NAMES = new Set([
  '1688', 'inaexport', 'indotrading', 'yellow pages', 'thailand yellow pages', 'vietnam yellow pages',
  'trade promotion agency', 'leather goods association', 'external trade development corporation',
  'kadin indonesia', 'kadin', 'thai trade', 'global sources', 'made-in-china', 'alibaba',
  'canton fair', 'sgs', 'qima', 'intertek', 'tuv', 'tüv', 'bureau veritas', 'eurofins',
  'ul', 'asi', 'elevate', 'omega compliance', 'thomasnet', 'importyeti',
]);

/** 产业带 / 城市 / 省份：常以 "Name (Country)" 形式出现，但不是品牌。 */
const GEO_NOISE = new Set([
  'bangpoo', 'samut prakan', 'laem chabang', 'chonburi', 'rayong', 'huadu', 'shunde',
  'ningbo', 'shanghai', 'beijing', 'hangzhou', 'wenzhou', 'taizhou', 'quanzhou', 'jiangsu',
  'fujian', 'guangdong', 'chennai', 'mumbai', 'noida', 'gurgaon', 'taipei', 'taichung',
  'kaohsiung', 'tangerang', 'bekasi', 'cikarang', 'karawang', 'semarang', 'surabaya',
  'hai phong', 'da nang', 'can tho', 'binh duong', 'dong nai', 'long an', 'penang',
  'selangor', 'johor', 'klang',
]);

const COUNTRY_RE = String.raw`(?:China|Vietnam|Viet Nam|Indonesia|Thailand|India|Taiwan|Hong Kong|South Korea|Japan|Malaysia|Philippines|Singapore|Germany|Canada|United States|USA|Europe|Southeast Asia|Shenzhen|Guangzhou|Zhejiang|Dongguan|Xiamen|Foshan|Yiwu|Ho Chi Minh City|Hanoi|Jakarta|Bandung|Surabaya)`;

/** 行级"供应商语境"：该行必须提到国家/地区或代工/制造语义，才承认这是一个供应商名称候选。 */
const LINE_SUPPLIER_CONTEXT = new RegExp(
  String.raw`(?:${COUNTRY_RE}|OEM|ODM|manufactur\w*|factor(?:y|ies)|supplier|private[-\s]?label|maker|producer|vendor|contract\s+manufactur\w*)`,
  'i',
);

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flatten = (t) => String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');

function snippet(text, index, before = 90, after = 120) {
  const s = Math.max(0, index - before);
  const e = Math.min(text.length, index + after);
  return (s > 0 ? '…' : '') + flatten(text.slice(s, e)).trim() + (e < text.length ? '…' : '');
}

function allMatches(text, re) {
  const out = [];
  for (const r of re) {
    const rx = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g');
    let m;
    while ((m = rx.exec(text)) !== null) {
      out.push({ index: m.index, match: m[0] });
      if (m.index === rx.lastIndex) rx.lastIndex += 1;
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/* ------------------------------------------------------------------ *
 * 回答分析
 * ------------------------------------------------------------------ */
function analyzeAnswer(rawText) {
  const text = flatten(rawText);

  /* --- 目标品牌 --- */
  const targetHits = [];
  for (const a of TARGET.aliases) {
    for (const m of allMatches(text, [a.re])) {
      targetHits.push({ alias: a.alias, index: m.index, match: m.match });
    }
  }
  targetHits.sort((a, b) => a.index - b.index);
  const target = {
    mentioned: targetHits.length > 0,
    count: targetHits.length,
    firstIndex: targetHits.length ? targetHits[0].index : -1,
    matchedAlias: targetHits.length ? targetHits[0].alias : null,
    snippet: targetHits.length ? snippet(text, targetHits[0].index) : null,
  };

  /* --- known 竞品 --- */
  const competitors = [];
  const ambiguous = [];
  for (const c of COMPETITORS) {
    const hits = allMatches(text, c.re);
    if (!hits.length) continue;
    if (c.confidence === 'ambiguous') {
      const ctxOk = hits.filter((h) => AMBIGUOUS_CONTEXT.test(snippet(text, h.index, 120, 120)));
      ambiguous.push({
        name: c.name,
        why: c.ambiguousWhy,
        rawCount: hits.length,
        contextConfirmedCount: ctxOk.length,
        contextConfirmed: ctxOk.length > 0,
        snippets: (ctxOk.length ? ctxOk : hits).slice(0, 3).map((h) => snippet(text, h.index)),
      });
      if (ctxOk.length) {
        competitors.push({
          name: c.name,
          confidence: 'ambiguous-context-confirmed',
          count: ctxOk.length,
          firstIndex: ctxOk[0].index,
          snippet: snippet(text, ctxOk[0].index),
        });
      }
    } else {
      competitors.push({
        name: c.name,
        confidence: 'high',
        count: hits.length,
        firstIndex: hits[0].index,
        snippet: snippet(text, hits[0].index),
      });
    }
  }
  competitors.sort((a, b) => a.firstIndex - b.firstIndex);

  /* --- 额外品牌抽取（启发式，带证据） --- */
  const candidates = new Map(); // key -> {name, sources:Set, count, firstIndex, snippet}
  const COMPANY_KEYWORD = /(Luggage|Bags?|Cases?|Suitcase|Group|Corp\w*|Ltd\.?|Limited|Co\.|Industr\w*|Manufactur\w*|Factor\w*|Holdings?|Enterprise|Trading|International)/i;
  /** 所有词都必须以大写字母/数字开头（Title Case 专有名词），否则丢弃。允许 Co., / Ltd. 之类内部标点。 */
  const isProperName = (s) =>
    s.split(/\s+/).every((w) => w === '&' || /^[A-Z0-9][\w&.'’,-]*$/.test(w)) && /^[A-Z0-9]/.test(s);
  /** 行业协会 / 贸易促进机构 / 目录站：是"去哪儿找"的线索，不是被推荐的代工厂。 */
  const isOrganizationNotSupplier = (s) =>
    /(Trade Promotion|Development Corporation|Association|Chamber of Commerce|Yellow Pages|Inaexport|Indotrading|Kadin)/i.test(s) ||
    s.split(/\s+/).some((w) => NON_SUPPLIER_NAMES.has(w.toLowerCase().replace(/[.,]$/, '')));
  /** 纯地名/产业带（如 "Bangpoo Industrial", "Huadu"）不算品牌。 */
  const isGeoOnly = (s) =>
    new RegExp(`^(?:${COUNTRY_RE})(?:\\s+(?:Industrial|Estate|Park|District|Province|City|Zone|Region|Area))*$`, 'i').test(s) ||
    /^(?:[A-Z][a-z]+\s+){0,2}(?:Industrial|Estate|Park|Zone)$/i.test(s) ||
    GEO_NOISE.has(s.toLowerCase()) ||
    // 含逗号但没有公司后缀 → 基本是"城市, 省份"式地名
    (s.includes(',') && !COMPANY_KEYWORD.test(s));
  /** 以产品品类名词开头、又没有品牌感的片段（如 "Bags Co., Ltd"）丢弃。 */
  const isGenericFragment = (s) => /^(?:Bags?|Cases?|Luggage|Suitcases?|Boxes|Trolleys?)\b/i.test(s);
  const hasCompanyKeyword = (s) => COMPANY_KEYWORD.test(s);
  /** 名称所在行（含下一行）是否具备"供应商语境"。 */
  const lineContext = (index, len) => {
    const start = text.lastIndexOf('\n', index) + 1;
    const endIdx = text.indexOf('\n', index + len);
    const line = text.slice(start, endIdx === -1 ? text.length : endIdx);
    const next = endIdx === -1 ? '' : text.slice(endIdx + 1, endIdx + 200);
    return LINE_SUPPLIER_CONTEXT.test(line) || LINE_SUPPLIER_CONTEXT.test(next);
  };

  const addCandidate = (name, source, index, { requireCompanySignal = false, requireLineContext = false } = {}) => {
    let clean = String(name || '')
      .replace(/[*_`#>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-–—•·,;:()"']+/, '')
      .replace(/[\s\-–—•·,;:.!?"')]+$/, '')
      .trim();
    if (!clean) return;
    clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!clean || clean.length < 2 || clean.length > 60) return;
    const words = clean.split(' ');
    if (words.length > 5) return;
    const lower = clean.toLowerCase();
    if (GENERIC_TOKENS.has(lower)) return;
    if (NON_SUPPLIER_NAMES.has(lower)) return;
    if (words.every((w) => GENERIC_TOKENS.has(w.toLowerCase().replace(/[.,]$/, '')))) return;
    if (!isProperName(clean)) return;
    if (isGeoOnly(clean)) return;
    if (isGenericFragment(clean)) return;
    if (isOrganizationNotSupplier(clean)) return;
    if (requireCompanySignal && !hasCompanyKeyword(clean)) return;
    if (requireLineContext && !lineContext(index, String(name || '').length)) return;
    if (words.some((w) => HEADING_STOP.has(w.toLowerCase().replace(/[:：.,]+$/, '')))) return;
    if (/[:：]$/.test(clean)) return;
    // 排除已知品牌（它们单独统计）
    if (/djiluggage/i.test(clean)) return;
    if (COMPETITORS.some((c) => c.re.some((r) => new RegExp(r.source, 'i').test(clean)))) return;
    if (new RegExp(`^(?:${COUNTRY_RE})$`, 'i').test(clean)) return;
    const key = lower;
    if (!candidates.has(key)) {
      candidates.set(key, { name: clean, sources: new Set(), count: 0, firstIndex: index, snippet: snippet(text, index) });
    }
    const rec = candidates.get(key);
    rec.sources.add(source);
    rec.count += 1;
    rec.firstIndex = Math.min(rec.firstIndex, index);
  };

  // 1) markdown 链接标签：最高置信度
  for (const m of text.matchAll(/\[([^\]\n]{2,80})\]\((https?:\/\/[^)\s]+)\)/g)) {
    addCandidate(m[1], 'markdown-link-label', m.index);
  }
  // 1b) markdown 粗体名称：仅当位于行首/列表/表格，或名称本身含公司后缀词时才计入
  for (const m of text.matchAll(/\*\*([^*\n]{2,60})\*\*/g)) {
    const raw = m[1].trim();
    if (!raw || raw.includes(':') || raw.includes('：')) continue;
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const prefix = text.slice(lineStart, m.index);
    const atLineStart = /^[ \t>*+|\d.)-]*$/.test(prefix);
    if (!atLineStart && !hasCompanyKeyword(raw)) continue;
    const win = text.slice(Math.max(0, m.index - 170), Math.min(text.length, m.index + m[0].length + 170));
    if (!SUPPLIER_CONTEXT.test(win)) continue;
    addCandidate(raw, 'bold-span', m.index, { requireLineContext: true });
  }
  // 1c) 标题（### PT Sunindo Adipersada — Indonesia）
  for (const m of text.matchAll(/^#{2,4}\s+([^\n]{2,60})$/gm)) {
    // "名称 — 国家" 形式的标题是典型的供应商卡片，允许没有公司后缀词
    const hasCountryTail = new RegExp(String.raw`[—–-]\s*(?:${COUNTRY_RE})\b`, 'i').test(m[1]);
    const raw = m[1]
      .replace(/\s*[—–-]\s*(?:China|Vietnam|Indonesia|Thailand|India|Taiwan|Japan|Korea|Malaysia|Singapore|Philippines|Canada|Germany).*$/i, '')
      .trim();
    if (!SUPPLIER_CONTEXT.test(text.slice(Math.max(0, m.index - 120), Math.min(text.length, m.index + 220)))) continue;
    addCandidate(raw, 'heading', m.index, { requireCompanySignal: !hasCountryTail, requireLineContext: true });
  }
  // 1d) 破折号列举项： "- Name — Country/描述"
  for (const m of text.matchAll(/^[ \t>*+|\d.)-]*\*{0,2}([A-Z][\w&.'’-]*(?:[ \t]+(?:&[ \t]+)?[A-Z][\w&.'’-]*){0,3})\*{0,2}[ \t]+[—–-][ \t]+/gm)) {
    addCandidate(m[1], 'bullet-dash', m.index, { requireLineContext: true });
  }
  // 2) 域名
  const domains = [];
  for (const m of text.matchAll(/\b((?:[a-z0-9][a-z0-9-]{1,40})\.(?:com|id|vn|co|net|cn|io|org|shop|store|asia|biz)(?:\.[a-z]{2})?)\b/gi)) {
    const d = m[1].toLowerCase();
    if (d.startsWith('127.0.0.1')) continue;
    domains.push({ domain: d, index: m.index, snippet: snippet(text, m.index) });
    if (NON_BRAND_DOMAINS.has(d)) continue;
    const label = d.replace(/\.(com|id|vn|co|net|cn|io|org|shop|store|asia|biz)(\.[a-z]{2})?$/, '');
    addCandidate(label.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), 'domain', m.index);
  }
  // 3) "Name (Country)" 模式
  const reCountry = new RegExp(String.raw`([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3})\s*\(\s*(?:based\s+in\s+)?${COUNTRY_RE}\s*\)`, 'g');
  for (const m of text.matchAll(reCountry)) addCandidate(m[1], 'name(country)', m.index);
  // 4) "X Co., Ltd." / "X Factory/Manufacturing/Group/Industrial"
  for (const m of text.matchAll(/\b([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3}\s+(?:Co\.,?\s*Ltd\.?|Limited|Group|Industrial|Industries|Manufacturing|MFG))\b/g)) {
    addCandidate(m[1], 'legal-suffix', m.index);
  }
  // 5) 列表引导词后的枚举项
  for (const m of text.matchAll(/\b(?:such as|including|include|like|e\.g\.,?|for example|namely|consider|contact|try)\s+([^.\n;:]{2,320})/gi)) {
    const body = m[1];
    let offset = 0;
    for (const part of body.split(/,| and | or |;|\//)) {
      const idx = m.index + m[0].indexOf(body) + Math.max(0, offset);
      offset += part.length + 1;
      const frag = part.trim();
      if (!frag) continue;
      const head = frag.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if (/^[A-Z0-9]/.test(head) && head.split(' ').length <= 5) addCandidate(head, 'list-lead-in', Math.min(idx, text.length - 1));
    }
  }
  // 6) "based in Country" 前的公司名（较弱）
  for (const m of text.matchAll(/\b([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3})\s*(?:,|–|-|—)?\s*(?:is\s+)?based in\s+[A-Z]/g)) {
    addCandidate(m[1], 'based-in', m.index);
  }

  /* 合并同一品牌的变体：仅弱来源（域名反推/列表引导）且字母串被某个文本来源名称包含 → 丢弃；
     仅大小写/空格/标点不同的同名项 → 合并。 */
  const HIGH_SOURCES = new Set(['markdown-link-label', 'bold-span', 'heading', 'bullet-dash', 'name(country)', 'legal-suffix', 'domain']);
  const WEAK_SOURCES = new Set(['domain', 'list-lead-in', 'based-in']);
  const letters = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawList = [...candidates.values()];
  const textDerived = rawList.filter((c) => [...c.sources].some((s) => !WEAK_SOURCES.has(s)));
  const merged = [];
  for (const c of rawList) {
    const onlyWeak = [...c.sources].every((s) => WEAK_SOURCES.has(s));
    if (onlyWeak) {
      const hit = textDerived.find((t) => {
        if (t === c) return false;
        const tl = letters(t.name);
        const cl = letters(c.name);
        return tl.includes(cl) || cl.includes(tl);
      });
      if (hit) continue; // 与文本中出现的完整名称重复，丢弃弱变体
    }
    const dupKey = letters(c.name);
    const dup = merged.find((m) => letters(m.name) === dupKey);
    if (dup) {
      [...c.sources].forEach((s) => dup.sources.add(s));
      dup.count += c.count;
      dup.firstIndex = Math.min(dup.firstIndex, c.firstIndex);
      continue;
    }
    merged.push({ ...c, sources: new Set(c.sources) });
  }

  const additionalBrands = merged
    .filter((c) => c.name.split(' ').length <= 5)
    .map((c) => ({
      name: c.name,
      count: c.count,
      firstIndex: c.firstIndex,
      sources: [...c.sources],
      confidence: [...c.sources].some((s) => HIGH_SOURCES.has(s)) ? 'high' : 'medium',
      snippet: c.snippet,
    }))
    .sort((a, b) => a.firstIndex - b.firstIndex);

  /* --- 排序：实体首次出现顺序 --- */
  const entities = [];
  if (target.mentioned) entities.push({ name: TARGET.name, kind: 'target', firstIndex: target.firstIndex });
  for (const c of competitors) entities.push({ name: c.name, kind: 'competitor', firstIndex: c.firstIndex });
  for (const b of additionalBrands) entities.push({ name: b.name, kind: 'additional', firstIndex: b.firstIndex });
  entities.sort((a, b) => a.firstIndex - b.firstIndex);

  const knownEntities = entities.filter((e) => e.kind !== 'additional');
  const rankAll = target.mentioned ? entities.findIndex((e) => e.kind === 'target') + 1 : null;
  const rankKnown = target.mentioned ? knownEntities.findIndex((e) => e.kind === 'target') + 1 : null;

  const noSpecificSupplier =
    !target.mentioned &&
    competitors.length === 0 &&
    !additionalBrands.some((b) => b.confidence === 'high');

  return {
    target,
    competitors,
    ambiguousMatches: ambiguous,
    additionalBrands,
    domains: dedupeBy(domains, (d) => d.domain),
    entityOrder: entities.map((e) => ({ name: e.name, kind: e.kind })),
    rankAll,
    rankKnown,
    rankAllTotal: entities.length,
    rankKnownTotal: knownEntities.length,
    noSpecificSupplier,
    answerChars: rawText.length,
  };
}

function dedupeBy(items, keyFn) {
  const seen = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!seen.has(k)) seen.set(k, { ...it, count: 0 });
    seen.get(k).count += 1;
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ *
 * 网关调用
 * ------------------------------------------------------------------ */
async function getModels() {
  try {
    const res = await fetch(`${GATEWAY}/v1/models`, { signal: AbortSignal.timeout(20000) });
    const json = await res.json().catch(() => null);
    const ids = (json?.data || []).map((m) => m.id);
    return { ok: res.ok, status: res.status, ids, count: ids.length };
  } catch (e) {
    return { ok: false, status: 0, ids: [], error: String(e?.message || e) };
  }
}

async function postJson(path, body, timeoutMs) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const rawText = await res.text();
    let json = null;
    try { json = JSON.parse(rawText); } catch { /* keep raw text */ }
    return { ok: res.ok, status: res.status, json, rawText, durationMs: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, json: null, rawText: '', error: String(e?.name === 'AbortError' ? `aborted: ${e.message}` : e?.message || e), durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(json) {
  const ch = json?.choices?.[0];
  if (!ch) return { content: '', source: null, finishReason: null };
  const msg = ch.message || {};
  let content = msg.content;
  if (Array.isArray(content)) content = content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  if (!content && typeof msg.reasoning_content === 'string' && msg.reasoning_content) {
    return { content: msg.reasoning_content, source: 'message.reasoning_content', finishReason: ch.finish_reason ?? null };
  }
  if (!content && typeof ch.text === 'string') {
    return { content: ch.text, source: 'choices[0].text', finishReason: ch.finish_reason ?? null };
  }
  return { content: content || '', source: content ? 'message.content' : null, finishReason: ch.finish_reason ?? null };
}

async function chatWithRetry(engine, prompt, attemptLog) {
  let last = null;
  for (let attempt = 1; attempt <= OPT.retries + 1; attempt += 1) {
    process.stdout.write(`    → ${engine.id} / ${prompt.id} attempt ${attempt}/${OPT.retries + 1} ... `);
    const res = await postJson('/v1/chat/completions', { model: engine.model, messages: [{ role: 'user', content: prompt.text }] }, OPT.timeoutMs);
    const ex = res.ok ? extractContent(res.json) : { content: '', source: null, finishReason: null };
    const record = {
      attempt,
      ok: res.ok && ex.content.trim().length > 0,
      httpStatus: res.status,
      durationMs: res.durationMs,
      error: res.error || (res.ok ? (ex.content.trim() ? null : 'empty content in 200 response') : `HTTP ${res.status}`),
      errorBody: res.ok ? null : (res.json ? JSON.stringify(res.json).slice(0, 800) : res.rawText.slice(0, 800)),
      content: ex.content,
      contentSource: ex.source,
      finishReason: ex.finishReason,
      usage: res.json?.usage ?? null,
      modelReturned: res.json?.model ?? null,
      requestedAt: nowIso(),
    };
    attemptLog.push(record);
    console.log(record.ok ? `OK (${record.durationMs}ms, ${record.content.length} chars)` : `FAIL (${record.error})`);

    if (record.ok) return record;
    last = record;
    // 模型不存在 → 不必重试
    if (res.status === 404) break;
    if (attempt <= OPT.retries) await sleep(Math.min(20000, 2000 * 2 ** (attempt - 1)));
  }
  return last;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */
async function main() {
  const startedAt = nowIso();
  mkdirSync(abs(RAW_DIR), { recursive: true });
  mkdirSync(abs('.workbuddy-ai/reports'), { recursive: true });

  const prompts = PROMPTS.filter((p) => (OPT.withCn || p.lang === 'en') && (!OPT.promptIds.length || OPT.promptIds.includes(p.id)));
  const engines = ENGINES.filter((e) => !OPT.engines.length || OPT.engines.includes(e.id));

  console.log('AI Visibility Harness');
  console.log(`  gateway   : ${GATEWAY}`);
  console.log(`  engines   : ${engines.map((e) => `${e.id}(${e.role})`).join(', ')}`);
  console.log(`  prompts   : ${prompts.map((p) => p.id).join(', ')} (${prompts.length})`);
  console.log(`  timeout   : ${OPT.timeoutMs}ms | retries: ${OPT.retries} | delay: ${OPT.delayMs}ms`);
  console.log('');

  if (OPT.dryRun) {
    console.log('[dry-run] 不做任何网络请求。');
    return;
  }

  if (OPT.reanalyze) {
    console.log('[--reanalyze] 复用已有原始回答，仅重跑品牌识别与统计（零网络请求）。');
    return reanalyze();
  }

  if (OPT.probeEngines) {
    console.log('[--probe-engines] 只做引擎可达性探测（记录完整失败响应体），不改动已有回答。');
    return probeEngines();
  }

  /* 1. 网关模型清单 */
  console.log('[1/5] 读取网关模型清单 GET /v1/models');
  const models = await getModels();
  console.log(`      HTTP ${models.status} — ${models.count} 个模型`);
  const geminiInList = models.ids.filter((id) => /gemini/i.test(id));
  console.log(`      含 gemini 的模型 id: ${geminiInList.length ? geminiInList.join(', ') : '(无)'}`);

  /* 2. Gemini 不可用性证据 */
  const unavailableProbe = [];
  if (OPT.geminiProbe) {
    console.log('[2/5] 验证 Gemini 可用性（预期 404）');
    for (const p of UNAVAILABLE_PROBES) {
      const res = await postJson(p.endpoint, p.body, Math.min(OPT.timeoutMs, 60000));
      const errMsg = res.json?.error?.message || res.json?.error || res.rawText.slice(0, 400) || res.error || '';
      unavailableProbe.push({
        id: p.id,
        model: p.model,
        endpoint: p.endpoint,
        httpStatus: res.status,
        ok: res.ok,
        available: false,
        errorMessage: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
        probedAt: nowIso(),
      });
      console.log(`      ${p.model} @ ${p.endpoint} → HTTP ${res.status} (${String(errMsg).slice(0, 90)}…)`);
      await sleep(300);
    }
  } else {
    console.log('[2/5] 跳过 Gemini 验证');
  }

  /* 3. 引擎预检 */
  const preflight = [];
  const reachable = new Map();
  if (OPT.preflight) {
    console.log('[3/5] 引擎预检（单条 PONG 请求，Claude 冷启动可能较慢）');
    for (const e of engines) {
      const res = await postJson('/v1/chat/completions', { model: e.model, messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }, OPT.timeoutMs);
      const ex = res.ok ? extractContent(res.json) : { content: '' };
      const ok = res.ok && ex.content.trim().length > 0;
      preflight.push({
        engine: e.id,
        model: e.model,
        ok,
        httpStatus: res.status,
        durationMs: res.durationMs,
        reply: ex.content.slice(0, 120),
        error: ok ? null : (res.error || `HTTP ${res.status}`),
        errorBody: ok ? null : (res.json ? JSON.stringify(res.json).slice(0, 1000) : res.rawText.slice(0, 1000)),
        probedAt: nowIso(),
      });
      reachable.set(e.id, ok);
      console.log(`      ${e.id}: ${ok ? `OK (${res.durationMs}ms, "${ex.content.trim().slice(0, 20)}")` : `UNREACHABLE (${res.error || 'HTTP ' + res.status})`}`);
      await sleep(OPT.delayMs);
    }
  } else {
    console.log('[3/5] 跳过预检');
    for (const e of engines) reachable.set(e.id, true);
  }

  /* 4. 逐引擎逐提问调用 */
  console.log('[4/5] 采集回答');
  const engineResults = [];
  for (const e of engines) {
    const isReachable = reachable.get(e.id);
    const entry = {
      id: e.id,
      model: e.model,
      label: e.label,
      role: e.role,
      reachable: isReachable,
      skippedReason: isReachable ? null : '预检失败：引擎不可达，未发送任何提问（避免无意义请求）',
      answers: [],
      failures: [],
    };
    engineResults.push(entry);

    if (!isReachable) {
      console.log(`  [${e.id}] 预检失败，跳过全部提问。`);
      continue;
    }

    for (let i = 0; i < prompts.length; i += 1) {
      const p = prompts[i];
      const attemptLog = [];
      console.log(`  [${e.id}] ${p.id} ${p.angle}`);
      const final = await chatWithRetry(e, p, attemptLog);
      const rawFile = `raw-${e.id}-${i + 1}.json`;
      writeFileSync(
        abs(join(RAW_DIR, rawFile)),
        JSON.stringify(
          {
            harness: 'scripts/site-audit/ai-visibility.mjs',
            engine: { id: e.id, model: e.model, label: e.label, role: e.role },
            prompt: { id: p.id, angle: p.angle, lang: p.lang, text: p.text },
            requestedAt: attemptLog[0]?.requestedAt ?? null,
            ok: Boolean(final?.ok),
            attempts: attemptLog,
            answer: final?.ok ? final.content : null,
            error: final?.ok ? null : (final?.error || 'unknown failure'),
            note: 'answer 字段为该次提问的完整原始回答，未做任何删改；attempts 保留全部重试记录。',
          },
          null,
          2,
        ),
        'utf8',
      );

      entry.answers.push({
        promptId: p.id,
        angle: p.angle,
        lang: p.lang,
        promptText: p.text,
        ok: Boolean(final?.ok),
        attempts: attemptLog.length,
        httpStatus: final?.httpStatus ?? null,
        durationMs: final?.durationMs ?? null,
        finishReason: final?.finishReason ?? null,
        contentSource: final?.contentSource ?? null,
        usage: final?.usage ?? null,
        error: final?.ok ? null : (final?.error || 'unknown failure'),
        errorBody: final?.errorBody ?? null,
        rawFile: join(RAW_DIR, rawFile),
        answer: final?.ok ? final.content : null,
        analysis: final?.ok ? analyzeAnswer(final.content) : null,
      });

      if (final?.ok) {
        const a = entry.answers[entry.answers.length - 1].analysis;
        const extra = a.additionalBrands.filter((b) => b.confidence === 'high').slice(0, 4).map((b) => b.name);
        console.log(
          `      target=${a.target.mentioned ? `YES(rank ${a.rankAll})` : 'no'} | competitors=[${a.competitors.map((c) => c.name).join(', ')}] | extra=[${extra.join(', ')}]`,
        );
      } else {
        entry.failures.push({ promptId: p.id, error: final?.error, httpStatus: final?.httpStatus });
      }
      if (i < prompts.length - 1) await sleep(OPT.delayMs);
    }
    await sleep(OPT.delayMs);
  }

  /* 5. 统计 + 落盘 */
  console.log('[5/5] 汇总并写入 JSON');
  const summaries = {};
  for (const entry of engineResults) {
    summaries[entry.id] = summarizeEngine(entry, prompts);
  }
  const overall = summarizeOverall(engineResults, summaries, prompts);

  const report = {
    generatedAt: nowIso(),
    startedAt,
    harness: {
      script: 'scripts/site-audit/ai-visibility.mjs',
      node: process.version,
      gateway: GATEWAY,
      temperature: '未设置（使用各模型默认值）',
      delayMs: OPT.delayMs,
      timeoutMs: OPT.timeoutMs,
      maxRetries: OPT.retries,
      withChinesePrompts: OPT.withCn,
      note: '每次提问只采集 1 个样本（temperature 默认值），因此结果非确定性，只能反映单次快照。',
    },
    matchingRules: {
      target: {
        name: TARGET.name,
        aliasesTested: TARGET.aliases.map((a) => a.alias),
        caseInsensitive: true,
        note: TARGET.note,
      },
      competitors: COMPETITORS.map((c) => ({
        name: c.name,
        confidence: c.confidence,
        patterns: c.re.map((r) => r.source),
        ...(c.ambiguousWhy ? { ambiguityNote: c.ambiguousWhy, contextRequirement: AMBIGUOUS_CONTEXT.source } : {}),
      })),
      rankDefinition:
        'rank = 目标品牌在"按首次出现位置排序的实体列表"中的位次。rankAll 计入目标 + 已知竞品 + 启发式抽取的额外品牌；rankKnown 只计入目标 + 已知竞品列表（更保守）。位置按字符下标，非模型主观排序。',
      additionalBrandExtraction: [
        'markdown-link-label: [名称](URL) 中的链接文本（高置信）',
        'domain: 正文域名，去掉平台域名后反推名称（高置信）',
        'name(country): "名称 (China/Vietnam/Indonesia…)" 模式（高置信）',
        'legal-suffix: "X Co., Ltd. / Group / Manufacturing / Industries"（高置信）',
        'list-lead-in: such as / including / like / contact 后面的枚举项（中置信）',
        'based-in: "X is based in <Country>"（中置信）',
        '通用词、地名、平台名（Alibaba/Made-in-China 等）会被过滤；中文公司名不在英文大写模式覆盖范围内，属已知局限。',
      ],
      noSpecificSupplierDefinition:
        '回答中既未出现目标品牌、也未出现任何已知竞品、且没有任何"高置信"额外品牌 → 记为"未推荐任何具体供应商"。',
    },
    prompts: prompts.map((p) => ({ ...p, neutralCheck: !/djiluggage|dji\s*luggage|omaska|hung\s*phat|greatchip/i.test(p.text) })),
    gatewayModels: { ok: models.ok, status: models.status, count: models.count, ids: models.ids, geminiIds: geminiInList },
    unavailableEnginesProbe: unavailableProbe,
    preflight,
    engines: Object.fromEntries(
      engineResults.map((entry) => [
        entry.id,
        {
          id: entry.id,
          model: entry.model,
          label: entry.label,
          role: entry.role,
          reachable: entry.reachable,
          skippedReason: entry.skippedReason,
          answers: entry.answers,
          failures: entry.failures,
          summary: summaries[entry.id],
        },
      ]),
    ),
    overall,
  };

  writeFileSync(abs(REPORT_FILE), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✓ 写入 ${REPORT_FILE}`);
  console.log(`✓ 原始回答目录 ${RAW_DIR}/`);

  /* 控制台小结 */
  console.log('\n=== 提及率小结 ===');
  for (const [id, s] of Object.entries(summaries)) {
    if (!s.reachable) {
      console.log(`${id}: 未测试（${s.skippedReason}）`);
      continue;
    }
    console.log(
      `${id}: ${s.targetMentionedCount}/${s.answersOk} 回答提及 djiluggage.id (${s.targetMentionRatePct}%) | ` +
        `未推荐任何具体供应商: ${s.noSupplierAnswers.count}/${s.answersOk} | 失败: ${s.failures}`,
    );
  }
  console.log(`\nGemini 可用性: ${unavailableProbe.map((u) => `${u.model}=HTTP ${u.httpStatus}`).join(', ') || '未验证'}`);
  return report;
}

/* ------------------------------------------------------------------ *
 * --probe-engines：只探测各引擎可达性，并把完整失败响应体写进报告。
 * 用于留下"哪些引擎测不了、为什么"的可审计证据（每次 1 个极小请求）。
 * ------------------------------------------------------------------ */
async function probeEngines() {
  const prev = existsSync(abs(REPORT_FILE)) ? safeJson(abs(REPORT_FILE)) : null;
  const probes = [];
  console.log('引擎探测（单条 PONG 请求；Claude 冷启动可能耗时数分钟）');
  for (const e of ENGINES.filter((x) => !OPT.engines.length || OPT.engines.includes(x.id))) {
    const res = await postJson('/v1/chat/completions', { model: e.model, messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }, OPT.timeoutMs);
    const ex = res.ok ? extractContent(res.json) : { content: '' };
    const ok = res.ok && ex.content.trim().length > 0;
    const rec = {
      engine: e.id,
      model: e.model,
      role: e.role,
      ok,
      httpStatus: res.status,
      durationMs: res.durationMs,
      reply: ex.content.trim().slice(0, 120),
      error: ok ? null : (res.error || `HTTP ${res.status}`),
      errorBody: ok ? null : (res.json ? JSON.stringify(res.json).slice(0, 1000) : res.rawText.slice(0, 1000)),
      probedAt: nowIso(),
    };
    probes.push(rec);
    console.log(`  ${e.id}: ${ok ? `OK (${res.durationMs}ms, "${ex.content.trim().slice(0, 20)}")` : `不可用 (HTTP ${res.status}, ${res.durationMs}ms)`}`);
    if (!ok && rec.errorBody) console.log(`    ${rec.errorBody.slice(0, 300)}`);
    await sleep(OPT.delayMs);
  }
  const report = prev || { generatedAt: null, harness: {}, prompts: PROMPTS, engines: {}, overall: null };
  report.engineProbes = probes;
  report.preflight = probes.map((p) => ({ ...p }));
  report.harness = { ...(report.harness || {}), lastEngineProbeAt: nowIso(), mode: report.harness?.mode || 'full-run' };
  writeFileSync(abs(REPORT_FILE), JSON.stringify(report, null, 2), 'utf8');
  console.log(`✓ 探测结果已写入 ${REPORT_FILE}（字段 engineProbes / preflight）`);
  return report;
}

/* ------------------------------------------------------------------ *
 * --reanalyze：复用 .seo-geo/ai-visibility/raw-*.json，零网络请求重建报告。
 * 用于在不重复消耗网关请求的前提下迭代品牌识别规则。
 * ------------------------------------------------------------------ */
function reanalyze() {
  const prev = existsSync(abs(REPORT_FILE)) ? safeJson(abs(REPORT_FILE)) : null;
  const files = existsSync(abs(RAW_DIR)) ? readdirSync(abs(RAW_DIR)).filter((f) => /^raw-.*\.json$/.test(f)) : [];
  if (!files.length) throw new Error(`在 ${RAW_DIR}/ 未找到任何 raw-*.json，无法 --reanalyze`);

  const raws = files.map((f) => ({ file: f, data: safeJson(abs(join(RAW_DIR, f))) })).filter((r) => r.data);
  const byEngine = new Map();
  for (const r of raws) {
    const id = r.data.engine?.id;
    if (!id) continue;
    if (!byEngine.has(id)) byEngine.set(id, []);
    byEngine.get(id).push(r);
  }

  const engineIds = [...new Set([...ENGINES.map((e) => e.id), ...byEngine.keys()])].filter(
    (id) => !OPT.engines.length || OPT.engines.includes(id),
  );

  const engineResults = [];
  for (const id of engineIds) {
    const cfg = ENGINES.find((e) => e.id === id) || { id, model: id, label: id, role: 'unknown' };
    const group = (byEngine.get(id) || []).sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
    const prevEngine = prev?.engines?.[id] || null;
    const entry = {
      id,
      model: cfg.model,
      label: cfg.label,
      role: cfg.role,
      reachable: group.length > 0,
      skippedReason: group.length
        ? null
        : prevEngine?.skippedReason || 'reanalyze：该引擎没有 raw-*.json（本次运行未采集到回答）',
      answers: [],
      failures: [],
    };
    for (const { file, data } of group) {
      const last = data.attempts?.[data.attempts.length - 1] || null;
      entry.answers.push({
        promptId: data.prompt?.id ?? null,
        angle: data.prompt?.angle ?? null,
        lang: data.prompt?.lang ?? null,
        promptText: data.prompt?.text ?? null,
        ok: Boolean(data.ok),
        attempts: data.attempts?.length ?? 0,
        httpStatus: last?.httpStatus ?? null,
        durationMs: last?.durationMs ?? null,
        finishReason: last?.finishReason ?? null,
        contentSource: last?.contentSource ?? null,
        usage: last?.usage ?? null,
        error: data.ok ? null : data.error || 'unknown failure',
        errorBody: data.ok ? null : last?.errorBody ?? null,
        rawFile: join(RAW_DIR, file),
        answer: data.answer ?? null,
        analysis: data.answer ? analyzeAnswer(data.answer) : null,
      });
      if (!data.ok) entry.failures.push({ promptId: data.prompt?.id, error: data.error, httpStatus: last?.httpStatus ?? null });
    }
    engineResults.push(entry);
  }

  const prompts = [...new Map(raws.map((r) => [r.data.prompt?.id, r.data.prompt])).values()].filter(Boolean);
  const summaries = {};
  for (const entry of engineResults) summaries[entry.id] = summarizeEngine(entry, prompts);
  const overall = summarizeOverall(engineResults, summaries, prompts);

  const report = {
    generatedAt: nowIso(),
    startedAt: prev?.startedAt ?? null,
    harness: {
      ...(prev?.harness || {}),
      mode: 'reanalyze（统计重算：品牌识别/汇总由脚本重新计算，未调用网关；raw-*.json 中的回答均为真实网关调用结果）',
      lastReanalyzeAt: nowIso(),
      node: process.version,
      gateway: GATEWAY,
    },
    matchingRules: prev?.matchingRules ?? {},
    prompts,
    gatewayModels: prev?.gatewayModels ?? null,
    unavailableEnginesProbe: prev?.unavailableEnginesProbe ?? [],
    engineProbes: prev?.engineProbes ?? [],
    preflight: prev?.preflight ?? [],
    engines: Object.fromEntries(
      engineResults.map((e) => [
        e.id,
        { id: e.id, model: e.model, label: e.label, role: e.role, reachable: e.reachable, skippedReason: e.skippedReason, answers: e.answers, failures: e.failures, summary: summaries[e.id] },
      ]),
    ),
    overall,
  };
  writeFileSync(abs(REPORT_FILE), JSON.stringify(report, null, 2), 'utf8');
  console.log(`✓ 重算完成并写入 ${REPORT_FILE}`);
  for (const [id, s] of Object.entries(summaries)) {
    console.log(
      s.reachable
        ? `${id}: 目标提及 ${s.targetMentionRateText} (${s.targetMentionRatePct}%) | 额外品牌(高置信) ${s.additionalBrands.length} 个 | 未推荐任何具体供应商 ${s.noSupplierAnswers.count}/${s.answersOk}`
        : `${id}: 未测试（${s.skippedReason}）`,
    );
  }
  return report;
}

function safeJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeEngine(entry, prompts) {
  const ok = entry.answers.filter((a) => a.ok);
  const targetHits = ok.filter((a) => a.analysis.target.mentioned);
  const competitorCounts = new Map();
  const additionalCounts = new Map();
  const domainCounts = new Map();
  for (const a of ok) {
    for (const c of a.analysis.competitors) {
      const rec = competitorCounts.get(c.name) || { name: c.name, count: 0, promptIds: [], firstSnippets: [] };
      rec.count += 1;
      rec.promptIds.push(a.promptId);
      if (rec.firstSnippets.length < 2) rec.firstSnippets.push(c.snippet);
      competitorCounts.set(c.name, rec);
    }
    for (const b of a.analysis.additionalBrands) {
      const rec = additionalCounts.get(b.name) || { name: b.name, count: 0, promptIds: [], snippet: b.snippet, sources: new Set(), confidence: b.confidence };
      rec.count += 1;
      rec.promptIds.push(a.promptId);
      b.sources.forEach((s) => rec.sources.add(s));
      if (b.confidence === 'high') rec.confidence = 'high';
      additionalCounts.set(b.name, rec);
    }
    for (const d of a.analysis.domains) {
      domainCounts.set(d.domain, (domainCounts.get(d.domain) || 0) + 1);
    }
  }
  const ranks = targetHits.map((a) => a.analysis.rankAll).filter((n) => typeof n === 'number');
  const ranksKnown = targetHits.map((a) => a.analysis.rankKnown).filter((n) => typeof n === 'number');
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);

  return {
    reachable: entry.reachable,
    skippedReason: entry.skippedReason,
    promptsAsked: entry.answers.length,
    answersOk: ok.length,
    failures: entry.failures.length,
    failureDetail: entry.failures,
    targetMentionedCount: targetHits.length,
    targetMentionRatePct: ok.length ? Math.round((targetHits.length / ok.length) * 1000) / 10 : null,
    targetMentionRateText: `${targetHits.length}/${ok.length}`,
    targetMentions: targetHits.map((a) => ({
      promptId: a.promptId,
      rankAll: a.analysis.rankAll,
      rankAllTotal: a.analysis.rankAllTotal,
      rankKnown: a.analysis.rankKnown,
      rankKnownTotal: a.analysis.rankKnownTotal,
      matchedAlias: a.analysis.target.matchedAlias,
      snippet: a.analysis.target.snippet,
    })),
    averageRankAll: avg(ranks),
    averageRankKnown: avg(ranksKnown),
    competitorCounts: [...competitorCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    uniqueCompetitors: competitorCounts.size,
    ambiguousBrandMatches: ok.flatMap((a) =>
      a.analysis.ambiguousMatches.filter((m) => m.rawCount > 0).map((m) => ({ promptId: a.promptId, ...m, snippets: m.snippets })),
    ),
    noSupplierAnswers: {
      count: ok.filter((a) => a.analysis.noSpecificSupplier).length,
      promptIds: ok.filter((a) => a.analysis.noSpecificSupplier).map((a) => a.promptId),
    },
    additionalBrands: [...additionalCounts.values()]
      .map((r) => ({ ...r, sources: [...r.sources] }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    domainsCited: [...domainCounts.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
    answerLengths: ok.map((a) => ({ promptId: a.promptId, chars: a.analysis.answerChars })),
    latencies: ok.map((a) => ({ promptId: a.promptId, ms: a.durationMs, attempts: a.attempts })),
  };
}

function summarizeOverall(engineResults, summaries, prompts) {
  const tested = engineResults.filter((e) => e.reachable);
  const allOk = engineResults.flatMap((e) => e.answers.filter((a) => a.ok));
  const targetHits = allOk.filter((a) => a.analysis.target.mentioned);
  const competitorGlobal = new Map();
  const brandGlobal = new Map();
  for (const a of allOk) {
    for (const c of a.analysis.competitors) competitorGlobal.set(c.name, (competitorGlobal.get(c.name) || 0) + 1);
    for (const b of a.analysis.additionalBrands.filter((x) => x.confidence === 'high')) brandGlobal.set(b.name, (brandGlobal.get(b.name) || 0) + 1);
  }
  return {
    enginesConfigured: engineResults.length,
    enginesTested: tested.map((e) => e.id),
    enginesNotTested: engineResults.filter((e) => !e.reachable).map((e) => ({ id: e.id, reason: e.skippedReason })),
    promptsPerEngine: prompts.length,
    totalAnswersOk: allOk.length,
    totalFailures: engineResults.reduce((s, e) => s + e.failures.length, 0),
    targetMentionedCount: targetHits.length,
    targetMentionRatePct: allOk.length ? Math.round((targetHits.length / allOk.length) * 1000) / 10 : null,
    noSupplierAnswerCount: allOk.filter((a) => a.analysis.noSpecificSupplier).length,
    competitorCountsGlobal: [...competitorGlobal.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    recommendedBrandsGlobal: [...brandGlobal.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

main().catch((e) => {
  console.error('\n✗ harness 崩溃（这本身也是一个如实记录的失败）:', e);
  process.exitCode = 1;
});
