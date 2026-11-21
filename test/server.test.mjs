// Integration tests: real HTTP server on a random port, fake GitHub API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../lib/server.mjs';
import { createFakeFetch, jsonResponse } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server;
let port;
let tmpDir;
let fakeFetch;

const GH = 'https://api.github.com';

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghh-test-'));
  fs.writeFileSync(
    path.join(tmpDir, 'allowlist.json'),
    JSON.stringify({ protected: { login: 'Protected', note: '', addedAt: '2026-01-01T00:00:00.000Z' } })
  );
  fakeFetch = createFakeFetch([
    [`GET ${GH}/user`, () => jsonResponse(200, { login: 'me', name: 'Me' }, { 'x-oauth-scopes': 'user:follow, repo, delete_repo' })],
    [`DELETE ${GH}/user/following/`, () => jsonResponse(204)],
    [`PUT ${GH}/user/following/`, () => jsonResponse(204)],
    [`DELETE ${GH}/repos/me/`, () => jsonResponse(204)],
    [`PATCH ${GH}/repos/me/`, () => jsonResponse(200, { archived: true })],
  ]);
  server = createAppServer({
    publicDir: path.join(root, 'public'),
    allowlistFile: path.join(tmpDir, 'allowlist.json'),
    fetchImpl: fakeFetch,
    getDefaultToken: () => 'ghp_fake',
    unfollowDelayMs: 0,
    mutationDelayMs: 0,
    logger: { error() {} },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function request(method, urlPath, { body, headers = {} } = {}) {
  const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: urlPath,
        headers: {
          host: `127.0.0.1:${port}`,
          ...(payload !== undefined ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            // not JSON
          }
          resolve({ status: res.statusCode, headers: res.headers, json, text: data });
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

test('rejects requests with a foreign Host header (DNS rebinding)', async () => {
  const res = await request('GET', '/api/status', { headers: { host: 'evil.example' } });
  assert.equal(res.status, 421);
});

test('rejects cross-origin state changes (CSRF)', async () => {
  const res = await request('POST', '/api/unfollow', {
    body: { usernames: ['bob'] },
    headers: { origin: 'https://evil.example' },
  });
  assert.equal(res.status, 403);
  const other = await request('POST', '/api/auth/token', {
    body: { token: 'x' },
    headers: { origin: `http://localhost:${port + 1}` },
  });
  assert.equal(other.status, 403);
});

test('status never leaks the token', async () => {
  const res = await request('GET', '/api/status');
  assert.equal(res.status, 200);
  assert.equal(res.json.viewerLogin, 'me');
  assert.equal(res.json.hasDeleteRepoScope, true);
  assert.ok(!res.text.includes('ghp_fake'));
});

test('unfollow skips allowlisted and invalid users', async () => {
  const res = await request('POST', '/api/unfollow', {
    body: { usernames: ['bob', 'protected', 'bad name'] },
    headers: { origin: `http://127.0.0.1:${port}` },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.succeeded, ['bob']);
  const byLogin = Object.fromEntries(res.json.results.map((r) => [r.login, r]));
  assert.equal(byLogin.protected.skipped, true);
  assert.equal(byLogin['bad name'].error, 'Invalid username format');
  assert.ok(!fakeFetch.calls.some((c) => c.url.endsWith('/user/following/protected')));
});

test('follow (undo) endpoint re-follows users', async () => {
  const res = await request('POST', '/api/follow', { body: { usernames: ['bob'] } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.succeeded, ['bob']);
  assert.ok(fakeFetch.calls.some((c) => c.method === 'PUT' && c.url.endsWith('/user/following/bob')));
});

test('repo delete enforces ownership', async () => {
  const res = await request('POST', '/api/repos/delete', { body: { repos: ['me/old', 'someone/else', '../etc'] } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.succeeded, ['me/old']);
  assert.equal(res.json.failed.length, 2);
  assert.ok(!fakeFetch.calls.some((c) => c.url.includes('/repos/someone/')));
});

test('repo archive and unarchive send the archived flag', async () => {
  const res = await request('POST', '/api/repos/archive', { body: { repos: ['me/a'], archived: false } });
  assert.equal(res.status, 200);
  const call = fakeFetch.calls.filter((c) => c.method === 'PATCH').pop();
  assert.deepEqual(JSON.parse(call.init.body), { archived: false });
});

test('allowlist add/remove sanitizes input and persists to disk', async () => {
  let res = await request('POST', '/api/allowlist', { body: { usernames: ['NewOne', '__proto__', 'bad name'] } });
  assert.equal(res.status, 200);
  assert.ok(res.json.allowlist.newone);
  assert.ok(!Object.prototype.hasOwnProperty.call(res.json.allowlist, '__proto__'));
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'allowlist.json'), 'utf8'));
  assert.ok(onDisk.newone);

  res = await request('DELETE', '/api/allowlist', { body: { usernames: ['newone'] } });
  assert.ok(!res.json.allowlist.newone);
});

test('bad input returns 4xx, not 500', async () => {
  assert.equal((await request('POST', '/api/unfollow', { body: '{not json' })).status, 400);
  assert.equal((await request('POST', '/api/unfollow', { body: { usernames: [] } })).status, 400);
  const many = Array.from({ length: 501 }, (_, i) => `u${i}`);
  assert.equal((await request('POST', '/api/unfollow', { body: { usernames: many } })).status, 400);
  assert.equal((await request('GET', '/api/nope')).status, 404);
});

test('serves static files with security headers and blocks traversal', async () => {
  const res = await request('GET', '/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
  const lib = await request('GET', '/lib/github.js');
  assert.match(lib.headers['content-type'], /javascript/);
  // Encoded and raw dot segments must never escape public/
  for (const p of ['/%2e%2e/server.mjs', '/../server.mjs', '/..%2fserver.mjs', '/lib/..%2f..%2fserver.mjs']) {
    const r = await request('GET', p);
    assert.notEqual(r.status, 200, p);
    assert.ok(!r.text.includes('createAppServer'), p);
  }
});

test('missing scope stops the batch and reports what already succeeded', async () => {
  let n = 0;
  const scopedFetch = createFakeFetch([
    [`GET ${GH}/user`, () => jsonResponse(200, { login: 'me' }, { 'x-oauth-scopes': 'user:follow' })],
    [`DELETE ${GH}/repos/me/`, () => (n++ === 0 ? jsonResponse(204) : jsonResponse(403, { message: 'Must have admin rights' }, { 'x-oauth-scopes': 'user:follow' }))],
  ]);
  const s = createAppServer({
    publicDir: path.join(root, 'public'),
    allowlistFile: path.join(tmpDir, 'allowlist2.json'),
    fetchImpl: scopedFetch,
    getDefaultToken: () => 'ghp_fake2',
    mutationDelayMs: 0,
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  const res = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: p, method: 'POST', path: '/api/repos/delete', headers: { host: `127.0.0.1:${p}`, 'content-type': 'application/json' } },
      (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode, json: JSON.parse(d) }));
      }
    );
    req.on('error', reject);
    req.end(JSON.stringify({ repos: ['me/a', 'me/b', 'me/c'] }));
  });
  s.close();
  assert.equal(res.status, 403);
  assert.equal(res.json.code, 'MISSING_DELETE_REPO_SCOPE');
  assert.deepEqual(res.json.succeeded, ['me/a']);
  assert.equal(scopedFetch.calls.filter((c) => c.method === 'DELETE').length, 2);
});
