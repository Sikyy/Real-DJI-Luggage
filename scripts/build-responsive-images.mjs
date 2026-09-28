/**
 * 生成首页产品图的自适应 AVIF 变体。
 *
 * 背景：这六张图原本是 PNG，尺寸 1086–1434px 宽，而实际最大显示需求只有
 * 401×513（桌面）和 330×330（移动 DPR2）。用 PNG 存实拍照片是双重浪费 ——
 * 格式不对，尺寸也过大。转成 AVIF 并按显示尺寸缩到 500 / 1000 两档后，
 * 六张图合计从 8.2 MB 降到约 280 KB。
 *
 * 依赖 macOS 自带的 sips（能写 AVIF）。这不是构建步骤 —— 变体文件已提交进仓库，
 * 只有换图或调整尺寸时才需要重跑。因为 /product-images/* 有缓存头，文件名里带
 * 内容哈希，换图即换 URL。
 *
 *   node scripts/build-responsive-images.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, renameSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const srcDir = path.join(root, 'product-images')
const outDir = path.join(srcDir, 'avif')

const IMAGES = [
  'home-pc-abs-zipper-suitcase',
  'home-pp-suitcase',
  'home-aluminum-frame-suitcase',
  'Polycarbonate-Zipper-Suitcase',
  'home-fabric-suitcase',
  'home-special-custom-suitcase',
]
const WIDTHS = [500, 1000]

if (process.platform !== 'darwin') {
  console.error('此脚本依赖 macOS 的 sips（WebP/AVIF 编码）。在其它平台请改用 cwebp/avifenc。')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// 先把上次生成的清掉，避免留下无引用的孤儿文件
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.avif')) renameSync(path.join(outDir, f), path.join('/tmp', f))
}

const results = []
for (const base of IMAGES) {
  const src = path.join(srcDir, `${base}.png`)
  if (!existsSync(src)) throw new Error(`缺少源图：${src}`)
  for (const w of WIDTHS) {
    const tmp = path.join('/tmp', `${base}-${w}.avif`)
    execFileSync('sips', ['--resampleWidth', String(w), '-s', 'format', 'avif', '-s', 'formatOptions', 'high', src, '--out', tmp], { stdio: 'ignore' })
    const hash = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 8)
    const name = `${base}-${w}.${hash}.avif`
    renameSync(tmp, path.join(outDir, name))
    const bytes = statSync(path.join(outDir, name)).size
    results.push({ name, w, bytes })
  }
}

const total = results.reduce((n, r) => n + r.bytes, 0)
for (const r of results) console.log(`  ${r.name.padEnd(52)} ${(r.bytes / 1024).toFixed(1).padStart(6)} KB`)
console.log(`\n合计 ${(total / 1024).toFixed(0)} KB（源 PNG 合计 ${(IMAGES.reduce((n, b) => n + statSync(path.join(srcDir, `${b}.png`)).size, 0) / 1048576).toFixed(1)} MB）`)
console.log('\n文件名含内容哈希，页面里的 srcset 需要同步更新为新哈希。')
