// Runtime adapter. The UI calls one interface; this module decides whether the
// work happens in the browser against api.github.com (Web App Mode) or on the
// local Node server (Local CLI Mode).

import {
  UNFOLLOW_DELAY_MS,
  MUTATION_DELAY_MS,
  AbortedError,
  getTokenStatus,
  analyzeUser,
  fetchRepos,
  unfollowUser,
  followUser,
  deleteRepo,
  setRepoArchived,
  checkRepoOwnership,
  runSerialBatch,
} from '../lib/github.js';
import {
  normalizeAllowlist,
  mergeAllowlistEntries,
  addToAllowlist,
  removeFromAllowlist,
} from '../lib/allowlist.js';
import { KEYS, local, session } from './storage.js';

// Unauthenticated browsers get 60 requests/hr per IP; refuse scans that would blow through it.
const MAX_UNAUTHENTICATED_CONNECTIONS = 2500;

export function getBrowserPat() {
  return session.get(KEYS.pat, '') || '';
}

export function setBrowserPat(token) {
  if (token) session.set(KEYS.pat, token);
  else session.remove(KEYS.pat);
}

export function loadLocalAllowlist() {
  return normalizeAllowlist(local.getJson(KEYS.allowlist, {}));
}

export function saveLocalAllowlist(allowlist) {
  local.setJson(KEYS.allowlist, allowlist);
}

async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (signal?.aborted) throw new AbortedError();
    throw new Error('Lost connection to the local server. Is `npx github-housekeeping` still running?');
  }
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
}

async function apiOrThrow(path, opts) {
  const { res, payload } = await api(path, opts);
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}

/** Detects whether the local CLI server is present. */
export async function detectMode() {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('application/json')) {
      return { mode: 'local-cli', status: await res.json() };
    }
  } catch {
    // no local server: web mode
  }
  return { mode: 'web-client', status: null };
}

const MUTATIONS = {
  unfollow: { endpoint: '/api/unfollow', field: 'usernames', key: 'login', delay: UNFOLLOW_DELAY_MS },
  follow: { endpoint: '/api/follow', field: 'usernames', key: 'login', delay: UNFOLLOW_DELAY_MS },
  delete: { endpoint: '/api/repos/delete', field: 'repos', key: 'fullName', delay: MUTATION_DELAY_MS },
  archive: { endpoint: '/api/repos/archive', field: 'repos', key: 'fullName', delay: MUTATION_DELAY_MS, extra: { archived: true } },
  unarchive: { endpoint: '/api/repos/archive', field: 'repos', key: 'fullName', delay: MUTATION_DELAY_MS, extra: { archived: false } },
};

export function createBackend(mode) {
  const isCli = mode === 'local-cli';

  async function status() {
    if (isCli) return apiOrThrow('/api/status');
    const token = getBrowserPat();
    const s = await getTokenStatus(token);
    return { mode: 'web-client', source: token ? 'browser-pat' : 'none', ...s };
  }

  async function setToken(token) {
    if (isCli) return apiOrThrow('/api/auth/token', { method: 'POST', body: { token } });
    setBrowserPat(token);
    return status();
  }

  async function analyze(username, { signal, onProgress, onRetry } = {}) {
    if (isCli) {
      return apiOrThrow(`/api/analyze?username=${encodeURIComponent(username)}`, { signal });
    }
    return analyzeUser(getBrowserPat(), username, {
      signal,
      onProgress,
      onRetry,
      allowlist: loadLocalAllowlist(),
      maxUnauthenticatedConnections: MAX_UNAUTHENTICATED_CONNECTIONS,
    });
  }

  async function repos(username, { isOwner, signal, onProgress, onRetry } = {}) {
    if (isCli) {
      return apiOrThrow(`/api/repos?username=${encodeURIComponent(username)}`, { signal });
    }
    return fetchRepos(getBrowserPat(), username, { isOwner, signal, onProgress, onRetry });
  }

  // Allowlist: disk in CLI mode (mirrored to localStorage), localStorage in web mode
  async function allowlistAdd(current, usernames) {
    let next;
    if (isCli) next = (await apiOrThrow('/api/allowlist', { method: 'POST', body: { usernames } })).allowlist;
    else next = addToAllowlist(current, usernames).allowlist;
    saveLocalAllowlist(next);
    return next;
  }

  async function allowlistRemove(current, usernames) {
    let next;
    if (isCli) next = (await apiOrThrow('/api/allowlist', { method: 'DELETE', body: { usernames } })).allowlist;
    else next = removeFromAllowlist(current, usernames);
    saveLocalAllowlist(next);
    return next;
  }

  async function allowlistImport(current, entries) {
    let next;
    if (isCli) next = (await apiOrThrow('/api/allowlist', { method: 'POST', body: { entries } })).allowlist;
    else next = mergeAllowlistEntries(current, entries);
    saveLocalAllowlist(next);
    return next;
  }

  /**
   * Runs a batch mutation one item at a time so progress is exact and the
   * Stop button takes effect between items.
   * kind: 'unfollow' | 'follow' | 'delete' | 'archive' | 'unarchive'
   * Returns { results: [{ item, ok, error?, code? }], aborted, stoppedForScope }.
   */
  async function mutate(kind, items, { signal, onProgress, onRetry, viewerLogin } = {}) {
    const spec = MUTATIONS[kind];
    if (!spec) throw new Error(`Unknown operation: ${kind}`);

    let worker;
    if (isCli) {
      worker = async (item) => {
        const { res, payload } = await api(spec.endpoint, {
          method: 'POST',
          signal,
          body: { [spec.field]: [item], ...spec.extra },
        });
        const first = payload.results?.[0];
        if (res.status === 401 || (res.status === 403 && payload.code)) {
          return { ok: false, code: 'MISSING_SCOPE', error: payload.error };
        }
        if (!res.ok) return { ok: false, error: payload.error || `HTTP ${res.status}` };
        if (payload.aborted && !first) throw new AbortedError();
        return first ? { ok: first.ok, error: first.error, skipped: first.skipped } : { ok: false, error: 'No result' };
      };
    } else {
      const token = getBrowserPat();
      if (!token) {
        return { results: [{ item: items[0], ok: false, code: 'MISSING_SCOPE', error: 'No token' }], aborted: false, stoppedForScope: true };
      }
      const opts = { signal, onRetry };
      worker = async (item) => {
        if (kind === 'unfollow') return unfollowUser(token, item, opts);
        if (kind === 'follow') return followUser(token, item, opts);
        const ownershipError = checkRepoOwnership(item, viewerLogin);
        if (ownershipError) return { ok: false, error: ownershipError, requested: false };
        if (kind === 'delete') return deleteRepo(token, item, opts);
        return setRepoArchived(token, item, kind === 'archive', opts);
      };
    }

    return runSerialBatch(items, worker, { delayMs: spec.delay, signal, onProgress });
  }

  return {
    mode,
    isCli,
    status,
    setToken,
    analyze,
    repos,
    allowlistAdd,
    allowlistRemove,
    allowlistImport,
    mutate,
  };
}
