import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const outDir = path.join(root, 'dist')

const includeDirs = new Set([
  '404',
  'about',
  'careers',
  'collections',
  'comparison',
  'contact',
  'newsroom',
  'privacy-policy',
  'process',
  'products',
  'services',
])

const includeFileExtensions = new Set(['.css', '.html', '.js', '.svg', '.txt', '.xml'])
const includeFiles = new Set(['_headers', '_redirects'])
const excludeNames = new Set(['.DS_Store'])

function shouldCopyFile(name) {
  if (excludeNames.has(name)) return false
  if (includeFiles.has(name)) return true
  return includeFileExtensions.has(path.extname(name))
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
  const quotedPathRe = /["'(]\/(assets|product-images)\/[^"'?#)\s]+/g
  const srcsetRe = /srcset=["']([^"']+)["']/g

  for (const match of text.matchAll(quotedPathRe)) {
    const raw = match[0].slice(1)
    references.add(raw.replace(/^\//, ''))
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
