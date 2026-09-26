/**
 * Google Search Console 取数脚本。
 *
 * 认证：服务账号 JSON（默认 .secrets/gsc-service-account.json）
 *   → 本地用 Node 原生 crypto 签 RS256 JWT（无需任何 npm 依赖）
 *   → 换取 access token → 调用 Search Console API
 *
 * 前置条件：在 GSC「设置 → 用户和权限」里把该服务账号的 client_email 加为资源用户。
 *
 * 用法：
 *   node scripts/gsc.mjs sites                 列出已验证资源（验证权限是否配好）
 *   node scripts/gsc.mjs sitemaps [siteUrl]    列出站点地图与状态
 *   node scripts/gsc.mjs query   [siteUrl]     拉取搜索效果数据（默认近 28 天）
 *   node scripts/gsc.mjs report  [siteUrl]     生成基线报告（Markdown + JSON）
 *
 * 可选环境变量：
 *   GSC_KEY_FILE   服务账号 JSON 路径（默认 .secrets/gsc-service-account.json）
 *   GSC_DAYS       查询天数，默认 28
 *   GSC_LAG        数据滞后天数，默认 3（GSC 通常滞后 2–3 天）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const KEY_FILE = process.env.GSC_KEY_FILE
  ? path.resolve(process.env.GSC_KEY_FILE)
  : path.join(root, '.secrets/gsc-service-account.json')
const DAYS = Number(process.env.GSC_DAYS || 28)
const LAG = Number(process.env.GSC_LAG || 3)
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

// ---------------------------------------------------------------- 认证

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken() {
  if (!existsSync(KEY_FILE)) {
    throw new Error(`找不到服务账号密钥：${KEY_FILE}\n请把 JSON 密钥放到该路径，或用 GSC_KEY_FILE 指定。`)
  }
  const key = JSON.parse(readFileSync(KEY_FILE, 'utf8'))
  if (key.type !== 'service_account' || !key.private_key || !key.client_email) {
    throw new Error('密钥文件格式不对：需要 type=service_account，且含 private_key 与 client_email。')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(key.private_key)
  const assertion = `${header}.${claims}.${base64url(signature)}`

  const res = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`换取 access token 失败 (${res.status}): ${JSON.stringify(body)}`)
  return { token: body.access_token, email: key.client_email, project: key.project_id }
}

async function api(pathname, token, { method = 'GET', body: payload } = {}) {
  const res = await fetch(`https://searchconsole.googleapis.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `403 无权限。请确认已在 GSC「设置 → 用户和权限」里把服务账号加为资源用户：\n  ${body?.error?.message || text}`,
      )
    }
    throw new Error(`${res.status} ${res.statusText}: ${body?.error?.message || text}`)
  }
  return body
}

// ---------------------------------------------------------------- 查询封装

function dateRange(days = DAYS, lag = LAG) {
  const end = new Date(Date.now() - lag * 86400000)
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { startDate: iso(start), endDate: iso(end) }
}

async function querySearchAnalytics(siteUrl, token, { dimensions, rowLimit = 100, startDate, endDate } = {}) {
  const range = startDate ? { startDate, endDate } : dateRange()
  const pathname = `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const body = { ...range, dimensions: dimensions || [], rowLimit, dataState: 'final' }
  try {
    return await api(pathname, token, { method: 'POST', body })
  } catch (err) {
    // 部分资源对 dataState=final 支持不佳，退回默认重试一次
    if (String(err.message).includes('dataState')) {
      const { dataState, ...rest } = body
      return api(pathname, token, { method: 'POST', body: rest })
    }
    throw err
  }
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`)
const num = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))
const pos = (v) => (v == null ? '—' : v.toFixed(1))

// ---------------------------------------------------------------- 命令

async function cmdSites(auth) {
  const data = await api('/webmasters/v3/sites', auth.token)
  console.log(`服务账号: ${auth.email}`)
  console.log(`项目:     ${auth.project}`)
  console.log(`\n已验证资源 ${(data.siteEntry || []).length} 个：`)
  for (const s of data.siteEntry || []) {
    console.log(`  ${s.permissionLevel.padEnd(18)} ${s.siteUrl}`)
  }
  return data
}

async function cmdSitemaps(auth, siteUrl) {
  const data = await api(`/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, auth.token)
  console.log(`站点地图（${siteUrl}）：`)
  for (const s of data.sitemap || []) {
    console.log(`  ${s.path}`)
    console.log(`    最后下载: ${s.lastDownloaded || '从未'}`)
    console.log(`    提交内容: ${s.contents?.map((c) => `${c.type}:${c.submitted}`).join(', ') || '—'}`)
    // 注意：GSC API 把 warnings / errors 返回为字符串形式的计数，不是数组。
    const warnCount = Number(s.warnings || 0)
    const errCount = Number(s.errors || 0)
    console.log(`    警告: ${warnCount} | 错误: ${errCount}`)
    if (s.isPending) console.log('    状态: 待处理')
    if (s.lastSubmitted) console.log(`    最后提交: ${s.lastSubmitted}`)
  }
  return data
}

async function cmdReport(auth, siteUrl) {
  const range = dateRange()
  console.log(`资源: ${siteUrl}`)
  console.log(`区间: ${range.startDate} → ${range.endDate}（近 ${DAYS} 天，已扣除 ${LAG} 天数据滞后）\n`)

  const [totals, byQuery, byPage, byCountry, byDevice, byDate, byQueryPage, sitemaps] = await Promise.all([
    querySearchAnalytics(siteUrl, auth.token, { dimensions: [] }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['query'], rowLimit: 100 }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['page'], rowLimit: 100 }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['country'], rowLimit: 50 }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['device'], rowLimit: 10 }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['date'], rowLimit: 200 }),
    querySearchAnalytics(siteUrl, auth.token, { dimensions: ['query', 'page'], rowLimit: 150 }),
    api(`/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, auth.token).catch(() => ({ sitemap: [] })),
  ])

  const g = (d) => d.rows || []
  const t = g(totals)[0] || {}
  const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0)

  const lines = []
  lines.push(`# Google Search Console 基线报告`)
  lines.push('')
  lines.push(`- 资源：\`${siteUrl}\``)
  lines.push(`- 区间：**${range.startDate} → ${range.endDate}**（近 ${DAYS} 天，扣除 ${LAG} 天滞后）`)
  lines.push(`- 抓取时间：${new Date().toISOString()}`)
  lines.push(`- 服务账号：\`${auth.email}\``)
  lines.push('')
  lines.push('## 总览')
  lines.push('')
  lines.push('| 指标 | 数值 |')
  lines.push('|---|---|')
  lines.push(`| 点击 | ${num(t.clicks)} |`)
  lines.push(`| 展示 | ${num(t.impressions)} |`)
  lines.push(`| CTR | ${pct(t.ctr)} |`)
  lines.push(`| 平均排名 | ${pos(t.position)} |`)
  lines.push(`| 有展示的查询数 | ${g(byQuery).length} |`)
  lines.push(`| 有展示的页面数 | ${g(byPage).length} |`)
  lines.push('')

  const table = (title, rows, keyName, limit = 25) => {
    lines.push(`## ${title}`)
    lines.push('')
    lines.push(`| ${keyName} | 点击 | 展示 | CTR | 平均排名 |`)
    lines.push('|---|---|---|---|---|')
    for (const r of rows.slice(0, limit)) {
      lines.push(`| ${String(r.keys[0]).replace(/\|/g, '\\|')} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${pos(r.position)} |`)
    }
    lines.push('')
  }
  table('Top 查询', g(byQuery), '查询', 30)
  table('Top 页面', g(byPage), '页面', 30)
  table('国家/地区', g(byCountry), '国家', 20)

  // 查询 × 页面：诊断「哪个词落在哪个页」的关键视图
  lines.push('## 查询 × 页面')
  lines.push('')
  lines.push('| 查询 | 页面 | 点击 | 展示 | CTR | 平均排名 |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of g(byQueryPage).slice(0, 40)) {
    const page = String(r.keys[1]).replace(/^https?:\/\/[^/]+/, '') || '/'
    lines.push(`| ${String(r.keys[0]).replace(/\|/g, '\\|')} | ${page} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${pos(r.position)} |`)
  }
  lines.push('')

  lines.push('## 设备')
  lines.push('')
  lines.push('| 设备 | 点击 | 展示 | CTR | 平均排名 |')
  lines.push('|---|---|---|---|---|')
  for (const r of g(byDevice)) {
    lines.push(`| ${r.keys[0]} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${pos(r.position)} |`)
  }
  lines.push('')

  lines.push('## 站点地图')
  lines.push('')
  for (const s of sitemaps.sitemap || []) {
    const w = Number(s.warnings || 0)
    const e = Number(s.errors || 0)
    lines.push(`- \`${s.path}\` — 最后下载 ${s.lastDownloaded || '从未'}，警告 ${w}，错误 ${e}，提交 ${s.contents?.map((c) => `${c.type}:${c.submitted}`).join(', ') || '—'}`)
  }
  lines.push('')
  lines.push('## 每日趋势')
  lines.push('')
  lines.push('| 日期 | 点击 | 展示 | CTR | 平均排名 |')
  lines.push('|---|---|---|---|---|')
  for (const r of g(byDate)) {
    lines.push(`| ${r.keys[0]} | ${num(r.clicks)} | ${num(r.impressions)} | ${pct(r.ctr)} | ${pos(r.position)} |`)
  }
  lines.push('')

  // console 摘要
  console.log('=== 总览 ===')
  console.log(`  点击 ${num(t.clicks)} | 展示 ${num(t.impressions)} | CTR ${pct(t.ctr)} | 平均排名 ${pos(t.position)}`)
  console.log(`  有展示的查询 ${g(byQuery).length} 个 | 页面 ${g(byPage).length} 个`)
  console.log('\n=== Top 10 查询 ===')
  for (const r of g(byQuery).slice(0, 10)) {
    console.log(`  ${num(r.clicks).padStart(6)} 击 / ${num(r.impressions).padStart(7)} 展 / 排 ${pos(r.position).padStart(5)}  ${r.keys[0]}`)
  }
  console.log('\n=== Top 10 页面 ===')
  for (const r of g(byPage).slice(0, 10)) {
    console.log(`  ${num(r.clicks).padStart(6)} 击 / ${num(r.impressions).padStart(7)} 展 / 排 ${pos(r.position).padStart(5)}  ${String(r.keys[0]).replace(/^https?:\/\/[^/]+/, '') || '/'}`)
  }
  console.log('\n=== 站点地图 ===')
  for (const s of sitemaps.sitemap || []) console.log(`  ${s.path} — 最后下载 ${s.lastDownloaded || '从未'}`)
  console.log('\n提示：CTR 高但排名低的查询 = 摘要吸引力强但位置不够；排名高但 CTR 低 = 标题/描述需要改。')

  const outDir = path.join(root, '.seo-geo/gsc')
  mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const jsonPath = path.join(outDir, `gsc-${stamp}.json`)
  const mdPath = path.join(root, `.workbuddy-ai/reports/gsc-baseline-${stamp}.md`)
  mkdirSync(path.dirname(mdPath), { recursive: true })
  writeFileSync(jsonPath, JSON.stringify({ siteUrl, range, serviceAccount: auth.email, fetchedAt: new Date().toISOString(), totals: t, byQuery: g(byQuery), byPage: g(byPage), byCountry: g(byCountry), byDevice: g(byDevice), byDate: g(byDate), byQueryPage: g(byQueryPage), sitemaps }, null, 2))
  writeFileSync(mdPath, lines.join('\n'))
  console.log(`\n原始 JSON: ${path.relative(root, jsonPath)}`)
  console.log(`报告:      ${path.relative(root, mdPath)}`)
}

// ---------------------------------------------------------------- 入口

const [cmd = 'report', siteArg] = process.argv.slice(2)

/**
 * 解析要查询的资源。GSC 有两种资源类型，API 里的 siteUrl 写法不同：
 *   网域资源     sc-domain:djiluggage.id
 *   网址前缀资源 https://djiluggage.id/
 * 未显式指定时，从账号可访问的资源列表里挑一个（优先含 djiluggage 的）。
 */
async function resolveSite(auth, explicit) {
  if (explicit) return explicit
  if (process.env.GSC_SITE) return process.env.GSC_SITE
  const data = await api('/webmasters/v3/sites', auth.token)
  const list = (data.siteEntry || []).map((s) => s.siteUrl)
  if (!list.length) throw new Error('该服务账号没有任何可访问的 GSC 资源。请在 GSC 里把它加为资源用户。')
  return list.find((s) => s.includes('djiluggage')) || list[0]
}

try {
  const auth = await getAccessToken()
  if (cmd === 'sites') {
    await cmdSites(auth)
  } else if (cmd === 'sitemaps') {
    await cmdSitemaps(auth, await resolveSite(auth, siteArg))
  } else if (cmd === 'query') {
    const site = await resolveSite(auth, siteArg)
    const range = dateRange()
    console.log(`资源 ${site} | ${range.startDate} → ${range.endDate}`)
    for (const dims of [['query'], ['page'], ['country'], ['device']]) {
      const d = await querySearchAnalytics(site, auth.token, { dimensions: dims, rowLimit: 25 })
      console.log(`\n--- 维度: ${dims[0]}（${(d.rows || []).length} 行）---`)
      for (const r of (d.rows || []).slice(0, 15)) {
        console.log(`  ${num(r.clicks).padStart(6)} 击 / ${num(r.impressions).padStart(7)} 展 / ${pct(r.ctr).padStart(8)} / 排 ${pos(r.position).padStart(5)}  ${r.keys[0]}`)
      }
    }
  } else if (cmd === 'report') {
    await cmdReport(auth, await resolveSite(auth, siteArg))
  } else {
    console.error(`未知命令: ${cmd}\n可用: sites | sitemaps | query | report`)
    process.exit(1)
  }
} catch (err) {
  console.error(`\n✖ ${err.message}\n`)
  process.exit(1)
}
