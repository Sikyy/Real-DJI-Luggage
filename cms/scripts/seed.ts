import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

type CollectionSlug =
  | 'team-members'
  | 'trusted-logos'
  | 'testimonials'
  | 'news-posts'
  | 'job-posts'

async function upsertByField<T extends Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  field: string,
  value: string,
  data: T,
) {
  const existing = await payload.find({
    collection,
    limit: 1,
    where: {
      [field]: {
        equals: value,
      },
    },
  })

  if (existing.docs[0]) {
    return payload.update({
      collection,
      id: existing.docs[0].id,
      data: data as any,
    })
  }

  return payload.create({
    collection,
    data: data as any,
  })
}

async function seed() {
  const payload = await getPayload({ config: configPromise })

  const teamMembers = await Promise.all([
    upsertByField(payload, 'team-members', 'name', 'Founder / CEO', {
      name: 'Founder / CEO',
      role: 'Company Leadership',
      externalImageUrl: 'https://framerusercontent.com/images/GUp8VdbqJAnhfOr7NK5rhb7iz4.png',
      imageAlt: 'DJI Luggage leadership',
      sortOrder: 10,
      isActive: true,
    }),
    upsertByField(payload, 'team-members', 'name', 'Production Lead', {
      name: 'Production Lead',
      role: 'Manufacturing Operations',
      externalImageUrl: 'https://framerusercontent.com/images/IJzILYgo1giGLlbhYFoQxnkTYQ.png',
      imageAlt: 'DJI Luggage production lead',
      sortOrder: 20,
      isActive: true,
    }),
    upsertByField(payload, 'team-members', 'name', 'Quality Lead', {
      name: 'Quality Lead',
      role: 'Quality Control',
      externalImageUrl: 'https://framerusercontent.com/images/miYR1uyIgPn1OuV5Tbi4b9GKSg.png',
      imageAlt: 'DJI Luggage quality lead',
      sortOrder: 30,
      isActive: true,
    }),
    upsertByField(payload, 'team-members', 'name', 'Export Lead', {
      name: 'Export Lead',
      role: 'Buyer Coordination',
      externalImageUrl: 'https://framerusercontent.com/images/MpL8d6ij0GvQ1VvuPLf1q4Sh5IU.png',
      imageAlt: 'DJI Luggage export lead',
      sortOrder: 40,
      isActive: true,
    }),
    upsertByField(payload, 'team-members', 'name', 'Customer Success Lead', {
      name: 'Customer Success Lead',
      role: 'Client Support',
      externalImageUrl: 'https://framerusercontent.com/images/d9QoUUypywk33NzCK1txqmi0Rc.png',
      imageAlt: 'DJI Luggage customer support lead',
      sortOrder: 50,
      isActive: true,
    }),
  ])

  const trustedLogos = await Promise.all([
    upsertByField(payload, 'trusted-logos', 'name', 'OEM Buyers', {
      name: 'OEM Buyers',
      sourceType: 'sourceSymbol',
      sourceSymbolId: 'trusted-logo-ipsum-bars',
      viewBox: '0 0 267 116',
      sortOrder: 10,
      isActive: true,
    }),
    upsertByField(payload, 'trusted-logos', 'name', 'Retail Partners', {
      name: 'Retail Partners',
      sourceType: 'sourceSymbol',
      sourceSymbolId: 'trusted-logo-loop',
      viewBox: '0 0 268 116',
      sortOrder: 20,
      isActive: true,
    }),
    upsertByField(payload, 'trusted-logos', 'name', 'Corporate Programs', {
      name: 'Corporate Programs',
      sourceType: 'sourceSymbol',
      sourceSymbolId: 'trusted-logo-logoipsum',
      viewBox: '0 0 268 116',
      sortOrder: 30,
      isActive: true,
    }),
    upsertByField(payload, 'trusted-logos', 'name', 'Distributor Networks', {
      name: 'Distributor Networks',
      sourceType: 'sourceSymbol',
      sourceSymbolId: 'trusted-logo-uam',
      viewBox: '0 0 268 116',
      sortOrder: 40,
      isActive: true,
    }),
  ])

  const testimonials = await Promise.all([
    upsertByField(payload, 'testimonials', 'company', 'Private Label Buyer', {
      quote: '"DJI Luggage helped us turn a concept into a production-ready suitcase line with clear communication at every step."',
      company: 'Private Label Buyer',
      externalImageUrl:
        'https://framerusercontent.com/images/qkMQq9Zs1gGZaibDwwhw42dog.jpg?width=3000&height=2248',
      sortOrder: 10,
      isActive: true,
    }),
    upsertByField(payload, 'testimonials', 'company', 'Retail Distributor', {
      quote: '"The team understands bulk luggage programs, from samples to packing details. That made our buying process much easier."',
      company: 'Retail Distributor',
      externalImageUrl:
        'https://framerusercontent.com/images/gvhFBMsq7CqzGkGuVh2v7bOU4CE.jpg?scale-down-to=4096&width=5464&height=3640',
      sortOrder: 20,
      isActive: true,
    }),
    upsertByField(payload, 'testimonials', 'company', 'Corporate Gifts Partner', {
      quote: '"Their production support gave us confidence to build a practical travel product for our corporate customers."',
      company: 'Corporate Gifts Partner',
      externalImageUrl:
        'https://framerusercontent.com/images/ttsW2lp4NVYHyV30luZYHR1UMg.jpg?width=3936&height=2214',
      sortOrder: 30,
      isActive: true,
    }),
  ])

  const defaultArticleIntro =
    'Practical notes from DJI Luggage on building reliable suitcase and travel product programs, from early product planning to repeatable production.'

  const defaultArticleSections = [
    {
      heading: 'Start With A Clear Product Brief',
      body:
        'A strong luggage program starts with the basics: suitcase size, shell or fabric direction, wheel system, handle requirements, lining, lock type, color, branding method, target price, and expected quantity. Clear inputs help the factory recommend realistic construction choices and avoid unnecessary sampling rounds.\n\nFor buyers, this early clarity also makes quotations easier to compare and gives the production team a better foundation for scheduling materials and labor.',
    },
    {
      heading: 'Sampling Turns Ideas Into Decisions',
      body:
        'Sampling is where design intent meets production reality. Buyers can review structure, weight, finish, trolley movement, wheel feel, zipper performance, logo placement, interior layout, and packaging details before committing to a larger order.\n\nDJI Luggage uses the sample stage to align expectations, document changes, and prepare the approved version for bulk production.',
    },
    {
      heading: 'Quality Checks Need To Be Built In',
      body:
        'Luggage quality is shaped by many small details: material consistency, wheel assembly, handle strength, corner protection, stitching, zipper movement, color matching, logo position, and carton packing. Checking these details during production is more effective than waiting until the shipment is finished.\n\nA steady quality process helps reduce rework and gives buyers more confidence in repeat orders.',
    },
    {
      heading: 'Plan Packaging And Delivery Early',
      body:
        'Carton size, master packing, product labels, hangtags, barcode placement, and destination requirements should be discussed early. These details affect cost, warehousing, inspection, and final delivery readiness.\n\nFor wholesale and private-label buyers, packaging is part of the product experience, not only a shipping detail.',
    },
    {
      heading: 'Build For The Next Order',
      body:
        'The best manufacturing relationship is built for repetition. Once a buyer confirms a product direction, the next goal is consistency: stable specifications, reliable lead times, documented approvals, and a clear channel for improvements.\n\nDJI Luggage supports buyers who want a practical factory partner for long-term travel product development.',
    },
  ]

  const articleDefaults = (author: string) => ({
    author,
    intro: defaultArticleIntro,
    contentSections: defaultArticleSections,
  })

  const newsPosts = await Promise.all([
    upsertByField(payload, 'news-posts', 'slug', 'choosing-the-right-luggage-manufacturer', {
      title: 'Choosing The Right Luggage Manufacturer',
      slug: 'choosing-the-right-luggage-manufacturer',
      category: 'insights',
      excerpt: 'What buyers should clarify before starting an OEM or private-label suitcase program.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      publishedAt: '2025-10-31T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'oem-vs-odm-for-luggage-brands', {
      title: 'OEM vs ODM For Luggage Brands',
      slug: 'oem-vs-odm-for-luggage-brands',
      category: 'insights',
      excerpt: 'A simple way to decide whether to customize an existing design or develop a new one.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
      publishedAt: '2025-10-02T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'quality-checks-in-suitcase-production', {
      title: 'Quality Checks In Suitcase Production',
      slug: 'quality-checks-in-suitcase-production',
      category: 'news',
      excerpt: 'The production details that matter most for durable travel products.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/gtxhO5eQb8zTp6csYDNAsGA9k.jpg',
      publishedAt: '2025-09-27T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'material-choices-for-hard-shell-luggage', {
      title: 'Material Choices For Hard Shell Luggage',
      slug: 'material-choices-for-hard-shell-luggage',
      category: 'insights',
      excerpt: 'How shell material, finish, and components shape cost, feel, and durability.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/qerU0u7MgBoEnXdijYtcgsdtMTk.jpg',
      publishedAt: '2025-09-17T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'planning-your-first-bulk-luggage-order', {
      title: 'Planning Your First Bulk Luggage Order',
      slug: 'planning-your-first-bulk-luggage-order',
      category: 'news',
      excerpt: 'A practical checklist for quantities, timelines, samples, packing, and approvals.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/dIpxXeu2nK0wcdN1Ri0jBE0Aw.jpg',
      publishedAt: '2025-09-08T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'building-a-private-label-travel-line', {
      title: 'Building A Private Label Travel Line',
      slug: 'building-a-private-label-travel-line',
      category: 'news',
      excerpt: 'From logo placement to product range planning, private-label luggage needs a steady process.',
      externalCoverImageUrl:
        'https://framerusercontent.com/images/CA2gOg0z0KVvO9JiKIDAroigUw.jpg?scale-down-to=1024&width=5191&height=3458',
      publishedAt: '2025-09-01T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'packaging-and-export-prep-for-suitcases', {
      title: 'Packaging And Export Prep For Suitcases',
      slug: 'packaging-and-export-prep-for-suitcases',
      category: 'insights',
      excerpt: 'Why cartons, labels, and packing details should be confirmed before production ends.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/pNkjoqFtJG8GbECTaKovqOFWvXI.jpg',
      publishedAt: '2025-08-29T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
    upsertByField(payload, 'news-posts', 'slug', 'from-sample-to-production', {
      title: 'From Sample To Production',
      slug: 'from-sample-to-production',
      category: 'news',
      excerpt: 'How approved samples become repeatable production standards for luggage buyers.',
      externalCoverImageUrl: 'https://framerusercontent.com/images/qdVrKVWoQ6IYD1EWJSW1Z5nYMc.jpg',
      publishedAt: '2025-08-12T00:00:00.000Z',
      status: 'published',
      ...articleDefaults('DJI Luggage Team'),
    }),
  ])

  const sharedResponsibilities = [
    {
      body:
        'Coordinate daily work with production, quality, purchasing, and buyer-facing teams.',
    },
    {
      body:
        'Keep product specifications, sample feedback, and order requirements clear and documented.',
    },
    {
      body:
        'Track timelines, flag risks early, and help the team maintain reliable delivery standards.',
    },
    {
      body:
        'Support continuous improvement across luggage production, packing, and customer communication.',
    },
    {
      body:
        'Review buyer feedback and production data to improve future orders.',
    },
    {
      body:
        'Maintain practical documentation for samples, approvals, inspections, and handovers.',
    },
  ]

  const sharedBasicRequirements = [
    { body: 'Experience working in manufacturing, consumer goods, export, quality, or operations.' },
    {
      body:
        'Strong attention to detail and ability to keep work organized across multiple orders.',
    },
    {
      body:
        'Clear communication skills with internal teams, suppliers, and customers.',
    },
    {
      body:
        'Ability to prioritize practical work and solve problems calmly under production timelines.',
    },
    { body: 'Comfortable working in a hands-on factory environment.' },
  ]

  const sharedPreferredRequirements = [
    { body: 'Experience with luggage, bags, plastic shell products, textiles, or travel goods.' },
    { body: 'Familiarity with OEM or ODM order workflows.' },
    { body: 'Ability to work with photos, specs, inspection notes, and buyer feedback.' },
    { body: 'English or Mandarin communication skills are a plus for export coordination.' },
  ]

  const jobPosts = await Promise.all([
    upsertByField(payload, 'job-posts', 'slug', 'production-supervisor', {
      title: 'Production Supervisor',
      slug: 'production-supervisor',
      department: 'Manufacturing',
      location: 'BOGOR, ID',
      employmentType: 'full-time',
      postedDate: '2025-11-05T00:00:00.000Z',
      summary:
        'Coordinate daily suitcase and travel goods production so approved specifications move cleanly from sample to bulk order.',
      sidebarText:
        'DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.',
      jobDescription:
        'DJI Luggage is looking for a Production Supervisor to coordinate people, materials, schedules, and quality checkpoints across luggage production. You will help keep orders organized, practical, and ready for buyer review.',
      responsibilities: sharedResponsibilities,
      basicIntro: '3+ years of experience in manufacturing operations or production coordination.',
      basicRequirements: sharedBasicRequirements,
      preferredIntro: 'Experience with bags, luggage, consumer goods, or assembly-based manufacturing is preferred.',
      preferredRequirements: sharedPreferredRequirements,
      sortOrder: 10,
      isOpen: true,
    }),
    upsertByField(payload, 'job-posts', 'slug', 'quality-control-specialist', {
      title: 'Quality Control Specialist',
      slug: 'quality-control-specialist',
      department: 'Quality',
      location: 'BOGOR, ID',
      employmentType: 'full-time',
      postedDate: '2025-01-02T00:00:00.000Z',
      summary:
        'Inspect luggage details, document findings, and help ensure production matches approved samples and buyer specifications.',
      sidebarText:
        'DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.',
      jobDescription:
        'DJI Luggage is looking for a Quality Control Specialist to check components, assembly, finishing, packing, and final product presentation. You will help the team catch issues early and keep quality records clear.',
      responsibilities: [
        {
          body:
            'Inspect shell, fabric, wheels, trolley handles, zippers, locks, lining, logos, and carton packing.',
        },
        {
          body:
            'Compare production output against approved samples and documented specifications.',
        },
        {
          body:
            'Record inspection notes, photos, and issue summaries for internal follow-up.',
        },
        {
          body:
            'Coordinate with production supervisors to resolve defects and prevent repeated issues.',
        },
        {
          body:
            'Support incoming material checks and final pre-shipment review.',
        },
        {
          body:
            'Keep quality records organized for future repeat orders.',
        },
        {
          body:
            'Help maintain a practical standard for durable, buyer-ready travel products.',
        },
      ],
      basicIntro:
        '2+ years of experience in quality control, production inspection, or consumer goods manufacturing.',
      basicRequirements: sharedBasicRequirements,
      preferredIntro: 'Experience inspecting luggage, bags, textiles, plastic shell products, or hardware is preferred.',
      preferredRequirements: sharedPreferredRequirements,
      sortOrder: 20,
      isOpen: true,
    }),
    upsertByField(payload, 'job-posts', 'slug', 'export-sales-coordinator', {
      title: 'Export Sales Coordinator',
      slug: 'export-sales-coordinator',
      department: 'Sales',
      location: 'BOGOR, ID',
      employmentType: 'full-time',
      postedDate: '2025-09-21T00:00:00.000Z',
      summary:
        'Support buyer inquiries, quotation follow-up, sample coordination, and order communication for luggage programs.',
      sidebarText:
        'DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.',
      jobDescription:
        'DJI Luggage is looking for an Export Sales Coordinator to help buyers move from inquiry to quotation, sampling, production, and repeat order planning. You will keep communication clear and help the team respond quickly.',
      responsibilities: sharedResponsibilities,
      basicIntro: '2+ years of experience in B2B sales support, export coordination, customer service, or order management.',
      basicRequirements: sharedBasicRequirements,
      preferredIntro: 'Experience with OEM, ODM, private-label, or manufacturing sales coordination is preferred.',
      preferredRequirements: sharedPreferredRequirements,
      sortOrder: 30,
      isOpen: true,
    }),
    upsertByField(payload, 'job-posts', 'slug', 'sample-development-technician', {
      title: 'Sample Development Technician',
      slug: 'sample-development-technician',
      department: 'Product Development',
      location: 'BOGOR, ID',
      employmentType: 'full-time',
      postedDate: '2025-10-21T00:00:00.000Z',
      summary:
        'Help turn buyer briefs into sample luggage products by coordinating materials, construction details, and revisions.',
      sidebarText:
        'DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.',
      jobDescription:
        'DJI Luggage is looking for a Sample Development Technician to support product trials, revisions, and technical handover before bulk production. You will help bridge buyer ideas and factory execution.',
      responsibilities: sharedResponsibilities,
      basicIntro: '2+ years of experience in sample making, product development, production support, or technical coordination.',
      basicRequirements: sharedBasicRequirements,
      preferredIntro: 'Experience with luggage, bags, sewing, shell assembly, trims, or hardware selection is preferred.',
      preferredRequirements: sharedPreferredRequirements,
      sortOrder: 40,
      isOpen: true,
    }),
  ])

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      brandName: 'DJI Luggage',
      logoLabel: 'DJI LUGGAGE',
      logoDisplay: 'image',
      logoAlt: 'DJI Luggage',
      logoHref: '/',
      externalLogoImageUrl: '/assets/brand/dji-luggage-logo-white.png',
      externalDarkLogoImageUrl: '/assets/brand/dji-luggage-logo-black.png',
      requestQuoteLabel: 'Get a Quote',
      requestQuoteUrl: '/contact',
      mainNavigation: [
        { label: 'Home', url: '/' },
        { label: 'About', url: '/about' },
        { label: 'Manufacturing', url: '/services' },
        { label: 'Capabilities', url: '/platform' },
        { label: 'Insights', url: '/newsroom/filters/all' },
        { label: 'Careers', url: '/careers' },
      ],
      menuContact: {
        quickContactLabel: 'Quick Contact',
        email: 'info@djiluggage.id',
        messageLabel: 'Send Us A Message',
        quoteLabel: 'Get a Quote',
        quoteUrl: '/contact',
      },
      footerContact: {
        label: 'Contact',
        heading: "Let's Get Started",
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
      },
      address:
        'JL RAYA PARUNG BOGOR,\nDESA/KELURAHAN KEMANG,\nKEC. KEMANG, KAB. BOGOR,\nPROVINSI JAWA BARAT,\nKODE POS: 16310',
      footerColumns: [
        {
          heading: 'Main',
          links: [
            { label: 'Home', url: '/' },
            { label: 'Manufacturing', url: '/services' },
            { label: 'About', url: '/about' },
            { label: 'Careers', url: '/careers' },
            { label: 'Capabilities', url: '/platform' },
            { label: 'Insights', url: '/newsroom/filters/all' },
          ],
        },
        {
          heading: 'Support',
          links: [
            { label: '404', url: '/404' },
            { label: 'Privacy Policy', url: '/privacy-policy' },
          ],
        },
      ],
      socialLinks: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
        { label: 'X', url: 'https://x.com/', icon: 'x' },
        { label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
        { label: 'WhatsApp', url: 'https://wa.me/6281266189081', icon: 'whatsapp' },
      ],
      copyright: '©2026 DJI Luggage. All rights reserved.',
      credit: 'Indonesian luggage manufacturer',
    },
  })

  await payload.updateGlobal({
    slug: 'home-page',
    data: {
      metaTitle: 'DJI Luggage - Indonesian Luggage Manufacturer',
      hero: {
        breadcrumb: 'Home',
        title: 'Manufacturing Luggage,\nBuilt For Your Brand',
        description:
          'DJI Luggage manufactures durable suitcase and travel bag programs for retailers, distributors, and growing private labels.',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        posterUrl: 'https://framerusercontent.com/images/9oXIMPUOwaaTowc6iUbxkZ146KE.png',
        videoUrl: 'https://framerusercontent.com/assets/B1E36n5Z6jDij8UJYkjAIGrRups.mp4',
      },
      services: {
        label: 'What We Make',
        heading:
          'We help buyers develop practical luggage products, from private-label suitcase programs to sampling, production coordination, and quality checks.',
        cards: [
          {
            title: 'OEM Private Label Luggage',
            description:
              'Build suitcase and travel bag lines around your brand, color direction, logo placement, packaging, and target market.',
          },
          {
            title: 'ODM Product Development',
            description:
              'Turn product ideas into samples with practical guidance on structure, materials, trims, wheels, handles, and interior details.',
          },
          {
            title: 'Bulk Production And QC',
            description:
              'Coordinate manufacturing, inspection, packing, and buyer approvals so repeat orders stay clear and consistent.',
          },
        ],
        buttonLabel: 'View Services',
        buttonUrl: '/services',
      },
      values: [
        {
          number: '1',
          title: 'Craftsmanship',
          description:
            'We focus on practical construction details that make luggage feel durable, useful, and ready for daily travel.',
        },
        {
          number: '2',
          title: 'Reliable Production',
          description:
            'From sample approval to bulk order packing, our process is built around clarity, consistency, and follow-through.',
        },
        {
          number: '3',
          title: 'Long-Term Partnership',
          description:
            'We support buyers who want a steady manufacturing partner for new launches, seasonal programs, and repeat orders.',
        },
      ],
      technologyCta: {
        label: 'Manufacturing Capability',
        headingHtml:
          'From concept <span class="inline-img"><img src="https://framerusercontent.com/images/ZHqjUB0xVhxl0vTlth6rCo3PUo.jpg" alt=""></span> to sampling <span class="inline-img"><img src="https://framerusercontent.com/images/IsBCAtrPkzqt9u9duPkAiN5dvhw.jpg" alt=""></span> and scaled luggage production.',
        buttonLabel: 'Explore Capabilities',
        buttonUrl: '/platform',
      },
      howWeWork: {
        label: 'How We Work',
        body:
          'DJI Luggage keeps the manufacturing path simple: align the brief, confirm the sample, produce with quality checks, and prepare the order for buyer handover.',
        steps: [
          {
            number: '[01]',
            body: 'Brief: Share product type, quantity, target market, branding, material direction, and timing.',
          },
          {
            number: '[02]',
            body: 'Sample: Review construction, logo placement, components, colors, packaging, and required changes.',
          },
          {
            number: '[03]',
            body: 'Produce: Move approved details into bulk production, inspection, packing, and delivery coordination.',
          },
        ],
      },
      newsroom: {
        label: 'Recent Articles',
        heading: 'Newsroom',
        posts: newsPosts.slice(0, 5).map((item) => item.id),
      },
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'about-page',
    data: {
      metaTitle: 'About - DJI Luggage',
      pageTitle: 'About DJI Luggage',
      externalHeroImageUrl: 'https://framerusercontent.com/images/2cLLtW9JseVLuB8Se1lBw03NAlI.jpg',
      whoWeAre: {
        label: 'Who We Are',
        heading:
          'We are a Bogor-based luggage manufacturer helping buyers turn travel product ideas into reliable production programs.',
        columns: [
          {
            body:
              'DJI Luggage supports OEM, ODM, and private-label buyers with practical product development, sample coordination, bulk production, and quality control for suitcase and travel goods programs.',
          },
          {
            body:
              'Our work is built around clear communication, realistic timelines, and production details that help brands prepare for retail, wholesale, corporate, and distributor channels.',
          },
        ],
      },
      reach: {
        label: 'Our Reach',
        heading: 'Based in Bogor, Supporting Buyers Across Indonesia and Beyond',
        locations: [
          { country: 'Indonesia', city: 'Bogor' },
          { country: 'Indonesia', city: 'Jakarta' },
          { country: 'Indonesia', city: 'Surabaya' },
          { country: 'Indonesia', city: 'Bali' },
          { country: 'Southeast Asia', city: 'Singapore' },
          { country: 'Southeast Asia', city: 'Kuala Lumpur' },
        ],
        globeVideoUrl: 'https://framerusercontent.com/assets/euvxzcjhbUUqkHE2xg8ip1m5lIo.mp4',
      },
      metrics: {
        label: 'Key Metrics',
        heading: 'Manufacturing capability shaped around product quality, repeatable production, and responsive buyer support.',
        externalImageUrl:
          'https://framerusercontent.com/images/SmKpJArNfpH0J4YgHNcqsyxuyEA.jpg?scale-down-to=1024&width=5418&height=3612',
        imageAlt: 'manufacturing planning',
        subtext:
          'Use these as CMS-editable business proof points, then replace them with exact factory data, audit details, and buyer references when ready.',
        items: [
          { value: 'OEM', label: 'Private Label Programs', tone: 'dark' },
          { value: 'ODM', label: 'Sample Development', tone: 'gray' },
          { value: 'QC', label: 'Production Quality Checks', tone: 'yellow' },
          { value: 'B2B', label: 'Wholesale Manufacturing', tone: 'charcoal' },
        ],
      },
      testimonials: testimonials.map((item) => item.id),
      trustedLabel: 'Trusted By',
      trustedLogos: trustedLogos.map((item) => item.id),
      teamLabel: 'Our Team',
      teamHeading: 'Leadership',
      teamMembers: teamMembers.map((item) => item.id),
      careersCta: {
        label: 'Careers',
        heading: 'Join the team building durable luggage products from Indonesia',
        buttonLabel: 'Explore Careers',
        buttonUrl: '/careers',
      },
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'services-page',
    data: {
      metaTitle: 'Manufacturing Services - DJI Luggage',
      hero: {
        label: 'Manufacturing',
        title: 'Manufacturing Services',
        description:
          'OEM, ODM, sampling, bulk production, and quality support for luggage and travel goods buyers.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/Qufuc7ZvvPRLp2ePWNlY4pH48w.jpg',
        imageAlt: 'Warehouse shelving',
      },
      focus: {
        label: 'Our Focus',
        heading:
          'DJI Luggage helps brands and distributors build practical suitcase programs with clear specifications, dependable production coordination, and buyer-ready packing.',
        paragraphs: [
          {
            body:
              'We support buyers who need a factory partner for private-label luggage, corporate travel products, retail ranges, and bulk order programs.',
          },
          {
            body:
              'Each project starts with product requirements and moves through sample approval, material coordination, production checks, and final handover.',
          },
        ],
      },
      aerial: {
        externalImageUrl: 'https://framerusercontent.com/images/dIpxXeu2nK0wcdN1Ri0jBE0Aw.jpg',
        imageAlt: 'Highway aerial view',
        labels: [
          { label: 'OEM Luggage' },
          { label: 'ODM Development' },
          { label: 'Quality Control' },
          { label: 'Bulk Orders' },
        ],
      },
      services: {
        heading: 'Services',
        items: [
          {
            number: '[01]',
            title: 'OEM Private Label',
            description:
              'Manufacture luggage around your brand requirements, including logo placement, colors, packaging, trim choices, and retail or distributor needs.',
            externalImageUrl: 'https://framerusercontent.com/images/hMpfNtZpREzFm2iw1HGpOPs7cg.jpg',
            imageAlt: 'OEM luggage manufacturing',
          },
          {
            number: '[02]',
            title: 'ODM Product Development',
            description:
              'Develop new suitcase and travel goods concepts through sample rounds, construction review, material options, and production-ready specification alignment.',
            externalImageUrl: 'https://framerusercontent.com/images/qkMQq9Zs1gGZaibDwwhw42dog.jpg',
            imageAlt: 'ODM luggage sample development',
          },
          {
            number: '[03]',
            title: 'Material And Component Sourcing',
            description:
              'Coordinate shell materials, fabric, wheels, trolley handles, zippers, locks, lining, labels, cartons, and other details needed for your product range.',
            externalImageUrl: 'https://framerusercontent.com/images/JcvRxIUpdnFDa0zMeiuRidwGAg.jpg',
            imageAlt: 'luggage materials and components',
          },
          {
            number: '[04]',
            title: 'Production And Quality Control',
            description:
              'Move approved samples into bulk production with practical inspection points, packing checks, and clear communication before order handover.',
            externalImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
            imageAlt: 'luggage production quality control',
          },
        ],
      },
      industries: {
        title: 'Products We Support',
        externalImageUrl: 'https://framerusercontent.com/images/xuiGNeWrzpBf9F7gqvI7nHqMlg.webp',
        imageAlt: 'Warehouse interior',
        items: [
          { name: 'Travel Luggage' },
          { name: 'Cabin Suitcase' },
          { name: 'Checked Suitcase' },
          { name: 'Hard Shell Luggage' },
          { name: 'Soft Luggage' },
          { name: 'Travel Bags' },
          { name: 'Corporate Gifts' },
          { name: 'Retail Private Label' },
        ],
      },
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'platform-page',
    data: {
      metaTitle: 'Capabilities - DJI Luggage',
      hero: {
        label: 'Capabilities',
        title: 'How We Build',
        description:
          'A practical view of our luggage manufacturing workflow, from buyer brief to production handover.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/4FR1NuE2E9HUFnECPOEhqKYJN3U.jpg',
      },
      interfaceIntro: {
        label: 'Production Workflow',
        body:
          'Every order needs clear product data, sample approvals, production checkpoints, and buyer communication. Our workflow keeps those pieces connected.',
      },
      tabletMockup: {
        externalImageUrl: 'https://framerusercontent.com/images/kbFgydLmMWcDx19m8RsDtfRriA.png',
        imageAlt: 'Manufacturing planning dashboard',
      },
      featureSections: [
        {
          label: 'From Brief To Sample',
          heading: 'Turn Requirements Into A Product Direction',
          body:
            'Share product type, target price, market, quantity, materials, colors, logo direction, and packaging needs. We translate the brief into sample priorities and practical manufacturing options.',
          externalImageUrl: 'https://framerusercontent.com/images/6KnqYTEfv0yWM68b6hmLIAoLc.png',
          imageAlt: 'luggage sample planning',
        },
        {
          label: 'From Sample To Production',
          heading: 'Confirm Details Before Scaling The Order',
          body:
            'Once the sample is approved, the same details guide material preparation, assembly, quality checks, packing, and final buyer communication.',
          externalImageUrl: 'https://framerusercontent.com/images/w0PuRzQLRi5FkQEk6dP4v42iv4.png',
          imageAlt: 'luggage production tracking',
        },
      ],
      whyChoose: {
        label: 'Why Choose Us',
        body: 'Clear communication, practical manufacturing knowledge, and a production process built for repeat orders.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
      },
      highlights: {
        label: 'Features',
        heading: 'Capability Highlights',
        items: [
          {
            number: '[01]',
            body: 'OEM and private-label support for luggage buyers building branded product ranges.',
            externalIconUrl: 'https://framerusercontent.com/images/sHtqFSFFIZicgvnrXwnuy7el1k.svg',
          },
          {
            number: '[02]',
            body: 'ODM sample development for buyers who need help turning an idea into a production-ready design.',
            externalIconUrl: 'https://framerusercontent.com/images/4gIBVNwwAmQB1naE9zcz8lnWfY.svg',
          },
          {
            number: '[03]',
            body: 'Component coordination across shell material, lining, wheels, handles, locks, zippers, and labels.',
            externalIconUrl: 'https://framerusercontent.com/images/w5pbS2FriKLRpqu9FPdPgtaUxw.svg',
          },
          {
            number: '[04]',
            body: 'Quality checkpoints during production instead of waiting until the order is finished.',
            externalIconUrl: 'https://framerusercontent.com/images/dEjsM2tjkm0kdr6ruJjJd0Eio.svg',
          },
          {
            number: '[05]',
            body: 'Packing, carton, label, and handover details aligned before delivery preparation.',
            externalIconUrl: 'https://framerusercontent.com/images/mu43n2Awg4JAiKTH6TLGvTn8k8.svg',
          },
          {
            number: '[06]',
            body: 'Responsive buyer communication for samples, quotations, production updates, and repeat orders.',
            externalIconUrl: 'https://framerusercontent.com/images/jiE9KPvwb4tvZyIjzwj86SCjINU.svg',
          },
        ],
      },
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'newsroom-page',
    data: {
      metaTitle: 'Insights - DJI Luggage',
      hero: {
        title: 'Luggage Manufacturing Insights',
        descriptions: [
          {
            body: 'Notes on OEM luggage,\nprivate-label production,\nsampling and quality control.',
          },
          {
            body: 'Use this section for buyer guides,\ncompany updates and product\nmanufacturing knowledge.',
          },
        ],
      },
      filters: [
        { label: 'All', value: 'all' },
        { label: 'Insights', value: 'insights' },
        { label: 'News', value: 'news' },
      ],
      posts: newsPosts.map((item) => item.id),
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'careers-page',
    data: {
      metaTitle: 'Careers - DJI Luggage',
      hero: {
        title: 'Careers at\nDJI Luggage.',
        descriptions: [
          {
            body:
              'Join a practical manufacturing team building suitcase and travel goods programs for buyers and brands.',
          },
          {
            body:
              'Work across sampling, production, quality control, customer coordination, and factory operations.',
          },
        ],
      },
      teamPhotos: [
        {
          externalImageUrl: 'https://framerusercontent.com/images/ZYX74OGfgMItW1hW5UEHBon9ic.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/EAfzjUmTenmtXJuhNEUOCMwps.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/pY4ShkQbP5hHBA0R47iSDyJY4.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/QPbxJzSomgVjzBqsCDWlXDen47g.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/I0JLD4ZrkQ2m8SgO1b7ObGpY0Y.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/Rf6AGJdqHXAyTMdqgeIEMydTW4.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/0KH5UuIJHGUclkImAuBW1STq1gI.jpg',
          imageAlt: 'Career image',
        },
        {
          externalImageUrl: 'https://framerusercontent.com/images/WxjRRdMY30YyaF7s3NcvXQkdk.jpg',
          imageAlt: 'Career image',
        },
      ],
      benefitsIntro: {
        bodyHtml:
          "At <span class=\"benefits-highlight\">DJI Luggage</span>, you can build practical manufacturing skills, support real buyer programs, and grow with a team focused on <span class=\"benefits-highlight\">quality</span> travel products",
        externalImageUrl: 'https://framerusercontent.com/images/FgA1lEYmTjFwXZKDZbC2INNrVg.jpg',
        imageAlt: '',
      },
      benefits: [
        {
          number: '[01]',
          title: 'Hands-On Craft',
          body:
            'Learn through real production work, sample reviews, component details, and daily problem solving.',
        },
        {
          number: '[02]',
          title: 'Growth',
          body:
            'Build useful skills across manufacturing, quality, customer communication, and order coordination.',
        },
        {
          number: '[03]',
          title: 'Team Culture',
          body:
            'Work with people who value clarity, practical support, and steady improvement on every order.',
        },
      ],
      clock: {
        locationLabel: 'Bogor',
        timeZone: 'Asia/Jakarta',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/JRztHvFLJHCm77Wuu4pLXB4vWx0.jpg',
      },
      positionsHeading: 'Open Positions',
      positions: jobPosts.map((item) => item.id),
      finalCta: {
        label: 'Ready To Build',
        heading: 'Start Your\nLuggage Program',
        buttonLabel: 'Get a Quote',
        buttonUrl: '/contact',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'contact-page',
    data: {
      metaTitle: 'Contact - DJI Luggage',
      hero: {
        email: 'info@djiluggage.id',
        title: 'Contact Us',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/q7ovq9XPzUbvhCNfkFPPkWTTxw.jpg',
      },
      form: {
        label: 'Your Info',
        title: 'Request a Quote',
        fields: [
          { placeholder: 'Product Type' },
          { placeholder: 'Order Quantity' },
          { placeholder: 'Company Name' },
          { placeholder: 'Email / Phone' },
          { placeholder: 'Your Name' },
          { placeholder: 'Destination Market' },
        ],
        messagePlaceholder: 'Message',
        submitLabel: 'Send Inquiry',
        successMessage: 'Inquiry sent. We will contact you shortly.',
        errorMessage: 'Unable to send right now. Please email info@djiluggage.id or try again.',
      },
    },
  })

  console.log('DJI Luggage CMS seed complete.')
}

await seed()
process.exit(0)
