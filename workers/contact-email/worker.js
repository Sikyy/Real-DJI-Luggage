const DEFAULT_FROM_EMAIL = 'website@djiluggage.id'
const DEFAULT_FROM_NAME = 'DJI Luggage Website'
const MAX_FIELD_LENGTH = 500
const MAX_BODY_LENGTH = 8000

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function clean(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function cleanBody(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_BODY_LENGTH)
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function getMessage(payload, env) {
  const fromEmail = clean(env.CONTACT_FROM_EMAIL || payload.fromEmail || DEFAULT_FROM_EMAIL)
  const fromName = clean(env.CONTACT_FROM_NAME || payload.fromName || DEFAULT_FROM_NAME)
  const replyTo = clean(payload.replyTo || payload.email)
  const subject = clean(payload.subject || 'New DJI Luggage quote request')
  const text = cleanBody(payload.text || payload.message || 'New contact request from djiluggage.id')
  const html = cleanBody(payload.html)
  const to = clean(env.CONTACT_TO_EMAIL || payload.to)

  return {
    ...(to ? { to } : {}),
    from: { email: fromEmail, name: fromName },
    ...(replyTo && isEmail(replyTo) ? { replyTo } : {}),
    subject,
    text,
    ...(html ? { html } : {}),
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed.' }, 405)
    }

    if (!env.EMAIL || typeof env.EMAIL.send !== 'function') {
      return json({ ok: false, error: 'Email binding is not configured.' }, 500)
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400)
    }

    try {
      const result = await env.EMAIL.send(getMessage(payload, env))
      return json({ ok: true, messageId: result?.messageId || null })
    } catch (error) {
      console.error('Email send failed', error?.code, error?.message)
      return json(
        {
          ok: false,
          code: error?.code || 'EMAIL_SEND_FAILED',
          error: error?.message || 'Unable to send email.',
        },
        502,
      )
    }
  },
}
