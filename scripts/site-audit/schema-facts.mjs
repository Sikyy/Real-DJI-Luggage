/**
 * 需求 7 的确定性部分：结构化数据里的声明能否在页面上被印证。
 *
 * Jev 负责判断「语义上是否一致」，这里负责可以精确核对的硬事实：
 * 名称是否等于 H1、数量是否对得上、图片是否真的能打开、日期是否合法、
 * 模板常量是否被套用到了不该用的页面。
 *
 *   node scripts/site-audit/schema-facts.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_DIR = join(ROOT, '.seo-geo', 'site');

const corpus = JSON.parse(readFileSync(join(SITE_DIR, 'corpus.json'), 'utf8'));
const pageByPath = new Map(corpus.pages.map((p) => [p.urlPath, p]));

const flat = (obj, out = []) => {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.forEach((o) => flat(o, out));
    return out;
  }
  out.push(obj);
  for (const v of Object.values(obj)) if (v && typeof v === 'object') flat(v, out);
  return out;
};

const readBlocks = (slug) => {
  try {
    const html = readFileSync(join(SITE_DIR, `${slug}.html`), 'utf8');
    const out = [];
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { out.push(JSON.parse(m[1].trim())); } catch { /* 解析失败的块由 corpus 统计 */ }
    }
    return out;
  } catch { return []; }
};
const blocksByPath = new Map(corpus.schema.map((s) => [s.urlPath, readBlocks(pageByPath.get(s.urlPath).slug)]));

const findings = [];
const imageUrls = new Set();

for (const s of corpus.schema) {
  const p = pageByPath.get(s.urlPath);
  const text = p.text.toLowerCase();
  for (const block of blocksByPath.get(s.urlPath) || []) {
    const nodes = flat(block);
    for (const n of nodes) {
      const type = Array.isArray(n['@type']) ? n['@type'][0] : n['@type'];
      if (!type) continue;

      if (type === 'Product') {
        if (n.name && p.h1[0] && n.name.trim() !== p.h1[0].trim()) {
          findings.push({ url: s.urlPath, severity: 'high', kind: 'name-mismatch', detail: `Product.name = "${n.name}"，但页面 H1 = "${p.h1[0]}"` });
        }
        if (n.brand?.name) {
          const brand = n.brand.name;
          if (!text.includes(brand.toLowerCase())) {
            findings.push({ url: s.urlPath, severity: 'high', kind: 'brand-not-on-page', detail: `Product.brand = "${brand}"，但页面上从未出现该品牌名` });
          }
        }
        if (n.material) {
          const words = String(n.material).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
          const missing = words.filter((w) => !text.includes(w));
          if (missing.length) {
            findings.push({
              url: s.urlPath,
              severity: 'high',
              kind: 'material-not-on-page',
              detail: `Product.material = "${n.material}"，但页面正文没有出现：${missing.join('、')}`,
            });
          }
        }
        for (const img of [].concat(n.image || [])) {
          if (typeof img === 'string' && img.startsWith('http')) imageUrls.add(img);
        }
      }

      if (type === 'BlogPosting') {
        if (n.headline && p.h1[0] && n.headline.trim() !== p.h1[0].trim()) {
          findings.push({ url: s.urlPath, severity: 'medium', kind: 'headline-mismatch', detail: `BlogPosting.headline = "${n.headline}"，H1 = "${p.h1[0]}"` });
        }
        const iso = n.datePublished;
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          findings.push({ url: s.urlPath, severity: 'medium', kind: 'bad-date', detail: `BlogPosting.datePublished 不是合法的 ISO 日期：${iso ?? '缺失'}` });
        } else if (new Date(iso) > new Date()) {
          findings.push({ url: s.urlPath, severity: 'high', kind: 'future-date', detail: `datePublished 在未来：${iso}` });
        }
      }

      if (type === 'JobPosting') {
        if (n.title && p.h1[0] && n.title.trim() !== p.h1[0].trim()) {
          findings.push({ url: s.urlPath, severity: 'medium', kind: 'jobtitle-mismatch', detail: `JobPosting.title = "${n.title}"，H1 = "${p.h1[0]}"` });
        }
        if (n.validThrough && new Date(n.validThrough) < new Date()) {
          findings.push({ url: s.urlPath, severity: 'high', kind: 'expired-job', detail: `JobPosting.validThrough 已过期：${n.validThrough}（Google Jobs 会拒收过期职位）` });
        }
      }

      if (type === 'ItemList') {
        const items = flat(n).filter((x) => x['@type'] === 'ListItem');
        if (n.numberOfItems != null && items.length && n.numberOfItems !== items.length) {
          findings.push({
            url: s.urlPath,
            severity: 'high',
            kind: 'itemcount-mismatch',
            detail: `ItemList.numberOfItems = ${n.numberOfItems}，但实际只有 ${items.length} 个 ListItem`,
          });
        }
      }

      if (type === 'Organization') {
        if (n.telephone) {
          const digits = String(n.telephone).replace(/\D/g, '').slice(-8);
          if (digits && !text.replace(/\D/g, '').includes(digits)) {
            findings.push({ url: s.urlPath, severity: 'medium', kind: 'phone-not-on-page', detail: `Organization.telephone = ${n.telephone}，但页面可见文本中找不到该号码（只存在于 wa.me 链接与结构化数据里）` });
          }
        }
      }
    }
  }
}

/* ---- 模板常量检测：同一个值被套用到多少个页面上 ---- */
const constantUsage = (type, field) => {
  const map = new Map();
  for (const s of corpus.schema) {
    for (const block of blocksByPath.get(s.urlPath) || []) {
      for (const n of flat(block)) {
        const t = Array.isArray(n['@type']) ? n['@type'][0] : n['@type'];
        if (t !== type) continue;
        let v = n[field];
        if (v && typeof v === 'object') v = v.name;
        if (typeof v !== 'string') continue;
        if (!map.has(v)) map.set(v, []);
        map.get(v).push(s.urlPath);
      }
    }
  }
  return [...map.entries()]
    .filter(([, urls]) => urls.length > 2)
    .map(([value, urls]) => ({ type, field, value, pageCount: urls.length, sample: urls.slice(0, 4) }))
    .sort((a, b) => b.pageCount - a.pageCount);
};

const templateConstants = [...constantUsage('Product', 'material'), ...constantUsage('Product', 'category'), ...constantUsage('Product', 'brand')];

/* ---- 图片可达性（并发 6） ---- */
const urls = [...imageUrls];
const imageStatus = {};
let idx = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (idx < urls.length) {
      const u = urls[idx++];
      try {
        const res = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(20000) });
        imageStatus[u] = res.status;
      } catch (err) {
        imageStatus[u] = `ERR:${err.name}`;
      }
    }
  }),
);
const brokenImages = Object.entries(imageStatus).filter(([, st]) => st !== 200 && st !== 206);

const out = {
  checkedAt: new Date().toISOString(),
  totalFindings: findings.length,
  bySeverity: findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {}),
  byKind: findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {}),
  findings,
  templateConstants,
  imageChecked: urls.length,
  imageBroken: brokenImages.map(([u, st]) => ({ url: u, status: st })),
};

writeFileSync(join(SITE_DIR, 'schema-facts.json'), JSON.stringify(out, null, 2));

console.log(`▶ schema 硬事实检查完成`);
console.log(`  发现 ${out.totalFindings} 处不一致：${JSON.stringify(out.byKind)}`);
console.log(`  模板常量套用：${templateConstants.map((t) => `${t.type}.${t.field}="${t.value}" × ${t.pageCount} 页`).join('；') || '无'}`);
console.log(`  图片检查 ${out.imageChecked} 个，打不开 ${out.imageBroken.length} 个`);
for (const f of findings.slice(0, 8)) console.log(`   - [${f.severity}] ${f.url} ${f.kind}: ${f.detail}`);
