/**
 * 报告生成：把确定性抽取 + Jev 判断合成一份可读的 HTML。
 * 所有结论都能回溯到「分数」或「事实」之一，不做无依据的推断。
 */

export const SCORE_LABELS = {
  seo_title_meta_fit: '标题/元描述与搜索意图',
  seo_topical_focus: '主题聚焦度',
  seo_heading_outline: '标题层级大纲',
  seo_content_depth: '内容深度（采购决策）',
  seo_trust_evidence: '制造能力实证',
  seo_buyer_next_step: '询盘路径清晰度',
  seo_technical_readiness: '技术就绪度',
  geo_answerability: '直接回答能力',
  geo_entity_clarity: '实体清晰度',
  geo_citability: '可引用事实密度',
  geo_chunkability: '可切分/可摘引性',
  geo_freshness: '时效信号',
  geo_external_validation: '第三方背书',
  geo_ai_source_likelihood: '被 AI 选为来源的可能性',
};

export const NOUL_LABELS = {
  noul_faq_block: 'FAQ / 问答区块',
  noul_concrete_numbers: '具体生产数字',
  noul_certifications: '具名认证',
  noul_b2b_positioning: 'B2B 定位',
  noul_inquiry_path: '询盘途径',
};

const SEO_KEYS = Object.keys(SCORE_LABELS).filter((k) => k.startsWith('seo_'));
const GEO_KEYS = Object.keys(SCORE_LABELS).filter((k) => k.startsWith('geo_'));

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const pct = (v) => Math.round((v / 4) * 100);

function scoreOf(answers, key) {
  const a = answers?.[key];
  return a && typeof a.score === 'number' ? a.score : null;
}
function noulOf(answers, key) {
  const a = answers?.[key];
  return a && typeof a.noul === 'number' ? a.noul : null;
}

function seoAvg(answers) {
  const v = SEO_KEYS.map((k) => scoreOf(answers, k)).filter((x) => x !== null);
  return avg(v);
}
function geoAvg(answers) {
  const v = GEO_KEYS.map((k) => scoreOf(answers, k)).filter((x) => x !== null);
  return avg(v);
}

const band = (v) => (v >= 3.25 ? 'good' : v >= 2.25 ? 'mid' : 'bad');
const bandLabel = (v) => (v >= 3.25 ? '强' : v >= 2.25 ? '中' : '弱');
const bandColor = (v) => (v >= 3.25 ? '#128a5b' : v >= 2.25 ? '#c2820b' : '#c0392b');

function bar(value, max = 4, color) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar"><span style="width:${w.toFixed(1)}%;background:${color || bandColor(value)}"></span></div>`;
}

function noulChip(value) {
  const p = Math.round((value ?? 0) * 100);
  const cls = p >= 70 ? 'yes' : p >= 35 ? 'maybe' : 'no';
  const mark = p >= 70 ? '✓' : p >= 35 ? '~' : '✗';
  return `<span class="chip ${cls}" title="Jev 判定为「是」的概率 ${p}%">${mark} ${p}%</span>`;
}

/* ------------------------------ 因子解释 ------------------------------ */

function buildPageCards(pages, facts, jev) {
  return pages
    .map((p) => {
      const f = facts[p.id];
      const a = jev.pages[p.id] || {};
      const seo = seoAvg(a);
      const geo = geoAvg(a);
      const scoreRows = [...SEO_KEYS, ...GEO_KEYS]
        .map((k) => {
          const v = scoreOf(a, k);
          if (v === null) return '';
          const conf = a[k]?.confidence;
          return `<tr>
            <td class="dim">${esc(SCORE_LABELS[k])}</td>
            <td class="num">${v.toFixed(2)}</td>
            <td class="barcell">${bar(v)}</td>
            <td class="conf">${conf != null ? `${Math.round(conf * 100)}%` : '—'}</td>
          </tr>`;
        })
        .join('');
      const noulRows = Object.keys(NOUL_LABELS)
        .map((k) => {
          const v = noulOf(a, k);
          if (v === null) return '';
          return `<div class="noul"><span class="noul-label">${esc(NOUL_LABELS[k])}</span>${noulChip(v)}</div>`;
        })
        .join('');
      return `<section class="page-card ${p.isOurs ? 'ours' : ''}">
        <header>
          <div>
            <h3>${esc(p.owner)}${p.isOurs ? '<span class="tag own">本站</span>' : ''}</h3>
            <a class="url" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a>
            <p class="note">${esc(p.note)}</p>
          </div>
          <div class="headline-scores">
            <div class="hs"><span class="hs-k">SEO</span><strong style="color:${bandColor(seo)}">${seo.toFixed(2)}</strong><small>/4</small></div>
            <div class="hs"><span class="hs-k">GEO</span><strong style="color:${bandColor(geo)}">${geo.toFixed(2)}</strong><small>/4</small></div>
          </div>
        </header>
        <div class="grid">
          <div>
            <table class="scores">${scoreRows}</table>
            <div class="nouls">${noulRows}</div>
          </div>
          <aside class="facts">
            <h4>代码抽取到的事实</h4>
            <dl>
              <dt>title</dt><dd>${esc(f.title) || '<em>缺失</em>'} <small>(${f.titleLength} 字符)</small></dd>
              <dt>meta description</dt><dd>${esc(f.metaDescription) || '<em>缺失</em>'} <small>(${f.metaDescriptionLength} 字符)</small></dd>
              <dt>H1</dt><dd>${f.h1.map(esc).join(' / ') || '<em>缺失</em>'} <span class="muted">H1×${f.h1Count} H2×${f.h2Count} H3×${f.h3Count}</span></dd>
              <dt>正文词数</dt><dd>${f.wordCount.toLocaleString()}</dd>
              <dt>结构化数据</dt><dd>${f.jsonldTypes.length ? f.jsonldTypes.map((t) => `<code>${esc(t)}</code>`).join(' ') : '<em>无</em>'}</dd>
              <dt>图片 alt 覆盖</dt><dd>${f.imageAltCoverage}% <span class="muted">(${f.imageCount} 张)</span></dd>
              <dt>内链/外链</dt><dd>${f.internalLinkCount} / ${f.externalLinkCount}</dd>
              <dt>认证词命中</dt><dd>${f.certifications.length ? f.certifications.map((c) => `<code>${esc(c)}</code>`).join(' ') : '<em>无</em>'}</dd>
              <dt>数字化事实</dt><dd>${f.unitStatHits} 处带单位数字 · ${f.percentStatHits} 处百分比</dd>
              <dt>FAQ 区块</dt><dd>${f.hasFaq ? '有' : '无'}</dd>
              <dt>询盘信号</dt><dd>${f.ctaSignals.map((c) => `<code>${esc(c)}</code>`).join(' ') || '<em>无</em>'}</dd>
            </dl>
            ${
              f.headings.length
                ? `<details><summary>标题大纲（前 ${Math.min(12, f.headings.length)} 条）</summary><ol class="outline">${f.headings
                    .slice(0, 12)
                    .map((h) => `<li class="lvl${h.level}">${esc(h.text)}</li>`)
                    .join('')}</ol></details>`
                : ''
            }
          </aside>
        </div>
      </section>`;
    })
    .join('');
}

/* ------------------------------ 差距与行动 ------------------------------ */

function buildActionList(pages, facts, jev) {
  const ours = pages.filter((p) => p.isOurs);
  const actions = [];

  for (const p of ours) {
    const a = jev.pages[p.id] || {};
    const peers = pages.filter((q) => q.layer === p.layer && !q.isOurs);
    if (!peers.length) continue;

    // 1) 维度差距
    for (const k of [...SEO_KEYS, ...GEO_KEYS]) {
      const mine = scoreOf(a, k);
      if (mine === null) continue;
      const peerVals = peers.map((q) => scoreOf(jev.pages[q.id] || {}, k)).filter((v) => v !== null);
      if (!peerVals.length) continue;
      const best = Math.max(...peerVals);
      const gap = best - mine;
      if (gap >= 0.75) {
        actions.push({
          layer: p.layer,
          page: p.id,
          kind: mine < 2.25 ? 'p1' : 'p2',
          title: `${p.note}：${SCORE_LABELS[k]} 落后同层最佳 ${gap.toFixed(2)} 分`,
          detail: `本站 ${mine.toFixed(2)}/4，同层竞品最高 ${best.toFixed(2)}/4（${peers
            .filter((q) => scoreOf(jev.pages[q.id] || {}, k) === best)
            .map((q) => q.owner)
            .join('、')}）。`,
        });
      }
    }

    // 2) 布尔能力差距（竞品普遍具备而我方缺失）
    for (const k of Object.keys(NOUL_LABELS)) {
      const mine = noulOf(a, k);
      if (mine === null || mine >= 0.5) continue;
      const peerVals = peers.map((q) => noulOf(jev.pages[q.id] || {}, k)).filter((v) => v !== null);
      const peerYes = peerVals.filter((v) => v >= 0.5).length;
      if (peerYes >= Math.ceil(peerVals.length / 2)) {
        actions.push({
          layer: p.layer,
          page: p.id,
          kind: 'p1',
          title: `${p.note}：缺少「${NOUL_LABELS[k]}」`,
          detail: `Jev 判定本站该页为「否」（${Math.round(mine * 100)}%），同层 ${peerYes}/${peerVals.length} 个竞品页面具备。`,
        });
      }
    }
  }

  // 3) 纯事实型差距（不依赖模型，直接由抽取结果推导）
  for (const p of ours) {
    const f = facts[p.id];
    const peers = pages.filter((q) => q.layer === p.layer && !q.isOurs).map((q) => facts[q.id]);
    if (!peers.length) continue;
    const peerWords = peers.map((x) => x.wordCount).sort((a, b) => a - b);
    const peerMedian = peerWords[Math.floor(peerWords.length / 2)];
    if (f.wordCount < peerMedian * 0.6) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p2',
        title: `${p.note}：正文体量只有同层竞品中位数的 ${Math.round((f.wordCount / peerMedian) * 100)}%`,
        detail: `本站 ${f.wordCount.toLocaleString()} 词 vs 同层中位数 ${peerMedian.toLocaleString()} 词。AI 引擎需要可摘引的实质内容，过短的页面很难被引用。`,
      });
    }
    if (!f.jsonldTypes.length && peers.some((x) => x.jsonldTypes.length)) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p1',
        title: `${p.note}：没有任何 JSON-LD 结构化数据`,
        detail: `竞品已使用 ${[...new Set(peers.flatMap((x) => x.jsonldTypes))].slice(0, 6).join('、')} 等类型。建议至少补 Organization / Product / FAQPage。`,
      });
    }
    if (f.imageAltCoverage < 80) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p2',
        title: `${p.note}：图片 alt 覆盖率仅 ${f.imageAltCoverage}%`,
        detail: `${f.imageCount} 张图中只有 ${Math.round((f.imageAltCoverage / 100) * f.imageCount)} 张有 alt。alt 是多模态检索与图片搜索的入口。`,
      });
    }
    if (!f.hasFaq) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p2',
        title: `${p.note}：没有 FAQ / 问答区块`,
        detail: '问答式区块是 AI 答案最容易被整段摘引的结构，也是 FAQPage 结构化数据的前提。',
      });
    }
    if (!f.certifications.length && peers.some((x) => x.certifications.length)) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p1',
        title: `${p.note}：页面上没有任何具名认证`,
        detail: `竞品页面出现的认证包括 ${[...new Set(peers.flatMap((x) => x.certifications))].slice(0, 8).join('、')}。认证是最容易被 AI 直接引用的信任事实。`,
      });
    }
    const peerStats = peers.map((x) => x.unitStatHits).sort((a, b) => a - b);
    const peerStatMedian = peerStats[Math.floor(peerStats.length / 2)] || 0;
    if (peerStatMedian > 0 && f.unitStatHits < peerStatMedian * 0.4) {
      actions.push({
        layer: p.layer, page: p.id, kind: 'p2',
        title: `${p.note}：可量化事实偏少（${f.unitStatHits} 处带单位数字，同层中位数 ${peerStatMedian} 处）`,
        detail: `竞品页面用产能、尺寸、MOQ、交期等数字来支撑说法。缺少数字的页面在 AI 答案里没有可引用的抓手。`,
      });
    }
  }

  const order = { p1: 0, p2: 1 };
  return actions.sort((a, b) => order[a.kind] - order[b.kind] || a.page.localeCompare(b.page));
}

/* ------------------------------ 主渲染 ------------------------------ */

export function buildReportHtml({ pages, facts, jev, layers, globalQuery, generatedAt }) {
  const bySite = {};
  for (const p of pages) {
    bySite[p.siteName] ||= { owner: p.owner, isOurs: p.isOurs, seo: [], geo: [] };
    const a = jev.pages[p.id] || {};
    bySite[p.siteName].seo.push(seoAvg(a));
    bySite[p.siteName].geo.push(geoAvg(a));
  }
  const siteRows = Object.entries(bySite)
    .map(([name, v]) => ({ name, owner: v.owner, isOurs: v.isOurs, seo: avg(v.seo), geo: avg(v.geo) }))
    .sort((a, b) => b.geo - a.geo || b.seo - a.seo);

  const rankingRows = siteRows
    .map((s, i) => `<tr class="${s.isOurs ? 'ours-row' : ''}">
      <td class="rank">${i + 1}</td>
      <td>${esc(s.name)}${s.isOurs ? '<span class="tag own">本站</span>' : ''}</td>
      <td class="num" style="color:${bandColor(s.seo)}">${s.seo.toFixed(2)}</td>
      <td class="barcell">${bar(s.seo)}</td>
      <td class="num" style="color:${bandColor(s.geo)}">${s.geo.toFixed(2)}</td>
      <td class="barcell">${bar(s.geo)}</td>
    </tr>`)
    .join('');

  const layerSections = layers
    .map((layer) => {
      const inLayer = pages.filter((p) => p.layer === layer.id);
      if (!inLayer.length) return '';
      const rows = inLayer
        .map((p) => {
          const a = jev.pages[p.id] || {};
          const seo = seoAvg(a);
          const geo = geoAvg(a);
          return `<tr class="${p.isOurs ? 'ours-row' : ''}">
            <td>${esc(p.owner)}${p.isOurs ? '<span class="tag own">本站</span>' : ''}</td>
            <td class="num" style="color:${bandColor(seo)}">${seo.toFixed(2)}</td>
            <td class="num" style="color:${bandColor(geo)}">${geo.toFixed(2)}</td>
            <td class="muted small">${esc(p.note)}</td>
          </tr>`;
        })
        .join('');
      const choiceAnswers = jev.layers?.[layer.id] || {};
      const choiceBlocks = Object.entries(choiceAnswers)
        .map(([k, v]) => {
          const label = { best_seo_page: '最佳自然搜索页', best_geo_source: '最可能被 AI 摘引的页', best_trust_evidence: '制造能力证据最强的页' }[k] || k;
          const winner = inLayer.find((p) => p.id === v.choice);
          const probs = Object.entries(v.probabilities || {})
            .filter(([, x]) => x > 0.01)
            .sort((a, b) => b[1] - a[1])
            .map(([id, x]) => {
              const pg = inLayer.find((p) => p.id === id);
              return `<li><span>${esc(pg?.owner || id)}</span><span class="probbar"><i style="width:${(x * 100).toFixed(0)}%"></i></span><b>${Math.round(x * 100)}%</b></li>`;
            })
            .join('');
          return `<div class="choice">
            <h4>${esc(label)}</h4>
            <p class="winner ${winner?.isOurs ? 'win' : 'lose'}">Jev 选择：<strong>${esc(winner?.owner || v.choice)}</strong><span class="muted">置信度 ${Math.round((v.confidence || 0) * 100)}%</span></p>
            <ul class="probs">${probs}</ul>
          </div>`;
        })
        .join('');
      return `<section class="layer">
        <h3>${esc(layer.label)}<span class="muted small">目标查询：${esc(layer.query)}</span></h3>
        <table class="simple"><thead><tr><th>站点</th><th>SEO</th><th>GEO</th><th>对比页</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="choices">${choiceBlocks}</div>
      </section>`;
    })
    .join('');

  const globalAns = jev.global || {};
  const richAns = jev.globalRich || {};
  const globalBlock = globalAns.single_best_source
    ? (() => {
        const renderProbs = (ans, n) =>
          Object.entries(ans.probabilities || {})
            .filter(([, x]) => x > 0.005)
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([id, x]) => {
              const pg = pages.find((p) => p.id === id);
              return `<li><span>${esc(pg?.owner || id)} <span class="muted small">${esc(pg?.note || '')}</span></span><span class="probbar"><i style="width:${(x * 100).toFixed(0)}%"></i></span><b>${Math.round(x * 100)}%</b></li>`;
            })
            .join('');
        const blockFor = (ans, heading, note) => {
          if (!ans?.single_best_source) return '';
          const v = ans.single_best_source;
          const winner = pages.find((p) => p.id === v.choice);
          return `<div class="verify">
            <h4>${esc(heading)}</h4>
            <p class="winner ${winner?.isOurs ? 'win' : 'lose'}">Jev 选择：<strong>${esc(winner?.owner || v.choice)}</strong><span class="muted">置信度 ${Math.round((v.confidence || 0) * 100)}%</span></p>
            <ul class="probs big">${renderProbs(v, 6)}</ul>
            <p class="muted small">${esc(note)}</p>
          </div>`;
        };
        const learn = richAns.our_site_gap_owner
          ? pages.find((p) => p.id === richAns.our_site_gap_owner.choice)
          : globalAns.our_site_gap_owner
            ? pages.find((p) => p.id === globalAns.our_site_gap_owner.choice)
            : null;
        const flip =
          richAns.single_best_source &&
          richAns.single_best_source.choice !== globalAns.single_best_source.choice;
        const disagree = flip
          ? `<p class="caveat">⚠ 两种上下文下结论不一致：短摘要选 <strong>${esc(pages.find((p) => p.id === globalAns.single_best_source.choice)?.owner)}</strong>，给更完整正文后选 <strong>${esc(pages.find((p) => p.id === richAns.single_best_source.choice)?.owner)}</strong>。这说明候选页面差距很小，判断对上下文长度敏感——以长上下文结果为准，但不要把本站的领先当成稳定优势。</p>`
          : `<p class="caveat ok">✓ 两种上下文下结论一致，说明该判断对上下文长度不敏感。</p>`;
        return `<section class="global">
          <h2>核心问题：谁能代工定制铝框行李箱？</h2>
          <p class="query">模拟提问：<em>${esc(globalQuery)}</em></p>
          <div class="verify-grid">
            ${blockFor(globalAns, '短上下文（每页 1,200 字）', '接近搜索引擎摘要级信息量时的判断。')}
            ${blockFor(richAns, '长上下文（每页 4,000 字，复核）', '接近 AI 引擎实际读取整页时的判断。')}
          </div>
          ${disagree}
          ${learn ? `<p class="learn">最值得学习其 AI 可引用做法的竞品站点：<strong>${esc(learn.owner)}</strong> —— ${esc(learn.url)}</p>` : ''}
        </section>`;
      })()
    : '';

  const actions = buildActionList(pages, facts, jev);
  const actionItems = actions
    .map(
      (a) => `<li class="action ${a.kind}">
        <span class="prio">${a.kind === 'p1' ? '必做' : '建议'}</span>
        <div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div>
      </li>`,
    )
    .join('');

  const oursPages = pages.filter((p) => p.isOurs);
  const ourSeo = avg(oursPages.map((p) => seoAvg(jev.pages[p.id] || {})));
  const ourGeo = avg(oursPages.map((p) => geoAvg(jev.pages[p.id] || {})));
  const bestCompetitor = siteRows.find((s) => !s.isOurs);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>djiluggage.id SEO / GEO 对比分析 — ${esc(generatedAt.slice(0, 10))}</title>
<style>
  :root{--bg:#f5f6f8;--card:#fff;--ink:#1c2024;--muted:#6b7280;--line:#e3e6ea;--accent:#1f4fd8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
  .wrap{max-width:1180px;margin:0 auto;padding:32px 22px 80px}
  h1{font-size:26px;margin:0 0 6px}
  h2{font-size:20px;margin:38px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--ink)}
  h3{font-size:16px;margin:0 0 6px}
  h4{font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  .lede{color:var(--muted);margin:0 0 22px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:22px 0}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
  .kpi .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .kpi .v{font-size:28px;font-weight:700;line-height:1.25;margin-top:6px}
  .kpi .s{font-size:12px;color:var(--muted)}
  section.card,section.global,section.layer,.page-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:18px 0}
  .page-card.ours{border-color:#1f4fd8;box-shadow:0 0 0 3px rgba(31,79,216,.07)}
  .page-card>header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
  .url{font-size:12px;color:var(--accent);word-break:break-all;text-decoration:none}
  .note{margin:4px 0 0;font-size:13px;color:var(--muted)}
  .tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;margin-left:8px;vertical-align:middle}
  .tag.own{background:#1f4fd8;color:#fff}
  .headline-scores{display:flex;gap:20px}
  .hs{text-align:right}
  .hs-k{display:block;font-size:11px;color:var(--muted);letter-spacing:.06em}
  .hs strong{font-size:24px}
  .hs small{color:var(--muted)}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
  th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
  td.num{font-variant-numeric:tabular-nums;font-weight:700;width:58px}
  td.rank{color:var(--muted);width:28px}
  td.dim{width:210px}
  td.conf,td.barcell{width:auto}
  td.conf{width:52px;color:var(--muted);font-size:12px;text-align:right}
  .ours-row{background:rgba(31,79,216,.05)}
  .bar{background:#eceef1;border-radius:6px;height:8px;min-width:80px;overflow:hidden}
  .bar span{display:block;height:100%;border-radius:6px}
  .scores{margin-bottom:14px}
  .grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  .facts dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:0;font-size:13px}
  .facts dt{color:var(--muted);white-space:nowrap}
  .facts dd{margin:0;word-break:break-word}
  code{background:#eef1f5;border-radius:4px;padding:1px 5px;font-size:12px}
  .muted{color:var(--muted)}
  .small{font-size:12px}
  .nouls{display:flex;flex-wrap:wrap;gap:10px}
  .noul{display:flex;align-items:center;gap:8px;background:#f7f8fa;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:13px}
  .noul-label{color:var(--muted)}
  .chip{font-weight:700;font-size:12px;padding:1px 7px;border-radius:20px}
  .chip.yes{background:#e3f5ec;color:#0f7a4f}
  .chip.maybe{background:#fdf1dc;color:#9a6700}
  .chip.no{background:#fdeceb;color:#b3261e}
  .outline{margin:8px 0 0;padding-left:18px;font-size:13px}
  .outline .lvl1{font-weight:700}
  .outline .lvl3{color:var(--muted)}
  .choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:16px}
  .choice{background:#fafbfc;border:1px solid var(--line);border-radius:10px;padding:14px}
  .winner{margin:0 0 10px;font-size:13px}
  .winner.win strong{color:#0f7a4f}
  .winner.lose strong{color:#b3261e}
  ul.probs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:12px}
  ul.probs li{display:grid;grid-template-columns:1fr 90px 38px;gap:8px;align-items:center}
  .probbar{background:#e9ecf0;border-radius:4px;height:6px;overflow:hidden;display:block}
  .probbar i{display:block;height:100%;background:#1f4fd8}
  ul.probs b{text-align:right;font-variant-numeric:tabular-nums}
  section.global{background:#111827;color:#f9fafb;border:0}
  section.global h2{border-color:#374151;margin-top:0}
  section.global .query{color:#cbd5e1}
  section.global .muted{color:#94a3b8}
  section.global .probbar{background:#374151}
  section.global .probbar i{background:#60a5fa}
  section.global .winner.win strong{color:#4ade80}
  section.global .winner.lose strong{color:#fca5a5}
  .learn{margin-top:14px;font-size:14px;color:#e5e7eb}
  .verify-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:10px}
  .verify{background:#1f2937;border-radius:10px;padding:14px}
  .verify h4{color:#9ca3af}
  .caveat{margin:16px 0 0;font-size:13px;background:#3f2d0b;border-left:3px solid #f59e0b;padding:10px 12px;border-radius:6px;color:#fde68a}
  .caveat.ok{background:#0d2e1f;border-left-color:#34d399;color:#a7f3d0}
  ul.actions{list-style:none;padding:0;margin:0}
  li.action{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
  li.action:last-child{border-bottom:0}
  li.action .prio{flex:0 0 42px;height:22px;border-radius:6px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff}
  li.action.p1 .prio{background:#b3261e}
  li.action.p2 .prio{background:#9a6700}
  li.action p{margin:3px 0 0;font-size:13px;color:var(--muted)}
  .method{font-size:13px;color:var(--muted)}
  .method code{font-size:12px}
  .legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:8px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
</style>
</head>
<body>
<div class="wrap">
  <h1>djiluggage.id 的 SEO 与 GEO 对比分析</h1>
  <p class="lede">对标对象：行李箱制造业（英文 B2B 工厂/OEM 站点）。分析时间 ${esc(generatedAt.slice(0, 16).replace('T', ' '))} UTC ·
    12 个页面 × 19 个 Jev 判断 + 4 组跨页 Choice · 模型 ${esc(jev.model || 'jev-latest')}</p>

  <div class="kpis">
    <div class="kpi"><div class="k">本站 SEO 均分</div><div class="v" style="color:${bandColor(ourSeo)}">${ourSeo.toFixed(2)}<small style="font-size:14px;color:var(--muted)"> /4</small></div><div class="s">${bandLabel(ourSeo)}（3 页平均）</div></div>
    <div class="kpi"><div class="k">本站 GEO 均分</div><div class="v" style="color:${bandColor(ourGeo)}">${ourGeo.toFixed(2)}<small style="font-size:14px;color:var(--muted)"> /4</small></div><div class="s">${bandLabel(ourGeo)}（3 页平均）</div></div>
    <div class="kpi"><div class="k">GEO 最高竞品</div><div class="v">${esc(bestCompetitor?.name || '—')}</div><div class="s">GEO ${bestCompetitor ? bestCompetitor.geo.toFixed(2) : '—'} / SEO ${bestCompetitor ? bestCompetitor.seo.toFixed(2) : '—'}</div></div>
    <div class="kpi"><div class="k">待办建议</div><div class="v">${actions.length}</div><div class="s">其中必做 ${actions.filter((a) => a.kind === 'p1').length} 条</div></div>
  </div>

  ${globalBlock}

  <h2>1. 站点总分排行</h2>
  <section class="card">
    <table class="simple">
      <thead><tr><th></th><th>站点</th><th>SEO</th><th></th><th>GEO</th><th></th></tr></thead>
      <tbody>${rankingRows}</tbody>
    </table>
    <div class="legend">
      <span><i style="background:#128a5b"></i>强 ≥3.25</span>
      <span><i style="background:#c2820b"></i>中 2.25–3.25</span>
      <span><i style="background:#c0392b"></i>弱 &lt;2.25</span>
      <span>分数为 Jev 在 0–4 级评分标准上的概率加权值</span>
    </div>
  </section>

  <h2>2. 分层对比与 Jev 的跨页判断</h2>
  ${layerSections}

  <h2>3. 行动清单</h2>
  <section class="card">
    <ul class="actions">${actionItems || '<li class="action"><div>暂无显著差距。</div></li>'}</ul>
  </section>

  <h2>4. 逐页明细</h2>
  ${buildPageCards(pages, facts, jev)}

  <h2>5. 方法论</h2>
  <section class="card method">
    <p><strong>分工：</strong>能精确计算的事实（标题/元描述长度、标题层级、JSON-LD 类型、图片 alt 覆盖率、内外链、认证词与数字化事实命中、日期信号）由 <code>scripts/seo-geo/extract.mjs</code> 用代码抽取；「这对买家、对 AI 意味着什么」这一类判断交给 Jev（TypeSafe <code>${esc(jev.model || 'jev-latest')}</code>）。</p>
    <p><strong>提问方式：</strong>每页 14 个 Score（7 个 SEO 维度 + 7 个 GEO 维度）+ 5 个 Noul（FAQ 区块、具体生产数字、具名认证、B2B 定位、询盘途径），全部放进一次请求批量提问；跨页对比另外用 Choice 问题，每层 3 个、全局 1 个。Score 取值 0–4，报告中按等级色带呈现。</p>
    <p><strong>可复现：</strong><code>node scripts/seo-geo/run.mjs</code>；<code>--refresh</code> 重新抓线上页，<code>--reuse-jev</code> 复用上次模型答案只重出报告，<code>--only-fetch</code> 只抓取与抽取。原始数据见同目录 <code>.json</code>。</p>
    <p><strong>注意：</strong>页面内容会随时间变化，Jev 的判断基于抓取当刻的正文；分数是决策辅助信号，不是排名承诺。行动清单里的事实型条目（词数、alt、JSON-LD、认证词）与模型判断相互独立，可单独核验。</p>
  </section>
</div>
</body>
</html>`;
}
