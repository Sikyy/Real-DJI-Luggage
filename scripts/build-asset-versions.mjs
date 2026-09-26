/**
 * 用内容哈希写 ?v= 版本号。
 *
 * 背景：_headers 把根级 CSS/JS 标成 immutable，浏览器与 CDN 都会长缓存。
 * 手工维护版本号已经出过两次事故（改了 career-detail.js 和 site.js 却忘了
 * 提升版本号，线上继续下发旧文件）。这里按内容哈希自动生成，改没改由内容
 * 决定，不依赖人记得改数字。
 *
 *   node scripts/build-asset-versions.mjs [--check]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHECK = process.argv.includes('--check')

const ASSETS = [
  'site.css',
  'site.js',
  'menu-fix.css',
  'menu-fix.js',
  'consent.css',
  'consent.js',
  'career-detail.css',
  'career-detail.js',
].filter((a) => existsSync(path.join(root, a)))

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.workbuddy-ai', '.seo-geo', 'assets', 'scripts', 'product-images', 'functions'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
    } else if (/\.(html|js)$/.test(entry.name) && !ASSETS.includes(path.relative(root, full))) {
      out.push(full)
    }
  }
  return out
}

const versions = {}
for (const asset of ASSETS) {
  const hash = createHash('sha256').update(readFileSync(path.join(root, asset))).digest('hex').slice(0, 8)
  versions[asset] = hash
}

const files = walk(root)
let changed = 0
const stale = []
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [asset, hash] of Object.entries(versions)) {
    // 只改带 ?v= 的引用，避免动到别的字符串
    after = after.replace(new RegExp(`(/${asset.replace('.', '\\.')}\\?v=)[0-9a-zA-Z]+`, 'g'), `$1${hash}`)
  }
  if (after === before) continue
  if (CHECK) { stale.push(path.relative(root, file)); continue }
  writeFileSync(file, after)
  changed++
}

if (CHECK) {
  if (stale.length) {
    console.log(`以下 ${stale.length} 个文件的资源版本号与文件内容不一致：`)
    for (const f of stale.slice(0, 20)) console.log('  ', f)
    process.exit(1)
  }
  console.log('资源版本号与内容一致 ✓')
} else {
  console.log(`资源版本（内容哈希）：${Object.entries(versions).map(([a, h]) => `${a}=${h}`).join(' ')}`)
  console.log(`共更新 ${changed} 个文件的引用`)
}
