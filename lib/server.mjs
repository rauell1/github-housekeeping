// Local CLI server. createAppServer() builds the HTTP server without starting
// it, so tests can run it on a random port with a fake GitHub fetch.
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  USERNAME_REGEX,
  UNFOLLOW_DELAY_MS,
  MUTATION_DELAY_MS,
  getTokenStatus,
  analyzeUser,
  fetchRepos,
  unfollowUser,
  followUser,
  deleteRepo,
  setRepoArchived,
  checkRepoOwnership,
  runSerialBatch,
} from '../public/lib/github.js';
import {
  normalizeAllowlist,
  mergeAllowlistEntries,
  addToAllowlist,
  removeFromAllowlist,
  isAllowlisted,
} from '../public/lib/allowlist.js';
import { isAllowedHost, isAllowedOrigin, resolveStaticPath, MIME_TYPES } from './server-utils.mjs';

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self'; img-src 'self' https://*.githubusercontent.com https://github.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none';",
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_BATCH_ITEMS = 500;
const VIEWER_CACHE_MS = 60_000;

export function getGhCliToken() {
  try {
    return (
      execFileSync('gh', ['auth', 'token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim() || ''
    );
  } catch {
    return '';
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

/** AbortSignal that fires if the browser disconnects (Stop button, closed tab). */
function clientDisconnectSignal(res) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

function summarize(batch, key) {
  const results = batch.results.map(({ item, ...rest }) => ({ [key]: item, ...rest }));
  return {
    results,
    succeeded: results.filter((r) => r.ok).map((r) => r[key]),
    failed: results.filter((r) => !r.ok),
    aborted: batch.aborted,
  };
}

export function createAppServer(options) {
  const {
    publicDir,
    allowlistFile,
    fetchImpl = globalThis.fetch,
    getDefaultToken = getGhCliToken,
    initialToken = '',
    userAgent = 'github-housekeeping',
    unfollowDelayMs = UNFOLLOW_DELAY_MS,
    mutationDelayMs = MUTATION_DELAY_MS,
    logger = console,
  } = options;

  let customPat = initialToken;
  const viewerCache = new Map(); // token -> { status, at }

  const dataDir = path.dirname(allowlistFile);
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const gh = (extra = {}) => ({ fetchImpl, userAgent, ...extra });

  function loadAllowlist() {
    try {
      if (!existsSync(allowlistFile)) return {};
      return normalizeAllowlist(JSON.parse(readFileSync(allowlistFile, 'utf8')));
    } catch {
      return {};
    }
  }

  function saveAllowlist(allowlist) {
    writeFileSync(allowlistFile, JSON.stringify(allowlist, null, 2), 'utf8');
  }

  function resolveAuthToken() {
    if (customPat) return { token: customPat, source: 'custom-pat' };
    const ghToken = getDefaultToken();
    if (ghToken) return { token: ghToken, source: 'gh-cli' };
    return { token: '', source: 'none' };
  }

  async function getStatus({ fresh = false } = {}) {
    const { token, source } = resolveAuthToken();
    const cached = viewerCache.get(token);
    let status;
    if (!fresh && cached && Date.now() - cached.at < VIEWER_CACHE_MS) {
      status = cached.status;
    } else {
      status = await getTokenStatus(token, gh());
      if (token && status.authenticated) viewerCache.set(token, { status, at: Date.now() });
    }
    return { mode: 'local-cli', source, ...status, allowlistPath: allowlistFile, token };
  }

  function publicStatus(status) {
    const { token, ...rest } = status;
    return rest;
  }

  function parseItems(body, field, validate) {
    const raw = Array.isArray(body[field]) ? body[field] : [];
    if (raw.length === 0) throw new HttpError(400, `No ${field} provided.`);
    if (raw.length > MAX_BATCH_ITEMS) throw new HttpError(400, `Too many ${field} (max ${MAX_BATCH_ITEMS}).`);
    return raw.map((v) => String(v ?? '').trim()).map((v) => ({ value: v, valid: validate(v) }));
  }

  async function requireToken(res, action) {
    const status = await getStatus();
    if (!status.token) {
      sendJson(res, 401, { error: `Authentication required to ${action}.`, code: 'NO_TOKEN' });
      return null;
    }
    if (!status.authenticated) {
      sendJson(res, 401, { error: 'Could not verify token ownership.', code: 'INVALID_TOKEN' });
      return null;
    }
    return status;
  }

  function scopeErrorResponse(res, summary, code, message) {
    const last = summary.failed[summary.failed.length - 1];
    sendJson(res, 403, { ...summary, error: last?.error ? `${message} (${last.error})` : message, code });
  }

  async function handleFollowBatch(req, res, kind) {
    const body = await readJsonBody(req);
    const items = parseItems(body, 'usernames', (v) => USERNAME_REGEX.test(v));
    const status = await requireToken(res, kind === 'unfollow' ? 'unfollow users' : 'follow users');
    if (!status) return;

    const allowlist = loadAllowlist();
    const forceAllowlisted = Boolean(body.forceAllowlisted);
    const signal = clientDisconnectSignal(res);
    const op = kind === 'unfollow' ? unfollowUser : followUser;

    const batch = await runSerialBatch(
      items,
      async ({ value, valid }) => {
        if (!valid) return { ok: false, error: 'Invalid username format', requested: false };
        if (kind === 'unfollow' && !forceAllowlisted && isAllowlisted(allowlist, value)) {
          return { ok: false, skipped: true, error: 'Protected by allowlist', requested: false };
        }
        return op(status.token, value, gh({ signal }));
      },
      { delayMs: unfollowDelayMs, signal }
    );
    const summary = summarize({ ...batch, results: batch.results.map((r) => ({ ...r, item: r.item.value })) }, 'login');
    if (batch.stoppedForScope) {
      return scopeErrorResponse(
        res,
        summary,
        'MISSING_FOLLOW_SCOPE',
        'Your GitHub token is missing the "user:follow" scope required to follow or unfollow users.'
      );
    }
    sendJson(res, 200, summary);
  }

  async function handleRepoBatch(req, res, kind) {
    const body = await readJsonBody(req);
    const items = parseItems(body, 'repos', () => true);
    const status = await requireToken(res, kind === 'delete' ? 'delete repositories' : 'archive repositories');
    if (!status) return;

    const archived = body.archived !== false;
    const signal = clientDisconnectSignal(res);
    const batch = await runSerialBatch(
      items,
      async ({ value }) => {
        const ownershipError = checkRepoOwnership(value, status.viewerLogin);
        if (ownershipError) return { ok: false, error: ownershipError, requested: false };
        return kind === 'delete'
          ? deleteRepo(status.token, value, gh({ signal }))
          : setRepoArchived(status.token, value, archived, gh({ signal }));
      },
      { delayMs: mutationDelayMs, signal }
    );
    const summary = summarize({ ...batch, results: batch.results.map((r) => ({ ...r, item: r.item.value })) }, 'fullName');
    if (batch.stoppedForScope) {
      return kind === 'delete'
        ? scopeErrorResponse(res, summary, 'MISSING_DELETE_REPO_SCOPE', 'Your GitHub token is missing the "delete_repo" scope required to delete repositories.')
        : scopeErrorResponse(res, summary, 'MISSING_REPO_SCOPE', 'Your GitHub token is missing the "repo" scope required to archive repositories.');
    }
    sendJson(res, 200, summary);
  }

  async function resolveUsername(parsedUrl) {
    let username = (parsedUrl.searchParams.get('username') || '').trim().replace(/^@/, '');
    if (!username) username = (await getStatus()).viewerLogin || '';
    return username;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const port = server.address()?.port;
      if (!isAllowedHost(req.headers.host, port)) {
        return sendText(res, 421, 'Misdirected request: unexpected Host header');
      }
      const isMutation = req.method !== 'GET' && req.method !== 'HEAD';
      if (isMutation && !isAllowedOrigin(req.headers.origin, port)) {
        return sendJson(res, 403, { error: 'Forbidden cross-origin request' });
      }

      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
      const { pathname } = parsedUrl;
      const route = `${req.method} ${pathname}`;

      switch (route) {
        case 'GET /api/status':
          return sendJson(res, 200, publicStatus(await getStatus({ fresh: true })));

        case 'POST /api/auth/token': {
          const body = await readJsonBody(req);
          customPat = typeof body.token === 'string' ? body.token.trim() : '';
          return sendJson(res, 200, publicStatus(await getStatus({ fresh: true })));
        }

        case 'GET /api/analyze': {
          const username = await resolveUsername(parsedUrl);
          if (!username) return sendJson(res, 400, { error: 'Please provide a GitHub username to analyze.' });
          const { token } = resolveAuthToken();
          const signal = clientDisconnectSignal(res);
          const result = await analyzeUser(token, username, gh({ signal, allowlist: loadAllowlist() }));
          return sendJson(res, 200, result);
        }

        case 'GET /api/repos': {
          const username = await resolveUsername(parsedUrl);
          if (!username) return sendJson(res, 400, { error: 'Please provide a GitHub username to list repositories.' });
          const status = await getStatus();
          const isOwner = Boolean(status.viewerLogin) && status.viewerLogin.toLowerCase() === username.toLowerCase();
          const signal = clientDisconnectSignal(res);
          return sendJson(res, 200, await fetchRepos(status.token, username, gh({ signal, isOwner })));
        }

        case 'GET /api/allowlist':
          return sendJson(res, 200, { allowlist: loadAllowlist() });

        case 'POST /api/allowlist': {
          const body = await readJsonBody(req);
          let next;
          if (body.entries && typeof body.entries === 'object') {
            next = mergeAllowlistEntries(loadAllowlist(), body.entries);
          } else {
            next = addToAllowlist(loadAllowlist(), body.usernames, body.note).allowlist;
          }
          saveAllowlist(next);
          return sendJson(res, 200, { allowlist: next });
        }

        case 'DELETE /api/allowlist': {
          const body = await readJsonBody(req);
          const next = removeFromAllowlist(loadAllowlist(), body.usernames);
          saveAllowlist(next);
          return sendJson(res, 200, { allowlist: next });
        }

        case 'POST /api/unfollow':
          return await handleFollowBatch(req, res, 'unfollow');
        case 'POST /api/follow':
          return await handleFollowBatch(req, res, 'follow');
        case 'POST /api/repos/delete':
          return await handleRepoBatch(req, res, 'delete');
        case 'POST /api/repos/archive':
          return await handleRepoBatch(req, res, 'archive');
        default:
          break;
      }

      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');

      const resolvedPath = resolveStaticPath(publicDir, pathname);
      if (!resolvedPath) return sendText(res, 403, 'Forbidden');
      try {
        const content = await fs.readFile(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch {
        sendText(res, 404, 'Not found');
      }
    } catch (err) {
      if (err?.code === 'ABORTED') {
        if (!res.destroyed) res.destroy();
        return;
      }
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) logger.error?.('Request failed:', err instanceof Error ? err.message : err);
      sendJson(res, status, { error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  return server;
}
