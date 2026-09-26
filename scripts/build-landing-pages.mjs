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
    title: 'Build Your Own Luggage Brand | OEM Factory in Indonesia',
    description: 'Launch your own luggage brand: your name on the case, the lining and the carton, produced to your brief in Indonesia. MOQ 200 units, 25-55 day lead time.',
    h1: 'Build Your Own Luggage Brand',
    heroDesc: 'From brief to branded stock: your name on the case, the lining, the hardware and the carton, produced in Bogor, Indonesia.',
    service: { name: 'Private Label Luggage Manufacturing', type: 'Private label luggage production' },
    sections: [
      { h2: 'What building your own brand involves', blocks: [
        { p: 'You do not need a factory, a tool shop or a product team to launch a luggage brand. What you need is a product definition and a manufacturer willing to build to it. You supply the brief and the brand; we handle structure, tooling, sampling, production, inspection and export packing.', lead: true },
        { p: 'It can run two ways. As OEM, where you define the product from your own design. As ODM, where you adapt a structure we already produce. The second route reaches market faster and costs less, which is usually how a first range gets launched.' },
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
      { h2: 'Your brand, on every surface', blocks: [
        { p: 'A branded case carries your identity at six points. Deciding all six before sampling is what stops a launch slipping into a second sampling round.' },
      ] },
      { h2: 'Packaging built for the destination market', blocks: [
        { p: 'Export packing is either single pack or nested pack. Nested sets place a 20-inch case inside a 24-inch inside a 28-inch, cutting freight volume per unit. Inside the carton: non-woven fabric or EPE foam between nested cases, a PE or PP dust bag on every case including nested inners, die-cut corrugated board or EPE foam at the wheel housings and handle mounts, and silica gel desiccant or an anti-mould patch in the interior mesh pocket for container rain on long sea routes.' },
        { p: 'Packing is produced to EU PPWR, US CONEG with heavy metals below 100 ppm, and REACH with no DMFu. Origin documentation is the Indonesian Certificate of Origin.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Is the whole range exclusive to my brand?</strong> Branding, packaging, colour and component selection can be exclusive. The underlying structure may be shared where it is an ODM base.' },
        { p: '<strong>Do you handle retail-ready packaging?</strong> Yes - carton marks, barcode labels, hangtags, manuals and PE bags are prepared by destination market.' },
        { p: '<strong>What do you need from us to quote?</strong> Product type and size range, shell direction, branding method, target market, target price and expected quantity. The <a href="/contact">quote form</a> collects exactly those.' },
      ] },
    ],
  },



  // ------------------------------------------------------------ 6. Made in Indonesia
  {
    out: 'compliance/index.html',
    path: '/compliance',
    title: 'Export Compliance For Luggage Orders | Indonesia Factory',
    description: 'Packaging, chemical and testing compliance for luggage orders from Indonesia: EU PPWR, US CONEG, REACH, QB/T 2155-2018, and what we do not claim.',
    h1: 'Packaging, Chemical And Testing Compliance',
    heroDesc: 'The packaging rules, substance restrictions and test standards our export orders are built to - and the claims we do not make.',
    service: { name: 'Luggage Export Compliance', type: 'Export compliance and documentation for luggage manufacturing' },
    sections: [
      { h2: 'Three different things buyers call "compliance"', blocks: [
        { p: 'On a luggage order, compliance usually means one of three separate things: the rules your packaging has to meet, the substances your product is not allowed to contain, and the tests the finished case has to pass. They are evidenced by different documents and confirmed at different stages, so it is worth separating them before you ask a supplier for "the certificates".', lead: true },
        { p: 'The fourth item is origin: the documentation that proves where the goods were made. All four are settled at the quotation stage in our process, because the destination market determines which set applies.' },
      ] },
      { h2: 'Packaging compliance', blocks: [
        { p: 'These are the packaging regulations our export packing is produced to. They are stated here because buyers increasingly have to evidence them at their own end:' },
        { ul: [
          '<strong>EU PPWR</strong> - the European packaging and packaging waste regulation',
          '<strong>US CONEG</strong> - heavy metals in packaging below 100 ppm',
          '<strong>REACH</strong> - no DMFu',
        ] },
        { p: 'The packing itself is built for a long sea route as well as for the regulation: a PE or PP dust bag on every case, non-woven fabric or EPE foam between nested cases, die-cut corrugated board or EPE foam at the wheel housings and handle mounts, and silica gel desiccant or an anti-mould patch in the interior mesh pocket to absorb the condensation that forms inside a container crossing the equator.' },
      ] },
      { h2: 'Testing the finished case', blocks: [
        { p: 'Structural testing follows QB/T 2155-2018. The tests that decide whether a case is fit to ship are physical rather than documentary:' },
        { ul: [
          '<strong>Drop:</strong> conditioned at 18-25 &deg;C, released from 900 mm onto 45-grade steel, once handle-up and once side-handle-up',
          '<strong>Low-temperature drop:</strong> conditioned at -12 &deg;C for four hours, then dropped from 90 cm',
          '<strong>Wheels and trolley:</strong> 8 km on a cement drum plus 4 km on a cleated conveyor, with wheel wear within 2 mm',
          '<strong>Steps:</strong> 25 steps at 200 mm, on the trolley',
          '<strong>Stacking:</strong> 40 kg for 535-660 mm cases, 60 kg for 685-835 mm cases, held for four hours',
          '<strong>Salt spray:</strong> 16 hours to QB/T 3826, no more than three corrosion points, each no larger than one square millimetre',
          '<strong>Aluminium frame only:</strong> case mouth hardness, Brinell minimum 40 HWB to GB/T 231.1, with an anodised oxide film at 10-12 micrometres',
        ] },
        { p: 'Finished cases are sent to SGS for testing. Those are test reports on the samples submitted, not a product certification, and component certifications belong to the component manufacturers. On an aluminium frame case, note that the roller-drum impact and falling-ball tests written for plastic shells are not applicable to metal-bodied cases - a point many quotations get wrong.' },
      ] },
      { h2: 'Origin and export documentation', blocks: [
        { p: 'DJI Luggage manufactures in Bogor, West Java, Indonesia, and Indonesian origin is evidenced by an Indonesian Certificate of Origin. We prepare that alongside carton marks and packing details as part of export documentation support.' },
        { p: 'Factory facts a buyer audit usually asks for: two 1,500-tonne injection machines with 100% in-house mould making, 30,000 units of monthly capacity (about 70% hard shell), around 80 x 40HQ containers a year, 75 staff, and more than 10 years of luggage production.' },
        { table: { head: ['Market', 'Current export destinations'], rows: [
          ['Asia', 'China, Indonesia'],
          ['Oceania', 'Australia'],
          ['Europe', 'Germany'],
        ] } },
        { p: 'Destination requirements drive the packing specification. Tell us the market at the quotation stage and we quote the documentation and packaging set for that market rather than discovering a gap at shipment.' },
      ] },
      { h2: 'What we do not claim', blocks: [
        { p: 'Buyers are shown a lot of compliance and environmental language that cannot be checked. We would rather state the boundaries of what we can evidence:' },
        { ul: [
          'We state the packaging regulations we build to, above. We do not publish recycled-content percentages or carbon figures, because we do not have audited numbers for them.',
          'ISO 9001 is not currently held, so we do not claim it. Quality is evidenced by the documented test standards and inspection stages on this page and in our production workflow.',
          'Finished cases are sent to SGS for testing. That is not SGS product certification, and we do not describe it as one.',
        ] },
        { p: 'If your programme requires a specific certification, audited environmental data, or a factory audit, raise it at the quotation stage and we will tell you plainly whether we can meet it.' },
      ] },
      { h2: 'Questions buyers ask', blocks: [
        { p: '<strong>Can we visit or audit the factory?</strong> Factory profile, certificate archive and buyer audit document support are available before production scales.' },
        { p: '<strong>Which markets do you ship to today?</strong> China, Indonesia, Australia and Germany, at around 80 x 40HQ containers a year.' },
        { p: '<strong>Who prepares export documentation?</strong> We prepare carton marks, packing details and origin documentation. Destination-specific certificates remain the buyer\'s responsibility unless agreed in the quotation.' },
        { p: '<strong>Can you certify to a standard we name?</strong> Ask at the quotation stage. Where the standard is one we already test to we can point to the report; where it is not, we will say so rather than implying it.' },
      ] },
    ],
  },
  // ---------------------------------------------------------- 产品类型页
  // 三个箱体类型页，作为 /products 的 OUR FOCUS 分类入口。
  {
    out: 'products/pc-abs-luggage/index.html',
    path: '/products/pc-abs-luggage',
    collection: true,
    title: 'PC And ABS+PC Luggage Manufacturing | Indonesia Factory',
    description: 'Polycarbonate and ABS+PC hard-shell luggage made in Indonesia: impact resistance, finish options, tooling and MOQ 200 units. See how PC compares.',
    h1: 'PC And ABS+PC Luggage',
    heroDesc: 'The impact-resistant hard shell. Polycarbonate and ABS+PC give a scratch-tolerant body in a high-gloss, matte or brushed finish.',
    sections: [
      { h2: 'What a PC or ABS+PC case is', blocks: [
        { p: 'Polycarbonate and ABS+PC are the two blends most hard-shell luggage is built from. PC is the tougher of the two and holds its shape after an impact; ABS+PC is a blend that brings the cost down while keeping most of the impact behaviour. Both are formed as a shell with a lining, a telescopic handle, wheels and a closure around the opening.', lead: true },
        { p: 'We mould shells on two 1,500-tonne injection machines with 100% in-house mould making, which keeps a new shell shape off the third-party tool shop queue.' },
      ] },
      { h2: 'Where PC and ABS+PC perform', blocks: [
        { ul: [
          '<strong>Impact resistance.</strong> PC is the most impact-tolerant of the common shell materials, which is why it dominates mid and upper ranges.',
          '<strong>Finish range.</strong> It takes a fine texture, a high gloss, or a brushed and metallic effect that ABS alone cannot hold.',
          '<strong>Colour depth.</strong> Pigment disperses evenly, so deep colours and two-tone trims stay consistent across a nested set.',
          '<strong>Thin walls.</strong> A large case can be built without the shell becoming unmanageable to lift.',
        ] },
      ] },
      { h2: 'What it costs you', blocks: [
        { ul: [
          '<strong>Weight.</strong> Heavier than PP at the same size, which is what buyers notice first on a 28 inch case.',
          '<strong>Unit cost.</strong> More expensive than PP or plain ABS, so it belongs in the middle and top of a range, not the entry price point.',
          '<strong>Gloss shows wear.</strong> A high-gloss surface records scratches and scuffs more visibly than a textured PP surface. Matte and brushed finishes hide them better.',
          '<strong>Tooling.</strong> A new shell shape needs its own mould, which is a real cost if you are testing a market for the first time.',
        ] },
      ] },
      { h2: 'How it is specified', blocks: [
        { p: 'Four decisions settle most of a PC or ABS+PC programme: shell thickness, finish, colour and closure. Finish and colour are quoted per specification because both depend on batch size; a two-tone trim or a custom gloss costs less per unit as the order grows.' },
        { p: 'Sizes are 20, 24, 26 and 28 inch, supplied as single cases or nested sets. Interiors, wheel systems, locks and lining are selected from components already in production, which is what keeps a first order affordable.' },
      ] },
      { h2: 'Commercial terms', blocks: [
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Sample development: 7-15 working days',
          'Payment: 30% deposit, 70% balance',
          'Monthly capacity: 30,000 units, about 70% hard shell',
        ] },
        { p: 'See the current PC and ABS+PC cases in the <a href="/collections/all/">catalogue</a>, or read how a <a href="/services/luggage-oem/">OEM</a> or <a href="/services/luggage-odm/">ODM</a> programme is structured.' },
      ] },
    ],
  },
  {
    out: 'products/pp-luggage/index.html',
    path: '/products/pp-luggage',
    collection: true,
    title: 'PP Luggage Manufacturing | Polypropylene Suitcases',
    description: 'Polypropylene hard-shell luggage made in Indonesia: the lightest and lowest-cost shell, strong in the cold, MOQ 200 units and a 25-55 day lead time.',
    h1: 'PP Luggage',
    heroDesc: 'The lightest and lowest-cost hard shell. Polypropylene flexes instead of cracking, which is why it carries entry and mid-market ranges.',
    sections: [
      { h2: 'What a PP case is', blocks: [
        { p: 'Polypropylene is the workhorse hard-shell material. It is moulded as one shell, and its advantage is behavioural rather than cosmetic: where a stiffer material might crack under a sharp impact, PP bends and returns. That is why it holds the entry and mid-market price points, and why it is the natural choice for multi-piece nested sets where three cases have to stay light together.', lead: true },
        { p: 'PP is a single-material shell, recyclable under resin code 5, which makes end-of-life handling simpler than a bonded or mixed-material construction.' },
      ] },
      { h2: 'Where PP performs', blocks: [
        { ul: [
          '<strong>Weight.</strong> The lightest of the common hard-shell materials, which matters most when a 20, 24 and 28 inch set ships together.',
          '<strong>Unit cost.</strong> The lowest of the three, so it is the material that makes an entry price point possible.',
          '<strong>Cold resistance.</strong> PP flexes rather than becoming brittle at low temperature, which is why it is common in cold-climate markets.',
          '<strong>Chemical resistance.</strong> It resists most household chemicals and cleans easily.',
          '<strong>Single-material recycling.</strong> Resin code 5, with no bonded layers to separate.',
        ] },
      ] },
      { h2: 'What it costs you', blocks: [
        { ul: [
          '<strong>Finish ceiling.</strong> PP has a matte, slightly waxy surface. High gloss and premium metallic effects are not realistic, and paint does not adhere as durably as it does on ABS+PC.',
          '<strong>Rigidity.</strong> Lower than PC, so a PP shell needs ribbing or a thicker wall to hold its shape under stacking loads.',
          '<strong>Dimensional tolerance.</strong> PP shrinks more when moulded, so gaps and fit are looser than on a PC shell.',
          '<strong>Colour.</strong> Solid colours only. It will not carry the brushed or two-tone effects the PC range uses.',
        ] },
      ] },
      { h2: 'How it is specified', blocks: [
        { p: 'The two decisions that matter are wall thickness and ribbing pattern, because together they set how the case behaves under the 40 kg or 60 kg stacking test rather than how it looks. Finish is a matte texture, chosen from the mould rather than applied afterwards.' },
        { p: 'Sizes are 20, 24, 26 and 28 inch, supplied as single cases or nested sets. Wheels, locks, handles and lining come from components already in production.' },
      ] },
      { h2: 'Commercial terms', blocks: [
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Sample development: 7-15 working days',
          'Payment: 30% deposit, 70% balance',
          'Monthly capacity: 30,000 units, about 70% hard shell',
        ] },
        { p: 'See the current PP cases in the <a href="/collections/all/">catalogue</a>, or compare PP against <a href="/products/pc-abs-luggage/">PC and ABS+PC</a>.' },
      ] },
    ],
  },
  {
    out: 'products/aluminum-frame-luggage/index.html',
    path: '/products/aluminum-frame-luggage',
    collection: true,
    title: 'Aluminium Frame Luggage Manufacturing | Indonesia',
    description: 'Aluminium frame suitcases: an extruded aluminium profile around a PC or ABS+PC shell. Case mouth hardness, anodising, MOQ 200 units, 25-55 day lead time.',
    h1: 'Aluminium Frame Luggage',
    heroDesc: 'An extruded aluminium profile around the case mouth, on a PC or ABS+PC shell. The aluminium is the structural frame, not the whole case.',
    sections: [
      { h2: 'Frame, not a solid metal body', blocks: [
        { p: 'An aluminium frame case is not a solid aluminium body. It is a polycarbonate or ABS+PC shell joined to an extruded aluminium profile that runs around the opening. The aluminium carries the load at the case mouth - the point where a zippered case fails first - and the shell provides the body. The frame is bent from profile and riveted closed, not welded.', lead: true },
        { p: 'That distinction matters when you compare quotations. A supplier describing a case as entirely aluminium while quoting a polycarbonate shell is describing two different products. If you want the longer explanation, it is in <a href="/newsroom/aluminum-luggage-explained/">where the metal actually goes on a suitcase</a>.' },
      ] },
      { h2: 'Where an aluminium frame performs', blocks: [
        { ul: [
          '<strong>The strongest closure in the range.</strong> The opening is the weakest point on a zippered case, and the frame removes the zipper from that job.',
          '<strong>A mechanical feel.</strong> The latch action reads as premium in a way a zipper cannot, which is why the frame sits at the top of a range.',
          '<strong>Anodised finish.</strong> The oxide layer is part of the metal rather than a coating, so it does not chip away like paint.',
          '<strong>A testable number.</strong> Case mouth hardness is measurable, not a claim: minimum 40 HWB to GB/T 231.1.',
        ] },
      ] },
      { h2: 'What it costs you', blocks: [
        { ul: [
          '<strong>Unit cost.</strong> The highest of the three types, between the profile, the anodising and the extra assembly steps.',
          '<strong>Weight.</strong> The frame adds weight around the whole perimeter, on top of the shell.',
          '<strong>Corrosion requirement.</strong> An anodised frame is exposed to the same handling as the shell, so it must pass 16-hour salt spray to QB/T 3826.',
          '<strong>Outsourced steps.</strong> Extrusion and anodising are specialist processes carried out by specialist plants. That is normal in this industry, but it puts their queue inside your lead time.',
          '<strong>Not an entry-price product.</strong> A frame programme is the wrong tool for a value range; PP or ABS+PC will do that job.',
        ] },
      ] },
      { h2: 'How the frame is built', blocks: [
        { p: 'The profile is extruded to the required cross-section, cut to the case perimeter, bent to the corner radii and riveted to the shell. Corners and the closure come from the same 6-series aluminium-magnesium alloy family as the profile. Anodising is the standard finish, with the oxide film specified at 10-12 micrometres.' },
        { p: 'Mould making, bending, riveting and frame alignment stay inside our plant. Alignment is what the case mouth hardness ultimately depends on, so it is the step we will not move out.' },
      ] },
      { h2: 'Commercial terms', blocks: [
        { ul: [
          'Minimum order: 200 units per specification',
          'Lead time: 25-55 days from deposit and approved sample',
          'Sample development: 7-15 working days',
          'Payment: 30% deposit, 70% balance',
          'Monthly capacity: 30,000 units, about 70% hard shell',
        ] },
        { p: 'See the current frame range: <a href="/products/aluminum-suitcase-black/">AURA Collection</a> and <a href="/products/roaming-aluminum-frame-zipperless-luggage-grey/">Captain Aluminum Frame</a>. Frame construction is also covered in the <a href="/newsroom/aluminum-luggage-explained/">aluminium luggage article</a>.' },
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
  ${JSON.stringify(page.collection ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: page.h1,
    description: page.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'DJI Luggage', url: `${SITE}/` },
    about: { '@type': 'Thing', name: page.h1 },
    publisher: { '@type': 'Organization', name: 'DJI Luggage', url: `${SITE}/`, disambiguatingDescription: ORG.disambiguatingDescription },
  } : {
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
