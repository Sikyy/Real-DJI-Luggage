import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
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

function resolveStaticPath(urlPath) {
  const safePath = cleanPath(urlPath);
  const withoutTrailingSlash = safePath.replace(/\/index\.html$/, '');

  if (withoutTrailingSlash === '/404') {
    return resolve(root, '404.html');
  }

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

function sendFile(request, response, filePath) {
  const extension = extname(filePath);
  const statusCode = filePath.endsWith(`${sep}404.html`) ? 404 : 200;
  response.writeHead(statusCode, {
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=60',
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
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
