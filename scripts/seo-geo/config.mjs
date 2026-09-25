/**
 * SEO / GEO 对比分析的页面清单。
 *
 * 对标对象限定为「行李箱制造业网站」——即英文站、面向 B2B 买家
 * （品牌方 / 进口商 / 批发商）的行李箱工厂或 OEM/ODM 制造商，
 * 而不是 Rimowa / Away 这类零售品牌。
 *
 * 三层结构，每层内部才是可比的：
 *   home    —— 品牌层：能不能一眼看出你是谁、为谁服务、凭什么信你
 *   catalog —— 覆盖层：品类/目录页，决定长尾品类词能不能被索引和引用
 *   product —— 转化层：具体产品/材质页，决定 AI 与搜索能否回答规格类问题
 */

export const LAYERS = [
  { id: 'home', label: '首页（品牌层）', query: 'custom luggage manufacturer / OEM luggage factory' },
  { id: 'catalog', label: '目录页（覆盖层）', query: 'custom luggage catalog, what a factory can produce' },
  { id: 'product', label: '产品页（转化层）', query: 'custom aluminum frame suitcase manufacturer specs' },
];

export const PAGES = [
  // ---------- 首页 ----------
  {
    id: 'dji-home',
    layer: 'home',
    site: 'dji',
    siteName: 'DJI Luggage',
    owner: 'DJI Luggage（本站）',
    isOurs: true,
    url: 'https://djiluggage.id/',
    note: '本站首页',
  },
  {
    id: 'omaska-home',
    layer: 'home',
    site: 'omaska',
    siteName: 'OMASKA',
    owner: 'OMASKA',
    isOurs: false,
    url: 'https://www.omaska.com/',
    note: '背包/行李箱工厂，B2B 内容营销标杆',
  },
  {
    id: 'hungphat-home',
    layer: 'home',
    site: 'hungphat',
    siteName: 'Hung Phat',
    owner: 'Hùng Phát（越南）',
    isOurs: false,
    url: 'https://hungphat-jsc.com/en/',
    note: '越南行李箱制造商，地域上最直接的同业',
  },
  {
    id: 'greatchip-home',
    layer: 'home',
    site: 'greatchip',
    siteName: 'Greatchip (HT Luggage)',
    owner: 'Greatchip / HT Luggage',
    isOurs: false,
    url: 'https://www.htluggage.com/',
    note: '中国行李箱制造商，品类维度站内架构较细',
  },

  // ---------- 目录页 ----------
  {
    id: 'dji-catalog',
    layer: 'catalog',
    site: 'dji',
    siteName: 'DJI Luggage',
    owner: 'DJI Luggage（本站）',
    isOurs: true,
    url: 'https://djiluggage.id/collections/all/',
    note: '全量产品集合页',
  },
  {
    id: 'omaska-catalog',
    layer: 'catalog',
    site: 'omaska',
    siteName: 'OMASKA',
    owner: 'OMASKA',
    isOurs: false,
    url: 'https://www.omaska.com/custom-luggage/',
    note: '定制行李箱总入口',
  },
  {
    id: 'hungphat-catalog',
    layer: 'catalog',
    site: 'hungphat',
    siteName: 'Hung Phat',
    owner: 'Hùng Phát（越南）',
    isOurs: false,
    url: 'https://hungphat-jsc.com/en/products/',
    note: '产品总目录',
  },
  {
    id: 'greatchip-catalog',
    layer: 'catalog',
    site: 'greatchip',
    siteName: 'Greatchip (HT Luggage)',
    owner: 'Greatchip / HT Luggage',
    isOurs: false,
    url: 'https://www.htluggage.com/Luggage/',
    note: '行李箱总目录',
  },

  // ---------- 产品 / 材质页 ----------
  {
    id: 'dji-product',
    layer: 'product',
    site: 'dji',
    siteName: 'DJI Luggage',
    owner: 'DJI Luggage（本站）',
    isOurs: true,
    url: 'https://djiluggage.id/products/aluminum-suitcase-black/',
    note: '铝框行李箱单品页',
  },
  {
    id: 'omaska-product',
    layer: 'product',
    site: 'omaska',
    siteName: 'OMASKA',
    owner: 'OMASKA',
    isOurs: false,
    url: 'https://www.omaska.com/pc-luggage/',
    note: 'PC 硬壳行李箱材质页（无单品页，取最接近的材质页）',
  },
  {
    id: 'hungphat-product',
    layer: 'product',
    site: 'hungphat',
    siteName: 'Hung Phat',
    owner: 'Hùng Phát（越南）',
    isOurs: false,
    url: 'https://hungphat-jsc.com/en/travelking-810-aluminum-frame-suitcase/',
    note: '铝框行李箱单品页，与我方最具可比性',
  },
  {
    id: 'greatchip-product',
    layer: 'product',
    site: 'greatchip',
    siteName: 'Greatchip (HT Luggage)',
    owner: 'Greatchip / HT Luggage',
    isOurs: false,
    url: 'https://www.htluggage.com/Aluminum-frame/',
    note: '铝框行李箱材质页',
  },
];

export const CACHE_DIR = '.seo-geo/cache';
export const REPORT_DIR = '.workbuddy-ai/reports';
