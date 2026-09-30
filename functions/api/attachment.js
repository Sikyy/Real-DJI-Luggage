/**
 * 附件取件页（Cloudflare Pages Function）。
 *
 * GET /api/attachment?key=<R2 key>&token=<HMAC>
 *
 * 为什么需要这一层：
 * R2 的 createSignedUrl 签名有效期有硬上限，做不出"永久链接"。
 * 所以邮件里给的是这个永久 URL，点开时才实时签一个短期的 R2 链接
 * 并 302 过去。桶本身保持私有，链接也不会因为过期而失效。
 *
 * 为什么不直接把桶开成公开：那等于任何人拿到 URL 就能永久读取客户的
 * 图纸、报价单和联系方式；而且一旦被转发或被抓取就无法收回。
 *
 * token 是 HMAC-SHA256(key, ATTACHMENT_TOKEN_SECRET)，所以链接可以被
 * 无限期转发使用 —— 这是"永久"的代价，属于产品选择，不是漏洞。
 * 但它不可被伪造或遍历：改一个字符就验签失败。
 */

// 单次下载链接的有效期。取件页只做一次跳转，签名够用即可，
// 不需要长 —— 越短越安全。
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 取件页内容依 URL 而定，且包含一次性跳转，不能让 CDN 缓存。
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      ...headers,
    },
  })
}

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 时间无关的比较，避免通过响应耗时逐字节猜测签名。
 * 两边长度不同也要走完整个比较流程。
 */
function timingSafeEqual(a, b) {
  const left = String(a || '')
  const right = String(b || '')
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

async function computeToken(key, secret) {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(key))
  // base64url：URL 里安全，不需要再转义
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function page(title, message, status) {
  return html(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHTML(title)} - DJI Luggage</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f4f3f1; color:#1a1a1a;
         font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .card { background:#fff; border-radius:18px; padding:40px 32px; max-width:420px; text-align:center;
          box-shadow:0 6px 32px rgba(0,0,0,0.07); }
  h1 { font-size:22px; margin:0 0 12px; letter-spacing:-0.4px; }
  p { font-size:14px; line-height:21px; color:#555; margin:0; }
  a { color:#1a1a1a; }
</style>
</head>
<body><div class="card"><h1>${escapeHTML(title)}</h1><p>${message}</p></div></body>
</html>`,
    status,
  )
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const token = url.searchParams.get('token')

  if (!key || !token) {
    return page('Invalid link', 'This download link is incomplete. Please use the link from your email.', 400)
  }

  // 没配密钥就明确报错，而不是跳过校验 —— 否则任何人都能读整个桶。
  const secret = env.ATTACHMENT_TOKEN_SECRET
  if (!secret) {
    console.error('ATTACHMENT_TOKEN_SECRET is not configured')
    return page('Unavailable', 'Downloads are temporarily unavailable. Please contact us directly.', 500)
  }

  if (!env.ATTACHMENTS || typeof env.ATTACHMENTS.get !== 'function') {
    console.error('ATTACHMENTS binding is not configured')
    return page('Unavailable', 'Downloads are temporarily unavailable. Please contact us directly.', 500)
  }

  const expected = await computeToken(key, secret)
  if (!timingSafeEqual(token, expected)) {
    // 不区分"签名不对"和"文件不存在"，避免被用来探测桶里有哪些 key。
    return page('Invalid link', 'This download link is not valid. Please use the link from your email.', 403)
  }

  // 只允许取本功能写入的路径，防止伪造 key 去读桶里其它东西。
  if (!key.startsWith('contact-attachments/') || key.includes('..')) {
    return page('Invalid link', 'This download link is not valid.', 403)
  }

  const object = await env.ATTACHMENTS.get(key)
  if (!object) {
    return page('File not found', 'This file is no longer available. Please contact us and we will resend it.', 404)
  }

  // 不把文件读进内存再吐出去，直接 302 到短期签名链接：
  // 省一次搬运，也让浏览器自带断点续传和下载进度。
  if (typeof env.ATTACHMENTS.createSignedUrl === 'function') {
    const signed = await env.ATTACHMENTS.createSignedUrl(key, DOWNLOAD_URL_TTL_SECONDS, { method: 'GET' })
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

  // 没有签名能力时退化成直接流式下载，至少保证能用。
  const headers = new Headers({
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  })
  const name = object.customMetadata?.originalName
  if (name) {
    headers.set('Content-Disposition', `attachment; filename="${name.replace(/["\\]/g, '')}"`)
  }
  return new Response(object.body, { status: 200, headers })
}

export async function onRequest() {
  return page('Not found', 'This page does not exist.', 405)
}
