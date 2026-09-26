/**
 * 审计流水线的路径与 base URL 解析。
 *
 * 默认抓线上；设置 SITE_BASE 就把整套语料指向另一个 base（例如本地预览
 * http://127.0.0.1:8767），并把产物写进独立目录，避免本地一轮覆盖线上的结果。
 *
 *   SITE_BASE=http://127.0.0.1:8767 npm run audit:corpus -- --refresh
 *   SITE_BASE=http://127.0.0.1:8767 npm run audit:analyze
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE_BASE = (process.env.SITE_BASE || 'https://djiluggage.id').replace(/\/+$/, '');
export const IS_DEFAULT_SITE = SITE_BASE === 'https://djiluggage.id';
export const SITE = SITE_BASE;
export const SITE_DIR = IS_DEFAULT_SITE
  ? join(ROOT, '.seo-geo', 'site')
  : join(ROOT, '.seo-geo', `site-${SITE_BASE.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-')}`);
export const LABEL = IS_DEFAULT_SITE ? '线上' : SITE_BASE;
