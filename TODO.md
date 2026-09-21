# TODO

## 已完成

- [x] **Open Graph / Twitter Card 元数据** —— 让分享到聊天软件时能渲染富预览卡。
  - 55 个页面里 54 个已带齐 `description`、`og:type`、`og:site_name`、`og:title`、`og:description`、
    `og:url`、`og:image`、`twitter:card`、`twitter:title`、`twitter:description`、`twitter:image`
    （唯一例外是 `404.html`，错误页不应被索引）。
  - 全部使用绝对生产 URL。分享卡沿用仓库里已有的 `/assets/og/dji-luggage-og.jpg`（1200×630）。
  - 图片分配：产品页用各自主图（21）、新闻文章用各自封面（8）、其余 25 个页面用默认分享卡。
  - 多语言版本元数据：站点目前只有英文（`/id`、`/zh` 前缀已 301 收敛到英文），故不需要。

- [x] **sitemap.xml 补全** —— 原来只有 21 条，**漏掉了全部 21 个产品页**和 `collections/all/`。
  现在 43 条，由 `scripts/build-sitemap.mjs` 从各页 `<link rel="canonical">` 自动派生
  （`npm run sitemap` 生成 / `npm run sitemap:check` 校验），手写漂移的问题不会再出现。

- [x] **结构化数据（JSON-LD）** —— 原来 37 个页面完全没有。现已注入 34 个：
  产品页 `Product`（21）、新闻文章 `BlogPosting`（8）、职位页 `JobPosting`（4，可进 Google Jobs）、
  `collections/all` 的 `CollectionPage` + `ItemList`（1）。
  由 `scripts/build-structured-data.mjs` 生成（`npm run structured-data` / `structured-data:check`），
  数据全部取自页面自身，不引入第二份真相。
  注：`Product` **故意不含 `offers`** —— 这是 B2B 定制品、没有真实售价，编一个价格会误导并触发 GSC 警告。

- [x] **`404.html` 缺 `<h1>`** —— 已把 `PAGE NOT FOUND` 从 `div` 改成 `h1`，
  并在 `.not-found-label` 里中和 h1 的默认字号/字重/行高/外边距，视觉不变。

- [x] **`_headers` 里的失效规则** —— 还留着已删除的 `/cms-connect.js` 缓存规则，已改为 `/site.js`。

- [x] **联系方式统一为 `+62 85111384747`** ——
  WhatsApp 链接由 `wa.me/8619816891233`（中国号）改为 `wa.me/6285111384747`，
  共 58 处 / 40 个静态页面；职位页那 4 个由 JS 生成的一并修好（原先还是 `href="#"`，点了没反应）。
  17 个页面的 Organization 结构化数据补上了 `telephone` 字段（此前只有 email 和地址）。
  联系表单的国家码下拉默认值本来就是 `+62`，无需改动。

## 待办

- [ ] **补上真实社交主页链接（WhatsApp 已完成）。**
  WhatsApp 已统一为 `https://wa.me/6285111384747`，覆盖全部 44 个页面
  （40 个静态 HTML + 4 个职位页由 `career-detail.js` 生成，菜单与页脚各一处），
  并已写入 17 个页面的 Organization 结构化数据 `telephone` 字段。

  仍待处理的是另外三个：
  - `about.html` / `about/index.html` 指向的是**通用首页**
    （`https://www.linkedin.com/`、`https://www.instagram.com/`、`https://www.youtube.com/`）
  - 其余页面的同位置图标都是 `href="#"`
  - 4 个职位页由 `career-detail.js` 的 `socialIcons` 常量生成，也是 `href="#"`

  通用首页链接比 `#` 更糟——看起来像真链接但没有任何指向性。
  需要你提供真实主页 URL，然后统一替换全站（含菜单、页脚与 `career-detail.js`）。

- [ ] **消除 `x.html` 与 `x/index.html` 的重复文件对。**
  8 组根级页面（about / careers / contact / newsroom / privacy-policy / process / products / services）
  同时存在两种形态、字节完全相同。canonical 已统一指向无斜杠版本，
  Google 会自行合并（属官方定义的「非错误」），但仓库里留着两份是维护负担。
  彻底消除的做法是删掉 `x/index.html` + 在 `_redirects` 里加 `/x/ /x 301`。
  这会改变已收录 URL 的状态码（200 → 301，仍属非错误），建议先看一轮 GSC 数据再定。

- [ ] **补齐上游独有产品（可选）。**
  `roamingluggage.com` 上还有 14 个本地没有的产品（DEEP-SHELL、LUMEN、CloudLite、Magical Space、
  Extremely Roomy、Carry-On 18"/20" 等）。需要下载上游图片并新建页面，属独立一轮的工作量。

- [ ] **确认新闻文章最后 3 篇的发布日期与封面。**
  `cms/scripts/seed.ts` 已随 CMS 一并删除，站内数据现在是唯一来源，
  但站内版本与已删除的 CMS seed 曾对最后 3 篇的「日期 + 封面」归属不一致：

  | slug | 站内（现采用） | 曾用的 CMS seed |
  |---|---|---|
  | `from-sample-to-production` | 9.01.25 / CA2gOg… | 08-12 / qdVrKV… |
  | `building-a-private-label-travel-line` | 8.29.25 / pNkjoq… | 09-01 / CA2gOg… |
  | `packaging-and-export-prep-for-suitcases` | 8.12.25 / qdVrKV… | 08-29 / pNkjoq… |

  前 5 篇两边一致；站内版本在新闻列表页上是严格递减的日期序列，故采用了站内版本。
  若真实排期不是这样，改 `newsroom/*/index.html` 内联 `articles` 对象 + `newsroom/index.html` 列表页即可。

## 维护约定

- 改职位文案：只改 `career-detail.js` 的 `jobs` 对象，然后跑 `npm run prerender:careers`。
- 增删页面：跑 `npm run sitemap` 与 `npm run structured-data`（两者都有 `:check` 变体可校验）。
