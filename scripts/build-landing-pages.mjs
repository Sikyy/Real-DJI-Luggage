/**
 * 生成 6 个落地页。
 *
 * 为什么不手写 HTML：站点的导航、菜单浮层、页脚、GTM/Consent 样板在每个页面里
 * 都是内联的。手写 6 个新页会把这份样板再复制 6 遍（全站将变成 63 份），
 * 以后改一次导航要动 63 个文件。这里改为从 services.html 抽取外壳，
 * 内容以数据形式定义在下面，需要改文案就改本文件再重跑。
 *
 * 生成后的页面仍需跑：
 *   npm run breadcrumbs     ← 注入 BreadcrumbList（脚本会自动跳过已有面包屑的页面）
 *   npm run org-schema      ← 本脚本已自带强化后的 Organization，此步为兜底
 *   npm run sitemap         ← 收录进 sitemap
 *
 * 用法：node scripts/build-landing-pages.mjs [--check]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')
const SITE = 'https://djiluggage.id'

// ---------------------------------------------------------------- 外壳

const shell = readFileSync(path.join(root, 'services.html'), 'utf8')

const at = (marker, from = 0) => {
  const i = shell.indexOf(marker, from)
  if (i < 0) throw new Error(`外壳中找不到标记：${marker}`)
  return i
}
const HEAD_A = shell.slice(0, at('<title>'))
const HEAD_B_RAW = shell.slice(at('<link rel="preload"'), at('<section class="services-hero">'))
const BODY_A = shell.slice(at('<body>'), at('<section class="services-hero">'))
const BODY_B = shell.slice(at('<!-- FOOTER -->'))

// HEAD_B 里含 services 专属的 BreadcrumbList，剥掉后由 build-breadcrumbs 统一生成
const HEAD_B = HEAD_B_RAW.replace(
  /[ \t]*<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"[\s\S]*?<\/script>\n?/g,
  '',
)

const LP_CSS = `  <style>
    /* ===== landing page content ===== */
    .lp-section { background: #fff; padding: 48px 24px 96px; }
    .lp-inner { max-width: 1080px; margin: 0 auto; }
    .lp-inner h2 {
      margin: 56px 0 0;
      font-family: 'Geist', sans-serif; font-size: 28px; font-weight: 400;
      letter-spacing: -1.2px; line-height: 34px; color: #000;
    }
    .lp-inner > h2:first-child { margin-top: 0; }
    .lp-inner h3 {
      margin: 32px 0 0;
      font-family: 'Geist', sans-serif; font-size: 18px; font-weight: 400;
      letter-spacing: -0.5px; line-height: 24px; color: #000;
    }
    .lp-inner p { margin: 18px 0 0; font-size: 16px; line-height: 24px; color: #000; max-width: 780px; }
    .lp-inner ul { margin: 18px 0 0; padding-left: 22px; max-width: 780px; }
    .lp-inner li { margin-top: 8px; font-size: 16px; line-height: 24px; color: #000; }
    .lp-inner table {
      margin: 24px 0 0; width: 100%; max-width: 900px;
      border-collapse: collapse; font-size: 15px; line-height: 21px; color: #000;
    }
    .lp-inner th, .lp-inner td {
      border-bottom: 1px solid #d4d4d4; padding: 12px 16px 12px 0;
      text-align: left; vertical-align: top;
    }
    .lp-inner th {
      font-weight: 400; text-transform: uppercase; font-size: 12px;
      letter-spacing: 0.08em; color: rgba(0,0,0,.55);
    }
    .lp-inner a { color: #000; text-decoration: underline; text-underline-offset: 3px; }
    .lp-lead { font-size: 18px !important; line-height: 27px !important; }
    @media (max-width: 768px) {
      .lp-section { padding: 32px 20px 64px; }
      .lp-inner h2 { font-size: 22px; line-height: 28px; margin-top: 40px; }
    }
  </style>
`

// ---------------------------------------------------------------- 内容渲染

function block(b) {
  if (b.h3) return `      <h3>${b.h3}</h3>`
  if (b.p) return `      <p${b.lead ? ' class="lp-lead"' : ''}>${b.p}</p>`
  if (b.ul) return `      <ul>\n${b.ul.map((li) => `        <li>${li}</li>`).join('\n')}\n      </ul>`
  if (b.table) {
    const head = `        <tr>${b.table.head.map((h) => `<th>${h}</th>`).join('')}</tr>`
    const rows = b.table.rows.map((r) => `        <tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')
    return `      <table>\n${head}\n${rows}\n      </table>`
  }
  throw new Error(`未知内容块：${JSON.stringify(Object.keys(b))}`)
}

function renderSections(sections) {
  return sections.map((s) => {
    const parts = [`      <h2>${s.h2}</h2>`]
    for (const b of s.blocks || []) parts.push(block(b))
    return parts.join('\n')
  }).join('\n\n')
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------- 页面定义

const ORG = {
  '@type': 'Organization',
  name: 'DJI Luggage',
  url: `${SITE}/`,
  logo: `${SITE}/assets/brand/dji-luggage-logo-black.png`,
  image: `${SITE}/assets/og/dji-luggage-og.jpg`,
  description: 'Indonesian luggage and suitcase manufacturer offering OEM & ODM development, production, quality control, and export.',
  email: 'info@djiluggage.id',
  telephone: '+6285111384747',
  address: { '@type': 'PostalAddress', addressLocality: 'Bogor', addressCountry: 'ID' },
  disambiguatingDescription: 'Indonesian luggage and suitcase manufacturer in Bogor, West Java. An OEM and ODM factory producing hard-shell and soft-shell travel luggage for brands, importers and distributors - a luggage manufacturer, not a drone, camera or consumer-electronics company.',
  areaServed: ['Indonesia', 'China', 'Australia', 'Germany'],
  knowsAbout: ['Luggage manufacturing', 'OEM manufacturing', 'ODM product development', 'Hard-shell suitcase production', 'Aluminium frame luggage', 'Export packaging'],
}

const CTA = `  <section class="final-cta" data-header="dark">
    <h2 class="cta-title" id="ctaTitle">Build Your<br>Luggage Line</h2>
    <a href="/contact" class="btn btn-glass reveal">Get a Quote</a>
  </section>

`

const PAGES = [
  // ------------------------------------------------------------ 1. OEM
  {
    out: 'services/luggage-oem/index.html',
    path: '/services/luggage-oem',
    title: 'Luggage OEM Manufacturing in Indonesia | DJI Luggage',
    description: 'OEM luggage manufacturing in Indonesia: we build to your specification with in-house moulds, MOQ 200 units and a 25-55 day lead time. Request a quote.',
    h1: 'Luggage OEM Manufacturing',
    heroDesc: 'We build suitcases to your specification - your shell shape, your components, your branding - from our factory in Bogor, Indonesia.',
    service: { name: 'Luggage OEM Manufacturing', type: 'OEM luggage manufacturing' },
    sections: [
      { h2: 'What OEM means at our factory', blocks: [
        { p: 'In an OEM programme you supply the product definition and we manufacture to it. That can be a full technical pack, a set of drawings, or a physical reference sample. We quote the tooling, materials, components and assembly separately, so you can see what each decision costs.', lead: true },
        { p: 'The work runs at our own plant in Bogor, West Java, Indonesia: two 1,500-tonne injection machines and 100% in-house mould making, which removes the third-party tool shop queue from the schedule.' },
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Payment: 30% deposit, 70% balance, unified for all order types',
          'Sample development: 7-15 working days after artwork and component direction are approved',
        ] },
      ] },
      { h2: 'What you supply, what we handle', blocks: [
        { table: { head: ['Stage', 'Your input', 'Our work'], rows: [
          ['Brief', 'Size, shell direction, wheel system, handle, lining, lock, colour, branding method, target price, quantity', 'Feasibility review against our existing structures and tooling'],
          ['Tooling', 'Approval of mould cost and shell shape', 'Mould design and manufacture in-house'],
          ['Sampling', 'Feedback on the first sample', 'Sample build, revision rounds, specification lock'],
          ['Production', 'Purchase order and deposit', 'Moulding, assembly, in-line inspection'],
          ['Inspection', 'AQL level and any third-party inspector', 'Incoming, in-line and final packing checks'],
          ['Export', 'Destination market requirements', 'Carton marks, packing, origin documentation'],
        ] } },
      ] },
      { h2: 'Materials you can specify', blocks: [
        { ul: [
          '<strong>Polycarbonate and ABS+PC</strong> hard shells, moulded on site',
          '<strong>PP</strong> shells for lighter, value-focused ranges',
          '<strong>Aluminium frame</strong> - a PC or ABS+PC shell with an extruded aluminium profile frame, bent and riveted closed rather than welded',
          '<strong>Fabric and soft-shell</strong> constructions for ranges where packability matters more than rigidity',
        ] },
        { p: 'Zipper and zipperless closures are both available. Wheels, handles, locks and lining are quoted against your brief; component minimums come from their own manufacturers.' },
      ] },
      { h2: 'How OEM differs from ODM', blocks: [
        { p: 'OEM gives you a product that is yours alone, and asks you to invest in tooling and sampling. ODM starts from a structure we already produce and adapts it, which reaches market faster and costs less. Both run under the same commercial terms here. If you have not chosen yet, the comparison on our <a href="/newsroom/oem-vs-odm-for-luggage-brands/">OEM vs ODM guide</a> sets out the trade-offs.' },
      ] },
      { h2: 'Testing and evidence', blocks: [
        { p: 'Structural testing follows QB/T 2155-2018: a drop from 900 mm onto 45-grade steel after conditioning at 18-25 °C, a low-temperature drop from 90 cm after four hours at -12 °C, wheel runs of 8 km on a cement drum plus 4 km on a cleated conveyor with wear within 2 mm, stacking of 40 kg or 60 kg for four continuous hours depending on case size, and 16-hour salt spray to QB/T 3826. On aluminium frame cases the case mouth is tested by Brinell hardness to GB/T 231.1 and must reach at least 40 HWB.' },
        { p: 'Finished cases are sent to SGS for testing. Those are test reports on submitted samples, not a product certification, and component certifications belong to the component manufacturers.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Who owns the mould?</strong> This is set in the commercial terms. Ask before the order, not after, because it decides what happens if you move production later.' },
        { p: '<strong>Can I start smaller than 200 units?</strong> The minimum is 200 units per specification. It applies per colour and per size combination you want produced.' },
        { p: '<strong>Do you make full aluminium cases?</strong> Our aluminium range is aluminium-frame construction: a PC or ABS+PC shell with a riveted extruded aluminium frame. The aluminium is the structural frame, not the whole case.' },
      ] },
    ],
  },

  // ------------------------------------------------------------ 2. ODM
  {
    out: 'services/luggage-odm/index.html',
    path: '/services/luggage-odm',
    title: 'Luggage ODM Development in Indonesia | DJI Luggage',
    description: 'ODM luggage development in Indonesia: adapt proven suitcase structures with your colours, hardware and branding. Faster to market, MOQ 200 units.',
    h1: 'Luggage ODM Development',
    heroDesc: 'Start from a structure already in production and make it yours - materials, colour, hardware, lining and packaging.',
    service: { name: 'Luggage ODM Development', type: 'ODM luggage product development' },
    sections: [
      { h2: 'What ODM means at our factory', blocks: [
        { p: 'In an ODM programme the core structure already exists and has been through production. You change what makes the product yours: shell material and finish, colour, wheels, telescopic handle, lock, lining, logo and packaging. Because the mould and the assembly process are already proven, there is no tooling investment and fewer sampling rounds.', lead: true },
        { p: 'That is the trade: faster and cheaper to start, with the base construction shared rather than exclusive to you. Colour, hardware, lining, branding and packaging can still be exclusive to your programme.' },
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Payment: 30% deposit, 70% balance, unified for all order types',
          'Capacity: 30,000 units a month, about 70% of it hard shell',
        ] },
      ] },
      { h2: 'What you can change without new tooling', blocks: [
        { table: { head: ['Element', 'Options'], rows: [
          ['Shell', 'PP, PC, ABS+PC, fabric; matte or gloss finish'],
          ['Structure', 'Zipper or zipperless closure; aluminium frame variant'],
          ['Colour', 'Shell colour, trim colour, lining colour'],
          ['Wheels', 'Two-wheel or four-wheel spinner sets'],
          ['Telescopic handle', 'Multi-stage aluminium or steel trolley systems'],
          ['Lock', 'TSA combination lock, or zipperless closure hardware'],
          ['Lining', 'Fabric choice, dry-wet separation pockets, interior mesh'],
          ['Branding', 'Badge, print, lining print, puller, carton mark'],
          ['Packaging', 'Carton, insert, dust bag, hangtag, barcode'],
        ] } },
      ] },
      { h2: 'When ODM is the right choice', blocks: [
        { ul: [
          'You are launching a first luggage range and want to limit upfront capital',
          'You want to test a market or a price band before committing to tooling',
          'You are extending an existing line and the structure is not the selling point',
          'You want stock on shelf within a quarter rather than designing from zero',
        ] },
        { p: 'Many brands enter with ODM, learn which models sell, then move the winners to OEM once volume justifies tooling. Our <a href="/newsroom/oem-vs-odm-for-luggage-brands/">OEM vs ODM guide</a> covers that sequence in detail.' },
      ] },
      { h2: 'Testing and evidence', blocks: [
        { p: 'ODM structures are tested to the same standard as OEM programmes, QB/T 2155-2018: a 900 mm loaded drop onto 45-grade steel, a low-temperature drop from 90 cm at -12 °C, wheel runs of 8 km plus 4 km with wear within 2 mm, four-hour stacking at 40 kg or 60 kg, and 16-hour salt spray to QB/T 3826. Finished cases are sent to SGS for testing, which produces test reports on submitted samples rather than a product certification.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Is the product exclusive to me?</strong> The base structure may be shared. Colour, hardware, lining, branding and packaging can be exclusive to your programme.' },
        { p: '<strong>Can I move to OEM later?</strong> Yes. Once a structure sells, tooling for a distinct shell shape can be quoted and the programme moves to OEM using the same components.' },
        { p: '<strong>How long does sampling take?</strong> Seven to fifteen working days after artwork and component direction are approved - usually fewer rounds than an OEM programme because the construction is already running.' },
      ] },
    ],
  },

  // ------------------------------------------------------------ 3. Private label
  {
    out: 'services/private-label-luggage/index.html',
    path: '/services/private-label-luggage',
    title: 'Private Label Luggage Manufacturing | Indonesia Factory',
    description: 'Private label luggage manufacturing in Indonesia: your brand on the case, the lining and the carton. MOQ 200 units, 25-55 day lead time, OEM and ODM.',
    h1: 'Private Label Luggage Manufacturing',
    heroDesc: 'Your name on the product, the lining, the hardware and the carton - produced to your specification in Bogor, Indonesia.',
    service: { name: 'Private Label Luggage Manufacturing', type: 'Private label luggage production' },
    sections: [
      { h2: 'What a private label programme involves', blocks: [
        { p: 'Private label means the product carries your name and nobody else\'s. It can run as OEM, where you define the product, or as ODM, where you adapt a structure we already produce. Either way, three decisions have to be settled before sampling: the shell or fabric direction, the branding method, and the packaging.', lead: true },
        { p: 'Everything else - wheels, telescopic handle, locks, lining, interior layout - can be adapted from structures already in production, which is what keeps a private label launch affordable.' },
      ] },
      { h2: 'Branding methods we apply', blocks: [
        { table: { head: ['Method', 'Where it goes', 'Notes'], rows: [
          ['Metal badge', 'Shell front', 'Most durable; carries a tooling cost for the badge die'],
          ['Silkscreen or transfer print', 'Shell, lining', 'Lower setup cost; suitable for smaller programmes'],
          ['Woven or printed label', 'Interior lining', 'Cheapest branding point; often used with a badge'],
          ['Custom puller', 'Zipper or closure', 'Small visible detail with a low minimum'],
          ['Lining print', 'Interior', 'Strong perceived value; needs a print repeat'],
          ['Carton mark', 'Export carton', 'Required for most retail and distribution channels'],
        ] } },
      ] },
      { h2: 'Commercial terms', blocks: [
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Payment: 30% deposit and 70% balance, unified for all order types',
          'Sample development: 7-15 working days after artwork and component direction are approved',
        ] },
        { p: 'The minimum applies per specification - so a programme with three colours is quoted as three specifications unless the colour change does not affect tooling or components.' },
      ] },
      { h2: 'Packaging built for the destination market', blocks: [
        { p: 'Export packing is either single pack or nested pack. Nested sets place a 20-inch case inside a 24-inch inside a 28-inch, cutting freight volume per unit. Inside the carton: non-woven fabric or EPE foam between nested cases, a PE or PP dust bag on every case including nested inners, die-cut corrugated board or EPE foam at the wheel housings and handle mounts, and silica gel desiccant or an anti-mould patch in the interior mesh pocket for container rain on long sea routes.' },
        { p: 'Packing is produced to EU PPWR, US CONEG with heavy metals below 100 ppm, and REACH with no DMFu. Origin documentation is the Indonesian Certificate of Origin.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Can the whole range be exclusive to us?</strong> Branding, packaging, colour and component selection can be exclusive. The underlying structure may be shared where it is an ODM base.' },
        { p: '<strong>Do you handle retail-ready packaging?</strong> Yes - carton marks, barcode labels, hangtags, manuals and PE bags are prepared by destination market.' },
        { p: '<strong>What do you need from us to quote?</strong> Product type and size range, shell direction, branding method, target market, target price and expected quantity. The <a href="/contact">quote form</a> collects exactly those.' },
      ] },
    ],
  },

  // ------------------------------------------------------------ 4. Aluminium frame
  {
    out: 'aluminum-frame-luggage/index.html',
    path: '/aluminum-frame-luggage',
    title: 'Aluminum Frame Luggage Manufacturing | OEM & ODM Factory',
    description: 'How aluminum frame luggage is made: extruded profile, riveted frame, anodised finish and a case mouth tested to at least 40 HWB. OEM and ODM from Indonesia.',
    h1: 'Aluminum Frame Luggage Manufacturing',
    heroDesc: 'How an aluminium frame case is actually built - the profile, the riveting, the anodising and the tests behind it.',
    service: { name: 'Aluminum Frame Luggage Manufacturing', type: 'Aluminium frame luggage production' },
    sections: [
      { h2: 'What an aluminium frame case is', blocks: [
        { p: 'An aluminium frame case is not a solid aluminium body. It is a polycarbonate or ABS+PC shell joined to an extruded aluminium profile frame that runs around the case mouth. The aluminium carries the load at the opening - the point where a zippered case fails first - and the shell provides the body. The frame is bent from profile and riveted closed, not welded.', lead: true },
        { p: 'That distinction matters when you are comparing quotations. A supplier describing a case as entirely aluminium while quoting a polycarbonate shell is describing two different products.' },
      ] },
      { h2: 'How the frame is made', blocks: [
        { table: { head: ['Step', 'Where it happens', 'What it involves'], rows: [
          ['Extrusion', 'Specialist profile plant', 'Aluminium is extruded into the frame profile. Extrusion is a specialist process and is normally outsourced, including by large factories.'],
          ['Anodising', 'Specialist plant', 'The anodic oxide layer that gives the frame its finish and corrosion resistance. Standard finish, oxide film of 10-12 micrometres.'],
          ['Cutting and punching', 'In-house', 'Profile is cut to the case perimeter and punched for rivet positions.'],
          ['Bending', 'In-house', 'Profile is bent to the case corner radius - the step that decides how cleanly the frame meets the shell.'],
          ['Riveting', 'In-house', 'The frame is closed and fixed around the case mouth by riveting rather than welding.'],
          ['Frame-to-shell fixing', 'In-house', 'Frame and shell are joined and the case mouth aligned before assembly.'],
        ] } },
        { p: 'We are explicit about which steps are ours. Extrusion and anodising being outsourced is normal in this industry and not a weakness; what matters is that mould making, bending, riveting and alignment stay inside our own plant.' },
      ] },
      { h2: 'Frame hardness: the number to ask for', blocks: [
        { p: 'The aluminium case mouth is tested by Brinell hardness to GB/T 231.1 and must reach at least 40 HWB. This is a requirement of QB/T 2155-2018 itself, not an optional extra. A frame below that figure will deform at the opening long before the shell fails, which is why a frame quotation without a hardness figure is incomplete.' },
      ] },
      { h2: 'Testing that applies to aluminium frame cases', blocks: [
        { ul: [
          'Case mouth hardness: Brinell, minimum 40 HWB to GB/T 231.1',
          'Salt spray: 16 hours to QB/T 3826, with no more than three corrosion points, each no larger than one square millimetre',
          'Drop: conditioned at 18-25 °C, released from 900 mm onto 45-grade steel, once handle-up and once side-handle-up, to QB/T 2155-2018',
          'Low-temperature drop: conditioned at -12 °C for four hours, then dropped from 90 cm',
          'Wheel and trolley testing: 8 km on a cement drum plus 4 km on a cleated conveyor, with wheel wear within 2 mm',
        ] },
        { p: 'Finished cases are sent to SGS for testing, which produces test reports on submitted samples rather than a product certification.' },
      ] },
      { h2: 'Materials and finishes', blocks: [
        { p: 'Shells are polycarbonate or ABS+PC. Frame profiles are 6-series aluminium-magnesium alloy, with the corner radius and closure made from the same alloy family. Anodising is the standard finish; the oxide film is specified at 10-12 micrometres. Four colourways are in current production across the frame range, and custom anodising is quoted per programme.' },
      ] },
      { h2: 'Ordering aluminium frame luggage', blocks: [
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Payment: 30% deposit, 70% balance',
          'Monthly capacity: 30,000 units, about 70% of it hard shell, from two 1,500-tonne injection machines and 100% in-house mould making',
        ] },
        { p: 'See the current frame range in the <a href="/collections/all/">catalogue</a>, or read how frame and full-aluminium constructions differ on the <a href="/aluminum-luggage/">aluminium luggage overview</a>.' },
      ] },
    ],
  },

  // ------------------------------------------------------------ 5. Aluminium (category)
  {
    out: 'aluminum-luggage/index.html',
    path: '/aluminum-luggage',
    title: 'Aluminum Luggage: Frame, Corners and Trim | DJI Luggage',
    description: 'Where aluminium is used in luggage: frame, corners, handle tubes and trim. Which parts are aluminium, why it matters, and how it compares with polycarbonate.',
    h1: 'Aluminum Luggage: Where the Metal Actually Goes',
    heroDesc: 'Aluminium appears in four places on a suitcase. Which ones a case uses decides what it weighs, what it costs and where it fails.',
    service: { name: 'Aluminum Luggage Manufacturing', type: 'Aluminium luggage production' },
    sections: [
      { h2: 'Four places aluminium appears on a suitcase', blocks: [
        { p: 'Aluminium is a material choice, not a single product category. On a suitcase it turns up in four distinct places, and a case can use any combination of them. Knowing which ones a quotation includes is the difference between comparing like with like and comparing marketing copy.', lead: true },
        { table: { head: ['Part', 'What it does', 'What changes if it is aluminium'], rows: [
          ['Case mouth frame', 'Runs around the opening; carries load where a zippered case fails first', 'Distributes impact at the opening; tested to at least 40 HWB'],
          ['Corner protectors', 'Absorbs the impacts a case actually receives in transit', 'Reinforced corners reduce shell cracking at the radius'],
          ['Telescopic handle tubes', 'Takes the bending load when the case is pulled', 'Resists deformation under a loaded, extended trolley'],
          ['Trim and hardware', 'Locks, badges, guard rings', 'Finish and perceived quality; the least structural of the four'],
        ] } },
      ] },
      { h2: 'Frame construction versus a solid metal body', blocks: [
        { p: 'A case described as "aluminium" may use an aluminium frame around a polycarbonate or ABS+PC shell, or it may be a solid aluminium body. They are different products with different weights, prices and failure modes. Our aluminium range is the frame construction: a PC or ABS+PC shell with an extruded aluminium profile frame, bent from profile and riveted closed rather than welded.' },
        { p: 'If a supplier describes a case as entirely aluminium while quoting a polycarbonate shell, the specification is inconsistent and should be resolved before you pay for a sample. The <a href="/aluminum-frame-luggage/">aluminium frame page</a> sets out exactly how that construction is built, step by step.' },
      ] },
      { h2: 'Aluminium or polycarbonate: how to decide', blocks: [
        { table: { head: ['Question', 'Points to an aluminium frame', 'Points to a polycarbonate shell'], rows: [
          ['What does it have to survive?', 'Frequent handling, hard impacts at the opening', 'General travel where weight matters more'],
          ['What price band is it sold in?', 'Premium and mid-premium', 'Volume and value ranges'],
          ['Is weight a selling point?', 'No - buyers accept the weight for rigidity', 'Yes - lighter cases are easier to sell and ship'],
          ['How is it merchandised?', 'Displayed, handled, compared in store', 'Sold online on specification and price'],
        ] } },
        { p: 'Most ranges use both. A brand will carry an aluminium frame line at the top and polycarbonate or PP below it, which is why our own catalogue runs <a href="/collections/all/">four product families</a> side by side.' },
      ] },
      { h2: 'Testing an aluminium case against the standard', blocks: [
        { p: 'Structural testing follows QB/T 2155-2018. The aluminium-specific requirements are the case mouth Brinell hardness - at least 40 HWB to GB/T 231.1 - and 16-hour salt spray to QB/T 3826, because an anodised frame is exposed to the same handling as the shell. Drop, low-temperature drop, wheel and stacking testing apply to the completed case regardless of shell material.' },
        { p: 'One point many quotations get wrong: the roller-drum impact and falling-ball tests written for plastic shells are explicitly not applicable to metal-bodied cases. An aluminium frame case has to be tested against the aluminium requirements, not borrowed from the plastic test list.' },
      ] },
      { h2: 'Producing aluminium luggage', blocks: [
        { ul: [
          'Materials: polycarbonate or ABS+PC shell with an extruded aluminium frame; 6-series aluminium-magnesium corners and closure',
          'Finish: anodised, oxide film specified at 10-12 micrometres',
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Capacity: 30,000 units a month, about 70% hard shell, with 100% in-house mould making',
        ] },
      ] },
    ],
  },

  // ------------------------------------------------------------ 6. Made in Indonesia
  {
    out: 'made-in-indonesia/index.html',
    path: '/made-in-indonesia',
    title: 'Made in Indonesia: Origin, Materials and Compliance',
    description: 'What Indonesian origin means for a luggage order: the Bogor factory, the Certificate of Origin, export markets, and the packaging regulations we build to.',
    h1: 'Made in Indonesia: Origin, Materials and Export Compliance',
    heroDesc: 'Where the factory is, what Indonesian origin documentation covers, and the packaging and chemical rules we actually build to.',
    service: { name: 'Indonesian Luggage Manufacturing', type: 'Luggage manufacturing in Indonesia' },
    sections: [
      { h2: 'Where the factory is', blocks: [
        { p: 'DJI Luggage manufactures in Bogor, West Java, Indonesia. Production, mould making, assembly and packing all happen at that site, which is why we can quote tooling and production on one schedule rather than two.', lead: true },
        { ul: [
          'Two 1,500-tonne injection machines, with 100% of moulds made in-house',
          'Monthly capacity of 30,000 units, about 70% of it hard shell',
          'Around 80 x 40HQ containers shipped each year',
          '75 staff across sampling, production coordination, quality control and export preparation',
          '10+ years of luggage production experience',
        ] },
      ] },
      { h2: 'What Indonesian origin covers', blocks: [
        { p: 'For a buyer, origin is a documentation question before it is a marketing question. Indonesian origin is evidenced by an Indonesian Certificate of Origin, which we prepare as part of export documentation support alongside carton marks and packing details.' },
        { table: { head: ['Market', 'Current export destinations'], rows: [
          ['Asia', 'China, Indonesia'],
          ['Oceania', 'Australia'],
          ['Europe', 'Germany'],
        ] } },
        { p: 'Destination requirements drive the packing specification. Tell us the market at the quotation stage and we quote the documentation and packaging set for that market rather than discovering it at shipment.' },
      ] },
      { h2: 'Packaging and chemical compliance we build to', blocks: [
        { p: 'These are the regulations our export packing is produced to. They are stated here because buyers increasingly have to evidence them at their end:' },
        { ul: [
          '<strong>EU PPWR</strong> - the European packaging and packaging waste regulation',
          '<strong>US CONEG</strong> - heavy metals in packaging below 100 ppm',
          '<strong>REACH</strong> - no DMFu',
        ] },
        { p: 'Alongside the regulatory set, the packing itself is built for a long sea route: a PE or PP dust bag on every case, non-woven fabric or EPE foam between nested cases, die-cut corrugated board or EPE foam at the wheel housings and handle mounts, and silica gel desiccant or an anti-mould patch in the interior mesh pocket to absorb the condensation that forms inside a container crossing the equator.' },
      ] },
      { h2: 'Materials, and reducing what travels', blocks: [
        { p: 'We produce in PP, PC, ABS+PC, aluminium frame and fabric. Two structural choices reduce the distance materials and tooling travel before a case is built:' },
        { ul: [
          '<strong>100% in-house mould making.</strong> A new shell shape does not wait in a third-party tool shop queue, and the mould does not have to be moved between sites.',
          '<strong>Aluminium frame construction.</strong> The frame is bent, riveted and aligned at our own plant. Extrusion and anodising are specialist processes and are carried out by specialist plants, which is normal in this industry.',
        ] },
      ] },
      { h2: 'What we do not claim', blocks: [
        { p: 'Buyers are shown a lot of environmental language that cannot be checked. We would rather state the boundaries of what we can evidence:' },
        { ul: [
          'We state the packaging regulations we build to, above. We do not publish recycled-content percentages or carbon figures, because we do not have audited numbers for them.',
          'ISO 9001 is not currently held, so we do not claim it. Quality is evidenced by our documented test standards and inspection stages.',
          'Finished cases are sent to SGS for testing. Those are test reports on submitted samples, not a product certification.',
        ] },
        { p: 'If your programme requires a specific certification, audited environmental data, or a factory audit, raise it at the quotation stage and we will tell you plainly whether we can meet it.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Can we visit or audit the factory?</strong> Factory profile, certificate archive and buyer audit document support are available before production scales.' },
        { p: '<strong>Which markets do you ship to today?</strong> China, Indonesia, Australia and Germany, at around 80 x 40HQ containers a year.' },
        { p: '<strong>Who prepares export documentation?</strong> We prepare carton marks, packing details and origin documentation. Destination-specific certificates remain the buyer\'s responsibility unless agreed in the quotation.' },
      ] },
    ],
  },
]

// ---------------------------------------------------------------- 生成

let written = 0
const report = []

for (const page of PAGES) {
  const canonical = `${SITE}${page.path}`
  const meta = `  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="DJI Luggage">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE}/assets/og/dji-luggage-og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(page.title)}">
  <meta name="twitter:description" content="${esc(page.description)}">
  <meta name="twitter:image" content="${SITE}/assets/og/dji-luggage-og.jpg">
`

  const jsonld = `  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', ...ORG })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.service.name,
    serviceType: page.service.type,
    description: page.description,
    url: canonical,
    provider: { '@type': 'Organization', name: 'DJI Luggage', url: `${SITE}/`, disambiguatingDescription: ORG.disambiguatingDescription },
    areaServed: ['Indonesia', 'China', 'Australia', 'Germany'],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: `${SITE}/contact`,
      servicePhone: '+6285111384747',
    },
  })}
  </script>
`

  const hero = `  <section class="services-hero">
    <img class="services-hero-bg" src="/assets/services/services-hero-luggage.png" alt="Luggage manufactured by DJI Luggage in Bogor, Indonesia" loading="eager">
    <div class="services-hero-content">
      <div class="services-hero-left">
        <h1 class="services-hero-title hero-anim-title">${page.h1}</h1>
        <div class="services-hero-arrow reveal">&darr;</div>
      </div>
      <div class="services-hero-right">
        <span class="desc-arrow reveal">&#8627;</span>
        <p class="services-hero-desc reveal">${esc(page.heroDesc)}</p>
      </div>
    </div>
  </section>
  <div class="services-divider"></div>
  <section class="lp-section" data-header="dark">
    <div class="lp-inner">
${renderSections(page.sections)}
    </div>
  </section>

`

  const html = HEAD_A + meta + HEAD_B.replace('</head>', LP_CSS + jsonld + '</head>') + BODY_A + hero + CTA + BODY_B

  const target = path.join(root, page.out)
  report.push({ out: page.out, title: page.title.length, desc: page.description.length, bytes: html.length })

  if (CHECK) continue
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, html, 'utf8')
  written++
}

console.log(CHECK ? '（dry-run）' : `已生成 ${written} 个落地页：`)
for (const r of report) {
  const dFlag = r.desc >= 120 && r.desc <= 165 ? '✅' : '⚠'
  const tFlag = r.title <= 60 ? '✅' : '⚠'
  console.log(`  ${r.out.padEnd(48)} title ${String(r.title).padStart(2)}${tFlag}  desc ${String(r.desc).padStart(3)}${dFlag}`)
}
