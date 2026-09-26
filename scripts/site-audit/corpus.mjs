/**
 * 站点全量语料构建。
 *
 * 产出（写入 .seo-geo/site/corpus.json）：
 *   pages[]      每个 canonical URL 的抽取事实 + 正文
 *   links[]      内链边（含锚文本）、断链、孤岛页
 *   clusters[]   相似度聚类（同质页面嫌疑）
 *   similar[]    相似度最高的页面两两组合
 *   schema[]     每页 JSON-LD 声明（用于与页面事实比对）
 *   duplicates[] x.html 与 x/index.html 重复文件对
 *   legacy[]     _redirects 里的旧 URL（用于反向映射校验）
 *
 * 纯代码，不调用模型。
 *
 *   node scripts/site-audit/corpus.mjs [--refresh]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extract } from '../seo-geo/extract.mjs';
import * as siteDir from './site-dir.mjs';

const { ROOT, SITE, SITE_DIR } = siteDir;
const REFRESH = process.argv.includes('--refresh');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

mkdirSync(SITE_DIR, { recursive: true });
const abs = (p) => join(ROOT, p);

/* ------------------------------- URL 归一 ------------------------------- */

const norm = (u) => {
  let s = String(u).trim().replace(/^https?:\/\/(www\.)?djiluggage\.id/i, '');
  s = s.replace(new RegExp('^' + SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
  s = s.split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s.toLowerCase();
};
const toAbs = (p) => (p === '/' ? SITE + '/' : SITE + p + '/');

/* ------------------------------- 语料来源 ------------------------------- */

const sitemap = readFileSync(abs('sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
console.log(`▶ sitemap 中 ${urls.length} 个 canonical URL`);

/** canonical URL → 本地文件（x → x.html 或 x/index.html） */
function localFileFor(urlPath) {
  const p = urlPath === '/' ? '' : urlPath.slice(1);
  const candidates = p ? [`${p}.html`, `${p}/index.html`] : ['index.html'];
  for (const c of candidates) if (existsSync(abs(c))) return c;
  return null;
}

async function loadHtml(urlPath, slug) {
  const cache = join(SITE_DIR, `${slug}.html`);
  if (!REFRESH && existsSync(cache)) return { html: readFileSync(cache, 'utf8'), from: 'cache' };
  const local = localFileFor(urlPath);
  try {
    const res = await fetch(toAbs(urlPath), {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    writeFileSync(cache, html);
    return { html, from: 'live' };
  } catch (err) {
    if (local) return { html: readFileSync(abs(local), 'utf8'), from: `local(${local})`, error: err.message };
    throw err;
  }
}

/* ------------------------------- 抓取 + 抽取 ------------------------------- */

const slugOf = (p) => (p === '/' ? 'home' : p.slice(1).replace(/\//g, '__'));

const pages = [];
let i = 0;
const CONC = 5;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (i < urls.length) {
      const idx = i++;
      const urlPath = norm(urls[idx]);
      const slug = slugOf(urlPath);
      try {
        const { html, from, error } = await loadHtml(urlPath, slug);
        const f = extract(html, toAbs(urlPath));
        pages.push({ urlPath, url: toAbs(urlPath), slug, source: from, sourceError: error || null, html, facts: f });
        process.stdout.write(`  ✓ ${urlPath}  (${from})\n`);
      } catch (err) {
        process.stdout.write(`  ✗ ${urlPath}  ${err.message}\n`);
      }
    }
  }),
);
pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

/* --- sitemap 之外、但被内链指向且本地有文件的页面（例如 canonical 已归并的筛选页） --- */
const extraPaths = new Set();
for (const page of pages) {
  for (const m of page.html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    const h = m[1].trim();
    if (!h.startsWith('/') || /^(mailto:|tel:|#)/i.test(h)) continue;
    const t = norm(h);
    if (urls.some((u) => norm(u) === t)) continue;
    if (localFileFor(t)) extraPaths.add(t);
  }
}
for (const t of extraPaths) {
  try {
    const { html, from } = await loadHtml(t, `extra-${slugOf(t)}`);
    pages.push({
      urlPath: t,
      url: toAbs(t),
      slug: `extra-${slugOf(t)}`,
      source: from,
      sourceError: null,
      html,
      facts: extract(html, toAbs(t)),
      inSitemap: false,
    });
    console.log(`  + ${t}  （sitemap 外，${from}）`);
  } catch (err) {
    console.log(`  ✗ ${t}  ${err.message}`);
  }
}
pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

/* ------------------------------- 内链图 ------------------------------- */

const known = new Map();
for (const p of pages) {
  known.set(norm(p.urlPath), p);
}

const edges = [];
const brokenLinks = [];
for (const p of pages) {
  const seen = new Set();
  for (const m of p.html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].trim();
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!/^(\/|https?:\/\/(www\.)?djiluggage\.id)/i.test(href)) continue;
    const target = norm(href);
    if (!target || target === norm(p.urlPath)) continue;
    const anchor = String(m[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const key = `${target}||${anchor.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dest = known.get(target);
    if (dest) edges.push({ from: p.urlPath, to: dest.urlPath, anchor });
    else brokenLinks.push({ from: p.urlPath, to: target, anchor, savedOnly: true });
  }
}

const inlinks = new Map(pages.map((p) => [p.urlPath, []]));
for (const e of edges) inlinks.get(e.to)?.push(e);

const orphans = pages
  .filter((p) => p.urlPath !== '/' && (inlinks.get(p.urlPath) || []).length === 0)
  .map((p) => p.urlPath);

/* ------------------------------- 相似度 ------------------------------- */

const STOP = new Set(
  ('the a an and or of for to in on with your you we our is are be by from at as it its this that these those ' +
    'luggage suitcase suitcases travel brand brands custom manufacturer manufacturers factory oem odm product products ' +
    'more read all new can will has have not but they their there here what who how why when where which')
    .split(/\s+/),
);

function tokens(page) {
  const f = page.facts;
  const text = [f.title, f.h1.join(' '), f.headings.map((h) => h.text).join(' '), f.bodyText.slice(0, 6000)]
    .join(' ')
    .toLowerCase();
  const set = new Map();
  for (const t of text.split(/[^a-z0-9]+/)) {
    if (t.length < 3 || STOP.has(t)) continue;
    set.set(t, (set.get(t) || 0) + 1);
  }
  return set;
}

const T = pages.map(tokens);
const df = new Map();
for (const t of T) for (const k of t.keys()) df.set(k, (df.get(k) || 0) + 1);
const N = pages.length;

function vec(t) {
  const v = new Map();
  let norm2 = 0;
  for (const [k, c] of t) {
    const w = (1 + Math.log(c)) * Math.log(N / (1 + df.get(k)));
    if (w <= 0) continue;
    v.set(k, w);
    norm2 += w * w;
  }
  const n = Math.sqrt(norm2) || 1;
  for (const [k, w] of v) v.set(k, w / n);
  return v;
}
const V = T.map(vec);

function cosine(a, b) {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, w] of small) if (big.has(k)) s += w * big.get(k);
  return s;
}

const similar = [];
for (let a = 0; a < pages.length; a++) {
  for (let b = a + 1; b < pages.length; b++) {
    const score = cosine(V[a], V[b]);
    // 存到 0.15：内链候选生成需要在 0.18 阈值附近也能取到相似度，聚类仍在 0.45 处切分
    if (score >= 0.15) {
      similar.push({
        a: pages[a].urlPath,
        b: pages[b].urlPath,
        score: Number(score.toFixed(3)),
        sharedTop: [...V[a].keys()].filter((k) => V[b].has(k)).slice(0, 12),
      });
    }
  }
}
similar.sort((x, y) => y.score - x.score);

// 并查集聚类
const parent = new Map(pages.map((p) => [p.urlPath, p.urlPath]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
for (const s of similar.filter((x) => x.score >= 0.45)) {
  const ra = find(s.a);
  const rb = find(s.b);
  if (ra !== rb) parent.set(ra, rb);
}
const clusterMap = new Map();
for (const p of pages) {
  const r = find(p.urlPath);
  if (!clusterMap.has(r)) clusterMap.set(r, []);
  clusterMap.get(r).push(p.urlPath);
}
const clusters = [...clusterMap.values()].filter((c) => c.length > 1);

/* ------------------------------- schema 声明 ------------------------------- */

function flattenSchema(page) {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const t = node['@type'];
    const type = Array.isArray(t) ? t.join('/') : t;
    const scalars = {};
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('@')) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') scalars[k] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) scalars[k] = v;
      else if (v && typeof v === 'object' && (v['@type'] === 'Brand' || v['@type'] === 'Organization') && v.name)
        scalars[k] = v.name;
    }
    if (type && !/ImageObject|PostalAddress|ContactPoint|PropertyValue|Question|Answer|ListItem/.test(String(type))) {
      out.push({ type: String(type), fields: scalars });
    }
    if (type && /PropertyValue/.test(String(type)) && node.name) {
      out.push({ type: 'PropertyValue', fields: { name: node.name, value: node.value } });
    }
    if (type && /ListItem/.test(String(type)) && node.position != null) {
      out.push({ type: 'ListItem', fields: { position: node.position, name: node.name || node.url || '' } });
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  };
  for (const block of page.facts.jsonldBlocks || []) walk(block);
  return out;
}

// 重新用原始 html 解析 JSON-LD 块（extract 里已解析，这里取原始结构）
function jsonLdBlocks(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch { /* 忽略解析失败的块，schema 检查里单独报告 */ }
  }
  return blocks;
}

const schema = pages.map((p) => {
  const withBlocks = { ...p, facts: { ...p.facts, jsonldBlocks: jsonLdBlocks(p.html) } };
  return {
    urlPath: p.urlPath,
    rawBlockCount: jsonLdBlocks(p.html).length,
    parseErrors: (p.html.match(/application\/ld\+json/gi) || []).length - jsonLdBlocks(p.html).length,
    nodes: flattenSchema(withBlocks),
  };
});

/* ------------------------------- 重复文件对 ------------------------------- */

const duplicates = [];
const rootHtml = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.includes('template'));
for (const f of rootHtml) {
  const base = f.replace(/\.html$/, '');
  const dirIndex = join(ROOT, base, 'index.html');
  if (existsSync(dirIndex)) {
    const a = readFileSync(abs(f), 'utf8');
    const b = readFileSync(dirIndex, 'utf8');
    duplicates.push({
      flat: `/${base}.html`,
      nested: `/${base}/index.html`,
      bytesFlat: a.length,
      bytesNested: b.length,
      identical: a === b,
      urlServed: `${SITE}/${base}`,
    });
  }
}

/* ------------------------------- 旧 URL ------------------------------- */

const redirectsRaw = readFileSync(abs('_redirects'), 'utf8');
const legacy = [];
for (const line of redirectsRaw.split('\n')) {
  const s = line.trim();
  if (!s || s.startsWith('#')) continue;
  const m = s.match(/^(\S+)\s+(\S+)\s+(\d{3})$/);
  if (!m) continue;
  legacy.push({ from: m[1], to: m[2], status: Number(m[3]) });
}

/* ------------------------------- 输出 ------------------------------- */

const corpus = {
  builtAt: new Date().toISOString(),
  site: SITE,
  pages: pages.map((p) => {
    const f = p.facts;
    return {
      urlPath: p.urlPath,
      url: p.url,
      slug: p.slug,
      inSitemap: p.inSitemap !== false,
      source: p.source,
      sourceError: p.sourceError,
      title: f.title,
      metaDescription: f.metaDescription,
      canonical: f.canonical,
      h1: f.h1,
      headings: f.headings,
      questionHeadings: f.questionHeadings,
      wordCount: f.wordCount,
      jsonldTypes: f.jsonldTypes,
      imageCount: f.imageCount,
      imageAltCoverage: f.imageAltCoverage,
      internalLinkCount: f.internalLinkCount,
      externalLinkCount: f.externalLinkCount,
      externalHosts: f.externalHosts,
      certifications: f.certifications,
      ctaSignals: f.ctaSignals,
      unitStatHits: f.unitStatHits,
      percentStatHits: f.percentStatHits,
      hasFaq: f.hasFaq,
      dates: f.dates.slice(0, 6),
      yearsMentioned: f.yearsMentioned,
      lang: f.lang,
      ogComplete: f.ogComplete,
      twitterComplete: f.twitterComplete,
      robotsMeta: f.robotsMeta,
      text: f.bodyText.slice(0, 9000),
      textLength: f.textLength,
    };
  }),
  links: edges,
  brokenLinks: brokenLinks.filter(
    (b) =>
      !b.to.startsWith('/id') &&
      !b.to.startsWith('/zh') &&
      !b.to.startsWith('/en') &&
      !b.to.startsWith('/cdn-cgi/'),
  ),
  cdnCgiLinkCount: brokenLinks.filter((b) => b.to.startsWith('/cdn-cgi/')).length,
  orphanCount: orphans.length,
  orphans,
  inlinkCounts: Object.fromEntries(pages.map((p) => [p.urlPath, (inlinks.get(p.urlPath) || []).length])),
  similar,
  clusters,
  schema,
  duplicates,
  legacy,
};

writeFileSync(join(SITE_DIR, 'corpus.json'), JSON.stringify(corpus, null, 2));

console.log(`\n▶ 语料完成`);
console.log(
    `  页面 ${corpus.pages.length}（sitemap 内 ${corpus.pages.filter((p) => p.inSitemap).length}） · 内链边 ${edges.length} · 真断链 ${corpus.brokenLinks.length} · 孤岛页 ${orphans.length}`,
  );
console.log(`  相似对(≥0.3) ${similar.length} · 聚类 ${clusters.length} · 重复文件对 ${duplicates.length} · 旧 URL ${legacy.length}`);
console.log(`  写入 ${relative(ROOT, join(SITE_DIR, 'corpus.json'))}`);
if (clusters.length) console.log(`\n  同质聚类：\n${clusters.map((c) => '   - ' + c.join('  |  ')).join('\n')}`);
if (orphans.length) console.log(`\n  孤岛页：${orphans.join(', ')}`);
