// Request guards for the local CLI server. Kept separate so they can be unit tested.
import path from 'node:path';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

/**
 * DNS-rebinding guard: the Host header must name this local server exactly
 * (127.0.0.1:<port> or localhost:<port>). A malicious site that rebinds its
 * domain to 127.0.0.1 still sends its own domain in Host, so it is rejected.
 */
export function isAllowedHost(hostHeader, port) {
  if (!hostHeader) return false;
  try {
    const parsed = new URL(`http://${hostHeader}`);
    const hostPort = parsed.port || '80';
    return LOCAL_HOSTNAMES.has(parsed.hostname) && hostPort === String(port);
  } catch {
    return false;
  }
}

/**
 * CSRF guard for state-changing requests. Browsers always send Origin on
 * cross-origin POST/DELETE, so a present Origin must be this exact server.
 * Requests without Origin come from non-browser local tools and are allowed.
 */
export function isAllowedOrigin(originHeader, port) {
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    return (
      parsed.protocol === 'http:' &&
      LOCAL_HOSTNAMES.has(parsed.hostname) &&
      (parsed.port || '80') === String(port)
    );
  } catch {
    return false;
  }
}

/** Resolves a URL path inside publicDir, or returns null for traversal attempts. */
export function resolveStaticPath(publicDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const safePath = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(publicDir, `.${safePath}`);
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) return null;
  return resolved;
}

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
