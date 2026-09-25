/**
 * 确定性 SEO 特征抽取。
 *
 * 这里刻意不调用任何模型：标题、元描述、标题层级、结构化数据、图片 alt、
 * 内外链、数字与认证词命中……都属于可精确计算的事实，交给代码算，
 * 模型只负责「这些东西对买家/AI 意味着什么」的判断。
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  middot: '·', times: '×', deg: '°', copy: '©', reg: '®', trade: '™', shy: '',
};

export function decodeEntities(input) {
  return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const cp = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(cp) && cp > 0) {
        try { return String.fromCodePoint(cp); } catch { return m; }
      }
      return m;
    }
    const key = body.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : m;
  });
}

const stripNoise = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ');

const stripChrome = (html) =>
  html
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, ' ');

export function htmlToText(html) {
  const withBreaks = html
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote|td)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? '').trim();
}

function metaTags(html) {
  const out = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    out.push({
      name: (attr(tag, 'name') || attr(tag, 'property') || attr(tag, 'itemprop') || '').toLowerCase(),
      content: attr(tag, 'content') || '',
      charset: attr(tag, 'charset'),
    });
  }
  return out;
}

function extractHeadings(html) {
  const headings = [];
  for (const m of html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (text) headings.push({ level: Number(m[1]), text: text.slice(0, 220) });
  }
  return headings;
}

function extractJsonLd(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      blocks.push({ __parse_error: true, __raw: raw.slice(0, 200) });
    }
  }
  return blocks;
}

function collectTypes(node, types = [], nodes = []) {
  if (!node || typeof node !== 'object') return { types, nodes };
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, types, nodes));
    return { types, nodes };
  }
  nodes.push(node);
  const t = node['@type'];
  if (typeof t === 'string') types.push(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.push(x));
  for (const [k, v] of Object.entries(node)) {
    if (k === '@type') continue;
    if (v && typeof v === 'object') collectTypes(v, types, nodes);
  }
  return { types, nodes };
}

const CERT_PATTERNS = [
  ['ISO 9001', /\biso\s*9001\b/i],
  ['ISO 14001', /\biso\s*14001\b/i],
  ['ISO 45001', /\biso\s*45001\b/i],
  ['BSCI', /\bbsci\b/i],
  ['Sedex/SMETA', /\bsedex\b|\bsmeta\b/i],
  ['GRS', /\bgrs\b|global recycled standard/i],
  ['OEKO-TEX', /\boeko[- ]?tex\b/i],
  ['REACH', /\breach\b/i],
  ['RoHS', /\brohs\b/i],
  ['TSA lock', /\btsa\b/i],
  ['Walmart audit', /\bwalmart\b/i],
  ['Disney FAMA', /\bdisney\b|\bfama\b/i],
  ['Bureau Veritas', /bureau veritas|\bbv\b audit/i],
  ['Intertek', /\bintertek\b/i],
  ['SGS', /\bsgs\b/i],
  ['FSC', /\bfsc\b/i],
  ['ISO 17025', /\biso\s*17025\b/i],
];

const CTA_PATTERNS = [
  ['询盘表单/按钮', /(request|get|ask for)\s+(a\s+)?(free\s+)?(quote|quotation|sample)|inquiry|enquir|contact\s+(us|our\s+team)|get\s+started|start\s+your\s+project/i],
  ['WhatsApp', /wa\.me|whatsapp/i],
  ['邮件', /mailto:|[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ['电话', /tel:|\+\d[\d\s()-]{7,}\d/i],
];

const UNIT_PATTERN =
  /\b\d[\d.,]*\s*(%|pcs|pieces|units|sets?|moq|kg|g\b|lb|mm|cm|m\b|inch|in\b|"|inch|liters?|l\b|days?|weeks?|months?|years?|sqm|sq\.?\s?m|20ft|40ft|hq|cartons?|containers?|teu|workers?|staff|lines?|machines?)\b/gi;

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function hasFaqSection(headings, text, jsonldTypes) {
  if (jsonldTypes.some((t) => /FAQPage|QAPage/i.test(t))) return true;
  if (headings.some((h) => /faq|frequently asked|问答|常见问题/i.test(h.text))) return true;
  const qHeadings = headings.filter((h) => h.text.trim().endsWith('?'));
  if (qHeadings.length >= 3) return true;
  const inlineQ = text.match(/(^|\n)\s*(Q\d?[:.、]|问[:：])/g);
  return Boolean(inlineQ && inlineQ.length >= 3);
}

export function extract(html, url) {
  // JSON-LD 必须在剥离 <script> 之前读取，否则会被当成普通脚本删掉
  const jsonld = extractJsonLd(html);
  const naturalHtml = stripNoise(html);
  const headEnd = naturalHtml.search(/<\/head>/i);
  const head = headEnd > 0 ? naturalHtml.slice(0, headEnd + 7) : naturalHtml.slice(0, 40000);

  const metas = metaTags(head.length > 20 ? head : naturalHtml);
  const pickMeta = (names) => {
    for (const n of names) {
      const hit = metas.find((m) => m.name === n && m.content);
      if (hit) return hit.content;
    }
    return '';
  };

  const titleMatch = naturalHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? htmlToText(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';
  const description = pickMeta(['description', 'og:description']);
  const canonicalMatch = naturalHtml.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
  const canonical = canonicalMatch ? attr(canonicalMatch[0], 'href') : '';
  const langMatch = naturalHtml.match(/<html\b[^>]*>/i);
  const lang = langMatch ? attr(langMatch[0], 'lang') : '';
  const hreflangs = [...naturalHtml.matchAll(/<link\b[^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);

  const screenshotHeadings = extractHeadings(naturalHtml);
  const headings = screenshotHeadings;

  // 正文：优先 main/article，否则用去掉导航/页脚的 body
  // 正文容器选择：不能只取第一个 <main>/<article>——很多页面把它用作卡片元素，
  // 第一个往往只有几十个词；也不能无条件取整页，否则会把菜单与重复卡片算进来。
  // 规则：取覆盖「整页可见文本」≥50% 的最大 main/article；都不达标就用整页。
  const stripped = stripChrome(naturalHtml);
  const countWords = (h) => htmlToText(h).split(/\s+/).filter((w) => /[A-Za-z0-9\u4e00-\u9fa5]/.test(w)).length;
  const visibleWords = countWords(stripped);
  let primary = stripped;
  let bestWords = 0;
  for (const m of naturalHtml.matchAll(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const w = countWords(m[2]);
    if (w > bestWords && w >= visibleWords * 0.5) {
      bestWords = w;
      primary = m[2];
    }
  }

  const bodyText = htmlToText(primary);
  const fullText = htmlToText(stripChrome(naturalHtml));
  const words = bodyText.split(/\s+/).filter((w) => /[A-Za-z0-9\u4e00-\u9fa5]/.test(w));

  const { types: jsonldTypes, nodes: jsonldNodes } = collectTypes(jsonld);
  const jsonldFlat = jsonldNodes.flatMap((n) => {
    const out = [];
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'string' || typeof v === 'number') out.push(`${k}=${v}`);
    }
    return out;
  });

  const images = [...naturalHtml.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesWithAlt = images.filter((tag) => (attr(tag, 'alt') || '').trim().length > 0);

  const anchors = [...naturalHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  const host = (() => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; } })();
  const internal = anchors.filter((h) => !/^(mailto:|tel:|javascript:|#)/i.test(h) && (!/^https?:/i.test(h) || h.includes(host)));
  const external = anchors.filter((h) => /^https?:/i.test(h) && !h.includes(host));

  const certs = CERT_PATTERNS.filter(([, re]) => re.test(fullText)).map(([name]) => name);
  const ctas = CTA_PATTERNS.filter(([, re]) => re.test(naturalHtml)).map(([name]) => name);
  const unitHits = countMatches(fullText, UNIT_PATTERN);
  const percentHits = countMatches(fullText, /\b\d[\d.,]*\s*%/g);
  const questionHeadings = headings.filter((h) => h.text.trim().endsWith('?'));

  const dates = [
    ...fullText.matchAll(/\b(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/g),
    ...fullText.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(20\d{2})/gi),
  ].map((m) => m[0]);
  const years = [...new Set([...fullText.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]))].sort();

  const ogComplete = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].every((k) => metas.some((m) => m.name === k && m.content));
  const twitterComplete = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].every((k) => metas.some((m) => m.name === k && m.content));

  return {
    url,
    fetchedAt: new Date().toISOString(),
    title,
    titleLength: title.length,
    metaDescription: description,
    metaDescriptionLength: description.length,
    canonical,
    canonicalSelf: canonical.replace(/\/$/, '') === url.replace(/\/$/, '') || canonical === url,
    lang,
    hreflangCount: hreflangs.length,
    robotsMeta: pickMeta(['robots']),
    viewport: pickMeta(['viewport']),
    ogComplete,
    twitterComplete,
    h1: headings.filter((h) => h.level === 1).map((h) => h.text),
    h1Count: headings.filter((h) => h.level === 1).length,
    h2Count: headings.filter((h) => h.level === 2).length,
    h3Count: headings.filter((h) => h.level === 3).length,
    headings: headings.slice(0, 40),
    questionHeadings: questionHeadings.map((h) => h.text).slice(0, 10),
    wordCount: words.length,
    jsonldTypes: [...new Set(jsonldTypes)],
    jsonldBlockCount: jsonld.length,
    jsonldParseErrors: jsonld.filter((b) => b && b.__parse_error).length,
    jsonldFlat: jsonldFlat.slice(0, 40),
    imageCount: images.length,
    imageAltCoverage: images.length ? Math.round((imagesWithAlt.length / images.length) * 100) : 0,
    internalLinkCount: internal.length,
    externalLinkCount: external.length,
    externalHosts: [...new Set(external.map((h) => { try { return new URL(h).host.replace(/^www\./, ''); } catch { return null; } }).filter(Boolean))].slice(0, 12),
    certifications: certs,
    ctaSignals: ctas,
    unitStatHits: unitHits,
    percentStatHits: percentHits,
    hasFaq: hasFaqSection(headings, fullText, jsonldTypes),
    dates,
    yearsMentioned: years,
    textLength: bodyText.length,
    bodyText,
    fullTextLength: fullText.length,
    fullText,
  };
}
