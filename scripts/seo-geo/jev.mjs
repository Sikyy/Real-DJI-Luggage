/**
 * Jev（TypeSafe System One）调用层。
 *
 * 设计原则：代码负责事实与流程，Jev 只负责「这对买家/对 AI 意味着什么」的判断。
 * 每页的全部问题放在一次请求里批量提问（并行问题更便宜也更快），
 * 跨页对比再用独立的 Choice 请求。
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';

export function loadApiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const candidates = [
    join(process.env.TYPESAFE_CONFIG_DIR || '', 'config.json'),
    join(homedir(), '.config', 'typesafe', 'config.json'),
    join(homedir(), '.typesafe', 'config.json'),
  ].filter((p) => p && !p.startsWith('config.json'));
  for (const path of candidates) {
    try {
      const cfg = JSON.parse(readFileSync(path, 'utf8'));
      const key = cfg.api_key || cfg.apiKey;
      if (key) return key;
    } catch { /* 继续找下一个 */ }
  }
  throw new Error('未找到 TypeSafe API key：请设置 TYPESAFE_API_KEY，或写入 ~/.config/typesafe/config.json');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callJev(apiKey, { state, questions, label = '' }) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1500 * 2 ** (attempt - 1));
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, model: MODEL, questions }),
        signal: AbortSignal.timeout(180000),
      });
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        lastErr = new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Jev ${res.status}: ${(await res.text().catch(() => '')).slice(0, 400)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (/Jev 4\d\d/.test(String(err.message))) throw err;
    }
  }
  throw new Error(`Jev 请求失败（${label}）：${lastErr?.message}`);
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

/* ------------------------------------------------------------------ */
/* 页面级问题：14 个 Score + 5 个 Noul，一次请求全部问完               */
/* ------------------------------------------------------------------ */

const SCORE_LEVELS = {
  seo_title_meta_fit: [
    '标题或元描述缺失，或只重复品牌名',
    '有标题和元描述但很泛，买家看不出具体提供什么',
    '点出了产品/服务，但没说清客户是谁或差异点',
    '同时说清了提供什么、给谁、以及至少一个差异点',
    '精准覆盖提供物 + 目标买家 + 差异点 + 佐证，与目标搜索意图高度吻合',
  ],
  seo_topical_focus: [
    '没有连贯主题，基本是导航和模板文字',
    '主题能看出来，但被大量无关区块稀释',
    '有一个清晰主题，但存在明显跑题段落',
    '主题清晰且通篇保持一致',
    '单一主题高度聚焦，每一节都在推进它',
  ],
  seo_heading_outline: [
    '没有有意义的标题',
    '有标题但空泛或层级错乱（例如 H1 缺失、H2 先于 H1）',
    '大致有序的大纲，但有明显缺口',
    '层级清晰，覆盖了主要章节',
    '层级清晰到可以直接当目录使用，买家能据此导航',
  ],
  seo_content_depth: [
    '只有营销口号',
    '表层描述，没有任何采购相关细节',
    '对材料或流程有一般性介绍',
    '对材料、工艺或定制选项有具体说明',
    '决策级细节：规格、选项、限制条件以及项目如何推进',
  ],
  seo_trust_evidence: [
    '完全没有，只是匿名营销页',
    '只有能力宣称，没有支撑细节',
    '有一些支撑细节（流程或厂房描述）',
    '有具名认证、产能或可核实的工艺细节',
    '多个相互独立的信任信号，采购经理可以逐一核实',
  ],
  seo_buyer_next_step: [
    '完全无法发起询盘',
    '只有一个远离正文的通用联系链接',
    '存在询盘入口，但没有任何说明',
    '询盘号召清晰，并说明了后续会发生什么',
    '明确且具体的下一步（报价/打样/MOQ 咨询），并就放在相关内容旁并附联系方式',
  ],
  seo_technical_readiness: [
    '缺标题或元描述',
    '基础元数据不全（无结构化数据、图片 alt 覆盖率低）',
    '基础元数据完整，但没有结构化数据',
    '元数据完整，且带有相关的结构化数据',
    '元数据、结构化数据齐备，技术卫生状况良好',
  ],
  geo_answerability: [
    '内容完全无法回答该问题',
    '提到了主题但没有给出答案',
    '部分回答，关键部分需要读者自行推断',
    '直接回答了主要问题',
    '不仅回答了主要问题，还回答了买家紧接着会问的问题',
  ],
  geo_entity_clarity: [
    '从页面上无法识别公司是谁、做什么',
    '有名字但含糊，没有产地或产品细节',
    '公司、产品与产地可以被识别',
    '识别清晰，还给出了产品系列与制造地',
    '实体界定毫不含糊：公司名、产品线、产地以及在供应链中的角色',
  ],
  geo_citability: [
    '没有任何可引用的事实',
    '只有一两个模糊数字',
    '有一些具体事实',
    '多个主题上都有具体事实',
    '通篇密集、具体、可溯源的事实，包括生产数据',
  ],
  geo_chunkability: [
    '一整块无法切分的文字',
    '长篇营销文案，几乎没有边界',
    '有一些段落可以独立成立',
    '章节和列表边界清晰，可以独立抽取',
    '存在明确的问答式或定义式区块，天然适合被逐条摘引',
  ],
  geo_freshness: [
    '页面上没有任何日期信号',
    '只有一行没有日期的版权信息',
    '出现了年份，但内容可能已经过时',
    '内容带有近期日期或更新标记',
    '内容带有明确的、近期的发布或更新时间',
  ],
  geo_external_validation: [
    '完全没有',
    '只有「深受品牌信赖」这类泛泛宣称',
    '有具名认证或标准',
    '有具名认证，且有具名客户或审计',
    '多个可查证且带上下文的第三方背书',
  ],
  geo_ai_source_likelihood: [
    '极不可能：页面缺少这类答案所需的实质内容',
    '不太可能：内容泛泛，与大量同类页面可互换',
    '有可能：覆盖了主题，但没有辨识度',
    '很可能：内容具体、结构利于检索',
    '极可能：在该主题上是最完整、最值得引用的来源',
  ],
};

export const SCORE_KEYS = Object.keys(SCORE_LEVELS);

const NOUL_KEYS = {
  noul_faq_block: '页面包含显式的 FAQ 或问答区块（在 `content.text` 中可见）',
  noul_concrete_numbers: '页面给出了具体的生产数字，例如产能、MOQ、交期、尺寸、设备或人员数量',
  noul_certifications: '页面点名了至少一项具体认证或审核标准（例如 ISO 9001、BSCI、Sedex、GRS）',
  noul_b2b_positioning: '页面明确面向 B2B 买家（品牌方、进口商、批发商、经销商），而不是终端消费者',
  noul_inquiry_path: '页面提供了发起商务询盘的具体途径（表单、邮箱、电话或 WhatsApp）',
};

export function buildPageQuestions() {
  const q = {};
  for (const [key, levels] of Object.entries(SCORE_LEVELS)) {
    q[key] = { type: 'score', instructions: PAGE_SCORE_INSTRUCTIONS[key], criteria: levels };
  }
  for (const [key, text] of Object.entries(NOUL_KEYS)) {
    q[key] = {
      type: 'noul',
      instructions: text,
      criteria: { true: '页面中确实存在', false: '页面中不存在或无法确认' },
    };
  }
  return q;
}

const PAGE_SCORE_INSTRUCTIONS = {
  seo_title_meta_fit:
    '`extracted.title` 和 `extracted.meta_description` 在多大程度上让一个 B2B 行李箱买家明白这页提供什么、为什么值得点击？只评估标题与元描述，不评估正文。参考该页的目标搜索意图 `page.layer_query`。',
  seo_topical_focus:
    '依据 `extracted.headings` 与 `content.text`：页面正文是否聚焦在一个清晰的产品或服务主题上？',
  seo_heading_outline:
    '`extracted.headings` 作为该页信息大纲的可读性如何？',
  seo_content_depth:
    '`content.text` 对一个正在做 B2B 行李箱采购决策的买家来说，深度与具体程度如何？',
  seo_trust_evidence:
    '页面提供了多少关于真实制造能力的实证（厂房、产能、认证、客户、工艺、可联系性）？',
  seo_buyer_next_step:
    '依据 `extracted.cta_signals` 与正文：一个 B2B 买家要发起询盘，路径有多清晰、多低门槛？',
  seo_technical_readiness:
    '依据 `extracted`（标题/元描述长度、canonical、结构化数据类型、图片 alt 覆盖率、标题层级数量）：这个页面对搜索引擎的准备程度如何？',
  geo_answerability:
    '如果一个 AI 助手用户问的正是 `page.layer_query` 对应的问题，`content.text` 有多直接地回答了它？',
  geo_entity_clarity:
    '页面把它的实体界定得有多清楚——公司是谁、生产什么、在哪里、叫什么名字？',
  geo_citability:
    '`content.text` 里包含多少具体、可被 AI 答案引用的事实（数字、MOQ、交期、尺寸、产能、认证、具名工艺）？',
  geo_chunkability:
    '检索系统从这个页面里抽取自包含段落有多容易（清晰标题、列表、问答、短段落）？',
  geo_freshness:
    '依据 `extracted.dates` 与 `extracted.years_mentioned`：页面是否显示出信息是当前的？',
  geo_external_validation:
    '页面上出现了多少第三方或可独立核实的背书（认证、审核、客户名、奖项、标准）？',
  geo_ai_source_likelihood:
    '当一个品牌方问起 `page.layer_query` 时，AI 答案引擎选中这个页面作为来源的可能性有多大？',
};

export function buildPageState(page, facts) {
  return {
    page: {
      url: page.url,
      site_name: page.siteName,
      owner: page.owner,
      layer_label: page.note,
      layer_query: page.query || '',
      is_our_site: page.isOurs,
    },
    extracted: {
      title: facts.title,
      title_length: facts.titleLength,
      meta_description: facts.metaDescription,
      meta_description_length: facts.metaDescriptionLength,
      canonical: facts.canonical,
      lang: facts.lang,
      hreflang_count: facts.hreflangCount,
      og_complete: facts.ogComplete,
      twitter_complete: facts.twitterComplete,
      h1: facts.h1,
      h1_count: facts.h1Count,
      h2_count: facts.h2Count,
      h3_count: facts.h3Count,
      headings: facts.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`),
      question_headings: facts.questionHeadings,
      word_count: facts.wordCount,
      jsonld_types: facts.jsonldTypes,
      jsonld_block_count: facts.jsonldBlockCount,
      image_count: facts.imageCount,
      image_alt_coverage_percent: facts.imageAltCoverage,
      internal_link_count: facts.internalLinkCount,
      external_link_count: facts.externalLinkCount,
      external_hosts: facts.externalHosts,
      certifications_detected: facts.certifications,
      cta_signals: facts.ctaSignals,
      unit_stat_hits: facts.unitStatHits,
      percent_stat_hits: facts.percentStatHits,
      has_faq_section: facts.hasFaq,
      dates: facts.dates.slice(0, 10),
      years_mentioned: facts.yearsMentioned,
      text_length: facts.textLength,
    },
    content: {
      text: facts.bodyText.slice(0, 12000),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 跨页对比：每层 3 个 Choice + 全局 1 个 Choice                       */
/* ------------------------------------------------------------------ */

const LAYER_CHOICES = {
  best_seo_page: '这一组页面里，哪一个对 `query` 这个搜索词最具备自然搜索竞争力？只依据给出的页面摘要判断。',
  best_geo_source: '这一组页面里，哪一个最可能被 AI 答案引擎摘引为 `query` 的来源？只依据给出的页面摘要判断。',
  best_trust_evidence: '这一组页面里，哪一个提供的可核实制造能力证据最强（认证、产能、工艺、客户）？只依据给出的页面摘要判断。',
};

export function buildLayerQuestions(candidates) {
  const criteria = {};
  for (const c of candidates) {
    criteria[c.id] = `${c.owner} — ${c.url}\n标题：${c.title || '（无）'}\n层级：${c.layerLabel}\n正文：${c.excerpt}`;
  }
  const q = {};
  for (const [key, text] of Object.entries(LAYER_CHOICES)) {
    q[key] = { type: 'choice', instructions: text, criteria };
  }
  return q;
}

export function buildLayerState(layer, candidates) {
  return {
    layer: layer.id,
    layer_label: layer.label,
    query: layer.query,
    candidates: candidates.map((c) => ({
      id: c.id,
      owner: c.owner,
      url: c.url,
      title: c.title,
      meta_description: c.metaDescription,
      headings: c.headings,
      word_count: c.wordCount,
      jsonld_types: c.jsonldTypes,
      certifications: c.certifications,
      has_faq: c.hasFaq,
      unit_stat_hits: c.unitStatHits,
      excerpt: c.excerpt,
    })),
  };
}

export const GLOBAL_QUERY =
  'Who can manufacture custom aluminum-frame suitcases for a new luggage brand? (OEM/ODM supplier selection)';

export function buildGlobalQuestions(candidates, { rich = false } = {}) {
  const criteria = {};
  for (const c of candidates) {
    criteria[c.id] = `${c.owner}（${c.layerLabel}）— ${c.url}\n标题：${c.title || '（无）'}\n正文：${c.excerpt}`;
  }
  const contextNote = rich
    ? '给出的是各页面较完整的正文，请依据正文实质内容判断。'
    : '给出的是各页面的正文摘要，请依据可见内容判断。';
  return {
    single_best_source: {
      type: 'choice',
      instructions:
        `一个品牌方问 AI：「谁能帮我生产定制铝框行李箱？」（对应 \`query\`）。下列页面中，哪一个最可能被 AI 引用为答案来源？${contextNote}`,
      criteria,
    },
    our_site_gap_owner: {
      type: 'choice',
      instructions:
        '如果要点名一个最应该向 DJI Luggage 学习其页面对 AI 可引用性做法的站点，是哪一个？依据 `candidates` 中非我方页面的可引用性判断。',
      criteria: Object.fromEntries(Object.entries(criteria).filter(([k]) => !k.startsWith('dji-'))),
    },
  };
}
