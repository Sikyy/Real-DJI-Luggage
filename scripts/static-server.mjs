import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrotliCompress, createGzip } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8767);
const supportedLocales = new Set(['en', 'id', 'zh']);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function cleanPath(urlPath) {
  const decoded = decodeURIComponent(stripLocalePrefix(urlPath).split('?')[0] || '/');
  const withIndex = decoded.endsWith('/') ? decoded + 'index.html' : decoded;
  return normalize(withIndex).replace(/^(\.\.[/\\])+/, '');
}

function stripLocalePrefix(urlPath) {
  const [pathOnly, query] = String(urlPath || '/').split('?');
  const parts = pathOnly.split('/').filter(Boolean);
  if (supportedLocales.has(parts[0])) parts.shift();
  const stripped = '/' + parts.join('/');
  return (stripped === '/' ? '/' : stripped) + (query ? '?' + query : '');
}

function insideRoot(filePath) {
  const relative = normalize(filePath).replace(root, '');
  return filePath === root || (relative.startsWith(sep) && !relative.includes('..'));
}

// 真实存在的静态文件优先。只有页面在仓库里确实不存在时，才回退到模板，
// 这样本地预览与 Cloudflare Pages 的实际行为一致（Pages 永远读真实文件）。
function realPageFor(safePath) {
  const filePath = resolve(root, '.' + safePath);
  if (!insideRoot(filePath)) return null;
  const asIndex = join(filePath, 'index.html');
  if (existsSync(asIndex) && statSync(asIndex).isFile()) return asIndex;
  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;
  return null;
}

function resolveStaticPath(urlPath) {
  const safePath = cleanPath(urlPath);
  const withoutTrailingSlash = safePath.replace(/\/index\.html$/, '');

  if (withoutTrailingSlash === '/404') {
    return resolve(root, '404.html');
  }

  const realPage = realPageFor(safePath);
  if (realPage) return realPage;

  if (withoutTrailingSlash.match(/^\/newsroom\/filters\/[^/]+$/)) {
    return resolve(root, 'newsroom.html');
  }

  const articleMatch = withoutTrailingSlash.match(/^\/newsroom\/([^/]+)$/);
  if (articleMatch && articleMatch[1] !== 'filters') {
    return resolve(root, 'article-template.html');
  }

  const jobMatch = withoutTrailingSlash.match(/^\/careers\/([^/]+)$/);
  if (jobMatch) {
    return resolve(root, 'career-template.html');
  }

  let candidate = resolve(root, '.' + safePath);

  if (!insideRoot(candidate)) return null;

  const htmlCandidate = resolve(root, '.' + withoutTrailingSlash + '.html');
  if (insideRoot(htmlCandidate) && existsSync(htmlCandidate) && statSync(htmlCandidate).isFile()) {
    return htmlCandidate;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    candidate = join(candidate, 'index.html');
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  return resolve(root, '404.html');
}

const compressibleTypes = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);

function cacheControlFor(extension) {
  // HTML must always revalidate so content/redirect updates propagate.
  if (extension === '.html') return 'no-store';
  // CSS/JS 一律不缓存：本地预览时改了文件必须立刻可见。生产由 Cloudflare 按
  // ?v= 版本号长缓存，若这里也标 immutable，改完不升版本号就会被旧文件骗到。
  if (['.css', '.js'].includes(extension)) return 'no-store';
  // 字体是内容寻址之外的静态资源，可以长缓存。
  if (['.woff2', '.woff'].includes(extension)) {
    return 'public, max-age=31536000, immutable';
  }
  // Images/video aren't content-hashed; cache long but allow revalidation on replace.
  return 'public, max-age=2592000';
}

function sendFile(request, response, filePath) {
  const extension = extname(filePath);
  const statusCode = filePath.endsWith(`${sep}404.html`) ? 404 : 200;
  const headers = {
    'Cache-Control': cacheControlFor(extension),
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
  };

  const acceptEncoding = String(request.headers['accept-encoding'] || '');
  let encoding = null;
  if (compressibleTypes.has(extension)) {
    headers.Vary = 'Accept-Encoding';
    if (/\bbr\b/.test(acceptEncoding)) encoding = 'br';
    else if (/\bgzip\b/.test(acceptEncoding)) encoding = 'gzip';
  }
  if (encoding) headers['Content-Encoding'] = encoding;

  response.writeHead(statusCode, headers);

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const source = createReadStream(filePath);
  if (encoding === 'br') {
    source.pipe(createBrotliCompress()).pipe(response);
  } else if (encoding === 'gzip') {
    source.pipe(createGzip()).pipe(response);
  } else {
    source.pipe(response);
  }
}

// Cloudflare Pages 会先套用 _redirects 再找静态文件。本地预览如果跳过这一步，
// 已加 301 的旧 URL 在本地会显示 404，与线上不一致，所以这里同样先匹配规则。
// 支持精确路径和尾部 * 通配（目标里用 :splat），够覆盖本仓库的全部规则。
function loadRedirects() {
  const file = resolve(root, '_redirects');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    // Cloudflare 只把「以 # 开头」的行当注释。若像早先那样剥掉行内所有 #，
    // 目标里的片段（如 /newsroom/#insights）会被吃掉，状态码也会退化。
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map(([from, to, status]) => ({ from, to, status: Number(status) || 302 }));
}

const redirectRules = loadRedirects();

function matchRedirect(urlPath) {
  // 按字面路径匹配，结尾斜杠有别 —— 这与 Cloudflare 一致（官方文档同时给出
  // `/trailing /trailing/ 301` 与 `/notrailing/ /nottrailing 301` 两个示例）。
  // 若在这里把斜杠归一化，`/about /about/ 301` 会连 /about/ 一起匹配，导致自跳转死循环。
  const pathOnly = String(urlPath || '/').split('?')[0] || '/';

  for (const rule of redirectRules) {
    if (rule.from.endsWith('*')) {
      const base = rule.from.slice(0, -1);
      if (!pathOnly.startsWith(base)) continue;
      const splat = pathOnly.slice(base.length).replace(/^\//, '');
      return { status: rule.status, location: rule.to.replace(':splat', splat) };
    }
    if (pathOnly === rule.from) {
      return { status: rule.status, location: rule.to };
    }
  }
  return null;
}

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const redirect = matchRedirect(request.url || '/');
  if (redirect) {
    response.writeHead(redirect.status, { Location: redirect.location, 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const filePath = resolveStaticPath(request.url || '/');
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad Request');
    return;
  }

  sendFile(request, response, filePath);
});

server.listen(port, () => {
  console.log(`DJI Luggage static server running at http://localhost:${port}/`);
});
