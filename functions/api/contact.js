/**
 * 联系表单接口（Cloudflare Pages Function）。
 *
 * 请求：multipart/form-data（含可选的 attachment 文件）
 * 存储：附件存 R2（绑定 ATTACHMENTS），邮件里给一条限时签名下载链接。
 *
 * 为什么不是 JSON：JSON 装不下文件字节。历史上这个接口收 JSON，
 * 只把 fileName 字段写进邮件，文件本体被丢掉了 —— 客户以为发了，
 * 其实从没离开浏览器。
 *
 * R2 桶是私有的：不挂公开域名，只通过 createSignedUrl 生成短期链接。
 */
const DEFAULT_TO_EMAIL = 'info@djiluggage.id'
const DEFAULT_FROM_EMAIL = 'website@djiluggage.id'
const DEFAULT_FROM_NAME = 'DJI Luggage Website'
const MAX_FIELD_LENGTH = 500
const MAX_MESSAGE_LENGTH = 4000

// 这两个常量必须与 site.js 里的 MAX_FILE_BYTES / ALLOWED_FILE_EXTENSIONS 一致。
// 前端那份只是体验优化，这里才是真正的强制点。
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_FILE_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg',
  'zip', 'rar', 'ai', 'psd', 'dwg',
]

// 签名链接有效期。客户给的是报价单/图纸，不需要长期可访问；
// 7 天足够业务处理，也限制了一旦邮件被转发出去的暴露面。
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60

// 扩展名 -> MIME，用于回传 Content-Type。R2 不会替我们猜。
const EXTENSION_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  ai: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  dwg: 'image/vnd.dwg',
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  }
}

function clean(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function cleanMultiline(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_MESSAGE_LENGTH)
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textLine(label, value) {
  return value ? `${label}: ${value}` : `${label}: -`
}

function htmlRow(label, value) {
  return `<tr><th align="left" style="padding:6px 12px 6px 0;">${escapeHTML(label)}</th><td style="padding:6px 0;">${escapeHTML(value || '-')}</td></tr>`
}

function extensionOf(name) {
  const base = String(name || '').split(/[\\/]/).pop() || ''
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(index + 1).toLowerCase() : ''
}

/**
 * 去掉目录分隔符和控制字符，并限制长度。
 * 客户文件名会进邮件正文和 R2 key，不能直接信任。
 */
function safeFileName(name, extension) {
  const base = String(name || '').split(/[\\/]/).pop() || ''
  const stripped = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim()
  const withoutExt = extension ? stripped.slice(0, stripped.length - extension.length - 1) : stripped
  const cleaned = withoutExt.replace(/\s+/g, '-').replace(/^[.-]+/, '').slice(0, 80)
  return `${cleaned || 'attachment'}.${extension}`
}

/**
 * 校验魔数。扩展名可以随便改，所以对少数格式再做一次真实字节判断。
 * 只覆盖高风险的几种（伪装成 PDF/图片的可执行文件）；
 * 其余格式（docx/zip/ai 等本身就是容器）无法用固定魔数可靠区分，交给杀软和人工。
 */
function signatureMatches(bytes, extension) {
  const startsWith = (signature) => signature.every((byte, i) => bytes[i] === byte)

  switch (extension) {
    case 'pdf':
      return startsWith([0x25, 0x50, 0x44, 0x46]) // %PDF
    case 'png':
      return startsWith([0x89, 0x50, 0x4e, 0x47])
    case 'jpg':
    case 'jpeg':
      return startsWith([0xff, 0xd8, 0xff])
    case 'gif':
      return startsWith([0x47, 0x49, 0x46, 0x38])
    case 'webp':
      return startsWith([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return startsWith([0x50, 0x4b]) // PK
    case 'rar':
      return startsWith([0x52, 0x61, 0x72, 0x21])
    case 'psd':
      return startsWith([0x38, 0x42, 0x50, 0x53])
    default:
      // 其余格式不做魔数判断（SVG 是文本、ai 版本差异大等）。
      return true
  }
}

/**
 * 把请求解析成字段 + 附件。
 * 兼容两种 Content-Type：multipart/form-data（带文件的现状）
 * 和 application/json（老客户端/预检，不含附件）。
 */
async function readRequest(request) {
  const contentType = request.headers.get('Content-Type') || ''

  if (contentType.includes('multipart/form-data')) {
    let form
    try {
      form = await request.formData()
    } catch {
      return { error: 'Invalid form data.' }
    }

    const field = (key) => {
      const value = form.get(key)
      return typeof value === 'string' ? value : ''
    }

    const uploaded = form.get('attachment')
    const file = uploaded && typeof uploaded === 'object' && typeof uploaded.arrayBuffer === 'function'
      ? uploaded
      : null

    return {
      fields: {
        customerName: field('customerName') || field('name'),
        email: field('email'),
        phone: field('phone'),
        companyName: field('companyName') || field('company'),
        businessCategory: field('businessCategory') || field('productType'),
        message: field('message'),
        sourceUrl: field('sourceUrl'),
      },
      file,
    }
  }

  if (contentType.includes('application/json')) {
    let body
    try {
      body = await request.json()
    } catch {
      return { error: 'Invalid JSON body.' }
    }
    return {
      fields: {
        customerName: body.customerName || body.name,
        email: body.email,
        phone: body.phone,
        companyName: body.companyName || body.company,
        businessCategory: body.businessCategory || body.productType,
        message: body.message,
        sourceUrl: body.sourceUrl,
      },
      file: null,
    }
  }

  return { error: 'Unsupported content type.' }
}

/**
 * 校验并写入 R2。返回 { name, size, key, url, expiresAt } 或 { error }。
 * 任何一步失败都不能静默降级成「没附件但邮件照发」——
 * 那正是这个接口以前的 bug：客户以为发了，收件人永远看不到。
 */
async function storeAttachment(file, env) {
  if (!env.ATTACHMENTS || typeof env.ATTACHMENTS.put !== 'function') {
    return { error: 'Attachment storage is not configured.' }
  }

  const extension = extensionOf(file.name)
  if (!extension || !ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return { error: 'Unsupported attachment type.' }
  }

  if (file.size > MAX_FILE_BYTES) {
    return { error: 'Attachment is larger than 10 MB.' }
  }

  // 先读进内存再校验魔数。上限 10 MB，放内存是安全的。
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return { error: 'Attachment is larger than 10 MB.' }
  }

  if (!signatureMatches(new Uint8Array(buffer.slice(0, 16)), extension)) {
    return { error: 'Attachment content does not match its file type.' }
  }

  const fileName = safeFileName(file.name, extension)
  const now = new Date()
  const key = [
    'contact-attachments',
    `${now.getUTCFullYear()}`,
    `${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    `${now.getTime()}-${crypto.randomUUID().slice(0, 8)}-${fileName}`,
  ].join('/')

  await env.ATTACHMENTS.put(key, buffer, {
    httpMetadata: {
      contentType: EXTENSION_MIME[extension] || file.type || 'application/octet-stream',
      // 私有桶：不让浏览器/CDN 缓存一份游离于签名之外的副本。
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      originalName: fileName,
      uploadedAt: now.toISOString(),
    },
  })

  let url = null
  if (typeof env.ATTACHMENTS.createSignedUrl === 'function') {
    // v4 签名同时保护 query string，所以必须显式声明 GET。
    url = await env.ATTACHMENTS.createSignedUrl(key, SIGNED_URL_TTL_SECONDS, { method: 'GET' })
  }

  return { name: fileName, size: buffer.byteLength, key, url }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: corsHeaders(request), status: 204 })
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request)

  const parsed = await readRequest(request)
  if (parsed.error) {
    return json({ ok: false, error: parsed.error }, 400, headers)
  }

  const { fields, file } = parsed

  const name = clean(fields.customerName)
  const email = clean(fields.email)
  const phone = clean(fields.phone)
  const company = clean(fields.companyName)
  const category = clean(fields.businessCategory)
  const sourceUrl = clean(fields.sourceUrl, 1000)
  const message = cleanMultiline(fields.message)

  if (!email && !phone) {
    return json({ ok: false, error: 'Please provide an email or phone number.' }, 400, headers)
  }

  if (email && !isEmail(email)) {
    return json({ ok: false, error: 'Please provide a valid email address.' }, 400, headers)
  }

  // 附件失败就整体失败，明确告诉客户重发。
  // 不吞掉错误、也不发一封没有附件的邮件假装成功。
  let attachment = null
  if (file && file.size > 0) {
    const stored = await storeAttachment(file, env)
    if (stored.error) {
      console.error('Attachment upload failed', stored.error)
      return json({ ok: false, error: stored.error }, 400, headers)
    }
    attachment = stored
  }

  const submittedAt = new Date().toISOString()
  const to = clean(env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL)
  const fromEmail = clean(env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL)
  const fromName = clean(env.CONTACT_FROM_NAME || DEFAULT_FROM_NAME)
  const subjectName = name || company || email || phone || 'Website visitor'
  const subject = `New DJI Luggage quote request - ${subjectName}`
  const replyTo = email || undefined

  const attachmentText = attachment
    ? `${attachment.name} (${Math.round(attachment.size / 1024)} KB)\n  ${attachment.url || '(signed link unavailable - check the R2 bucket)'}`
    : ''
  const attachmentHTML = attachment
    ? attachment.url
      ? `<a href="${escapeHTML(attachment.url)}">${escapeHTML(attachment.name)}</a> (${Math.round(attachment.size / 1024)} KB)`
      : `${escapeHTML(attachment.name)} (${Math.round(attachment.size / 1024)} KB) - signed link unavailable`
    : ''

  const text = [
    'New quote request from djiluggage.id',
    '',
    textLine('Name', name),
    textLine('Email', email),
    textLine('Phone / WhatsApp', phone),
    textLine('Company', company),
    textLine('Business category', category),
    textLine('Attachment', attachmentText),
    textLine('Source URL', sourceUrl),
    textLine('Submitted at', submittedAt),
    ...(attachment ? ['', `Download link valid for ${SIGNED_URL_TTL_SECONDS / 86400} days.`] : []),
    '',
    'Message:',
    message || '-',
  ].join('\n')

  const html = [
    '<h2 style="font-family:Arial,sans-serif;margin:0 0 16px;">New quote request from djiluggage.id</h2>',
    '<table style="font-family:Arial,sans-serif;border-collapse:collapse;">',
    htmlRow('Name', name),
    htmlRow('Email', email),
    htmlRow('Phone / WhatsApp', phone),
    htmlRow('Company', company),
    htmlRow('Business category', category),
    attachmentHTML
      ? `<tr><th align="left" style="padding:6px 12px 6px 0;">Attachment</th><td style="padding:6px 0;">${attachmentHTML}</td></tr>`
      : htmlRow('Attachment', ''),
    htmlRow('Source URL', sourceUrl),
    htmlRow('Submitted at', submittedAt),
    '</table>',
    ...(attachment
      ? [`<p style="font-family:Arial,sans-serif;color:#717680;font-size:13px;margin:12px 0 0;">Download link valid for ${SIGNED_URL_TTL_SECONDS / 86400} days.</p>`]
      : []),
    '<h3 style="font-family:Arial,sans-serif;margin:18px 0 8px;">Message</h3>',
    `<p style="font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHTML(message || '-')}</p>`,
  ].join('')

  try {
    let result = null

    if (env.EMAIL && typeof env.EMAIL.send === 'function') {
      result = await env.EMAIL.send({
        to,
        from: { email: fromEmail, name: fromName },
        ...(replyTo ? { replyTo } : {}),
        subject,
        text,
        html,
      })
    } else if (env.EMAIL_SERVICE && typeof env.EMAIL_SERVICE.fetch === 'function') {
      const serviceResponse = await env.EMAIL_SERVICE.fetch('https://email-service.local/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fromEmail,
          fromName,
          html,
          message,
          name,
          phone,
          replyTo,
          subject,
          text,
          attachment,
        }),
      })

      if (!serviceResponse.ok) {
        throw new Error('Email service worker failed with ' + serviceResponse.status)
      }

      result = await serviceResponse.json().catch(() => null)
    } else {
      return json({ ok: false, error: 'Email service is not configured.' }, 500, headers)
    }

    return json(
      {
        ok: true,
        messageId: result?.messageId || null,
        attachment: attachment ? { name: attachment.name, size: attachment.size } : null,
      },
      200,
      headers,
    )
  } catch (error) {
    console.error('Failed to send contact email', error)
    return json({ ok: false, error: 'Unable to send email right now.' }, 502, headers)
  }
}

export async function onRequest() {
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    Allow: 'POST, OPTIONS',
  })
}
