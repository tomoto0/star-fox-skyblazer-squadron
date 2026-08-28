import { createServer } from 'node:http';
import { gzipSync, deflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8747);
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
const IMAGE_PATH = join(ROOT, 'assets', 'og', 'skyblazer_og.jpg');
const CARD_PATH = join(ROOT, 'social-card.html');
const INDEX_PATH = join(ROOT, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

// Meta-owned consumers are explicit: Facebook shares, Instagram in-app/DM fetches,
// and Meta's external preview agents all receive the small static card document.
const CRAWLER_RE = /Twitterbot|TwitterPreview|facebookexternalhit|Facebot|Instagram|InstagramBot|Meta-ExternalAgent|Meta-ExternalFetcher|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot|Line\/|LINE\/|Googlebot/i;
const TITLE = 'STAR FOX — SKYBLAZER SQUADRON';
const DESCRIPTION = '4つの戦闘ゾーン、16 Wave、6ボスに挑む3Dレールシューティング。仲間とともに戦術飛行で空域を奪還せよ。';

function getOrigin(req) {
  if (PUBLIC_ORIGIN) return PUBLIC_ORIGIN;
  const host = String(req.headers.host || 'localhost').replace(/[^a-zA-Z0-9.:[\]-]/g, '');
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const protocol = forwarded === 'https' || (!local && forwarded !== 'http') ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function socialMeta(origin) {
  const canonical = `${origin}/`;
  const image = `${origin}/api/og-image.jpg`;
  const escapedTitle = TITLE.replace(/&/g, '&amp;');
  const escapedDescription = DESCRIPTION.replace(/&/g, '&amp;');
  return `
<meta name="description" content="${escapedDescription}">
<meta name="keywords" content="3Dレールシューティング, ブラウザゲーム, Three.js, 宇宙戦闘, STAR FOX">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="STAR FOX — SKYBLAZER SQUADRON">
<meta property="og:title" content="${escapedTitle}">
<meta property="og:description" content="${escapedDescription}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="STAR FOX — SKYBLAZER SQUADRONの高速3D空中戦">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapedTitle}">
<meta name="twitter:description" content="${escapedDescription}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:src" content="${image}">
<meta name="twitter:image:alt" content="STAR FOX — SKYBLAZER SQUADRONの高速3D空中戦">
<meta name="twitter:domain" content="${origin.replace(/^https?:\/\//, '')}">`;
}

function renderSocialHtml(template, origin, normalPage = false) {
  const meta = socialMeta(origin);
  if (normalPage) return template.replace('<!-- SOCIAL_META: server.mjs injects absolute OGP and X Card tags for every HTML response. -->', meta);
  return template.replace('{{SOCIAL_META}}', meta);
}

function isCrawler(req) {
  return CRAWLER_RE.test(String(req.headers['user-agent'] || ''));
}

function write(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function writeHtml(req, res, status, headers, html) {
  const source = Buffer.from(html, 'utf8');
  const accept = String(req.headers['accept-encoding'] || '').toLowerCase();
  const vary = headers.Vary ? `${headers.Vary}, Accept-Encoding` : 'Accept-Encoding';
  if (accept.includes('gzip')) {
    const compressed = gzipSync(source);
    return write(res, status, { ...headers, Vary: vary, 'Content-Encoding': 'gzip', 'Content-Length': compressed.length }, compressed);
  }
  if (accept.includes('deflate')) {
    const compressed = deflateSync(source);
    return write(res, status, { ...headers, Vary: vary, 'Content-Encoding': 'deflate', 'Content-Length': compressed.length }, compressed);
  }
  return write(res, status, { ...headers, Vary: vary, 'Content-Length': source.length }, source);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://request.local');
    const pathname = decodeURIComponent(url.pathname);
    const origin = getOrigin(req);

    // Stable, same-origin, non-redirecting OGP image route. Its source asset is
    // deliberately served as image/jpeg rather than a storage or signed URL.
    if (pathname === '/api/og-image.jpg') {
      const data = await readFile(IMAGE_PATH);
      return write(res, 200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      }, data);
    }

    if (pathname === '/robots.txt') {
      return write(res, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      }, 'User-agent: *\nAllow: /\n');
    }

    // The root keeps the full Canvas game for people, but crawler user agents
    // receive a compact static document so they never have to parse game assets.
    if (pathname === '/') {
      if (isCrawler(req)) {
        const card = await readFile(CARD_PATH, 'utf8');
        return writeHtml(req, res, 200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          'X-Robots-Tag': 'all',
          'Vary': 'User-Agent',
        }, renderSocialHtml(card, origin));
      }
      const index = await readFile(INDEX_PATH, 'utf8');
      return writeHtml(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Robots-Tag': 'all',
        'Vary': 'User-Agent',
      }, renderSocialHtml(index, origin, true));
    }

    const file = normalize(join(ROOT, pathname));
    if (!file.startsWith(normalize(ROOT))) return write(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'forbidden');
    const data = await readFile(file);
    const ext = extname(file).toLowerCase();
    const cache = /\.(?:js|mjs|css|png|jpe?g|svg|woff2|ico|mp3|ogg|wav|glb|gltf|bin)$/i.test(file)
      ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
      : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
    return write(res, 200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    }, data);
  } catch {
    return write(res, 404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, 'not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`serving on http://0.0.0.0:${PORT}`));
