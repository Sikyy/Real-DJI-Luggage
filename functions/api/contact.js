const DEFAULT_TO_EMAIL = 'info@djiluggage.id'
const DEFAULT_FROM_EMAIL = 'website@djiluggage.id'
const DEFAULT_FROM_NAME = 'DJI Luggage Website'
const MAX_FIELD_LENGTH = 500
const MAX_MESSAGE_LENGTH = 4000

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

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: corsHeaders(request), status: 204 })
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400, headers)
  }

  const name = clean(body.customerName || body.name)
  const email = clean(body.email)
  const phone = clean(body.phone)
  const company = clean(body.companyName || body.company)
  const category = clean(body.businessCategory || body.productType)
  const fileName = clean(body.fileName)
  const sourceUrl = clean(body.sourceUrl, 1000)
  const message = cleanMultiline(body.message)

  if (!email && !phone) {
    return json({ ok: false, error: 'Please provide an email or phone number.' }, 400, headers)
  }

  if (email && !isEmail(email)) {
    return json({ ok: false, error: 'Please provide a valid email address.' }, 400, headers)
  }

  const submittedAt = new Date().toISOString()
  const to = clean(env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL)
  const fromEmail = clean(env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL)
  const fromName = clean(env.CONTACT_FROM_NAME || DEFAULT_FROM_NAME)
  const subjectName = name || company || email || phone || 'Website visitor'
  const subject = `New DJI Luggage quote request - ${subjectName}`
  const replyTo = email || undefined

  const text = [
    'New quote request from djiluggage.id',
    '',
    textLine('Name', name),
    textLine('Email', email),
    textLine('Phone / WhatsApp', phone),
    textLine('Company', company),
    textLine('Business category', category),
    textLine('Attached file name', fileName),
    textLine('Source URL', sourceUrl),
    textLine('Submitted at', submittedAt),
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
    htmlRow('Attached file name', fileName),
    htmlRow('Source URL', sourceUrl),
    htmlRow('Submitted at', submittedAt),
    '</table>',
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
          body,
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
        }),
      })

      if (!serviceResponse.ok) {
        throw new Error('Email service worker failed with ' + serviceResponse.status)
      }

      result = await serviceResponse.json().catch(() => null)
    } else {
      return json({ ok: false, error: 'Email service is not configured.' }, 500, headers)
    }

    return json({ ok: true, messageId: result?.messageId || null }, 200, headers)
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
