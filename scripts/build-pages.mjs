import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const outDir = path.join(root, 'dist')

const includeDirs = new Set([
  'about',
  'careers',
  'collections',
  'contact',
  'made-in-indonesia',
  'newsroom',
  'privacy-policy',
  'process',
  'products',
  'services',
])

const includeFileExtensions = new Set(['.css', '.html', '.js', '.svg', '.txt', '.xml'])
const includeFiles = new Set(['_headers', '_redirects'])
// 模板文件仅供本地开发服务器（static-server.mjs）兜底使用，不发布到生产环境。
const excludeNames = new Set(['.DS_Store', 'article-template.html', 'career-template.html'])

function shouldCopyFile(name) {
  if (excludeNames.has(name)) return false
  if (includeFiles.has(name)) return true
  return includeFileExtensions.has(path.extname(name))
}

// 防呆：带 index.html 的顶级目录必须在白名单里，否则它会被静默地排除在
// 发布产物之外 —— 站点源码看起来正常，线上却是 404。新增落地页目录时最容易踩。
const omittedDirs = (await readdir(root, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !includeDirs.has(e.name) && !e.name.startsWith('.'))
  .map((e) => e.name)
  .filter((name) => existsSync(path.join(root, name, 'index.html')))
  .filter((name) => !['node_modules', 'dist', 'functions', 'scripts', 'product-images'].includes(name))

if (omittedDirs.length) {
  throw new Error(
    `以下目录含 index.html 但不在 includeDirs 白名单中，会被静默排除：\n  ${omittedDirs.join('\n  ')}\n` +
      '请把它们加入 scripts/build-pages.mjs 的 includeDirs。',
  )
}

await rm(outDir, { force: true, recursive: true })
await mkdir(outDir, { recursive: true })

for (const entry of await readdir(root)) {
  if (excludeNames.has(entry)) continue

  const source = path.join(root, entry)
  const destination = path.join(outDir, entry)
  const info = await stat(source)

  if (info.isDirectory()) {
    if (includeDirs.has(entry)) {
      await cp(source, destination, {
        filter: (sourcePath) => !sourcePath.split(path.sep).includes('.DS_Store'),
        recursive: true,
      })
    }
    continue
  }

  if (info.isFile() && shouldCopyFile(entry)) {
    await cp(source, destination)
  }
}

async function walkFiles(dir, files = []) {
  for (const entry of await readdir(dir)) {
    const filePath = path.join(dir, entry)
    const info = await stat(filePath)

    if (info.isDirectory()) {
      await walkFiles(filePath, files)
    } else if (info.isFile()) {
      files.push(filePath)
    }
  }

  return files
}

function collectAssetReferences(text) {
  const references = new Set()
  // 同时匹配相对路径（"/assets/x.png"）与绝对 URL（"https://djiluggage.id/assets/x.png"）。
  // og:image / twitter:image 用的是绝对 URL，旧正则只认引号后紧跟 "/assets/"，会漏掉它们。
  const pathRe = /["'(](?:https?:\/\/[^"'/\s]+)?(\/(?:assets|product-images)\/[^"'?#)\s]+)/g
  const srcsetRe = /srcset=["']([^"']+)["']/g

  for (const match of text.matchAll(pathRe)) {
    references.add(match[1].slice(1))
  }

  for (const match of text.matchAll(srcsetRe)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0]
      if (url.startsWith('/assets/') || url.startsWith('/product-images/')) {
        references.add(url.slice(1).split('?')[0])
      }
    }
  }

  return references
}

const assetReferences = new Set()
const sourceFiles = (await walkFiles(outDir)).filter((filePath) => {
  return ['.css', '.html', '.js'].includes(path.extname(filePath))
})

for (const filePath of sourceFiles) {
  const text = await readFile(filePath, 'utf8')
  for (const reference of collectAssetReferences(text)) {
    assetReferences.add(reference)
  }
}

for (const reference of [...assetReferences].sort()) {
  const source = path.join(root, reference)
  if (!existsSync(source)) {
    throw new Error(`Referenced asset does not exist: ${reference}`)
  }

  const destination = path.join(outDir, reference)
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination)
}

console.log(`Built Cloudflare Pages output at ${path.relative(root, outDir)}`)
console.log(`Copied ${assetReferences.size} referenced media assets`)
