import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  githubFetch,
  getRetryDecision,
  readErrorMessage,
  runSerialBatch,
  unfollowUser,
  deleteRepo,
  setRepoArchived,
  checkRepoOwnership,
  categorizeConnections,
  analyzeUser,
  getTokenStatus,
  TimeoutError,
  AbortedError,
} from '../public/lib/github.js';
import { createFakeFetch, jsonResponse } from './helpers.mjs';

const FAST = { maxWaitMs: 5000 };

test('retries a 403 secondary rate limit using Retry-After', async () => {
  const retries = [];
  const fetchImpl = createFakeFetch([
    [
      'GET https://api.github.com/user',
      ({ n }) =>
        n === 0
          ? jsonResponse(403, { message: 'You have exceeded a secondary rate limit' }, { 'retry-after': '0' })
          : jsonResponse(200, { login: 'me' }),
    ],
  ]);
  const res = await githubFetch('https://api.github.com/user', { fetchImpl, onRetry: (r) => retries.push(r), ...FAST });
  assert.equal(res.status, 200);
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(retries[0].reason, 'secondary');
});

test('retries 429 and 502 responses', async () => {
  const fetchImpl = createFakeFetch([
    ['GET https://x/429', ({ n }) => (n === 0 ? jsonResponse(429, {}, { 'retry-after': '0' }) : jsonResponse(200, {}))],
  ]);
  assert.equal((await githubFetch('https://x/429', { fetchImpl })).status, 200);

  const decision = await getRetryDecision(jsonResponse(502, {}), 0);
  assert.deepEqual([decision.retry, decision.reason], [true, 'server']);
});

test('waits until x-ratelimit-reset when the primary limit is exhausted', async () => {
  const now = 1_700_000_000_000;
  const res = jsonResponse(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 30) });
  const d = await getRetryDecision(res, 0, now);
  assert.equal(d.retry, true);
  assert.equal(d.reason, 'primary');
  assert.equal(d.waitMs, 31_000);
});

test('does not wait longer than maxWaitMs; returns the failed response instead', async () => {
  const fetchImpl = createFakeFetch([
    ['GET https://x/', () => jsonResponse(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) })],
  ]);
  const res = await githubFetch('https://x/', { fetchImpl, maxWaitMs: 1000 });
  assert.equal(res.status, 403);
  assert.equal(fetchImpl.calls.length, 1);
});

test('a plain 403 permission error is not retried', async () => {
  const d = await getRetryDecision(jsonResponse(403, { message: 'Resource not accessible by integration' }), 0);
  assert.equal(d.retry, false);
});

test('gives up after maxRetries', async () => {
  const fetchImpl = createFakeFetch([['GET https://x/', () => jsonResponse(429, {}, { 'retry-after': '0' })]]);
  const res = await githubFetch('https://x/', { fetchImpl, maxRetries: 2 });
  assert.equal(res.status, 429);
  assert.equal(fetchImpl.calls.length, 3);
});

test('times out a hanging request', async () => {
  const hanging = (url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  await assert.rejects(
    githubFetch('https://x/', { fetchImpl: hanging, timeoutMs: 20, maxRetries: 0 }),
    (err) => err instanceof TimeoutError && err.code === 'TIMEOUT'
  );
});

test('a cancelled signal rejects with AbortedError, even mid-request', async () => {
  const controller = new AbortController();
  const hanging = (url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const p = githubFetch('https://x/', { fetchImpl: hanging, signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(p, AbortedError);
});

test('a cancelled signal interrupts a rate-limit wait', async () => {
  const controller = new AbortController();
  const fetchImpl = createFakeFetch([['GET https://x/', () => jsonResponse(429, {}, { 'retry-after': '30' })]]);
  const p = githubFetch('https://x/', { fetchImpl, signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  const started = Date.now();
  await assert.rejects(p, AbortedError);
  assert.ok(Date.now() - started < 2000);
});

test('readErrorMessage explains unauthenticated rate limits', async () => {
  const res = jsonResponse(403, { message: 'API rate limit exceeded for 1.2.3.4' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-limit': '60', 'x-ratelimit-reset': '1700000000' });
  assert.match(await readErrorMessage(res), /60 requests\/hr.*token/);
});

test('unfollowUser reports MISSING_SCOPE for classic tokens without user:follow', async () => {
  const fetchImpl = createFakeFetch([['DELETE https://api.github.com/user/following/bob', () => jsonResponse(404, { message: 'Not Found' }, { 'x-oauth-scopes': 'read:user' })]]);
  const r = await unfollowUser('ghp_test', 'bob', { fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'MISSING_SCOPE');
});

test('unfollowUser succeeds on 204', async () => {
  const fetchImpl = createFakeFetch([['DELETE https://api.github.com/user/following/bob', () => jsonResponse(204)]]);
  assert.deepEqual(await unfollowUser('ghp_test', 'bob', { fetchImpl }), { ok: true, status: 204 });
});

test('deleteRepo with a fine-grained token only reports MISSING_SCOPE on permission messages', async () => {
  const fetchImpl = createFakeFetch([
    ['DELETE https://api.github.com/repos/me/a', () => jsonResponse(403, { message: 'Resource not accessible by personal access token' })],
    ['DELETE https://api.github.com/repos/me/b', () => jsonResponse(404, { message: 'Not Found' })],
  ]);
  assert.equal((await deleteRepo('github_pat_x', 'me/a', { fetchImpl })).code, 'MISSING_SCOPE');
  const b = await deleteRepo('github_pat_x', 'me/b', { fetchImpl });
  assert.equal(b.code, undefined);
  assert.equal(b.error, 'Not Found');
});

test('setRepoArchived treats "already archived" as success', async () => {
  const fetchImpl = createFakeFetch([['PATCH https://api.github.com/repos/me/a', () => jsonResponse(403, { message: 'Repository was archived so is read-only.' }, { 'x-oauth-scopes': 'repo' })]]);
  const r = await setRepoArchived('ghp_x', 'me/a', true, { fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.alreadyArchived, true);
});

test('checkRepoOwnership blocks other owners and malformed names', () => {
  assert.equal(checkRepoOwnership('Me/repo', 'me'), null);
  assert.match(checkRepoOwnership('other/repo', 'me'), /Ownership check failed/);
  assert.equal(checkRepoOwnership('../etc/passwd', 'me'), 'Invalid repository name');
  assert.equal(checkRepoOwnership('me/repo/extra', 'me'), 'Invalid repository name');
  assert.match(checkRepoOwnership('me/repo', null), /Ownership/);
});

test('runSerialBatch paces, stops on MISSING_SCOPE, and honors abort', async () => {
  const seen = [];
  const out = await runSerialBatch(
    ['a', 'b', 'c'],
    async (item) => {
      seen.push(item);
      return item === 'b' ? { ok: false, code: 'MISSING_SCOPE' } : { ok: true };
    },
    { delayMs: 0 }
  );
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(out.stoppedForScope, true);

  const controller = new AbortController();
  const progress = [];
  const aborted = await runSerialBatch(
    ['a', 'b', 'c'],
    async (item) => {
      if (item === 'a') controller.abort();
      return { ok: true };
    },
    { delayMs: 50, signal: controller.signal, onProgress: (p) => progress.push(p.done) }
  );
  assert.equal(aborted.aborted, true);
  assert.equal(aborted.results.length, 1);
  assert.deepEqual(progress, [1]);
});

test('runSerialBatch records thrown errors and keeps going', async () => {
  const out = await runSerialBatch(['a', 'b'], async (item) => {
    if (item === 'a') throw new Error('boom');
    return { ok: true };
  }, { delayMs: 0 });
  assert.deepEqual(out.results.map((r) => r.ok), [false, true]);
  assert.equal(out.results[0].error, 'boom');
});

test('categorizeConnections splits non-followers, mutuals, and fans (case-insensitive)', () => {
  const following = [{ login: 'Alice' }, { login: 'bob' }];
  const followers = [{ login: 'alice' }, { login: 'carol' }];
  const { nonFollowers, mutuals, fans } = categorizeConnections(following, followers);
  assert.deepEqual(nonFollowers.map((u) => u.login), ['bob']);
  assert.deepEqual(mutuals.map((u) => u.login), ['Alice']);
  assert.deepEqual(fans.map((u) => u.login), ['carol']);
  assert.equal(nonFollowers[0].followOrder, 2);
});

test('analyzeUser (no token) uses REST pagination', async () => {
  const page = (n, prefix) => Array.from({ length: n }, (_, i) => ({ login: `${prefix}${i}`, avatar_url: '', html_url: '' }));
  const fetchImpl = createFakeFetch([
    ['GET https://api.github.com/users/me/following?per_page=100&page=1', () => jsonResponse(200, page(100, 'f'))],
    ['GET https://api.github.com/users/me/following?per_page=100&page=2', () => jsonResponse(200, page(5, 'g'))],
    ['GET https://api.github.com/users/me/followers?per_page=100&page=1', () => jsonResponse(200, [{ login: 'f0' }, { login: 'zed' }])],
    ['GET https://api.github.com/users/me', () => jsonResponse(200, { login: 'me', followers: 2, following: 105 })],
  ]);
  const result = await analyzeUser('', 'me', { fetchImpl });
  assert.equal(result.counts.following, 105);
  assert.equal(result.counts.mutuals, 1);
  assert.equal(result.counts.fans, 1);
  assert.equal(result.enriched, false);
});

test('analyzeUser refuses huge unauthenticated scans and invalid usernames', async () => {
  const fetchImpl = createFakeFetch([['GET https://api.github.com/users/big', () => jsonResponse(200, { login: 'big', followers: 5000, following: 10 })]]);
  await assert.rejects(analyzeUser('', 'big', { fetchImpl, maxUnauthenticatedConnections: 2500 }), /without a token/);
  await assert.rejects(analyzeUser('', 'bad name', { fetchImpl }), /Invalid GitHub username/);
});

test('getTokenStatus reads scopes', async () => {
  const fetchImpl = createFakeFetch([['GET https://api.github.com/user', () => jsonResponse(200, { login: 'me' }, { 'x-oauth-scopes': 'repo, user:follow' })]]);
  const s = await getTokenStatus('ghp_x', { fetchImpl });
  assert.equal(s.authenticated, true);
  assert.equal(s.hasFollowScope, true);
  assert.equal(s.hasRepoScope, true);
  assert.equal(s.hasDeleteRepoScope, false);
});
