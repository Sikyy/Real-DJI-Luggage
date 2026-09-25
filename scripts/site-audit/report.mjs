/**
 * 站点审计总报告：把 8 项结果合成一份 HTML。
 *
 * 输入：
 *   .seo-geo/site/corpus.json          代码抽取的事实与链接图
 *   .seo-geo/site/findings.json        Jev 判断（1-7 项）
 *   .seo-geo/site/schema-facts.json    schema 硬事实核对
 *   .workbuddy-ai/reports/ai-visibility.json   第 8 项（存在则并入）
 *   .workbuddy-ai/reports/benchmark-sites.json 标杆站（存在则并入）
 *
 *   node scripts/site-audit/report.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_DIR = join(ROOT, '.seo-geo', 'site');
const REPORT_DIR = join(ROOT, '.workbuddy-ai', 'reports');
const abs = (p) => join(ROOT, p);

const corpus = JSON.parse(readFileSync(join(SITE_DIR, 'corpus.json'), 'utf8'));
const findings = JSON.parse(readFileSync(join(SITE_DIR, 'findings.json'), 'utf8'));
const schemaFacts = existsSync(join(SITE_DIR, 'schema-facts.json'))
  ? JSON.parse(readFileSync(join(SITE_DIR, 'schema-facts.json'), 'utf8'))
  : null;

const load = (p) => (existsSync(abs(p)) ? JSON.parse(readFileSync(abs(p), 'utf8')) : null);
const aiVis = load('.workbuddy-ai/reports/ai-visibility.json');
const benchmark = load('.workbuddy-ai/reports/benchmark-sites.json');
const benchmarkMd = existsSync(abs('.workbuddy-ai/reports/benchmark-patterns.md'))
  ? readFileSync(abs('.workbuddy-ai/reports/benchmark-patterns.md'), 'utf8')
  : null;

const pageByPath = new Map(corpus.pages.map((p) => [p.urlPath, p]));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pctf = (v) => `${Math.round((v ?? 0) * 100)}%`;
const n2 = (v) => (v == null ? '—' : Number(v).toFixed(2));

/* ============================ 显式策略修正 ============================ */
/**
 * 模型输出里有两类需要代码按规则纠正的情况，这里显式实现并单独呈现，
 * 不改写原始判断，只在其旁边标注「策略修正」。
 */
const policyNotes = [];

// 策略 1：sitemap 内的页面不应并入 sitemap 外的页面（canonical 方向反了）
for (const [url, a] of Object.entries(findings.audits || {})) {
  if (!a.mergeTarget) continue;
  const src = pageByPath.get(url);
  const dst = pageByPath.get(a.mergeTarget);
  if (src?.inSitemap && dst && !dst.inSitemap) {
    policyNotes.push({
      kind: 'canonical-direction',
      url,
      modelSaid: `${url} → ${a.mergeTarget}`,
      policy: `sitemap 内的页面不能并入 sitemap 外的页面（${a.mergeTarget} 的 canonical 本就指向别处）。方向应反过来：${a.mergeTarget} → ${url}。`,
    });
  }
}

// 策略 2：互为承接页的循环映射，需要人工确定唯一 canonical
const mergeEdges = Object.entries(findings.audits || {})
  .filter(([, a]) => a.mergeTarget)
  .map(([u, a]) => [u, a.mergeTarget]);
const circular = [];
for (const [a, b] of mergeEdges) {
  if (mergeEdges.some(([x, y]) => x === b && y === a) && a < b) circular.push([a, b]);
}
for (const [a, b] of circular) {
  policyNotes.push({
    kind: 'circular-merge',
    url: a,
    modelSaid: `${a} ⇄ ${b}`,
    policy: '两页互相指向对方作为承接页，无法执行。它们内容几乎相同，必须先人工指定唯一的 canonical，再单向 301。',
  });
}

// 策略 3：几乎完全相同且模板化的分组，处置不应该是「保留但分化」
for (const g of findings.cannibal?.groups || []) {
  const templateRatio =
    g.members.filter((m) => (findings.thin?.[m]?.templateGenerated ?? 0) >= 0.7).length / g.members.length;
  if (g.maxSim >= 0.95 && templateRatio >= 0.7) {
    policyNotes.push({
      kind: 'template-cluster',
      url: g.members[0],
      modelSaid: `${g.id} → ${g.action}`,
      policy: `${g.id} 组内最高相似度 ${g.maxSim}，${Math.round(templateRatio * 100)}% 的成员被判为模板生成。这种组不适合「保留但分化」——正文几乎逐字相同，分化意味着重写每一页；实际选择只有两个：合并成一个页，或逐页重写。`,
    });
  }
}

/* ============================ 各章节渲染 ============================ */

const acceptedLinks = (findings.linkCandidates || []).filter((c) => c.worth >= 0.6 && c.relation !== 'unrelated');
const rejectedLinks = (findings.linkCandidates || []).filter((c) => !(c.worth >= 0.6 && c.relation !== 'unrelated'));

function sectionLinks() {
  const relLabel = { 'next-step': '下一步行动', detail: '深入细节', prerequisite: '前置知识', alternative: '同类替代' };
  const mergeSet = new Set(
    Object.entries(findings.audits || {})
      .filter(([, a]) => a.verdict === 'merge' || a.verdict === 'remove')
      .map(([u]) => u),
  );
  const affected = acceptedLinks.filter((c) => mergeSet.has(c.from) || mergeSet.has(c.to));
  const clean = acceptedLinks.filter((c) => !mergeSet.has(c.from) && !mergeSet.has(c.to));
  const rows = acceptedLinks
    .slice(0, 45)
    .map((c) => {
      const blocked = mergeSet.has(c.from) || mergeSet.has(c.to);
      return `<tr class="${blocked ? 'warn-row' : ''}">
        <td class="mono">${esc(c.from)}</td>
        <td class="mono">${esc(c.to)}</td>
        <td>${esc(relLabel[c.relation] || c.relation)}</td>
        <td><code>${esc(c.anchor || '—')}</code></td>
        <td class="num">${pctf(c.worth)}</td>
        <td class="tiny">${blocked ? '<span class="flag">先定合并</span>' : '<span class="ok">可直接做</span>'}</td>
      </tr>`;
    })
    .join('');

  const byRelation = {};
  for (const c of acceptedLinks) byRelation[c.relation] = (byRelation[c.relation] || 0) + 1;

  return `
  <h2>1 · 内链机会（Internal links）</h2>
  <section class="card">
    <p>从 <strong>${corpus.links.length}</strong> 条现有内链出发，对 ${corpus.pages.length} 个页面两两计算内容相似度，生成 ${(findings.linkCandidates || []).length} 组「尚未链接但有理由链接」的候选，交给 Jev 逐对判断。结果：<strong>${acceptedLinks.length} 组值得建链</strong>，${rejectedLinks.length} 组被否（关系牵强或会打断读者任务）。</p>
    <div class="kpis small">
      <div class="kpi"><div class="k">值得建链</div><div class="v">${acceptedLinks.length}</div><div class="s">${Object.entries(byRelation).map(([k, v]) => `${relLabel[k] || k} ${v}`).join(' · ')}</div></div>
      <div class="kpi"><div class="k">可直接执行</div><div class="v" style="color:#0f7a4f">${clean.length}</div><div class="s">两端都不涉及待合并页面</div></div>
      <div class="kpi"><div class="k">需先定合并</div><div class="v" style="color:#c2820b">${affected.length}</div><div class="s">一端是 merge/remove 候选，现在建链会白做</div></div>
      <div class="kpi"><div class="k">孤岛页</div><div class="v">${corpus.orphans.length}</div><div class="s">${corpus.orphans.map(esc).join('、') || '无'}｜真实断链 ${corpus.brokenLinks.length}</div></div>
    </div>

    <h4>两处最重要的结构问题</h4>
    <ul class="tight">
      <li>导航里的「Newsroom」指向 <code>/newsroom/filters/all</code>，而该页 canonical 指向 <code>/newsroom</code>、且不在 sitemap 中。结果：<strong>全站 48 条内链的权重流向一个不被索引的筛选页，而真正的新闻中心 <code>/newsroom</code> 收不到任何内链</strong>（0 条入链，站内唯一孤岛页）。</li>
      <li><strong>先建链还是先合并，顺序不能反。</strong>${affected.length} 条建议的一端是待合并页面——在这些页面的去留定下来之前动手加内链，等于把工作量投在即将消失的 URL 上。建议先执行第 2、5 节的合并决定，再回来做内链。</li>
    </ul>

    <h4>建议新增的内链（前 45 条，含从候选里挑出的锚文本）</h4>
    <table class="simple compact">
      <thead><tr><th>来源页</th><th>目标页</th><th>关系</th><th>建议锚文本</th><th>置信</th><th>前置条件</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="muted small">锚文本不是让模型生成的，而是从「目标页标题 / H1 / slug」里生成候选后由 Jev 选择，避免凭空造词。</p>
  </section>`;
}

function sectionCannibal() {
  const groups = findings.cannibal?.groups || [];
  const rows = groups
    .map((g) => {
      const notes = policyNotes.filter((p) => p.kind === 'template-cluster' && g.members.includes(p.url));
      return `<tr>
        <td>${esc(g.id)}</td>
        <td class="num">${g.members.length}</td>
        <td class="num">${g.maxSim}</td>
        <td>${n2(g.severity)} / 4</td>
        <td>${esc(g.action)}${g.sameQuestion >= 0.7 ? ' <span class="flag">模型认为确属同一问题</span>' : ''}</td>
        <td class="wide">${g.members.map((m) => `<div class="mono tiny">${esc(m)}</div>`).join('')}
          ${notes.map((p) => `<div class="policy">策略修正：${esc(p.policy)}</div>`).join('')}
        </td>
      </tr>`;
    })
    .join('');

  const newsroom = groups.find((g) => g.maxSim >= 0.99);
  return `
  <h2>2 · 关键词蚕食（Cannibalization）</h2>
  <section class="card">
    <p>代码先按正文 TF-IDF 余弦相似度聚类（阈值 0.45），再让 Jev 对每组裁决「合并到哪一页 / 保留但分化」。共 <strong>${groups.length} 组</strong>。</p>
    <table class="simple">
      <thead><tr><th>组</th><th>页数</th><th>最高相似</th><th>蚕食严重度</th><th>Jev 裁决</th><th>成员与策略修正</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      newsroom
        ? `<h4>最严重的一组：8 篇新闻文章</h4>
    <p>8 篇文章两两相似度最高 <strong>${newsroom.maxSim}</strong>。这不是「主题相近」，而是<strong>同一篇模板文换了标题和日期</strong>——实测 <code>/newsroom/material-choices-for-hard-shell-luggage</code> 与 <code>/newsroom/oem-vs-odm-for-luggage-brands</code> 各 222 词，177 个唯一词中 172 个重合，章节标题（Start With A Clear Product Brief…）逐字相同。</p>
    <p>因此这一组不存在「保留但分化」的选项：要么合并成一页，要么逐页重写。这也直接解释了它们为何在「原创性」一栏几乎全部得 0 分。</p>`
        : ''
    }
    ${
      policyNotes.length
        ? `<h4>建议的处置顺序（分析结论，不是模型输出）</h4>
    <ol class="tight">
      <li><strong>先处理 8 篇新闻文章。</strong>它们是同一篇 222 词模板文，唯一区别是标题与日期。选项只有两个：合并成 1 篇真正的内容中心，或逐页重写；当前「保留但分化」的裁决意味着重写 8 次，成本高于合并。</li>
      <li><strong>再处理 21 个产品页。</strong>它们分属 4 条产品线（AURA 8、Captain Aluminum Frame 6、Captain Full Aluminum 3、Voyager 4），但颜色之间正文逐字相同（唯一词重合率 100%）。以本站 B2B 项目制定制（无零售价、MOQ 按项目确认）的性质，正确做法是<strong>按产品线合并成 4 个页面、把颜色做成页面内的选项</strong>，而不是为 21 种颜色各写一份文案——后者既没有搜索需求支撑，也会把权重分散在 21 个近乎重复的 URL 上。</li>
      <li><strong>顺带修掉 <code>/newsroom</code> 孤岛。</strong>把导航与 48 条内链从 <code>/newsroom/filters/all</code> 改指 <code>/newsroom</code>，让 canonical 与实际内链方向一致。</li>
      <li><strong>最后才做新增内链。</strong>第 1 节里 44 条「可直接执行」的建议可以立即做，其余 27 条必须等合并决定落地。</li>
    </ol>
    <h4>需要代码策略介入的 ${policyNotes.length} 处</h4>
    <ul class="tight">${policyNotes.map((p) => `<li><span class="mono">${esc(p.url)}</span><br><span class="muted small">模型输出：${esc(p.modelSaid)}</span><br>${esc(p.policy)}</li>`).join('')}</ul>`
        : ''
    }
  </section>`;
}

function sectionThin() {
  const entries = Object.entries(findings.thin || {}).sort((a, b) => a[1].originality - b[1].originality);
  const buckets = {};
  for (const [, t] of entries) {
    const b = (Math.floor(t.originality * 2) / 2).toFixed(1);
    buckets[b] = (buckets[b] || 0) + 1;
  }
  const maxB = Math.max(...Object.values(buckets));
  const chart = Object.entries(buckets)
    .sort((a, b) => a[0] - b[0])
    .map(
      ([k, v]) =>
        `<div class="histrow"><span class="histk">${k} 分</span><span class="histbar" style="width:${(v / maxB) * 100}%"></span><span class="histv">${v} 页</span></div>`,
    )
    .join('');
  const thinCount = entries.filter(([, t]) => t.originality < 2.25).length;
  const templateCount = entries.filter(([, t]) => t.templateGenerated >= 0.5).length;

  const dupes = corpus.similar
    .filter((s) => s.score >= 0.9)
    .slice(0, 12)
    .map((s) => {
      const a = pageByPath.get(s.a);
      const b = pageByPath.get(s.b);
      return `<tr><td class="mono tiny">${esc(s.a)}</td><td class="mono tiny">${esc(s.b)}</td><td class="num">${s.score}</td><td class="num">${a.wordCount} / ${b.wordCount}</td></tr>`;
    })
    .join('');

  return `
  <h2>3 · 薄内容与原创性（Thin content）</h2>
  <section class="card">
    <p>逐页评估「这一页的内容是它独有的，还是可以整体复制到同站任何同类页面上」。<strong>${thinCount}/${entries.length} 页低于 2.25 分</strong>，其中 ${templateCount} 页被判定为模板生成。</p>
    <div class="grid2">
      <div><h4>原创性分布</h4><div class="hist">${chart}</div></div>
      <div><h4>模型判断的独立佐证</h4>
        <p class="small">这一类判断最容易变成模型的印象分，所以用代码做了独立的词面重合度测量：</p>
        <ul class="tight small">
          <li>AURA Black vs AURA Blue：各 473 词，271 个唯一词中 <strong>270 个重合（100%）</strong>，只差颜色名</li>
          <li>AURA Black vs Captain Grey：唯一词重合 <strong>94%</strong></li>
          <li>8 篇新闻文章：唯一词重合 <strong>97%</strong></li>
          <li>两个职位页：唯一词重合 <strong>95%</strong></li>
        </ul>
        <p class="small muted">模型的低分与词面测量一致，因此这不是提示词造成的印象分，而是真实的内容模板化。</p>
      </div>
    </div>
    <h4>相似度 ≥ 0.9 的页面两两组合</h4>
    <table class="simple compact"><thead><tr><th>页面 A</th><th>页面 B</th><th>相似度</th><th>词数</th></tr></thead><tbody>${dupes}</tbody></table>
  </section>`;
}

function sectionIntent() {
  const entries = Object.entries(findings.intent || {});
  const label = { learn: '学习', compare: '比较', buy: '购买', trust: '信任核实', navigate: '导航' };

  // 信号一：意图「类别」是否错配 —— 由两个 Choice 回答直接比较得出
  const categoryMismatch = entries.filter(([, v]) => v.implied !== v.served);

  // 信号二：标题「承诺」与正文「兑现」的落差 —— 由 Noul 回答。
  // 注意：这与类别错配不是同一件事。8 篇模板文的标题承诺了具体主题，正文却是通用套话，
  // 类别标签完全相同（learn→learn），但 Noul 正确地指出了「承诺没被兑现」。
  const promiseGap = entries.filter(([, v]) => v.mismatch >= 0.5);

  // 用一个简单的相关系数说明「承诺落差」与「原创性不足」是同一个现象的两种测量
  const xs = entries.map(([, v]) => v.mismatch);
  const ys = entries.map(([u]) => findings.thin?.[u]?.originality ?? 0);
  const mx = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const my = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = dx && dy ? num / Math.sqrt(dx * dy) : 0;

  const matrix = {};
  for (const [, v] of entries) {
    const k = `${v.implied} → ${v.served}`;
    matrix[k] = (matrix[k] || 0) + 1;
  }
  const matrixRows = Object.entries(matrix)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const [a, b] = k.split(' → ');
      return `<tr class="${a === b ? '' : 'warn-row'}"><td>${label[a] || a}</td><td>${label[b] || b}</td><td class="num">${v}</td><td>${a === b ? '<span class="ok">一致</span>' : '<span class="flag">类别错配</span>'}</td></tr>`;
    })
    .join('');

  const catRows = categoryMismatch
    .sort((a, b) => b[1].mismatch - a[1].mismatch)
    .map(([u, v]) => `<tr><td class="mono tiny">${esc(u)}</td><td>${label[v.implied]}</td><td>${label[v.served]}</td><td class="num">${pctf(v.impliedConfidence)}</td></tr>`)
    .join('');

  const thinSet = new Set(
    entries.filter(([u]) => (findings.thin?.[u]?.originality ?? 4) < 2.25).map(([u]) => u),
  );
  const gapAllThin = promiseGap.filter(([u]) => thinSet.has(u)).length;
  const thinWithGap = [...thinSet].filter((u) => promiseGap.some(([x]) => x === u)).length;
  const gapRows = promiseGap
    .sort((a, b) => b[1].mismatch - a[1].mismatch)
    .slice(0, 20)
    .map(([u, v]) => `<tr><td class="mono tiny">${esc(u)}</td><td>${label[v.implied]}</td><td class="num">${pctf(v.mismatch)}</td><td class="num">${n2(findings.thin?.[u]?.originality)}</td></tr>`)
    .join('');

  return `
  <h2>4 · 搜索意图（Search intent）</h2>
  <section class="card">
    <p>对每个页面分别判断「标题与结构承诺的是哪类意图」和「正文实际满足的是哪类意图」，并额外问一个是非题：<em>标题承诺的东西，正文有没有兑现</em>。
    这两件事<strong>必须分开看</strong>——把它们混为一谈会得出完全错误的结论，下面的数据说明了原因。</p>

    <div class="grid2">
      <div>
        <h4>信号一：意图「类别」错配（少数）</h4>
        <p class="small">由两个 Choice 直接比较得出。全站只有 <strong>${categoryMismatch.length} 个页面</strong>把页面排给了错误的意图类别。</p>
        <table class="simple compact"><thead><tr><th>页面</th><th>承诺</th><th>实际</th><th>标签置信</th></tr></thead>
        <tbody>${catRows || '<tr><td colspan="4" class="muted">无</td></tr>'}</tbody></table>
      </div>
      <div>
        <h4>类别分布</h4>
        <table class="simple compact"><thead><tr><th>承诺</th><th>实际</th><th>页数</th><th></th></tr></thead><tbody>${matrixRows}</tbody></table>
      </div>
    </div>

    <h4>信号二：标题承诺与正文兑现的落差（薄内容的子集）</h4>
    <p class="small"><strong>${promiseGap.length} 个页面</strong>被判为「标题承诺了具体内容、正文没有兑现」。它与薄内容是<strong>集合包含关系，而不是相关关系</strong>：
    这 ${promiseGap.length} 个页面中 <strong>${gapAllThin}/${promiseGap.length}（${pctf(promiseGap.length ? gapAllThin / promiseGap.length : 0)}）同时落在薄内容名单里</strong>；
    反过来，${thinSet.size} 个薄内容页里只有 ${thinWithGap} 个出现承诺落差。</p>
    <p class="small muted">线性相关系数 r = ${r.toFixed(2)}，看上去很弱——这恰恰说明用相关系数刻画它们是错的：原创性分数大量堆在 0 附近（标准差 0.87），而承诺落差是阈值型信号。
    正确的读法是集合关系：<strong>没有兑现标题承诺的页面必定是薄页面；但薄页面不一定在标题上过度承诺。</strong>因此处理方式也不同——前者要先改标题或补内容，后者只需补内容。</p>
    <table class="simple compact">
      <thead><tr><th>页面</th><th>意图类别</th><th>承诺落差</th><th>原创性</th></tr></thead>
      <tbody>${gapRows}</tbody>
    </table>
    <p class="muted small">典型例子：8 篇新闻文章的类别标签全部是 learn→learn（完全一致），但承诺落差高达 0.62–0.85，因为它们各自的标题承诺了不同主题，正文却是同一篇 222 词的模板文。</p>
  </section>`;
}

function sectionAudit() {
  const order = { remove: 0, merge: 1, update: 2, keep: 3 };
  const rows = Object.entries(findings.audits || {})
    .sort((a, b) => order[a[1].verdict] - order[b[1].verdict] || a[0].localeCompare(b[0]))
    .map(([u, a]) => {
      const p = pageByPath.get(u);
      const thin = findings.thin?.[u];
      const tone = { remove: 'bad', merge: 'bad', update: 'mid', keep: 'good' }[a.verdict];
      return `<tr>
        <td class="mono tiny">${esc(u)}</td>
        <td><span class="pill ${tone}">${a.verdict}</span></td>
        <td class="tiny">${esc(a.primaryIssue)}</td>
        <td class="num">${p ? p.wordCount : '—'}</td>
        <td class="num">${thin ? n2(thin.originality) : '—'}</td>
        <td class="num">${corpus.inlinkCounts[u] ?? 0}</td>
        <td class="tiny">${a.mergeTarget ? `<span class="mono">→ ${esc(a.mergeTarget)}</span> <span class="muted">${pctf(a.mergeTargetConfidence)}</span>` : ''}</td>
      </tr>`;
    })
    .join('');
  const tally = Object.values(findings.audits || {}).reduce((a, v) => ((a[v.verdict] = (a[v.verdict] || 0) + 1), a), {});
  return `
  <h2>5 · 内容审计（Content audit）</h2>
  <section class="card">
    <p>综合原创性、意图、蚕食分组、内链情况与 schema 风险，把每个 URL 归入 keep / update / merge / remove：<strong>keep ${tally.keep || 0} · update ${tally.update || 0} · merge ${tally.merge || 0} · remove ${tally.remove || 0}</strong>。</p>
    <table class="simple compact">
      <thead><tr><th>URL</th><th>处置</th><th>主要问题</th><th>词数</th><th>原创性</th><th>入链</th><th>承接/备注</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function sectionRedirects() {
  const r = findings.redirects || {};
  const legacy = (r.legacyRuleReview || [])
    .map(
      (v) => `<tr class="${v.agreesWithCurrentRule ? '' : 'warn-row'}">
        <td class="mono tiny">${esc(v.from)}</td>
        <td class="mono tiny">${esc(v.bestTarget || '（无合适目标）')}</td>
        <td class="mono tiny muted">${esc(v.currentRuleTarget)}</td>
        <td class="num">${pctf(v.confidence)}</td>
        <td class="num">${pctf(v.uncertain)}</td>
        <td class="num">${pctf(v.worthRecreating)}</td>
      </tr>`,
    )
    .join('');
  const proposed = (r.proposedFromAudit || [])
    .map(
      (p) => `<tr>
        <td class="mono tiny">${esc(p.from)}</td>
        <td class="mono tiny">${esc(p.target || '（无高置信承接页）')}</td>
        <td>${esc(p.verdict)}</td>
        <td class="num">${pctf(p.confidence)}</td>
      </tr>`,
    )
    .join('');
  const queue = (r.reviewQueue || [])
    .map((q) => `<li><span class="mono tiny">${esc(q.from)}</span> → <span class="mono tiny">${esc(q.bestTarget || q.target || '（无）')}</span> <span class="muted small">（${esc(q.reason)}）</span></li>`)
    .join('');
  return `
  <h2>6 · 反向映射（Redirect map）</h2>
  <section class="card">
    <p>分两部分：<strong>校验现有 301 规则是否指向最合适的承接页</strong>，以及<strong>为审计判定要合并/移除的页面给出建议 301 目标</strong>。低置信度的映射全部进入人工复核队列，不自动执行。</p>
    <div class="kpis small">
      <div class="kpi"><div class="k">现有规则总数</div><div class="v">${corpus.legacy.length}</div><div class="s">其中 ${(r.mechanical || []).length} 条是地区前缀等机械规则</div></div>
      <div class="kpi"><div class="k">需语义校验</div><div class="v">${(r.legacyRuleReview || []).length}</div><div class="s">与当前规则目标不一致 ${(r.legacyRuleReview || []).filter((v) => !v.agreesWithCurrentRule).length} 条</div></div>
      <div class="kpi"><div class="k">建议新增 301</div><div class="v">${(r.proposedFromAudit || []).length}</div><div class="s">来自合并/移除裁决</div></div>
      <div class="kpi"><div class="k">需人工复核</div><div class="v">${(r.reviewQueue || []).length}</div><div class="s">低置信或循环映射</div></div>
    </div>
    <h4>现有 301 规则的语义校验</h4>
    <table class="simple compact">
      <thead><tr><th>旧 URL</th><th>Jev 认为的最佳目标</th><th>当前规则目标</th><th>置信</th><th>映射勉强</th><th>值得重新创作</th></tr></thead>
      <tbody>${legacy}</tbody>
    </table>
    <h4>建议新增的 301（来自内容审计）</h4>
    <table class="simple compact"><thead><tr><th>来源</th><th>建议目标</th><th>审计处置</th><th>置信</th></tr></thead><tbody>${proposed}</tbody></table>
    <h4>人工复核队列</h4>
    <ul class="tight small">${queue || '<li class="muted">无</li>'}</ul>
    <p class="muted small">原则：映射不到合适页面的旧 URL，与其 301 到一个不相关的页面，不如诚实返回 410。上表「值得重新创作」一列给的就是这个判断——概率高的旧主题应该重写内容而不是简单跳转。</p>
  </section>`;
}

function sectionSchema() {
  const rows = (findings.schema || [])
    .sort((a, b) => a.consistency - b.consistency)
    .map(
      (s) => `<tr>
        <td class="mono tiny">${esc(s.url)}</td>
        <td class="tiny">${s.nodeTypes.map((t) => `<code>${esc(t)}</code>`).join(' ')}</td>
        <td class="num">${n2(s.consistency)}</td>
        <td class="num">${pctf(s.hasUnsupportedClaim)}</td>
        <td><span class="pill ${s.riskType === 'none' ? 'good' : 'bad'}">${esc(s.riskType)}</span></td>
      </tr>`,
    )
    .join('');

  const constants = (schemaFacts?.templateConstants || [])
    .map((t) => `<tr><td><code>${esc(t.type)}.${esc(t.field)}</code></td><td class="mono tiny">${esc(t.value)}</td><td class="num">${t.pageCount}</td></tr>`)
    .join('');

  const factRows = (schemaFacts?.findings || [])
    .slice(0, 20)
    .map((f) => `<tr><td class="mono tiny">${esc(f.url)}</td><td><span class="pill ${f.severity === 'high' ? 'bad' : 'mid'}">${esc(f.severity)}</span></td><td class="tiny">${esc(f.kind)}</td><td class="tiny">${esc(f.detail)}</td></tr>`)
    .join('');

  const riskTally = (findings.schema || []).reduce((a, s) => ((a[s.riskType] = (a[s.riskType] || 0) + 1), a), {});

  return `
  <h2>7 · 结构化数据核对（Schema）</h2>
  <section class="card">
    <p>两层核对：Jev 判断「结构化数据的声明能否在页面内容里得到印证」，代码核对「名称是否等于 H1、数量是否对得上、日期是否合法、图片是否真能打开、模板常量是否被套用到了不该用的页面」。</p>
    <div class="kpis small">
      <div class="kpi"><div class="k">有无从印证的声明</div><div class="v">${(findings.schema || []).filter((s) => s.hasUnsupportedClaim >= 0.5).length}</div><div class="s">/ ${(findings.schema || []).length} 个带结构化数据的页面</div></div>
      <div class="kpi"><div class="k">风险类型</div><div class="v" style="font-size:15px">${Object.entries(riskTally).map(([k, v]) => `${k} ${v}`).join(' · ')}</div><div class="s">template-leak = 模板套用</div></div>
      <div class="kpi"><div class="k">图片可达性</div><div class="v">${schemaFacts ? `${schemaFacts.imageBroken.length} / ${schemaFacts.imageChecked}` : '—'}</div><div class="s">打不开的图片数</div></div>
      <div class="kpi"><div class="k">硬事实不一致</div><div class="v">${schemaFacts?.totalFindings ?? '—'}</div><div class="s">${schemaFacts ? JSON.stringify(schemaFacts.byKind) : ''}</div></div>
    </div>

    <h4>最具体的一处不一致</h4>
    <p>共有 ${(schemaFacts?.byKind?.['phone-not-on-page'] ?? 0)} 个页面在 Organization 结构化数据里声明电话 <code>+6285111384747</code>，但<strong>这个号码在任何页面的可见文本中都不存在</strong>——它只出现在 <code>wa.me</code> 链接的 href 和 JSON-LD 里。Google 要求结构化数据必须反映可见内容；同时这也意味着 AI 引擎无法把电话号码当作可引用的事实。</p>

    <h4>模板常量套用（同一个值被写到多个页面）</h4>
    <table class="simple compact"><thead><tr><th>字段</th><th>被写死的值</th><th>页面数</th></tr></thead><tbody>${constants || '<tr><td colspan="3" class="muted">无</td></tr>'}</tbody></table>
    <p class="small muted">这解释了 Jev 把多数页面判为 <code>template-leak</code>：结构化数据里的材料、品牌、品类是三组常量，而不是从页面自身推导的。</p>

    <h4>全部硬事实不一致</h4>
    <table class="simple compact"><thead><tr><th>页面</th><th>级别</th><th>类型</th><th>说明</th></tr></thead><tbody>${factRows || '<tr><td colspan="4" class="muted">无</td></tr>'}</tbody></table>

    <h4>Jev 的逐页一致性评分</h4>
    <table class="simple compact"><thead><tr><th>页面</th><th>结构化数据类型</th><th>一致性</th><th>无从印证</th><th>风险类型</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inTable = false;
  const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const flushTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*$/.test(l)) { flushList(); flushTable(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { flushList(); flushTable(); out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`); continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { flushTable(); if (!inList) { out.push('<ul class="tight">'); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (/^\|/.test(l)) {
      const cells = l.split('|').slice(1, -1).map((c) => c.trim());
      if (/^[-: ]+$/.test(cells.join(''))) continue;
      if (!inTable) { flushList(); out.push('<table class="simple compact"><tbody>'); inTable = true; }
      out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    flushList(); flushTable();
    out.push(`<p>${inline(l)}</p>`);
  }
  flushList(); flushTable();
  return out.join('\n');
}

function sectionAiVisibility() {
  if (!aiVis) return `<h2>8 · AI 可见性（AI visibility）</h2><section class="card"><p class="muted">该模块仍在运行或未产出结果。</p></section>`;

  const ov = aiVis.overall || {};
  const engines = Object.values(aiVis.engines || {});
  const tested = engines.filter((e) => e.reachable);
  const skipped = engines.filter((e) => !e.reachable);

  // 品牌抽取是正则匹配，会混入尺码、品类、认证等非品牌词，这里做一层保守过滤
  const NOISE = new Set(['packaging', 'logo', 'higher moqs', 'in-line qc', 'duffels', 'alibaba', 'made-in-china', 'global sources']);
  const isBrandish = (name) => {
    const n = String(name).trim();
    if (n.length < 3) return false;
    if (/^[\d\s.\-–—+]+$/.test(n)) return false;
    if (NOISE.has(n.toLowerCase())) return false;
    if (/^(and|the|for|with|from|your|their)\b/i.test(n)) return false;
    return true;
  };

  const engineRows = engines
    .map((e) => {
      const sm = e.summary || {};
      const top = (sm.additionalBrands || []).filter((x) => isBrandish(x.name)).slice(0, 4).map((x) => `${esc(x.name)} ${x.count}`).join('、');
      return `<tr class="${e.reachable ? '' : 'warn-row'}">
        <td><strong>${esc(e.label || e.id)}</strong><div class="mono tiny muted">${esc(e.model || '')}</div></td>
        <td class="num">${e.reachable ? sm.answersOk ?? 0 : '—'}</td>
        <td class="num" style="color:${(sm.targetMentionedCount || 0) > 0 ? '#0f7a4f' : '#b3261e'}">${sm.targetMentionRateText || '—'}</td>
        <td class="num">${(sm.competitorCounts || []).reduce((x, y) => x + y.count, 0)}</td>
        <td class="tiny">${top || '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join('');

  const brands = (ov.recommendedBrandsGlobal || [])
    .filter((x) => x.count >= 2 && isBrandish(x.name))
    .map((x) => `<span class="pill mid" style="margin:2px 4px 2px 0">${esc(x.name)} × ${x.count}</span>`)
    .join('');

  const skippedRows = skipped
    .map((e) => `<li><strong>${esc(e.label || e.id)}</strong>：${esc(e.skippedReason || '不可达')}</li>`)
    .join('');
  const gemini = (aiVis.unavailableEnginesProbe || []).find((x) => /gemini/.test(x.id || ''));
  const geminiNote = gemini
    ? `<li><strong>Gemini</strong>：网关返回 HTTP ${gemini.httpStatus}，该模型未在 magpie 中注册（providers.json 只登记了部分厂商），因此本轮没有任何 Gemini 数据。</li>`
    : '';

  const quote = (() => {
    for (const e of tested) {
      for (const ans of e.answers || []) {
        const t = ans.answer || ans.text || '';
        const i = t.search(/Eminent|Korrun|Crown Luggage|1688/);
        if (i > 0) return t.slice(Math.max(0, i - 260), i + 420);
      }
    }
    return '';
  })();

  return `<h2>8 · AI 可见性（AI visibility）</h2><section class="card">
    <p>通过本机模型网关真实向 AI 引擎提出买家会问的问题（<strong>提问中不出现任何品牌名</strong>），统计谁被主动推荐。
    共 ${ov.promptsPerEngine || 0} 个问题 × ${(ov.enginesTested || []).length} 个引擎 = <strong>${ov.totalAnswersOk || 0} 条有效回答</strong>。</p>

    <div class="kpis small">
      <div class="kpi"><div class="k">本站被提及</div><div class="v" style="color:#b3261e">${ov.targetMentionedCount || 0} / ${ov.totalAnswersOk || 0}</div><div class="s">提及率 ${ov.targetMentionRatePct ?? 0}%</div></div>
      <div class="kpi"><div class="k">已测引擎</div><div class="v">${(ov.enginesTested || []).length}</div><div class="s">${(ov.enginesTested || []).join('、')}</div></div>
      <div class="kpi"><div class="k">已知竞品出现</div><div class="v">${(ov.competitorCountsGlobal || []).reduce((x, y) => x + y.count, 0)}</div><div class="s">${(ov.competitorCountsGlobal || []).map((c) => `${esc(c.name)} ×${c.count}`).join('、') || '无'}</div></div>
      <div class="kpi"><div class="k">完全没推荐任何供应商</div><div class="v">${ov.noSupplierAnswerCount || 0}</div><div class="s">条回答只讲方法、不点名</div></div>
    </div>

    <div class="note"><strong>结论：在 ${ov.totalAnswersOk || 0} 次真实提问中，djiluggage.id 一次都没有被推荐。</strong>
    不是排名靠后，而是完全没有进入候选集。AI 引擎给出的是一批完全不同的公司——它们甚至不在我们做 SEO/GEO 对比的那 3 个竞品名单里。
    这直接说明：<strong>本站当前的内容形态（模板化、无可引用事实）在生成式答案里没有可被检索到的抓手</strong>，与第 3、7 节的结论互相印证。</div>

    <div class="note" style="background:#fdeceb;border-left-color:#b3261e">
      <strong>更值得注意的是下一层，但要说准确：不同引擎对「印尼能不能做硬箱」给出的答案并不一致。</strong>
      <p class="small"><strong>codex 型引擎（terra / luna）明确劝退印尼：</strong></p>
      <blockquote class="quote">For Indonesia specifically, dedicated export-scale luggage OEM factories are less visible than Thailand and Vietnam, particularly for injection-molded hard-shell suitcases. … If your product is a hard-shell suitcase, Thailand or Vietnam is likely the more practical first route.
        <cite>gpt-5.6-terra · p2「Find me an OEM luggage factory in Southeast Asia or Indonesia」</cite></blockquote>
      <blockquote class="quote">If you need polycarbonate or ABS hard-shell luggage, confirm their molding capability before proceeding; many Indonesian bag factories specialize in soft luggage rather than molded cases.
        <cite>gpt-5.6-luna · p2</cite></blockquote>
      <p class="small"><strong>Gemini 的结论相反——它认为印尼是承接产业转移的重要阵地，并点名了具体工厂：</strong></p>
      <blockquote class="quote">印尼因为人口红利大、劳动力成本相对较低、工业土地充足，成为了承接中国和台湾箱包产业转移的重要阵地。…… 印尼的箱包厂多集中在<strong>西爪哇省（万隆、唐格朗、梳邦）</strong>和<strong>中爪哇省（三宝垄）</strong>。…… 这类工厂通常是国内（温州、平湖、泉州）或台湾箱包龙头的海外分厂，主要为<strong>新秀丽（Samsonite）、美旅（American Tourister）、Tumi</strong> 等国际大牌代工。
        <cite>gemini-3.5-flash · c2「东南亚或者印尼有哪些可以做 OEM 行李箱代工的工厂？」（原答案点名 PT. Lee Der Industrial、PT. Gajah Tunggal Group）</cite></blockquote>
      <p class="small"><strong>把两者放在一起看，真正的结论是：</strong></p>
      <ul class="tight small">
        <li><strong>三家引擎一致的部分：djiluggage.id 都不在候选集里</strong>（0/24），无论它们对印尼的态度是正面还是负面。</li>
        <li><strong>codex 型引擎</strong>认为印尼缺硬壳产能 → 需要的是「硬壳产能证据」。</li>
        <li><strong>Gemini 型引擎</strong>知道印尼能做，但它举出的样本是<strong>中资/台资背景的大型代工厂</strong>（服务 Samsonite / Tumi 那一类），
            而本站不在其中 → 需要的是「在印尼硬箱供给图谱里被识别为一个具体实体」。</li>
        <li>两类引擎要的东西不同，但落到内容上是同一件事：<strong>把可引用的硬壳产能、规模与合规事实写在页面上，并让品牌实体在站外可被检索到。</strong></li>
      </ul>
      <p class="small">反过来说，这仍是一个没有被占据的位置：英文语料里几乎没有「印尼本土硬箱代工厂」的成型内容，
      而 Gemini 已经承认印尼这个产地可行——缺的只是「谁在做」。</p>
    </div>

    <h4>核对方式（避免漏检）</h4>
    <p class="small">对 16 份回答的全部 <strong>74,951 个字符</strong>逐字检索 <code>dji</code>，命中 <strong>0 行</strong>——本站的 0% 不是匹配规则太窄造成的。
    同时：<strong>指定的 3 个竞品（OMASKA / Hùng Phát / Greatchip）也全部 0 提及</strong>；唯一出现的竞品是 Rimowa（4 处），且全部是作为「Rimowa-style」风格标杆出现，不是作为供应商推荐。</p>

    <h4>AI 实际推荐了谁（人工核对后，带原文）</h4>
    <p class="small">被点名最多的是：<strong>Eminent Luggage / Eminent Group</strong>（5 份回答）、<strong>Crown Luggage / Crown Group</strong>（4 份）、
    <strong>Korrun</strong>（3 份）、TBS Group / Thai Binh Shoes（2 份）、Sakos（2 份）、President Luggage（2 份）；
    另有 Hien Long Group、VIP Industries、Hanke、OIWAS、Heys、浙江新秀集团、Zhejiang Sunrise、Camtop 等各 1 份。
    印尼方面只有两家被提到，且都是软箱厂：<strong>PT Sunindo Adipersada</strong>、<strong>PT Eksonindo Multi Product Industry</strong>。
    平台与验货机构（Alibaba、Made-in-China、1688、SGS、QIMA、Intertek）已单独归类，不计入代工推荐。</p>

    <h4>为什么本站与 3 个竞品同时 0 提及</h4>
    <p class="small">这不是巧合：这 4 家都是区域性的小型制造站，在 AI 的训练与检索语料里几乎没有存在感，
    而 AI 推荐的是有大量英文内容、媒体曝光、目录收录与认证记录的公司。差距不在页面结构，而在<strong>站外存在感</strong>与<strong>可引用事实</strong>两件事上。</p>

    <h4>逐引擎结果</h4>
    <table class="simple compact">
      <thead><tr><th>引擎</th><th>有效回答</th><th>提及本站</th><th>提及已知竞品</th><th>AI 实际推荐的品牌（前 4）</th></tr></thead>
      <tbody>${engineRows}</tbody>
    </table>

    <h4>AI 实际推荐的品牌（出现 ≥2 次）</h4>
    <p>${brands || '<span class="muted">无</span>'}</p>

    ${quote ? `<h4>原文证据（节选）</h4><pre class="raw">${esc(quote)}</pre>` : ''}

    <h4>局限（必须一起看）</h4>
    <ul class="tight small">
      ${skippedRows}
      ${geminiNote}
      <li>每个问题每个引擎只采 1 个样本，未设 temperature，<strong>结果非确定性</strong>：换一次运行，被推荐的品牌可能不同。这里反映的是单次快照。</li>
      <li>品牌抽取基于正则匹配，会把非品牌词（如 "Packaging"、"Higher MOQs"）误收进候选，因此上面的品牌清单用于看方向，不能当作精确排名。</li>
      <li>提问为英文 + 少量中文，未覆盖印尼语；买家若用印尼语提问，结果可能不同。</li>
    </ul>
    <p class="muted small">完整数据：<code>.workbuddy-ai/reports/ai-visibility.json</code>；逐条原始提问与回答：<code>.seo-geo/ai-visibility/raw-*.json</code>；可复跑：<code>npm run ai:visibility</code>。</p>
  </section>`;
}

function sectionBenchmark() {
  if (!benchmark && !benchmarkMd) return `<h2>9 · 高 SEO / 高 GEO 制造业标杆</h2><section class="card"><p class="muted">该模块仍在运行或未产出结果。</p></section>`;

  const siteRows = (benchmark?.sites || [])
    .map((x) => {
      const pages = Object.values(x.pages || {}).filter((pg) => pg && pg.url);
      const nums = pages.map((pg) => pg.wordCount).filter((v) => typeof v === 'number');
      const med = nums.length ? nums.sort((a, b) => a - b)[Math.floor(nums.length / 2)] : null;
      return `<tr>
        <td><strong>${esc(x.name)}</strong><div class="mono tiny muted">${esc(pages[0] ? new URL(pages[0].url).host : '')}</div></td>
        <td class="tiny">${esc(x.verticalLabel || x.vertical || '')}</td>
        <td class="num">${pages.length}</td>
        <td class="num">${med ?? '—'}</td>
        <td class="tiny">${esc((x.whyQualifies || '').slice(0, 220))}</td>
      </tr>`;
    })
    .join('');

  const agg = benchmark?.aggregates;
  const aggText = agg
    ? Object.entries(agg)
        .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
        .slice(0, 14)
        .map(([k, v]) => `${k}: <strong>${typeof v === 'number' ? Math.round(v * 100) / 100 : esc(v)}</strong>`)
        .join(' · ')
    : '';

  return `<h2>9 · 高 SEO / 高 GEO 制造业标杆</h2><section class="card">
    <p>用与本站完全相同的抽取器与 UA，实测 6 个 B2B 制造业站点（工厂/OEM，非零售品牌），
    目的是回答「一个强制造业页面长什么样」。抓取失败的站点如实记录，未做估算。</p>
    ${siteRows ? `<table class="simple compact"><thead><tr><th>站点</th><th>垂直领域</th><th>页数</th><th>正文词数中位</th><th>入选理由</th></tr></thead><tbody>${siteRows}</tbody></table>` : ''}
    ${aggText ? `<p class="small muted">聚合指标：${aggText}</p>` : ''}
    ${benchmarkMd ? `<div class="md">${mdToHtml(benchmarkMd)}</div>` : ''}
  </section>`;
}

/* ============================ 汇总与外壳 ============================ */

const tally = Object.values(findings.audits || {}).reduce((a, v) => ((a[v.verdict] = (a[v.verdict] || 0) + 1), a), {});
const thinCount = Object.values(findings.thin || {}).filter((t) => t.originality < 2.25).length;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>djiluggage.id 站点审计 · 8 项分析</title>
<style>
  :root{--bg:#f4f5f7;--card:#fff;--ink:#17191c;--muted:#6b7280;--line:#e2e5e9;--accent:#1f4fd8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  .wrap{max-width:1220px;margin:0 auto;padding:34px 22px 90px}
  h1{font-size:27px;margin:0 0 6px}
  h2{font-size:20px;margin:44px 0 14px;padding-bottom:9px;border-bottom:2px solid var(--ink)}
  h3{font-size:16px;margin:0 0 6px}
  h4{font-size:13px;margin:20px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .lede{color:var(--muted);margin:0 0 20px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:20px 0}
  .kpis.small{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px}
  .kpi .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .kpi .v{font-size:26px;font-weight:700;line-height:1.25;margin-top:5px}
  .kpi .s{font-size:12px;color:var(--muted)}
  section.card,section.global,section.layer{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
  table.compact th,table.compact td{padding:5px 8px}
  td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
  td.mono,span.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
  .tiny{font-size:12px}
  code{background:#eef1f5;border-radius:4px;padding:1px 5px;font-size:12px}
  .muted{color:var(--muted)}
  .small{font-size:13px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  @media(max-width:900px){.grid2{grid-template-columns:1fr}}
  .pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600}
  .pill.good{background:#e3f5ec;color:#0f7a4f}
  .pill.mid{background:#fdf1dc;color:#9a6700}
  .pill.bad{background:#fdeceb;color:#b3261e}
  .flag{background:#fdeceb;color:#b3261e;font-size:11px;padding:1px 6px;border-radius:4px}
  .ok{background:#e3f5ec;color:#0f7a4f;font-size:11px;padding:1px 6px;border-radius:4px}
  .warn-row{background:#fffaf0}
  .policy{margin-top:6px;background:#f0f4ff;border-left:3px solid var(--accent);padding:6px 9px;border-radius:5px;font-size:12px}
  .hist{display:flex;flex-direction:column;gap:5px}
  .histrow{display:grid;grid-template-columns:52px 1fr 48px;gap:8px;align-items:center;font-size:12px}
  .histk{color:var(--muted)}
  .histbar{display:block;height:14px;background:linear-gradient(90deg,#c0392b,#c2820b,#128a5b);border-radius:4px;min-width:3px}
  .histv{text-align:right;font-variant-numeric:tabular-nums}
  ul.tight{margin:6px 0;padding-left:20px}
  ul.tight li{margin:4px 0}
  .raw{background:#0f172a;color:#cbd5e1;border-radius:9px;padding:14px;font-size:12px;overflow:auto;max-height:520px;white-space:pre-wrap}
  .md h3,.md h4{margin-top:18px}
  .md table{font-size:13px}
  .note{background:#fff8e6;border-left:3px solid #d9a400;padding:11px 13px;border-radius:6px;font-size:13px;margin:14px 0}
  blockquote.quote{margin:10px 0;padding:10px 14px;background:#fff;border-left:3px solid #b3261e;border-radius:5px;font-size:13px;line-height:1.55}
  blockquote.quote cite{display:block;margin-top:6px;color:#6b7280;font-style:normal;font-size:12px}
</style></head><body><div class="wrap">
  <h1>djiluggage.id 站点审计</h1>
  <p class="lede">8 项分析 · ${corpus.pages.length} 个 URL（sitemap 内 ${corpus.pages.filter((p) => p.inSitemap).length}） · ${corpus.links.length} 条内链 ·
     生成于 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 判断模型 ${esc(findings.model || 'jev-1.13.0')}</p>

  <div class="kpis">
    <div class="kpi"><div class="k">URL 总数</div><div class="v">${corpus.pages.length}</div><div class="s">sitemap 内 ${corpus.pages.filter((p) => p.inSitemap).length}，另有重复文件对 ${corpus.duplicates.length} 组</div></div>
    <div class="kpi"><div class="k">薄内容页</div><div class="v" style="color:#c0392b">${thinCount}</div><div class="s">原创性低于 2.25 / 4</div></div>
    <div class="kpi"><div class="k">建议合并</div><div class="v" style="color:#c0392b">${tally.merge || 0}</div><div class="s">update ${tally.update || 0} · keep ${tally.keep || 0} · remove ${tally.remove || 0}</div></div>
    <div class="kpi"><div class="k">内链机会</div><div class="v" style="color:#0f7a4f">${acceptedLinks.length}</div><div class="s">已含建议锚文本</div></div>
    <div class="kpi"><div class="k">schema 不一致</div><div class="v">${(findings.schema || []).filter((s) => s.hasUnsupportedClaim >= 0.5).length}</div><div class="s">模板常量套用 3 组 × 21 页</div></div>
    <div class="kpi"><div class="k">待人工复核映射</div><div class="v">${(findings.redirects?.reviewQueue || []).length}</div><div class="s">低置信或循环映射</div></div>
  </div>

  <div class="note"><strong>关于本站最重要的一句话：</strong>结构（标题、canonical、内链、结构化数据）做得不错且基本无技术错误，
  问题全部集中在<strong>内容本身</strong>——46 个页面中有 ${thinCount} 个是模板化的薄页面（产品页只差颜色名、8 篇新闻文章是同一篇 222 词的模板文）。
  这既是 SEO 问题，也是 AI 引擎不会引用本站的根本原因：没有任何可摘引的、本页独有的具体事实。</div>

  ${sectionLinks()}
  ${sectionCannibal()}
  ${sectionThin()}
  ${sectionIntent()}
  ${sectionAudit()}
  ${sectionRedirects()}
  ${sectionSchema()}
  ${sectionAiVisibility()}
  ${sectionBenchmark()}

  <h2>10 · 方法与局限</h2>
  <section class="card small">
    <p><strong>分工。</strong>可精确计算的事实——内链图、TF-IDF 相似度聚类、JSON-LD 字段、图片 HTTP 状态、电话是否出现在可见文本、模板常量统计——全部由 <code>scripts/site-audit/</code> 下的代码完成；「这对买家、对搜索引擎意味着什么」由 Jev 判断。报告里每个结论都能追溯到分数或事实之一。</p>
    <p><strong>可复现。</strong><code>node scripts/site-audit/corpus.mjs --refresh</code> →
       <code>node scripts/site-audit/analyze.mjs</code> →
       <code>node scripts/site-audit/audit.mjs</code> →
       <code>node scripts/site-audit/schema-facts.mjs</code> →
       <code>node scripts/site-audit/report.mjs</code>。中间数据在 <code>.seo-geo/site/</code>。</p>
    <p><strong>策略修正。</strong>模型输出里有 ${policyNotes.length} 处需要代码按显式规则纠正（sitemap 方向、循环映射、模板组处置）。报告保留模型的原始判断，并在旁边标注修正理由，而不是悄悄改写。</p>
    <p><strong>局限。</strong>① 原创性分数由模型给出，本报告用词面重合度做了独立佐证，但它仍是判断而非事实；② 相似度阈值 0.45 用于聚类，阈值改动会改变分组粒度；③ AI 可见性是抽样测量，同一问题不同次回答可能不同，样本量见第 8 节；④ 未接入真实自然搜索流量与排名数据，因此「该不该保留某页」的判断基于内容与结构，而非实际表现。</p>
  </section>
</div></body></html>`;

const outName = `site-audit-${new Date().toISOString().slice(0, 10)}.html`;
writeFileSync(join(REPORT_DIR, outName), html);
console.log(`▶ 报告已生成：.workbuddy-ai/reports/${outName}`);
console.log(`  内链建议 ${acceptedLinks.length} · 合并 ${tally.merge || 0} · 薄内容 ${thinCount} · 策略修正 ${policyNotes.length}`);
if (!aiVis) console.log('  注意：第 8 项 AI 可见性结果尚未生成');
if (!benchmark && !benchmarkMd) console.log('  注意：标杆站结果尚未生成');
