/**
 * 把职位页的服务端 HTML <body> 从空壳填成真实内容。
 *
 * 背景：career-detail.js 用 document.body.innerHTML = `...` 整体重建页面，
 * 所以 <body data-job-slug="x"></body> 在服务端是空的。Google 能执行 JS，
 * 但首屏无内容不利于收录。
 *
 * 做法：按 career-detail.js 里同一份数据与同一套 class 生成静态内容写进 <body>。
 * JS 运行时会把 body 整体替换掉，因此不会重复渲染；JS 失效时静态内容仍可读。
 * 数据源只有 career-detail.js 一处，不引入第二份真相。
 *
 * 用法：node scripts/prerender-careers.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const APPLY = process.argv.includes('--apply')

const src = readFileSync(path.join(root, 'career-detail.js'), 'utf8')

const jobsMatch = src.match(/const jobs = (\{[\s\S]*?\n  \});/)
if (!jobsMatch) throw new Error('未在 career-detail.js 中找到 jobs 对象')
const jobs = eval(`(${jobsMatch[1]})`)

function extractList(className) {
  const re = new RegExp(`<div class="job-list ${className}">([\\s\\S]*?)<\\/div>`)
  const m = src.match(re)
  if (!m) throw new Error(`未找到列表 ${className}`)
  return [...m[1].matchAll(/listItem\('((?:[^'\\]|\\.)*)'\)/g)].map((x) =>
    x[1].replace(/\\'/g, "'"),
  )
}

const responsibilities = extractList('responsibilities-list')
const basic = extractList('basic-list')
const preferred = extractList('preferred-list')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 与 career-detail.js 的 listItem() 保持一致：每一项各自包一层 <ul>
const listItem = (t) => `<ul><li><p>${esc(t)}</p></li></ul>`
const listBlock = (arr) =>
  arr.map((t) => `          ${listItem(t)}`).join('\n')

const SIDEBAR =
  'DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.'

function renderBody(slug) {
  const job = jobs[slug]
  if (!job) throw new Error(`jobs 中缺少 ${slug}`)
  return `<main class="job-main" data-header="dark">
      <aside class="job-sidebar">
        <div class="job-kicker">JOIN THE TEAM</div>
        <p>${esc(SIDEBAR)}</p>
      </aside>

      <section class="job-content">
        <h1 class="job-title">${esc(job.title)}</h1>
        <div class="job-meta"><span>${esc(job.date)}</span><span>${esc(job.type)}</span></div>

        <h2 class="job-heading job-description-title">Job Description</h2>
        <p class="job-description-copy">${esc(job.description)}</p>

        <h2 class="job-heading responsibilities-title">Responsibilities</h2>
        <div class="job-list responsibilities-list">
${listBlock(responsibilities)}
        </div>

        <h2 class="job-heading basic-title">Basic Requirements</h2>
        <p class="job-first-copy basic-first">${esc(job.basicIntro)}</p>
        <div class="job-list basic-list">
${listBlock(basic)}
        </div>

        <h2 class="job-heading preferred-title">Preferred Requirements</h2>
        <p class="job-first-copy preferred-first">${esc(job.preferredIntro)}</p>
        <div class="job-list preferred-list">
${listBlock(preferred)}
        </div>
      </section>
    </main>`
}

console.log('模式:', APPLY ? 'APPLY（写入）' : 'DRY-RUN（只预览）')
console.log(
  `共享列表：职责 ${responsibilities.length} / 基本 ${basic.length} / 优先 ${preferred.length}\n`,
)

for (const slug of Object.keys(jobs)) {
  const file = path.join(root, 'careers', slug, 'index.html')
  const html = readFileSync(file, 'utf8')
  // 可重复执行：空 body 或已填充的 body 都能匹配
  const re = new RegExp(`<body data-job-slug="${slug}">[\\s\\S]*?</body>`)
  if (!re.test(html)) {
    console.log(`${slug}  !! 未找到 body 标记，跳过`)
    continue
  }

  // <body> 里除了职位内容，还住着两段站点级代码：GTM 的 <noscript> 与 cookie
  // 同意横幅。整体替换 body 会把它们一起抹掉，所以先从旧 body 里取出来再放回去。
  const oldBody = html.match(re)[0]
  const gtm = oldBody.match(/[ \t]*<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/)
  const consent = oldBody.match(/[ \t]*<!-- Cookie consent banner -->[\s\S]*?<!-- End cookie consent banner -->/)

  const parts = [`<body data-job-slug="${slug}">`]
  if (gtm) parts.push(gtm[0].trim())
  parts.push(`  ${renderBody(slug)}`)
  if (consent) parts.push(consent[0].trim())
  parts.push('</body>')

  const next = html.replace(re, parts.join('\n'))
  if (APPLY) writeFileSync(file, next, 'utf8')
  console.log(
    `${slug.padEnd(32)} body ${html.length} → ${next.length} bytes  (+${next.length - html.length})` +
      `${gtm ? '' : '  !! 未找到 GTM noscript'}${consent ? '' : '  !! 未找到同意横幅'}`,
  )
}
