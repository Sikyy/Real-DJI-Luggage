# DJI Luggage Website Image Production Brief

这份表按当前网站代码整理，用于替换网站内的主要图片区域。建议所有照片交付 JPG/WebP，UI mockup 可交付 PNG/WebP，图标/Logo 优先 SVG 或透明 PNG。

通用规则：

- 多数图片使用 `object-fit: cover` 或 `background-size: cover`，会在不同屏幕上裁切。主体放在画面中间 60% 安全区，边缘只放环境信息。
- 页面本身已经叠加文字、按钮和深色遮罩，图片里不要再压文字。
- 暗色 hero / CTA 图建议画面本身对比清楚，但不要太复杂；文字通常在左下、居中或两侧覆盖。
- 表里的“建议尺寸”是作图交付尺寸，不一定等于 CSS 像素；按这个尺寸出图会比较抗高清屏和裁切。

## Global / Repeated

| 图片位 | 当前用途和文案 | 建议尺寸 | 构图建议 |
|---|---|---:|---|
| Header/Menu Logo 黑白版 | 全站导航 Logo。当前文件为 `715 x 81` 透明 PNG。 | `1430 x 162` PNG，或 SVG | 保留透明背景；黑白各一版。 |
| Footer 大 Logo | 全站页脚背景式大字标，当前为 SVG。 | SVG 优先 | 如果换品牌字标，保持超宽横向比例。 |
| Final CTA 背景图 | 多页面复用：`LET'S GET TO WORK` / `Build Your Luggage Line` / `Get a Quote`；Careers 用 `Build With DJI Luggage`，职位详情用 `Start Your Luggage Program`。 | `2880 x 1000`，最低 `2400 x 900` | 横向宽图，中心偏暗、画面干净；适合工厂、成品行李箱、装箱/出货场景。文字在中央覆盖，主体不要压在正中小范围。 |

## Homepage

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| 首页 Hero 视频/封面 | `Manufacturing Luggage For Growing Brands`；`We help brands develop, produce, inspect, and prepare luggage orders for export.` | 视频/图：`3840 x 2160` 或 `2560 x 1440` | 最重要首屏。建议用行李箱生产线、成品箱陈列、工厂质检或包装出货的横向大场景。左下和右下留暗区给标题和描述。 |
| Values 卡片 1 | `Community`；`We work closely with buyers, product teams, and importers...` | `1200 x 1500` | 买家/团队沟通、样品评审、会议桌上有行李箱样品。 |
| Values 卡片 2 | `Innovation`；`Our sample and production teams solve product details early...` | `1200 x 1500` | 材料、拉杆、轮子、锁具、内衬等细节研发或样品打样。 |
| Values 卡片 3 | `Sustainability`；`We help clients choose durable structures, sensible packaging...` | `1200 x 1500` | 耐用材料、可持续包装、整洁仓储或纸箱打包，风格务实。 |
| Yellow CTA 内联小图 1 | 句子里的 `Practical [image] manufacturing helps...` | `640 x 480` | 近景：工厂操作、缝纫/装配/质检手部细节。实际显示很小，主体要大。 |
| Yellow CTA 内联小图 2 | 句子里的 `...helps [image] luggage brands scale.` | `640 x 480` | 近景：成品行李箱、轮子/拉杆/箱壳细节、成品堆放。 |
| How We Work 背景 | `DJI Luggage keeps product development grounded...`；步骤 `Plan / Sample / Produce` | `2880 x 1800` | 横向大图，适合生产流程、样品台、包装线或工厂纵深。页面有深色遮罩和网格，主体不要太暗。 |
| 首页 Newsroom 卡片 | 5 张新闻卡：`Choosing the Right Luggage Manufacturer`、`OEM vs ODM for Luggage Brands`、`Quality Checks in Suitcase Production`、`Material Choices for Hard-Shell Luggage`、`Planning Your First Bulk Luggage Order` | 每张 `1200 x 1500` | 与新闻列表共用同一批文章封面，见 Newsroom 表。 |
| 首页 Final CTA | `LET'S GET TO WORK` / `Build Your Luggage Line` | `2880 x 1000` | 可复用全站 CTA 背景。 |

## About

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| About 顶部大图 | `Learn About DJI Luggage` 后的全宽图；下方 `WHO WE ARE` 文案讲团队、生产、质检、出口。 | `2880 x 1200` | 横向工厂/生产线/团队工作照。此处有 fixed/parallax 效果，中心区域要能独立成立。 |
| Our Reach 地球视频/视觉 | `Based in Indonesia, Supporting Luggage Brands Across the Globe`；城市：Paris, London, Shanghai, Los Angeles, Sao Paulo, Mumbai | 视频/图：`2400 x 1080` 或 `2211 x 995` | 如果替换，做全球贸易/航线/地图感视觉。黑底更适配当前版式。 |
| Key Metrics 图片 | `DJI Luggage turns practical factory capability into measurable production performance.`；指标 `10+ Years Experience / 75 Employees / 300 Production Details Tracked / 80k Units Annual Capacity` | `1200 x 1500` | 建议换成真实工厂管理、QC 表单、生产计划板、样品跟进场景。 |
| Testimonials Slide 1 | `"The sampling process was clear, fast, and practical for our launch plan."` / `TechCorp` | `2880 x 1600` | 横向满屏图，暗化后显示。建议样品确认、买家验样、行李箱样品桌。 |
| Testimonials Slide 2 | `"Reliable, efficient, and always communicative during production."` / `GreenLeaf Organics` | `2880 x 1600` | 生产现场、装配线、箱体检查。 |
| Testimonials Slide 3 | `"Their QC feedback helped us avoid costly changes after mass production."` / `Luna Interiors` | `2880 x 1600` | 质检人员检查拉杆、轮子、拉链、包装。 |
| Leadership 人像卡 | `Leadership`；当前姓名：Matt Longst, Nicole Sue, Melanie Lumon, John Mossier, Stacy Freed | 每张 `1000 x 1440`，最低 `866 x 1246` | 竖版团队/管理层肖像。当前显示比例约 `433 x 623`，移动端约 `280 x 420`。如果没有真实人员，建议改成工厂团队/岗位人物照，并同步改姓名职位。 |
| Careers CTA 图案背景 | `Explore careers with us and help build better luggage for global brands` | SVG 或 `2880 x 1200` | 当前是抽象网格背景；可继续用品牌图案，不必换成照片。 |
| About Final CTA | `LET'S GET TO WORK` / `Build Your Luggage Line` | `2880 x 1000` | 可复用全站 CTA 背景。 |

## Services

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| Services Hero 背景 | `Our Services`；`DJI Luggage helps brands turn luggage concepts into export-ready products with OEM and ODM manufacturing support.` | `2880 x 1200`，最低 `2400 x 1000` | 横向宽幅，行李箱工厂、仓储、包装/出货，画面会被压暗。 |
| Our Focus 全宽图 | 标签：`+ OEM LUGGAGE`、`+ ODM DESIGN`、`+ QUALITY CONTROL`、`+ EXPORT SUPPORT` | `2880 x 1200` 或 `2400 x 1000` | 宽幅流程感：产线、仓库、多个成品箱、包装区。底部有标签，底部不要放主体脸部。 |
| Service 01 | `OEM Manufacturing`；按客户尺寸、材料、颜色、五金、包装生产。 | `1200 x 756`，最低 `1000 x 630` | 横向小图。成品箱生产、箱壳、轮子、拉杆装配。 |
| Service 02 | `ODM Development`；工厂结构、组件选项、打样、生产建议。 | `1200 x 756` | 样品开发、材料板、组件选择、设计评审。 |
| Service 03 | `Quality Control`；检查材料、做工、结构、功能、包装一致性。 | `1200 x 756` | QC 检测：轮子、拉杆、拉链、箱体抗压/外观检查。 |
| Service 04 | `Export Preparation`；箱唛、包装细节、出货文档支持。 | `1200 x 756` | 纸箱、托盘、仓库、装柜/出货准备。 |
| Industries We Cover | `Travel Brands / Private Label / Ecommerce / Retail / Distributors / Corporate Gifting / Hospitality / Importers` | `1400 x 1260`，最低 `1326 x 1194` | 大竖横接近方图。可用多款行李箱陈列、零售/电商/仓储结合场景。 |
| Services Final CTA | `LET'S GET TO WORK` / `Build Your Luggage Line` | `2880 x 1000` | 可复用全站 CTA 背景。 |

## Platform

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| Platform Hero 背景 | `Our Platform`；`clear manufacturing workflow for luggage development, production, inspection, and export preparation.` | `2880 x 1200` | 横向暗色背景，建议制造流程、工厂管理、样品/订单白板。 |
| Tablet Mockup | `PRODUCTION WORKFLOW`；`One clear process connects product ideas, sampling, production, inspection, and export preparation.` | `1870 x 1512` PNG/WebP | 当前是界面 mockup，显示为 `935 x 756`。建议做订单/样品/QC/包装进度 dashboard，不要用物流路线 UI。 |
| Feature A 图片 | `PRODUCT DEVELOPMENT MADE SIMPLE` / `From Idea To Approved Sample` | `1342 x 1342` | 方图。产品 brief、材料选择、样品审批界面或实拍组合。 |
| Feature B 图片 | `PRODUCE SMARTER` / `Bulk Orders, Clearly Managed` | `1342 x 1342` | 方图。生产排期、QC 节点、包装要求 dashboard 或工厂管理场景。 |
| Why Choose 背景 | `WHY CHOOSE US`；`Clear communication and practical control for luggage production.` | `2880 x 1600` | 满屏横图，会深色压暗。适合整洁生产线、团队沟通、质检台。 |
| Highlight Icons 01-06 | 六个功能点：规格对齐、里程碑追踪、材料组件协调、产品线适配、反馈改进、出口准备 | SVG 或 `200 x 200` 透明 PNG | 当前是 100px 图标。若要换，统一线性图标风格即可，不建议用照片。 |
| Platform Final CTA | `LET'S GET TO WORK` / `Build Your Luggage Line` | `2880 x 1000` | 可复用全站 CTA 背景。 |

## Careers

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| Careers 图片漂移墙 1 | 页面文案：`Careers That Move You Forward.`；讲生产、质量、出口、样品开发岗位。 | `772 x 963` 或 `1000 x 1250` | 竖图。工厂员工、生产现场、团队工作。 |
| Careers 图片漂移墙 2 | 同上 | `1030 x 1220` 或 `1200 x 1420` | 竖图。团队协作或工厂走访。 |
| Careers 图片漂移墙 3 | 同上 | `902 x 656` 或 `1200 x 872` | 横图。生产线/仓库环境。 |
| Careers 图片漂移墙 4 | 同上 | `770 x 939` 或 `1000 x 1220` | 竖图。岗位人物或质检细节。 |
| Careers 图片漂移墙 5 | 同上 | `1030 x 1220` 或 `1200 x 1420` | 竖图。员工培训/样品开发。 |
| Careers 图片漂移墙 6 | 同上 | `772 x 963` 或 `1000 x 1250` | 竖图。包装/装配现场。 |
| Careers 图片漂移墙 7 | 同上 | `902 x 656` 或 `1200 x 872` | 横图。团队合影或工作环境。 |
| Careers 图片漂移墙 8 | 同上 | `770 x 939` 或 `1000 x 1220` | 竖图。生产细节或人物半身。 |
| Benefits 人像 | `At DJI Luggage, you'll find practical training, room for growth...` | `1000 x 1250`，最低 `800 x 1000` | 竖图，人物/员工半身或工作照。当前显示约 `500 x 624`。 |
| Clock/Location 背景 | `Bogor` + 实时时钟 | `3234 x 1760`，最低 `2880 x 1600` | 横向大图。建议 Bogor 工厂外观、园区、仓库外景或本地地标。底部右侧有时间文字，保留可读暗区。 |
| Careers Final CTA | `Let's Get to Work` / `Build With DJI Luggage` | `2880 x 1000` | 可复用 CTA，但也可换成团队/招聘氛围图。 |

## Newsroom / Articles

列表页和首页轮播都使用 `4:5` 文章封面；文章详情页同一张图会作为大横图显示。因此最好每篇提供一张高分辨率主图，构图既能裁成竖版卡片，也能裁成横版详情。

推荐交付：每篇 `2400 x 3000`，主体居中；如果只能做横图，至少 `2880 x 1600`，并确保中心可裁成 `4:5`。

注意：Newsroom 列表、文章模板 fallback 数据和旧 slug 跳转已按下表统一；做图时可以直接按下表的前台文案来。

| 文章 | 类型/日期 | 对应封面画面建议 |
|---|---|---|
| `Choosing the Right Luggage Manufacturer` | Insights / `10.31.25` | 工厂全景、生产线、样品评审，体现“选择制造商”。 |
| `OEM vs ODM for Luggage Brands` | Insights / `10.02.25` | 左右对比感：客户规格/OEM 与工厂开发/ODM；可拍材料、样品、图纸。 |
| `Quality Checks in Suitcase Production` | News / `9.27.25` | QC 检查行李箱轮子、拉杆、拉链、外观或包装。 |
| `Material Choices for Hard-Shell Luggage` | Insights / `9.17.25` | PC/ABS 箱壳、色板、纹理、配件样板。 |
| `Planning Your First Bulk Luggage Order` | News / `9.08.25` | 订单计划、纸箱、生产排期、批量成品箱。 |
| `From Sample to Production` | News / `9.01.25` | 从样品确认到批量生产的流程：样品台、生产确认、QC 节点、包装前检查。 |
| `Building a Private-Label Travel Line` | Insights / `8.29.25` | 私标品牌行李箱、logo 打样、包装设计、成品陈列。 |
| `Packaging and Export Prep for Suitcases` | News / `8.12.25` | 纸箱、箱唛、条码、托盘、装柜前准备。 |

文章详情页：

| 图片位 | 对应文案 | 建议尺寸 |
|---|---|---:|
| Article Hero Media | 文章标题、Introduction、Date、Author、Type；正文 fallback 为产品 brief、sampling、quality checks、packaging、repeat orders。 | `2880 x 1600` 或从 `2400 x 3000` 主图中心裁切 |
| Article Final CTA | `Ready to Build` / `Start Your Luggage Program` | `2880 x 1000` |

## Contact / Utility Pages

| 图片位 | 对应文案 | 建议尺寸 | 画面方向 |
|---|---|---:|---|
| Contact Hero 背景 | `info@djiluggage.id` / `Contact Us` / `Request a Quote` 表单 | `3200 x 1800`，最低 `2880 x 1600` | 大横图，当前显示极宽并向左偏移。建议用工厂/样品室/成品箱陈列，左侧保留暗区给 `Contact Us`。右侧有表单卡片，右侧主体会被遮挡。 |
| Privacy Policy CTA 背景 | `Need help with your luggage program?` / `Contact us to discuss product development...` | `2880 x 1000` | 可复用 CTA 背景。 |
| 404 视频/封面 | `The page you are looking for was not found or relocated.` / `Go Home` | 视频/图：`3840 x 2160` | 可选替换。建议用轻微动态的工厂/仓库/行李箱输送线，保持暗色背景。 |

## Job Detail Pages

职位详情页没有独立 hero 图片，主要只有底部 CTA：

| 图片位 | 对应文案 | 建议尺寸 | 备注 |
|---|---|---:|---|
| Job Detail Final CTA | `Ready To Build` / `Start Your Luggage Program` | `2880 x 1000` | 当前所有职位详情页复用同一张 CTA 背景。 |

当前职位标题：

- `Production Supervisor`
- `Quality Control Specialist`
- `Export Sales Coordinator`
- `Sample Development Technician`
