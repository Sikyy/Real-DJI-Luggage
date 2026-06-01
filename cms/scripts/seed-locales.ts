import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { randomUUID } from 'crypto'

type Locale = 'zh' | 'id'

type CollectionSlug = 'job-posts' | 'news-posts' | 'team-members' | 'testimonials'

type DBClient = {
  execute: (args: { args?: unknown[]; sql: string }) => Promise<{ rows: Record<string, unknown>[] }>
}

type ArrayLocaleItem = Record<string, unknown>
type ArrayLocaleColumn = string | [dbColumn: string, dataKey: string]

const finalCta = {
  zh: {
    label: '准备开始',
    heading: '启动您的\n行李箱项目',
    buttonLabel: '获取报价',
    buttonUrl: '/contact',
    externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
  },
  id: {
    label: 'Siap Mulai',
    heading: 'Mulai Program\nKoper Anda',
    buttonLabel: 'Minta Penawaran',
    buttonUrl: '/contact',
    externalBackgroundImageUrl: 'https://framerusercontent.com/images/cdkra1msE338pRZAmYqBqbSgQ.jpg',
  },
}

const articleSections = {
  zh: [
    {
      heading: '从清晰的产品需求开始',
      body:
        '可靠的行李箱项目需要先明确尺寸、硬壳或软面材料、轮组、拉杆、内里、锁具、颜色、品牌工艺、目标价格和订单数量。需求越清楚，工厂越容易给出务实的结构建议，并减少不必要的打样轮次。\n\n对采购方来说，前期信息清晰也能让报价更容易比较，并帮助生产团队更早安排材料和工期。',
    },
    {
      heading: '通过打样把想法变成决策',
      body:
        '打样阶段会把设计想法放到真实生产条件下验证。采购方可以在大货前确认结构、重量、表面处理、拉杆手感、轮子顺滑度、拉链表现、Logo 位置、内部分隔和包装细节。\n\nDJI Luggage 会在样品阶段整理修改意见，记录确认版本，并把最终样品转化为可执行的大货标准。',
    },
    {
      heading: '质量检查要嵌入生产过程',
      body:
        '行李箱质量由许多细节决定：材料一致性、轮组装配、拉杆强度、护角、车缝、拉链、颜色、Logo 位置和外箱包装。生产中持续检查，比等到完工后再处理更有效。\n\n稳定的质检流程可以减少返工，也让采购方在后续复购时更有信心。',
    },
    {
      heading: '提前规划包装与交付',
      body:
        '纸箱尺寸、套装包装、产品标签、吊牌、条码位置和目的地要求都应尽早确认。这些细节会影响成本、仓储、验货和最终交付准备。\n\n对批发和自有品牌采购来说，包装不仅是运输环节，也是产品体验的一部分。',
    },
    {
      heading: '为下一次订单建立标准',
      body:
        '好的制造合作关系应该能支持持续复购。一旦产品方向确认，下一步就是保持规格稳定、交期可预期、确认记录清楚，并保留持续优化的沟通渠道。\n\nDJI Luggage 支持希望建立长期旅行用品供应链的品牌、分销商和项目采购方。',
    },
  ],
  id: [
    {
      heading: 'Mulai Dari Brief Produk Yang Jelas',
      body:
        'Program koper yang kuat dimulai dari detail dasar: ukuran, material hard shell atau soft case, roda, trolley handle, lining, kunci, warna, metode branding, target harga, dan jumlah pesanan. Input yang jelas membantu pabrik memberi opsi konstruksi yang realistis dan mengurangi putaran sampel yang tidak perlu.\n\nBagi pembeli, kejelasan awal juga membuat penawaran lebih mudah dibandingkan dan membantu tim produksi menyiapkan material serta jadwal.',
    },
    {
      heading: 'Sampel Mengubah Ide Menjadi Keputusan',
      body:
        'Tahap sampel mempertemukan arah desain dengan kondisi produksi nyata. Pembeli dapat meninjau struktur, berat, finishing, gerakan trolley, rasa roda, performa zipper, posisi logo, layout interior, dan detail kemasan sebelum masuk ke order besar.\n\nDJI Luggage menggunakan tahap ini untuk menyelaraskan ekspektasi, mencatat revisi, dan menyiapkan versi yang disetujui untuk produksi massal.',
    },
    {
      heading: 'Quality Check Perlu Masuk Ke Proses',
      body:
        'Kualitas koper dibentuk oleh banyak detail kecil: konsistensi material, pemasangan roda, kekuatan handle, pelindung sudut, jahitan, zipper, warna, posisi logo, dan packing karton. Pemeriksaan selama produksi lebih efektif daripada menunggu pesanan selesai.\n\nProses QC yang stabil membantu mengurangi rework dan memberi pembeli keyakinan untuk repeat order.',
    },
    {
      heading: 'Rencanakan Kemasan Dan Pengiriman Lebih Awal',
      body:
        'Ukuran karton, master packing, label produk, hangtag, barcode, dan kebutuhan tujuan pengiriman sebaiknya dibahas sejak awal. Detail ini memengaruhi biaya, pergudangan, inspeksi, dan kesiapan serah terima.\n\nUntuk pembeli grosir dan private label, kemasan adalah bagian dari pengalaman produk, bukan hanya detail pengiriman.',
    },
    {
      heading: 'Bangun Standar Untuk Order Berikutnya',
      body:
        'Hubungan manufaktur terbaik dibuat untuk bisa diulang. Setelah arah produk disetujui, target berikutnya adalah konsistensi: spesifikasi stabil, lead time jelas, approval terdokumentasi, dan jalur komunikasi untuk perbaikan.\n\nDJI Luggage mendukung pembeli yang membutuhkan partner pabrik untuk pengembangan produk travel jangka panjang.',
    },
  ],
}

const sharedJobContent = {
  zh: {
    sidebarText: 'DJI Luggage 是位于印尼茂物的行李箱制造商，服务 OEM、ODM 和自有品牌采购方。',
    responsibilities: [
      { body: '协调生产、质量、采购和客户沟通团队的日常工作。' },
      { body: '确保产品规格、样品反馈和订单要求记录清楚。' },
      { body: '跟进时间节点，提前提示风险，并协助团队保持稳定交付。' },
      { body: '支持行李箱生产、包装和客户沟通流程的持续改进。' },
      { body: '整理采购方反馈和生产信息，用于优化后续订单。' },
      { body: '维护样品、确认、验货和交付相关文档。' },
    ],
    basicRequirements: [
      { body: '具备制造业、消费品、出口、质量或运营相关经验。' },
      { body: '关注细节，能同时管理多个订单的资料和进度。' },
      { body: '能与内部团队、供应商和客户清晰沟通。' },
      { body: '能在生产节奏下冷静处理实际问题并安排优先级。' },
      { body: '愿意在一线工厂环境中工作。' },
    ],
    preferredRequirements: [
      { body: '有行李箱、箱包、塑壳产品、纺织品或旅行用品经验优先。' },
      { body: '熟悉 OEM 或 ODM 订单流程优先。' },
      { body: '能处理照片、规格表、验货记录和客户反馈。' },
      { body: '具备英语或中文沟通能力者优先，便于出口订单协作。' },
    ],
  },
  id: {
    sidebarText: 'DJI Luggage adalah produsen koper berbasis di Bogor untuk pembeli OEM, ODM, dan private label.',
    responsibilities: [
      { body: 'Mengkoordinasikan pekerjaan harian dengan tim produksi, quality, purchasing, dan customer-facing.' },
      { body: 'Menjaga spesifikasi produk, feedback sampel, dan kebutuhan order tetap jelas serta terdokumentasi.' },
      { body: 'Melacak timeline, mengangkat risiko lebih awal, dan membantu tim menjaga standar pengiriman.' },
      { body: 'Mendukung perbaikan berkelanjutan pada produksi koper, packing, dan komunikasi pelanggan.' },
      { body: 'Meninjau feedback pembeli dan data produksi untuk memperbaiki order berikutnya.' },
      { body: 'Menjaga dokumentasi sampel, approval, inspeksi, dan handover tetap rapi.' },
    ],
    basicRequirements: [
      { body: 'Pengalaman di manufaktur, consumer goods, ekspor, quality, atau operations.' },
      { body: 'Teliti dan mampu mengelola beberapa order secara terorganisir.' },
      { body: 'Komunikasi jelas dengan tim internal, supplier, dan pelanggan.' },
      { body: 'Mampu menentukan prioritas dan menyelesaikan masalah secara tenang dalam timeline produksi.' },
      { body: 'Nyaman bekerja di lingkungan pabrik yang hands-on.' },
    ],
    preferredRequirements: [
      { body: 'Pengalaman dengan koper, tas, produk hard shell, tekstil, atau travel goods menjadi nilai tambah.' },
      { body: 'Memahami alur kerja order OEM atau ODM.' },
      { body: 'Mampu bekerja dengan foto, spesifikasi, catatan inspeksi, dan feedback pembeli.' },
      { body: 'Kemampuan komunikasi bahasa Inggris atau Mandarin menjadi nilai tambah untuk koordinasi ekspor.' },
    ],
  },
}

function dbIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function stripArrayFields(value: unknown): unknown {
  if (Array.isArray(value)) return undefined
  if (!value || typeof value !== 'object') return value

  const next: Record<string, unknown> = {}

  for (const [key, child] of Object.entries(value)) {
    const stripped = stripArrayFields(child)

    if (stripped !== undefined) {
      next[key] = stripped
    }
  }

  return next
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()
}

function tableNameFromSlug(slug: string) {
  return slug.replace(/-/g, '_')
}

function flattenLocaleData(value: unknown, prefix: string[] = [], output: Record<string, unknown> = {}) {
  if (Array.isArray(value) || value === undefined) return output

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenLocaleData(child, [...prefix, key], output)
    }

    return output
  }

  output[prefix.map(toSnakeCase).join('_')] = value
  return output
}

function getDBClient(payload: Payload): DBClient {
  return (payload.db as any).client as DBClient
}

async function getTableColumns(client: DBClient, table: string) {
  const result = await client.execute({
    sql: `PRAGMA table_info(${dbIdentifier(table)})`,
  })

  return new Map(
    result.rows
      .filter((row) => row.name && !['id', '_locale', '_parent_id'].includes(String(row.name)))
      .map((row) => [
        String(row.name),
        {
          notNull: Boolean(Number(row.notnull)),
        },
      ]),
  )
}

async function upsertLocaleData({
  client,
  data,
  locale,
  parentId,
  table,
}: {
  client: DBClient
  data: Record<string, unknown>
  locale: Locale
  parentId: unknown
  table: string
}) {
  const localeTable = `${table}_locales`
  const columns = await getTableColumns(client, localeTable)
  const flattened = flattenLocaleData(stripArrayFields(data))
  const values: Record<string, unknown> = {}

  for (const [column] of columns) {
    if (flattened[column] !== undefined) {
      values[column] = flattened[column]
    }
  }

  if (!Object.keys(values).length) return

  const existing = await client.execute({
    sql: `SELECT id FROM ${dbIdentifier(localeTable)} WHERE _locale = ? AND _parent_id = ? LIMIT 1`,
    args: [locale, parentId],
  })

  if (existing.rows[0]?.id) {
    await client.execute({
      sql: `UPDATE ${dbIdentifier(localeTable)} SET ${Object.keys(values)
        .map((column) => `${dbIdentifier(column)} = ?`)
        .join(', ')} WHERE _locale = ? AND _parent_id = ?`,
      args: [...Object.values(values), locale, parentId],
    })
    return
  }

  const fallback = await client.execute({
    sql: `SELECT * FROM ${dbIdentifier(localeTable)} WHERE _locale = 'en' AND _parent_id = ? LIMIT 1`,
    args: [parentId],
  })

  const insertValues: Record<string, unknown> = {}

  for (const [column, meta] of columns) {
    const value = values[column] ?? fallback.rows[0]?.[column]

    if (value !== undefined && value !== null) {
      insertValues[column] = value
    } else if (meta.notNull) {
      insertValues[column] = ''
    }
  }

  if (!Object.keys(insertValues).length) return

  await client.execute({
    sql: `INSERT INTO ${dbIdentifier(localeTable)} (${Object.keys(insertValues)
      .map(dbIdentifier)
      .join(', ')}, "_locale", "_parent_id") VALUES (${Object.keys(insertValues)
      .map(() => '?')
      .join(', ')}, ?, ?)`,
    args: [...Object.values(insertValues), locale, parentId],
  })
}

async function getGlobalParentId(client: DBClient, table: string) {
  const result = await client.execute({
    sql: `SELECT id FROM ${dbIdentifier(table)} LIMIT 1`,
  })

  return result.rows[0]?.id
}

async function findParentId(client: DBClient, table: string, slug: string) {
  const result = await client.execute({
    sql: `SELECT id FROM ${dbIdentifier(table)} WHERE slug = ? LIMIT 1`,
    args: [slug],
  })

  return result.rows[0]?.id
}

async function ensureMainNavigationRows(client: DBClient) {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM "site_settings_main_navigation"',
  })

  if (Number(result.rows[0]?.count || 0) >= 6) return

  const siteSettings = await getGlobalParentId(client, 'site_settings')
  if (!siteSettings) return

  const rows = [
    { label: 'Home', url: '/' },
    { label: 'About', url: '/about' },
    { label: 'Manufacturing', url: '/services' },
    { label: 'Capabilities', url: '/platform' },
    { label: 'Insights', url: '/newsroom/filters/all' },
    { label: 'Careers', url: '/careers' },
  ]

  await client.execute({
    sql: 'DELETE FROM "site_settings_main_navigation" WHERE _parent_id = ?',
    args: [siteSettings],
  })

  for (const [index, row] of rows.entries()) {
    await client.execute({
      sql: 'INSERT INTO "site_settings_main_navigation" ("_order", "_parent_id", "id", "label", "url") VALUES (?, ?, ?, ?, ?)',
      args: [index + 1, siteSettings, randomUUID(), row.label, row.url],
    })
  }
}

async function ensureFooterColumnRows(client: DBClient) {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM "site_settings_footer_columns"',
  })

  if (Number(result.rows[0]?.count || 0) >= 2) return

  const siteSettings = await getGlobalParentId(client, 'site_settings')
  if (!siteSettings) return

  const rows = [
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
  ]

  await client.execute({
    sql: 'DELETE FROM "site_settings_footer_columns" WHERE _parent_id = ?',
    args: [siteSettings],
  })

  for (const [index, row] of rows.entries()) {
    const columnId = randomUUID()

    await client.execute({
      sql: 'INSERT INTO "site_settings_footer_columns" ("_order", "_parent_id", "id", "heading") VALUES (?, ?, ?, ?)',
      args: [index + 1, siteSettings, columnId, row.heading],
    })

    for (const [linkIndex, link] of row.links.entries()) {
      await client.execute({
        sql: 'INSERT INTO "site_settings_footer_columns_links" ("_order", "_parent_id", "id", "label", "url") VALUES (?, ?, ?, ?, ?)',
        args: [linkIndex + 1, columnId, randomUUID(), link.label, link.url],
      })
    }
  }
}

async function ensureSocialLinkRows(client: DBClient) {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM "site_settings_social_links"',
  })

  if (Number(result.rows[0]?.count || 0) >= 4) return

  const siteSettings = await getGlobalParentId(client, 'site_settings')
  if (!siteSettings) return

  const rows = [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
    { label: 'X', url: 'https://x.com/', icon: 'x' },
    { label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
    { label: 'WhatsApp', url: 'https://wa.me/6281266189081', icon: 'whatsapp' },
  ]

  await client.execute({
    sql: 'DELETE FROM "site_settings_social_links" WHERE _parent_id = ?',
    args: [siteSettings],
  })

  for (const [index, row] of rows.entries()) {
    await client.execute({
      sql: 'INSERT INTO "site_settings_social_links" ("_order", "_parent_id", "id", "label", "url", "icon") VALUES (?, ?, ?, ?, ?, ?)',
      args: [index + 1, siteSettings, randomUUID(), row.label, row.url, row.icon],
    })
  }
}

async function setArrayLocaleRows({
  client,
  columns,
  items,
  locale,
  localeTable,
  parentId,
  table,
}: {
  client: DBClient
  columns: ArrayLocaleColumn[]
  items: ArrayLocaleItem[]
  locale: Locale
  localeTable: string
  parentId?: unknown
  table: string
}) {
  const where = parentId === undefined ? '' : ' WHERE _parent_id = ?'
  const rows = await client.execute({
    sql: `SELECT id FROM ${dbIdentifier(table)}${where} ORDER BY _order ASC`,
    args: parentId === undefined ? [] : [parentId],
  })

  if (rows.rows.length < items.length) {
    console.warn(`Skipping some ${localeTable} rows for ${locale}; expected ${items.length}, found ${rows.rows.length}.`)
  }

  for (const [index, item] of items.entries()) {
    const row = rows.rows[index]
    if (!row?.id) continue

    const entries: Array<[string, unknown]> = []

    for (const column of columns) {
      const dbColumn = Array.isArray(column) ? column[0] : column
      const dataKey = Array.isArray(column) ? column[1] : column

      if (item[dataKey] !== undefined) {
        entries.push([dbColumn, item[dataKey]])
      }
    }

    await client.execute({
      sql: `DELETE FROM ${dbIdentifier(localeTable)} WHERE _locale = ? AND _parent_id = ?`,
      args: [locale, row.id],
    })

    if (!entries.length) continue

    await client.execute({
      sql: `INSERT INTO ${dbIdentifier(localeTable)} (${entries
        .map(([column]) => dbIdentifier(column))
        .join(', ')}, "_locale", "_parent_id") VALUES (${entries.map(() => '?').join(', ')}, ?, ?)`,
      args: [...entries.map(([, value]) => value), locale, row.id],
    })
  }
}

async function setFooterColumnLinkLocales(
  client: DBClient,
  locale: Locale,
  columns: Array<{ links: ArrayLocaleItem[] }>,
) {
  const footerColumns = await client.execute({
    sql: 'SELECT id FROM "site_settings_footer_columns" ORDER BY _order ASC',
  })

  for (const [index, column] of columns.entries()) {
    const row = footerColumns.rows[index]
    if (!row?.id) continue

    await setArrayLocaleRows({
      client,
      table: 'site_settings_footer_columns_links',
      localeTable: 'site_settings_footer_columns_links_locales',
      parentId: row.id,
      locale,
      items: column.links,
      columns: ['label'],
    })
  }
}

async function updateGlobalLocale(payload: Payload, slug: string, locale: Locale, data: Record<string, unknown>) {
  const client = getDBClient(payload)
  const table = tableNameFromSlug(slug)
  const parentId = await getGlobalParentId(client, table)

  if (!parentId) {
    console.warn(`Skipping ${slug}; global row was not found.`)
    return
  }

  await upsertLocaleData({
    client,
    table,
    parentId,
    locale,
    data,
  })
}

async function updateBySlug(
  payload: Payload,
  collection: CollectionSlug,
  slug: string,
  locale: Locale,
  data: Record<string, unknown>,
) {
  const client = getDBClient(payload)
  const table = tableNameFromSlug(collection)
  const parentId = await findParentId(client, table, slug)

  if (!parentId) {
    console.warn(`Skipping ${collection}/${slug}; document was not found.`)
    return
  }

  await upsertLocaleData({
    client,
    table,
    parentId,
    locale,
    data,
  })
}

async function updateSortedCollection(
  payload: Payload,
  collection: CollectionSlug,
  locale: Locale,
  items: Record<string, unknown>[],
) {
  const client = getDBClient(payload)
  const table = tableNameFromSlug(collection)
  const existing = await client.execute({
    sql: `SELECT id FROM ${dbIdentifier(table)} ORDER BY sort_order ASC LIMIT ?`,
    args: [items.length],
  })

  for (const [index, data] of items.entries()) {
    const doc = existing.rows[index]
    if (!doc?.id) continue

    await upsertLocaleData({
      client,
      table,
      parentId: doc.id,
      locale,
      data,
    })
  }
}

async function seedSiteSettings(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      logoAlt: 'DJI Luggage 行李箱',
      requestQuoteLabel: '获取报价',
      mainNavigation: [
        { label: '首页', url: '/' },
        { label: '关于我们', url: '/about' },
        { label: '制造服务', url: '/services' },
        { label: '制造能力', url: '/platform' },
        { label: '行业洞察', url: '/newsroom/filters/all' },
        { label: '招聘', url: '/careers' },
      ],
      menuContact: {
        quickContactLabel: '快速联系',
        email: 'info@djiluggage.id',
        messageLabel: '发送消息',
        quoteLabel: '获取报价',
        quoteUrl: '/contact',
      },
      footerContact: {
        label: '联系',
        heading: '开始合作',
        buttonLabel: '获取报价',
        buttonUrl: '/contact',
      },
      address: '印度尼西亚西爪哇省茂物县 Kemang 区\nJL RAYA PARUNG BOGOR,\n邮编 16310',
      footerColumns: [
        {
          heading: '主要页面',
          links: [
            { label: '首页', url: '/' },
            { label: '制造服务', url: '/services' },
            { label: '关于我们', url: '/about' },
            { label: '招聘', url: '/careers' },
            { label: '制造能力', url: '/platform' },
            { label: '行业洞察', url: '/newsroom/filters/all' },
          ],
        },
        {
          heading: '支持',
          links: [
            { label: '404', url: '/404' },
            { label: '隐私政策', url: '/privacy-policy' },
          ],
        },
      ],
      socialLinks: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
        { label: 'X', url: 'https://x.com/', icon: 'x' },
        { label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
        { label: 'WhatsApp', url: 'https://wa.me/6281266189081', icon: 'whatsapp' },
      ],
      copyright: '©2026 DJI Luggage. 保留所有权利。',
      credit: '印度尼西亚行李箱制造商',
    },
    id: {
      logoAlt: 'DJI Luggage',
      requestQuoteLabel: 'Minta Penawaran',
      mainNavigation: [
        { label: 'Beranda', url: '/' },
        { label: 'Tentang', url: '/about' },
        { label: 'Manufaktur', url: '/services' },
        { label: 'Kapabilitas', url: '/platform' },
        { label: 'Wawasan', url: '/newsroom/filters/all' },
        { label: 'Karier', url: '/careers' },
      ],
      menuContact: {
        quickContactLabel: 'Kontak Cepat',
        email: 'info@djiluggage.id',
        messageLabel: 'Kirim Pesan',
        quoteLabel: 'Minta Penawaran',
        quoteUrl: '/contact',
      },
      footerContact: {
        label: 'Kontak',
        heading: 'Mari Mulai',
        buttonLabel: 'Minta Penawaran',
        buttonUrl: '/contact',
      },
      address:
        'JL RAYA PARUNG BOGOR,\nDESA/KELURAHAN KEMANG,\nKEC. KEMANG, KAB. BOGOR,\nPROVINSI JAWA BARAT,\nKODE POS: 16310',
      footerColumns: [
        {
          heading: 'Utama',
          links: [
            { label: 'Beranda', url: '/' },
            { label: 'Manufaktur', url: '/services' },
            { label: 'Tentang', url: '/about' },
            { label: 'Karier', url: '/careers' },
            { label: 'Kapabilitas', url: '/platform' },
            { label: 'Wawasan', url: '/newsroom/filters/all' },
          ],
        },
        {
          heading: 'Dukungan',
          links: [
            { label: '404', url: '/404' },
            { label: 'Kebijakan Privasi', url: '/privacy-policy' },
          ],
        },
      ],
      socialLinks: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
        { label: 'X', url: 'https://x.com/', icon: 'x' },
        { label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
        { label: 'WhatsApp', url: 'https://wa.me/6281266189081', icon: 'whatsapp' },
      ],
      copyright: '©2026 DJI Luggage. Hak cipta dilindungi.',
      credit: 'Produsen koper Indonesia',
    },
  }

  await updateGlobalLocale(payload, 'site-settings', locale, content[locale])

  const client = getDBClient(payload)

  await ensureMainNavigationRows(client)
  await ensureFooterColumnRows(client)
  await ensureSocialLinkRows(client)

  await setArrayLocaleRows({
    client,
    table: 'site_settings_main_navigation',
    localeTable: 'site_settings_main_navigation_locales',
    locale,
    items: content[locale].mainNavigation,
    columns: ['label'],
  })
  await setArrayLocaleRows({
    client,
    table: 'site_settings_footer_columns',
    localeTable: 'site_settings_footer_columns_locales',
    locale,
    items: content[locale].footerColumns,
    columns: ['heading'],
  })
  await setFooterColumnLinkLocales(client, locale, content[locale].footerColumns)
  await setArrayLocaleRows({
    client,
    table: 'site_settings_social_links',
    localeTable: 'site_settings_social_links_locales',
    locale,
    items: content[locale].socialLinks,
    columns: ['label'],
  })
}

async function seedHome(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: 'DJI Luggage - 印度尼西亚行李箱制造商',
      hero: {
        breadcrumb: '首页',
        title: '为您的品牌制造\n专业行李箱',
        description: 'DJI Luggage 为零售商、分销商和自有品牌制造耐用的行李箱与旅行包项目。',
        buttonLabel: '获取报价',
        buttonUrl: '/contact',
        posterUrl: 'https://framerusercontent.com/images/9oXIMPUOwaaTowc6iUbxkZ146KE.png',
        videoUrl: 'https://framerusercontent.com/assets/B1E36n5Z6jDij8UJYkjAIGrRups.mp4',
      },
      services: {
        label: '我们制造什么',
        heading: '我们帮助采购方开发务实的行李箱产品，从自有品牌项目到打样、生产协调和质量检查。',
        cards: [
          {
            title: 'OEM 自有品牌行李箱',
            description: '围绕您的品牌、颜色、Logo 位置、包装和目标市场打造行李箱与旅行包产品线。',
          },
          {
            title: 'ODM 产品开发',
            description: '把产品想法转化为样品，并围绕结构、材料、配件、轮子、拉杆和内部细节提供实际建议。',
          },
          {
            title: '大货生产与质检',
            description: '协调生产、验货、包装和采购方确认，让复购订单保持清晰和稳定。',
          },
        ],
        buttonLabel: '查看服务',
        buttonUrl: '/services',
      },
      values: [
        {
          number: '1',
          title: '制造工艺',
          description: '我们关注让行李箱更耐用、更实用、更适合日常旅行的结构细节。',
        },
        {
          number: '2',
          title: '稳定生产',
          description: '从样品确认到大货包装，我们的流程强调清晰、稳定和持续跟进。',
        },
        {
          number: '3',
          title: '长期合作',
          description: '我们支持需要稳定制造伙伴的新产品发布、季节项目和复购订单。',
        },
      ],
      technologyCta: {
        label: '制造能力',
        headingHtml:
          '从概念 <span class="inline-img"><img src="https://framerusercontent.com/images/ZHqjUB0xVhxl0vTlth6rCo3PUo.jpg" alt=""></span> 到打样 <span class="inline-img"><img src="https://framerusercontent.com/images/IsBCAtrPkzqt9u9duPkAiN5dvhw.jpg" alt=""></span> 再到规模化行李箱生产。',
        buttonLabel: '探索能力',
        buttonUrl: '/platform',
      },
      howWeWork: {
        label: '合作流程',
        body: 'DJI Luggage 让制造路径保持简单：确认需求、确认样品、带着质量检查生产，并为采购方交付做好准备。',
        steps: [
          { number: '[01]', body: '需求：提供产品类型、数量、目标市场、品牌、材料方向和时间计划。' },
          { number: '[02]', body: '样品：确认结构、Logo 位置、配件、颜色、包装和需要调整的细节。' },
          { number: '[03]', body: '生产：把确认细节导入大货生产、验货、包装和交付协调。' },
        ],
      },
      newsroom: {
        label: '最新文章',
        heading: '新闻中心',
      },
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'DJI Luggage - Produsen Koper Indonesia',
      hero: {
        breadcrumb: 'Beranda',
        title: 'Manufaktur Koper,\nDibangun Untuk Brand Anda',
        description:
          'DJI Luggage memproduksi program koper dan travel bag yang tahan lama untuk retailer, distributor, dan private label yang berkembang.',
        buttonLabel: 'Minta Penawaran',
        buttonUrl: '/contact',
        posterUrl: 'https://framerusercontent.com/images/9oXIMPUOwaaTowc6iUbxkZ146KE.png',
        videoUrl: 'https://framerusercontent.com/assets/B1E36n5Z6jDij8UJYkjAIGrRups.mp4',
      },
      services: {
        label: 'Apa Yang Kami Buat',
        heading:
          'Kami membantu pembeli mengembangkan produk koper yang praktis, dari program private label hingga sampling, koordinasi produksi, dan quality check.',
        cards: [
          {
            title: 'Koper OEM Private Label',
            description:
              'Bangun lini koper dan travel bag sesuai brand, warna, posisi logo, kemasan, dan target pasar Anda.',
          },
          {
            title: 'Pengembangan Produk ODM',
            description:
              'Ubah ide produk menjadi sampel dengan panduan praktis untuk struktur, material, trim, roda, handle, dan detail interior.',
          },
          {
            title: 'Produksi Massal Dan QC',
            description:
              'Koordinasi manufaktur, inspeksi, packing, dan approval pembeli agar repeat order tetap jelas dan konsisten.',
          },
        ],
        buttonLabel: 'Lihat Layanan',
        buttonUrl: '/services',
      },
      values: [
        {
          number: '1',
          title: 'Craftsmanship',
          description: 'Kami fokus pada detail konstruksi yang membuat koper terasa kuat, berguna, dan siap untuk perjalanan harian.',
        },
        {
          number: '2',
          title: 'Produksi Andal',
          description: 'Dari approval sampel hingga packing order besar, proses kami dibuat untuk kejelasan, konsistensi, dan follow-through.',
        },
        {
          number: '3',
          title: 'Kemitraan Jangka Panjang',
          description: 'Kami mendukung pembeli yang membutuhkan partner manufaktur stabil untuk peluncuran, program musiman, dan repeat order.',
        },
      ],
      technologyCta: {
        label: 'Kapabilitas Manufaktur',
        headingHtml:
          'Dari konsep <span class="inline-img"><img src="https://framerusercontent.com/images/ZHqjUB0xVhxl0vTlth6rCo3PUo.jpg" alt=""></span> ke sampling <span class="inline-img"><img src="https://framerusercontent.com/images/IsBCAtrPkzqt9u9duPkAiN5dvhw.jpg" alt=""></span> hingga produksi koper skala besar.',
        buttonLabel: 'Jelajahi Kapabilitas',
        buttonUrl: '/platform',
      },
      howWeWork: {
        label: 'Cara Kami Bekerja',
        body:
          'DJI Luggage menjaga jalur manufaktur tetap sederhana: selaraskan brief, konfirmasi sampel, produksi dengan quality check, lalu siapkan order untuk handover pembeli.',
        steps: [
          { number: '[01]', body: 'Brief: Bagikan tipe produk, jumlah, target pasar, branding, arah material, dan timeline.' },
          { number: '[02]', body: 'Sampel: Tinjau konstruksi, posisi logo, komponen, warna, kemasan, dan revisi yang dibutuhkan.' },
          { number: '[03]', body: 'Produksi: Pindahkan detail yang disetujui ke produksi massal, inspeksi, packing, dan koordinasi pengiriman.' },
        ],
      },
      newsroom: {
        label: 'Artikel Terbaru',
        heading: 'Newsroom',
      },
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'home-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'home_page_services_cards',
    localeTable: 'home_page_services_cards_locales',
    locale,
    items: content[locale].services.cards,
    columns: ['title', 'description'],
  })
  await setArrayLocaleRows({
    client,
    table: 'home_page_values',
    localeTable: 'home_page_values_locales',
    locale,
    items: content[locale].values,
    columns: ['number', 'title', 'description'],
  })
  await setArrayLocaleRows({
    client,
    table: 'home_page_how_we_work_steps',
    localeTable: 'home_page_how_we_work_steps_locales',
    locale,
    items: content[locale].howWeWork.steps,
    columns: ['number', 'body'],
  })
}

async function seedAbout(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '关于 - DJI Luggage',
      pageTitle: '关于 DJI Luggage',
      externalHeroImageUrl: 'https://framerusercontent.com/images/2cLLtW9JseVLuB8Se1lBw03NAlI.jpg',
      whoWeAre: {
        label: '我们是谁',
        heading: '我们是一家位于茂物的行李箱制造商，帮助采购方把旅行用品想法落地为可靠的生产项目。',
        columns: [
          {
            body: 'DJI Luggage 为 OEM、ODM 和自有品牌采购方提供产品开发、样品协调、大货生产和质量控制支持，覆盖行李箱与旅行用品项目。',
          },
          {
            body: '我们的工作建立在清晰沟通、现实交期和生产细节之上，帮助品牌进入零售、批发、企业礼品和分销渠道。',
          },
        ],
      },
      reach: {
        label: '服务范围',
        heading: '立足印尼茂物，服务印度尼西亚及更广区域的采购方',
        locations: [
          { country: '印度尼西亚', city: '茂物' },
          { country: '印度尼西亚', city: '雅加达' },
          { country: '印度尼西亚', city: '泗水' },
          { country: '印度尼西亚', city: '巴厘岛' },
          { country: '东南亚', city: '新加坡' },
          { country: '东南亚', city: '吉隆坡' },
        ],
        globeVideoUrl: 'https://framerusercontent.com/assets/euvxzcjhbUUqkHE2xg8ip1m5lIo.mp4',
      },
      metrics: {
        label: '关键指标',
        heading: '围绕产品质量、可重复生产和快速采购支持建立的制造能力。',
        externalImageUrl:
          'https://framerusercontent.com/images/SmKpJArNfpH0J4YgHNcqsyxuyEA.jpg?scale-down-to=1024&width=5418&height=3612',
        imageAlt: '制造计划',
        subtext: '这些是可在 CMS 中编辑的业务证明点。后续可替换为真实产能、审厂信息和客户案例。',
        items: [
          { value: 'OEM', label: '自有品牌项目', tone: 'dark' },
          { value: 'ODM', label: '样品开发', tone: 'gray' },
          { value: 'QC', label: '生产质量检查', tone: 'yellow' },
          { value: 'B2B', label: '批发制造', tone: 'charcoal' },
        ],
      },
      trustedLabel: '客户信赖',
      teamLabel: '我们的团队',
      teamHeading: '领导团队',
      careersCta: {
        label: '招聘',
        heading: '加入在印度尼西亚制造耐用行李箱产品的团队',
        buttonLabel: '查看职位',
        buttonUrl: '/careers',
      },
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'Tentang - DJI Luggage',
      pageTitle: 'Tentang DJI Luggage',
      externalHeroImageUrl: 'https://framerusercontent.com/images/2cLLtW9JseVLuB8Se1lBw03NAlI.jpg',
      whoWeAre: {
        label: 'Siapa Kami',
        heading:
          'Kami adalah produsen koper berbasis di Bogor yang membantu pembeli mengubah ide produk travel menjadi program produksi yang andal.',
        columns: [
          {
            body:
              'DJI Luggage mendukung pembeli OEM, ODM, dan private label dengan pengembangan produk, koordinasi sampel, produksi massal, dan quality control untuk program koper dan travel goods.',
          },
          {
            body:
              'Pekerjaan kami dibangun di atas komunikasi jelas, timeline realistis, dan detail produksi yang membantu brand masuk ke kanal retail, grosir, corporate, dan distributor.',
          },
        ],
      },
      reach: {
        label: 'Jangkauan Kami',
        heading: 'Berbasis Di Bogor, Mendukung Pembeli Di Indonesia Dan Kawasan Sekitar',
        locations: [
          { country: 'Indonesia', city: 'Bogor' },
          { country: 'Indonesia', city: 'Jakarta' },
          { country: 'Indonesia', city: 'Surabaya' },
          { country: 'Indonesia', city: 'Bali' },
          { country: 'Asia Tenggara', city: 'Singapura' },
          { country: 'Asia Tenggara', city: 'Kuala Lumpur' },
        ],
        globeVideoUrl: 'https://framerusercontent.com/assets/euvxzcjhbUUqkHE2xg8ip1m5lIo.mp4',
      },
      metrics: {
        label: 'Metrik Utama',
        heading: 'Kapabilitas manufaktur yang dibangun untuk kualitas produk, produksi berulang, dan dukungan pembeli yang responsif.',
        externalImageUrl:
          'https://framerusercontent.com/images/SmKpJArNfpH0J4YgHNcqsyxuyEA.jpg?scale-down-to=1024&width=5418&height=3612',
        imageAlt: 'perencanaan manufaktur',
        subtext:
          'Gunakan poin ini sebagai bukti bisnis yang dapat diedit di CMS, lalu ganti dengan data pabrik, audit, dan referensi pembeli saat sudah siap.',
        items: [
          { value: 'OEM', label: 'Program Private Label', tone: 'dark' },
          { value: 'ODM', label: 'Pengembangan Sampel', tone: 'gray' },
          { value: 'QC', label: 'Quality Check Produksi', tone: 'yellow' },
          { value: 'B2B', label: 'Manufaktur Grosir', tone: 'charcoal' },
        ],
      },
      trustedLabel: 'Dipercaya Oleh',
      teamLabel: 'Tim Kami',
      teamHeading: 'Leadership',
      careersCta: {
        label: 'Karier',
        heading: 'Bergabung dengan tim yang membangun produk koper tahan lama dari Indonesia',
        buttonLabel: 'Lihat Karier',
        buttonUrl: '/careers',
      },
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'about-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'about_page_who_we_are_columns',
    localeTable: 'about_page_who_we_are_columns_locales',
    locale,
    items: content[locale].whoWeAre.columns,
    columns: ['body'],
  })
  await setArrayLocaleRows({
    client,
    table: 'about_page_reach_locations',
    localeTable: 'about_page_reach_locations_locales',
    locale,
    items: content[locale].reach.locations,
    columns: ['country', 'city'],
  })
  await setArrayLocaleRows({
    client,
    table: 'about_page_metrics_items',
    localeTable: 'about_page_metrics_items_locales',
    locale,
    items: content[locale].metrics.items,
    columns: ['value', 'label'],
  })
}

async function seedServices(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '制造服务 - DJI Luggage',
      hero: {
        label: '制造服务',
        title: '行李箱制造服务',
        description: '为行李箱与旅行用品采购方提供 OEM、ODM、打样、大货生产和质量支持。',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/Qufuc7ZvvPRLp2ePWNlY4pH48w.jpg',
        imageAlt: '仓储货架',
      },
      focus: {
        label: '服务重点',
        heading: 'DJI Luggage 帮助品牌和分销商通过清晰规格、可靠生产协调和适合采购交付的包装，建立务实的行李箱项目。',
        paragraphs: [
          { body: '我们服务需要自有品牌行李箱、企业旅行产品、零售系列和大批量订单的采购方。' },
          { body: '每个项目从产品要求开始，经过样品确认、材料协调、生产检查和最终交付。' },
        ],
      },
      aerial: {
        externalImageUrl: 'https://framerusercontent.com/images/dIpxXeu2nK0wcdN1Ri0jBE0Aw.jpg',
        imageAlt: '道路航拍',
        labels: [{ label: 'OEM 行李箱' }, { label: 'ODM 开发' }, { label: '质量控制' }, { label: '大货订单' }],
      },
      services: {
        heading: '服务',
        items: [
          {
            number: '[01]',
            title: 'OEM 自有品牌',
            description: '按照您的品牌要求制造行李箱，包括 Logo 位置、颜色、包装、配件选择和零售或分销需求。',
            externalImageUrl: 'https://framerusercontent.com/images/hMpfNtZpREzFm2iw1HGpOPs7cg.jpg',
            imageAlt: 'OEM 行李箱制造',
          },
          {
            number: '[02]',
            title: 'ODM 产品开发',
            description: '通过多轮样品、结构评估、材料选择和量产规格确认，开发新的行李箱与旅行用品概念。',
            externalImageUrl: 'https://framerusercontent.com/images/qkMQq9Zs1gGZaibDwwhw42dog.jpg',
            imageAlt: 'ODM 行李箱样品开发',
          },
          {
            number: '[03]',
            title: '材料与配件采购',
            description: '协调箱壳材料、面料、轮子、拉杆、拉链、锁具、内里、标签、纸箱和产品系列需要的其他细节。',
            externalImageUrl: 'https://framerusercontent.com/images/JcvRxIUpdnFDa0zMeiuRidwGAg.jpg',
            imageAlt: '行李箱材料与配件',
          },
          {
            number: '[04]',
            title: '生产与质量控制',
            description: '将确认样品导入大货生产，并配合实用的检查点、包装检查和交付前沟通。',
            externalImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
            imageAlt: '行李箱生产质量控制',
          },
        ],
      },
      industries: {
        title: '支持的产品',
        externalImageUrl: 'https://framerusercontent.com/images/xuiGNeWrzpBf9F7gqvI7nHqMlg.webp',
        imageAlt: '仓库内部',
        items: [
          { name: '旅行行李箱' },
          { name: '登机箱' },
          { name: '托运行李箱' },
          { name: '硬壳箱' },
          { name: '软面箱' },
          { name: '旅行包' },
          { name: '企业礼品' },
          { name: '零售自有品牌' },
        ],
      },
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'Layanan Manufaktur - DJI Luggage',
      hero: {
        label: 'Manufaktur',
        title: 'Layanan Manufaktur',
        description: 'Dukungan OEM, ODM, sampling, produksi massal, dan quality untuk pembeli koper dan travel goods.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/Qufuc7ZvvPRLp2ePWNlY4pH48w.jpg',
        imageAlt: 'Rak gudang',
      },
      focus: {
        label: 'Fokus Kami',
        heading:
          'DJI Luggage membantu brand dan distributor membangun program koper yang praktis dengan spesifikasi jelas, koordinasi produksi andal, dan packing yang siap untuk pembeli.',
        paragraphs: [
          { body: 'Kami mendukung pembeli yang membutuhkan partner pabrik untuk koper private label, produk travel corporate, range retail, dan program order besar.' },
          { body: 'Setiap proyek dimulai dari kebutuhan produk lalu bergerak melalui approval sampel, koordinasi material, production check, dan handover akhir.' },
        ],
      },
      aerial: {
        externalImageUrl: 'https://framerusercontent.com/images/dIpxXeu2nK0wcdN1Ri0jBE0Aw.jpg',
        imageAlt: 'Aerial jalan raya',
        labels: [{ label: 'Koper OEM' }, { label: 'Pengembangan ODM' }, { label: 'Quality Control' }, { label: 'Bulk Order' }],
      },
      services: {
        heading: 'Layanan',
        items: [
          {
            number: '[01]',
            title: 'OEM Private Label',
            description:
              'Memproduksi koper sesuai kebutuhan brand Anda, termasuk posisi logo, warna, kemasan, pilihan trim, dan kebutuhan retail atau distributor.',
            externalImageUrl: 'https://framerusercontent.com/images/hMpfNtZpREzFm2iw1HGpOPs7cg.jpg',
            imageAlt: 'manufaktur koper OEM',
          },
          {
            number: '[02]',
            title: 'Pengembangan Produk ODM',
            description:
              'Mengembangkan konsep koper dan travel goods baru melalui putaran sampel, review konstruksi, opsi material, dan penyelarasan spesifikasi siap produksi.',
            externalImageUrl: 'https://framerusercontent.com/images/qkMQq9Zs1gGZaibDwwhw42dog.jpg',
            imageAlt: 'pengembangan sampel koper ODM',
          },
          {
            number: '[03]',
            title: 'Sourcing Material Dan Komponen',
            description:
              'Mengkoordinasikan material shell, kain, roda, trolley handle, zipper, lock, lining, label, karton, dan detail lain yang dibutuhkan range produk Anda.',
            externalImageUrl: 'https://framerusercontent.com/images/JcvRxIUpdnFDa0zMeiuRidwGAg.jpg',
            imageAlt: 'material dan komponen koper',
          },
          {
            number: '[04]',
            title: 'Produksi Dan Quality Control',
            description:
              'Memindahkan sampel yang disetujui ke produksi massal dengan titik inspeksi praktis, packing check, dan komunikasi jelas sebelum handover order.',
            externalImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
            imageAlt: 'quality control produksi koper',
          },
        ],
      },
      industries: {
        title: 'Produk Yang Kami Dukung',
        externalImageUrl: 'https://framerusercontent.com/images/xuiGNeWrzpBf9F7gqvI7nHqMlg.webp',
        imageAlt: 'Interior gudang',
        items: [
          { name: 'Koper Travel' },
          { name: 'Koper Kabin' },
          { name: 'Koper Bagasi' },
          { name: 'Koper Hard Shell' },
          { name: 'Koper Soft Case' },
          { name: 'Travel Bag' },
          { name: 'Corporate Gifts' },
          { name: 'Retail Private Label' },
        ],
      },
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'services-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'services_page_focus_paragraphs',
    localeTable: 'services_page_focus_paragraphs_locales',
    locale,
    items: content[locale].focus.paragraphs,
    columns: ['body'],
  })
  await setArrayLocaleRows({
    client,
    table: 'services_page_aerial_labels',
    localeTable: 'services_page_aerial_labels_locales',
    locale,
    items: content[locale].aerial.labels,
    columns: ['label'],
  })
  await setArrayLocaleRows({
    client,
    table: 'services_page_services_items',
    localeTable: 'services_page_services_items_locales',
    locale,
    items: content[locale].services.items,
    columns: ['number', 'title', 'description', ['image_alt', 'imageAlt']],
  })
  await setArrayLocaleRows({
    client,
    table: 'services_page_industries_items',
    localeTable: 'services_page_industries_items_locales',
    locale,
    items: content[locale].industries.items,
    columns: ['name'],
  })
}

async function seedPlatform(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '制造能力 - DJI Luggage',
      hero: {
        label: '制造能力',
        title: '我们如何制造',
        description: '从采购需求到生产交付，清晰展示我们的行李箱制造流程。',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/4FR1NuE2E9HUFnECPOEhqKYJN3U.jpg',
      },
      interfaceIntro: {
        label: '生产流程',
        body: '每个订单都需要清晰的产品资料、样品确认、生产检查点和采购方沟通。我们的工作流把这些环节连接起来。',
      },
      tabletMockup: {
        externalImageUrl: 'https://framerusercontent.com/images/kbFgydLmMWcDx19m8RsDtfRriA.png',
        imageAlt: '制造计划看板',
      },
      featureSections: [
        {
          label: '从需求到样品',
          heading: '把产品要求转化为清晰方向',
          body:
            '提供产品类型、目标价格、市场、数量、材料、颜色、Logo 方向和包装需求。我们会把需求转化为样品重点和实际制造选择。',
          externalImageUrl: 'https://framerusercontent.com/images/6KnqYTEfv0yWM68b6hmLIAoLc.png',
          imageAlt: '行李箱样品规划',
        },
        {
          label: '从样品到生产',
          heading: '确认细节后再进入规模化生产',
          body:
            '样品确认后，同一套细节会指导材料准备、组装、质量检查、包装和最终采购方沟通。',
          externalImageUrl: 'https://framerusercontent.com/images/w0PuRzQLRi5FkQEk6dP4v42iv4.png',
          imageAlt: '行李箱生产跟进',
        },
      ],
      whyChoose: {
        label: '为什么选择我们',
        body: '清晰沟通、实用制造经验，以及为复购订单设计的生产流程。',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
      },
      highlights: {
        label: '特点',
        heading: '能力亮点',
        items: [
          {
            number: '[01]',
            body: '为构建品牌产品线的行李箱采购方提供 OEM 与自有品牌支持。',
            externalIconUrl: 'https://framerusercontent.com/images/sHtqFSFFIZicgvnrXwnuy7el1k.svg',
          },
          {
            number: '[02]',
            body: '为需要把想法转化为量产设计的采购方提供 ODM 样品开发。',
            externalIconUrl: 'https://framerusercontent.com/images/4gIBVNwwAmQB1naE9zcz8lnWfY.svg',
          },
          {
            number: '[03]',
            body: '协调箱壳、内里、轮子、拉杆、锁具、拉链和标签等组件。',
            externalIconUrl: 'https://framerusercontent.com/images/w5pbS2FriKLRpqu9FPdPgtaUxw.svg',
          },
          {
            number: '[04]',
            body: '在生产过程中设置质量检查点，而不是等到订单结束后才检查。',
            externalIconUrl: 'https://framerusercontent.com/images/dEjsM2tjkm0kdr6ruJjJd0Eio.svg',
          },
          {
            number: '[05]',
            body: '在交付准备前确认包装、纸箱、标签和交接细节。',
            externalIconUrl: 'https://framerusercontent.com/images/mu43n2Awg4JAiKTH6TLGvTn8k8.svg',
          },
          {
            number: '[06]',
            body: '为样品、报价、生产进度和复购订单提供快速采购沟通。',
            externalIconUrl: 'https://framerusercontent.com/images/jiE9KPvwb4tvZyIjzwj86SCjINU.svg',
          },
        ],
      },
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'Kapabilitas - DJI Luggage',
      hero: {
        label: 'Kapabilitas',
        title: 'Cara Kami Membangun',
        description: 'Pandangan praktis atas workflow manufaktur koper kami, dari brief pembeli hingga handover produksi.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/4FR1NuE2E9HUFnECPOEhqKYJN3U.jpg',
      },
      interfaceIntro: {
        label: 'Workflow Produksi',
        body:
          'Setiap order membutuhkan data produk yang jelas, approval sampel, checkpoint produksi, dan komunikasi pembeli. Workflow kami menghubungkan semua bagian tersebut.',
      },
      tabletMockup: {
        externalImageUrl: 'https://framerusercontent.com/images/kbFgydLmMWcDx19m8RsDtfRriA.png',
        imageAlt: 'dashboard perencanaan manufaktur',
      },
      featureSections: [
        {
          label: 'Dari Brief Ke Sampel',
          heading: 'Ubah Kebutuhan Menjadi Arah Produk',
          body:
            'Bagikan tipe produk, target harga, pasar, jumlah, material, warna, arah logo, dan kebutuhan kemasan. Kami menerjemahkan brief menjadi prioritas sampel dan opsi manufaktur praktis.',
          externalImageUrl: 'https://framerusercontent.com/images/6KnqYTEfv0yWM68b6hmLIAoLc.png',
          imageAlt: 'perencanaan sampel koper',
        },
        {
          label: 'Dari Sampel Ke Produksi',
          heading: 'Konfirmasi Detail Sebelum Order Diperbesar',
          body:
            'Setelah sampel disetujui, detail yang sama menjadi panduan untuk persiapan material, assembly, quality check, packing, dan komunikasi akhir dengan pembeli.',
          externalImageUrl: 'https://framerusercontent.com/images/w0PuRzQLRi5FkQEk6dP4v42iv4.png',
          imageAlt: 'tracking produksi koper',
        },
      ],
      whyChoose: {
        label: 'Mengapa Memilih Kami',
        body: 'Komunikasi jelas, pengetahuan manufaktur praktis, dan proses produksi yang dibuat untuk repeat order.',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/VwHCLdxNIeTIUpNRcVkneH3p68.jpg',
      },
      highlights: {
        label: 'Fitur',
        heading: 'Sorotan Kapabilitas',
        items: [
          {
            number: '[01]',
            body: 'Dukungan OEM dan private label untuk pembeli koper yang membangun range produk branded.',
            externalIconUrl: 'https://framerusercontent.com/images/sHtqFSFFIZicgvnrXwnuy7el1k.svg',
          },
          {
            number: '[02]',
            body: 'Pengembangan sampel ODM untuk pembeli yang perlu mengubah ide menjadi desain siap produksi.',
            externalIconUrl: 'https://framerusercontent.com/images/4gIBVNwwAmQB1naE9zcz8lnWfY.svg',
          },
          {
            number: '[03]',
            body: 'Koordinasi komponen mulai dari shell, lining, roda, handle, lock, zipper, hingga label.',
            externalIconUrl: 'https://framerusercontent.com/images/w5pbS2FriKLRpqu9FPdPgtaUxw.svg',
          },
          {
            number: '[04]',
            body: 'Checkpoint kualitas selama produksi, bukan hanya setelah order selesai.',
            externalIconUrl: 'https://framerusercontent.com/images/dEjsM2tjkm0kdr6ruJjJd0Eio.svg',
          },
          {
            number: '[05]',
            body: 'Detail packing, karton, label, dan handover diselaraskan sebelum persiapan delivery.',
            externalIconUrl: 'https://framerusercontent.com/images/mu43n2Awg4JAiKTH6TLGvTn8k8.svg',
          },
          {
            number: '[06]',
            body: 'Komunikasi pembeli yang responsif untuk sampel, penawaran, update produksi, dan repeat order.',
            externalIconUrl: 'https://framerusercontent.com/images/jiE9KPvwb4tvZyIjzwj86SCjINU.svg',
          },
        ],
      },
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'platform-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'platform_page_feature_sections',
    localeTable: 'platform_page_feature_sections_locales',
    locale,
    items: content[locale].featureSections,
    columns: ['label', 'heading', 'body', ['image_alt', 'imageAlt']],
  })
  await setArrayLocaleRows({
    client,
    table: 'platform_page_highlights_items',
    localeTable: 'platform_page_highlights_items_locales',
    locale,
    items: content[locale].highlights.items,
    columns: ['number', 'body'],
  })
}

async function seedNewsroom(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '行业洞察 - DJI Luggage',
      hero: {
        title: '行李箱制造洞察',
        descriptions: [
          { body: '关于 OEM 行李箱、\n自有品牌生产、\n打样和质量控制的记录。' },
          { body: '这里可发布采购指南、\n公司动态和产品制造知识。' },
        ],
      },
      filters: [
        { label: '全部', value: 'all' },
        { label: '洞察', value: 'insights' },
        { label: '新闻', value: 'news' },
      ],
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'Wawasan - DJI Luggage',
      hero: {
        title: 'Wawasan Manufaktur Koper',
        descriptions: [
          { body: 'Catatan tentang koper OEM,\nproduksi private label,\nsampling, dan quality control.' },
          { body: 'Gunakan bagian ini untuk panduan pembeli,\nupdate perusahaan, dan pengetahuan manufaktur produk.' },
        ],
      },
      filters: [
        { label: 'Semua', value: 'all' },
        { label: 'Wawasan', value: 'insights' },
        { label: 'Berita', value: 'news' },
      ],
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'newsroom-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'newsroom_page_hero_descriptions',
    localeTable: 'newsroom_page_hero_descriptions_locales',
    locale,
    items: content[locale].hero.descriptions,
    columns: ['body'],
  })
  await setArrayLocaleRows({
    client,
    table: 'newsroom_page_filters',
    localeTable: 'newsroom_page_filters_locales',
    locale,
    items: content[locale].filters,
    columns: ['label'],
  })
}

async function seedCareers(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '招聘 - DJI Luggage',
      hero: {
        title: '加入\nDJI Luggage.',
        descriptions: [
          { body: '加入一支务实的制造团队，为采购方和品牌打造行李箱与旅行用品项目。' },
          { body: '参与打样、生产、质量控制、客户协调和工厂运营等工作。' },
        ],
      },
      teamPhotos: [
        { externalImageUrl: 'https://framerusercontent.com/images/ZYX74OGfgMItW1hW5UEHBon9ic.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/EAfzjUmTenmtXJuhNEUOCMwps.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/pY4ShkQbP5hHBA0R47iSDyJY4.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/QPbxJzSomgVjzBqsCDWlXDen47g.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/I0JLD4ZrkQ2m8SgO1b7ObGpY0Y.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/Rf6AGJdqHXAyTMdqgeIEMydTW4.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/0KH5UuIJHGUclkImAuBW1STq1gI.jpg', imageAlt: '招聘图片' },
        { externalImageUrl: 'https://framerusercontent.com/images/WxjRRdMY30YyaF7s3NcvXQkdk.jpg', imageAlt: '招聘图片' },
      ],
      benefitsIntro: {
        bodyHtml:
          '在 <span class="benefits-highlight">DJI Luggage</span>，你可以学习实用制造技能，支持真实采购项目，并与专注 <span class="benefits-highlight">质量</span> 的团队一起成长',
        externalImageUrl: 'https://framerusercontent.com/images/FgA1lEYmTjFwXZKDZbC2INNrVg.jpg',
        imageAlt: '',
      },
      benefits: [
        { number: '[01]', title: '一线工艺', body: '在真实生产、样品评审、配件细节和日常问题处理中学习。' },
        { number: '[02]', title: '成长', body: '在制造、质量、客户沟通和订单协调中积累实用能力。' },
        { number: '[03]', title: '团队文化', body: '与重视清晰沟通、实际支持和持续改善的人一起工作。' },
      ],
      clock: {
        locationLabel: '茂物',
        timeZone: 'Asia/Jakarta',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/JRztHvFLJHCm77Wuu4pLXB4vWx0.jpg',
      },
      positionsHeading: '开放职位',
      finalCta: finalCta.zh,
    },
    id: {
      metaTitle: 'Karier - DJI Luggage',
      hero: {
        title: 'Karier di\nDJI Luggage.',
        descriptions: [
          { body: 'Bergabung dengan tim manufaktur praktis yang membangun program koper dan travel goods untuk pembeli dan brand.' },
          { body: 'Bekerja di area sampling, produksi, quality control, customer coordination, dan operasi pabrik.' },
        ],
      },
      teamPhotos: [
        { externalImageUrl: 'https://framerusercontent.com/images/ZYX74OGfgMItW1hW5UEHBon9ic.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/EAfzjUmTenmtXJuhNEUOCMwps.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/pY4ShkQbP5hHBA0R47iSDyJY4.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/QPbxJzSomgVjzBqsCDWlXDen47g.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/I0JLD4ZrkQ2m8SgO1b7ObGpY0Y.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/Rf6AGJdqHXAyTMdqgeIEMydTW4.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/0KH5UuIJHGUclkImAuBW1STq1gI.jpg', imageAlt: 'Gambar karier' },
        { externalImageUrl: 'https://framerusercontent.com/images/WxjRRdMY30YyaF7s3NcvXQkdk.jpg', imageAlt: 'Gambar karier' },
      ],
      benefitsIntro: {
        bodyHtml:
          'Di <span class="benefits-highlight">DJI Luggage</span>, Anda dapat membangun skill manufaktur praktis, mendukung program pembeli nyata, dan tumbuh bersama tim yang fokus pada produk travel <span class="benefits-highlight">berkualitas</span>',
        externalImageUrl: 'https://framerusercontent.com/images/FgA1lEYmTjFwXZKDZbC2INNrVg.jpg',
        imageAlt: '',
      },
      benefits: [
        { number: '[01]', title: 'Praktik Langsung', body: 'Belajar melalui pekerjaan produksi nyata, review sampel, detail komponen, dan problem solving harian.' },
        { number: '[02]', title: 'Pertumbuhan', body: 'Bangun skill berguna di manufaktur, quality, komunikasi pelanggan, dan koordinasi order.' },
        { number: '[03]', title: 'Budaya Tim', body: 'Bekerja dengan orang yang menghargai kejelasan, dukungan praktis, dan perbaikan stabil di setiap order.' },
      ],
      clock: {
        locationLabel: 'Bogor',
        timeZone: 'Asia/Jakarta',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/JRztHvFLJHCm77Wuu4pLXB4vWx0.jpg',
      },
      positionsHeading: 'Posisi Terbuka',
      finalCta: finalCta.id,
    },
  }

  await updateGlobalLocale(payload, 'careers-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'careers_page_hero_descriptions',
    localeTable: 'careers_page_hero_descriptions_locales',
    locale,
    items: content[locale].hero.descriptions,
    columns: ['body'],
  })
  await setArrayLocaleRows({
    client,
    table: 'careers_page_team_photos',
    localeTable: 'careers_page_team_photos_locales',
    locale,
    items: content[locale].teamPhotos,
    columns: [['image_alt', 'imageAlt']],
  })
  await setArrayLocaleRows({
    client,
    table: 'careers_page_benefits',
    localeTable: 'careers_page_benefits_locales',
    locale,
    items: content[locale].benefits,
    columns: ['number', 'title', 'body'],
  })
}

async function seedContact(payload: Payload, locale: Locale) {
  const content = {
    zh: {
      metaTitle: '联系 - DJI Luggage',
      hero: {
        email: 'info@djiluggage.id',
        title: '联系我们',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/q7ovq9XPzUbvhCNfkFPPkWTTxw.jpg',
      },
      form: {
        label: '您的信息',
        title: '提交报价需求',
        fields: [
          { placeholder: '产品类型' },
          { placeholder: '订单数量' },
          { placeholder: '公司名称' },
          { placeholder: '邮箱 / 电话' },
          { placeholder: '联系人姓名' },
          { placeholder: '目标市场' },
        ],
        messagePlaceholder: '留言',
        submitLabel: '发送需求',
        successMessage: '需求已发送，我们会尽快联系您。',
        errorMessage: '暂时无法发送。请发送邮件至 info@djiluggage.id 或稍后再试。',
      },
    },
    id: {
      metaTitle: 'Kontak - DJI Luggage',
      hero: {
        email: 'info@djiluggage.id',
        title: 'Hubungi Kami',
        externalBackgroundImageUrl: 'https://framerusercontent.com/images/q7ovq9XPzUbvhCNfkFPPkWTTxw.jpg',
      },
      form: {
        label: 'Info Anda',
        title: 'Minta Penawaran',
        fields: [
          { placeholder: 'Tipe Produk' },
          { placeholder: 'Jumlah Order' },
          { placeholder: 'Nama Perusahaan' },
          { placeholder: 'Email / Telepon' },
          { placeholder: 'Nama Anda' },
          { placeholder: 'Pasar Tujuan' },
        ],
        messagePlaceholder: 'Pesan',
        submitLabel: 'Kirim Inquiry',
        successMessage: 'Inquiry terkirim. Kami akan menghubungi Anda segera.',
        errorMessage: 'Belum bisa mengirim saat ini. Silakan email info@djiluggage.id atau coba lagi.',
      },
    },
  }

  await updateGlobalLocale(payload, 'contact-page', locale, content[locale])

  const client = getDBClient(payload)

  await setArrayLocaleRows({
    client,
    table: 'contact_page_form_fields',
    localeTable: 'contact_page_form_fields_locales',
    locale,
    items: content[locale].form.fields,
    columns: ['placeholder'],
  })
}

async function seedCollections(payload: Payload, locale: Locale) {
  const client = getDBClient(payload)

  const teams = {
    zh: [
      { name: '创始人 / CEO', role: '公司管理', imageAlt: 'DJI Luggage 管理团队' },
      { name: '生产负责人', role: '制造运营', imageAlt: 'DJI Luggage 生产负责人' },
      { name: '质量负责人', role: '质量控制', imageAlt: 'DJI Luggage 质量负责人' },
      { name: '出口负责人', role: '采购方协调', imageAlt: 'DJI Luggage 出口负责人' },
      { name: '客户成功负责人', role: '客户支持', imageAlt: 'DJI Luggage 客户支持负责人' },
    ],
    id: [
      { name: 'Pendiri / CEO', role: 'Leadership Perusahaan', imageAlt: 'leadership DJI Luggage' },
      { name: 'Lead Produksi', role: 'Operasi Manufaktur', imageAlt: 'lead produksi DJI Luggage' },
      { name: 'Lead Quality', role: 'Quality Control', imageAlt: 'lead quality DJI Luggage' },
      { name: 'Lead Ekspor', role: 'Koordinasi Pembeli', imageAlt: 'lead ekspor DJI Luggage' },
      { name: 'Lead Customer Success', role: 'Dukungan Klien', imageAlt: 'lead customer support DJI Luggage' },
    ],
  }

  const testimonials = {
    zh: [
      {
        quote: '“DJI Luggage 帮助我们把概念变成可量产的行李箱系列，每一步沟通都很清晰。”',
        company: '自有品牌采购方',
      },
      {
        quote: '“团队理解大货行李箱项目，从样品到包装细节都能协助确认，让采购流程轻松很多。”',
        company: '零售分销商',
      },
      {
        quote: '“他们的生产支持让我们更有信心为企业客户开发实用的旅行产品。”',
        company: '企业礼品合作方',
      },
    ],
    id: [
      {
        quote:
          '“DJI Luggage membantu kami mengubah konsep menjadi lini koper yang siap produksi dengan komunikasi jelas di setiap langkah.”',
        company: 'Pembeli Private Label',
      },
      {
        quote:
          '“Tim memahami program koper massal, dari sampel hingga detail packing. Itu membuat proses pembelian kami jauh lebih mudah.”',
        company: 'Distributor Retail',
      },
      {
        quote:
          '“Dukungan produksi mereka memberi kami keyakinan untuk membangun produk travel praktis bagi pelanggan corporate kami.”',
        company: 'Partner Corporate Gifts',
      },
    ],
  }

  await updateSortedCollection(payload, 'team-members', locale, teams[locale])
  await updateSortedCollection(payload, 'testimonials', locale, testimonials[locale])

  const posts = {
    zh: [
      ['choosing-the-right-luggage-manufacturer', '如何选择合适的行李箱制造商', '在启动 OEM 或自有品牌行李箱项目前，采购方应该先确认什么。'],
      ['oem-vs-odm-for-luggage-brands', '行李箱品牌的 OEM 与 ODM', '用简单方式判断应该定制现有设计，还是开发新产品。'],
      ['quality-checks-in-suitcase-production', '行李箱生产中的质量检查', '影响耐用旅行产品的关键生产细节。'],
      ['material-choices-for-hard-shell-luggage', '硬壳行李箱的材料选择', '箱壳材料、表面处理和配件如何影响成本、手感和耐用性。'],
      ['planning-your-first-bulk-luggage-order', '规划第一批大货行李箱订单', '关于数量、时间、样品、包装和确认流程的实用清单。'],
      ['building-a-private-label-travel-line', '打造自有品牌旅行产品线', '从 Logo 位置到产品系列规划，自有品牌行李箱需要稳定流程。'],
      ['packaging-and-export-prep-for-suitcases', '行李箱包装与出口准备', '为什么纸箱、标签和包装细节需要在生产结束前确认。'],
      ['from-sample-to-production', '从样品到量产', '确认样品如何成为行李箱采购方可重复生产的标准。'],
    ],
    id: [
      ['choosing-the-right-luggage-manufacturer', 'Memilih Produsen Koper Yang Tepat', 'Hal yang perlu diperjelas pembeli sebelum memulai program koper OEM atau private label.'],
      ['oem-vs-odm-for-luggage-brands', 'OEM vs ODM Untuk Brand Koper', 'Cara sederhana menentukan apakah perlu mengustom desain yang ada atau mengembangkan desain baru.'],
      ['quality-checks-in-suitcase-production', 'Quality Check Dalam Produksi Koper', 'Detail produksi yang paling penting untuk produk travel yang tahan lama.'],
      ['material-choices-for-hard-shell-luggage', 'Pilihan Material Untuk Koper Hard Shell', 'Bagaimana material shell, finishing, dan komponen membentuk biaya, rasa, dan durability.'],
      ['planning-your-first-bulk-luggage-order', 'Merencanakan Bulk Order Koper Pertama', 'Checklist praktis untuk jumlah, timeline, sampel, packing, dan approval.'],
      ['building-a-private-label-travel-line', 'Membangun Lini Travel Private Label', 'Dari posisi logo hingga perencanaan range produk, koper private label membutuhkan proses yang stabil.'],
      ['packaging-and-export-prep-for-suitcases', 'Persiapan Packing Dan Ekspor Koper', 'Mengapa karton, label, dan detail packing harus dikonfirmasi sebelum produksi selesai.'],
      ['from-sample-to-production', 'Dari Sampel Ke Produksi', 'Bagaimana sampel yang disetujui menjadi standar produksi berulang untuk pembeli koper.'],
    ],
  }

  for (const [slug, title, excerpt] of posts[locale]) {
    await updateBySlug(payload, 'news-posts', slug, locale, {
      title,
      excerpt,
      author: locale === 'zh' ? 'DJI Luggage 团队' : 'Tim DJI Luggage',
      intro:
        locale === 'zh'
          ? '来自 DJI Luggage 的实用记录，覆盖可靠行李箱和旅行用品项目从早期规划到可重复生产的关键环节。'
          : 'Catatan praktis dari DJI Luggage tentang membangun program koper dan produk travel yang andal, dari perencanaan awal hingga produksi berulang.',
      contentSections: articleSections[locale],
    })

    const postId = await findParentId(client, 'news_posts', slug)
    if (postId) {
      await setArrayLocaleRows({
        client,
        table: 'news_posts_content_sections',
        localeTable: 'news_posts_content_sections_locales',
        parentId: postId,
        locale,
        items: articleSections[locale],
        columns: ['heading', 'body'],
      })
    }
  }

  const jobBase = sharedJobContent[locale]
  const jobs = {
    zh: [
      {
        slug: 'production-supervisor',
        title: '生产主管',
        department: '制造',
        summary: '协调行李箱与旅行用品日常生产，确保确认规格顺利从样品进入大货订单。',
        jobDescription:
          'DJI Luggage 正在招聘生产主管，负责协调人员、材料、排期和质量检查点，让行李箱生产保持有序、务实，并能支持采购方评审。',
        basicIntro: '3 年以上制造运营或生产协调经验。',
        preferredIntro: '有箱包、行李箱、消费品或装配型制造经验优先。',
      },
      {
        slug: 'quality-control-specialist',
        title: '质量控制专员',
        department: '质量',
        summary: '检查行李箱细节、记录结果，并确保生产符合确认样品和采购方规格。',
        jobDescription:
          'DJI Luggage 正在招聘质量控制专员，负责检查配件、组装、表面处理、包装和最终产品呈现，帮助团队提前发现问题并保持质量记录清晰。',
        basicIntro: '2 年以上质量控制、生产验货或消费品制造经验。',
        preferredIntro: '有行李箱、箱包、纺织品、塑壳产品或五金验货经验优先。',
      },
      {
        slug: 'export-sales-coordinator',
        title: '出口销售协调员',
        department: '销售',
        summary: '支持采购咨询、报价跟进、样品协调和行李箱项目订单沟通。',
        jobDescription:
          'DJI Luggage 正在招聘出口销售协调员，帮助采购方从询盘进入报价、打样、生产和复购计划，并保持沟通清晰及时。',
        basicIntro: '2 年以上 B2B 销售支持、出口协调、客户服务或订单管理经验。',
        preferredIntro: '有 OEM、ODM、自有品牌或制造销售协调经验优先。',
      },
      {
        slug: 'sample-development-technician',
        title: '样品开发技术员',
        department: '产品开发',
        summary: '通过材料、结构细节和修改协调，把采购方需求转化为行李箱样品。',
        jobDescription:
          'DJI Luggage 正在招聘样品开发技术员，支持产品试样、修改和大货前技术交接，连接采购想法与工厂执行。',
        basicIntro: '2 年以上样品制作、产品开发、生产支持或技术协调经验。',
        preferredIntro: '有行李箱、箱包、车缝、箱壳装配、配件或五金选择经验优先。',
      },
    ],
    id: [
      {
        slug: 'production-supervisor',
        title: 'Supervisor Produksi',
        department: 'Manufaktur',
        summary: 'Mengkoordinasikan produksi koper dan travel goods harian agar spesifikasi yang disetujui bergerak rapi dari sampel ke bulk order.',
        jobDescription:
          'DJI Luggage mencari Supervisor Produksi untuk mengkoordinasikan orang, material, jadwal, dan quality checkpoint di produksi koper. Anda akan membantu order tetap rapi, praktis, dan siap ditinjau pembeli.',
        basicIntro: '3+ tahun pengalaman di operasi manufaktur atau koordinasi produksi.',
        preferredIntro: 'Pengalaman dengan tas, koper, consumer goods, atau manufaktur berbasis assembly lebih disukai.',
      },
      {
        slug: 'quality-control-specialist',
        title: 'Spesialis Quality Control',
        department: 'Quality',
        summary: 'Memeriksa detail koper, mencatat temuan, dan memastikan produksi sesuai sampel yang disetujui serta spesifikasi pembeli.',
        jobDescription:
          'DJI Luggage mencari Spesialis Quality Control untuk memeriksa komponen, assembly, finishing, packing, dan presentasi produk akhir. Anda akan membantu tim menangkap isu lebih awal dan menjaga catatan kualitas tetap jelas.',
        basicIntro: '2+ tahun pengalaman di quality control, inspeksi produksi, atau manufaktur consumer goods.',
        preferredIntro: 'Pengalaman inspeksi koper, tas, tekstil, produk hard shell, atau hardware lebih disukai.',
      },
      {
        slug: 'export-sales-coordinator',
        title: 'Koordinator Penjualan Ekspor',
        department: 'Sales',
        summary: 'Mendukung inquiry pembeli, follow-up penawaran, koordinasi sampel, dan komunikasi order untuk program koper.',
        jobDescription:
          'DJI Luggage mencari Koordinator Penjualan Ekspor untuk membantu pembeli bergerak dari inquiry ke penawaran, sampling, produksi, dan rencana repeat order. Anda akan menjaga komunikasi tetap jelas dan responsif.',
        basicIntro: '2+ tahun pengalaman di B2B sales support, koordinasi ekspor, customer service, atau order management.',
        preferredIntro: 'Pengalaman dengan OEM, ODM, private label, atau koordinasi sales manufaktur lebih disukai.',
      },
      {
        slug: 'sample-development-technician',
        title: 'Teknisi Pengembangan Sampel',
        department: 'Pengembangan Produk',
        summary: 'Membantu mengubah brief pembeli menjadi sampel koper melalui koordinasi material, detail konstruksi, dan revisi.',
        jobDescription:
          'DJI Luggage mencari Teknisi Pengembangan Sampel untuk mendukung trial produk, revisi, dan handover teknis sebelum produksi massal. Anda akan menjembatani ide pembeli dan eksekusi pabrik.',
        basicIntro: '2+ tahun pengalaman di sample making, pengembangan produk, production support, atau koordinasi teknis.',
        preferredIntro: 'Pengalaman dengan koper, tas, sewing, shell assembly, trim, atau pemilihan hardware lebih disukai.',
      },
    ],
  }

  for (const job of jobs[locale]) {
    const { slug, ...data } = job

    await updateBySlug(payload, 'job-posts', slug, locale, {
      ...data,
      location: locale === 'zh' ? '印度尼西亚茂物' : 'BOGOR, ID',
      sidebarText: jobBase.sidebarText,
      responsibilities: jobBase.responsibilities,
      basicRequirements: jobBase.basicRequirements,
      preferredRequirements: jobBase.preferredRequirements,
    })

    const jobId = await findParentId(client, 'job_posts', slug)
    if (jobId) {
      await setArrayLocaleRows({
        client,
        table: 'job_posts_responsibilities',
        localeTable: 'job_posts_responsibilities_locales',
        parentId: jobId,
        locale,
        items: jobBase.responsibilities,
        columns: ['body'],
      })
      await setArrayLocaleRows({
        client,
        table: 'job_posts_basic_requirements',
        localeTable: 'job_posts_basic_requirements_locales',
        parentId: jobId,
        locale,
        items: jobBase.basicRequirements,
        columns: ['body'],
      })
      await setArrayLocaleRows({
        client,
        table: 'job_posts_preferred_requirements',
        localeTable: 'job_posts_preferred_requirements_locales',
        parentId: jobId,
        locale,
        items: jobBase.preferredRequirements,
        columns: ['body'],
      })
    }
  }
}

async function seed() {
  const payload = await getPayload({ config: configPromise })

  for (const locale of ['zh', 'id'] as const) {
    await seedSiteSettings(payload, locale)
    await seedHome(payload, locale)
    await seedAbout(payload, locale)
    await seedServices(payload, locale)
    await seedPlatform(payload, locale)
    await seedNewsroom(payload, locale)
    await seedCareers(payload, locale)
    await seedContact(payload, locale)
    await seedCollections(payload, locale)
  }

  console.log('DJI Luggage zh/id CMS content seed complete.')
}

await seed()
process.exit(0)
