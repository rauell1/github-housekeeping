import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isAllowedHost, isAllowedOrigin, resolveStaticPath } from '../lib/server-utils.mjs';

test('isAllowedHost accepts only this local server (DNS rebinding guard)', () => {
  assert.equal(isAllowedHost('127.0.0.1:3847', 3847), true);
  assert.equal(isAllowedHost('localhost:3847', 3847), true);
  assert.equal(isAllowedHost('evil.example:3847', 3847), false);
  assert.equal(isAllowedHost('127.0.0.1:9999', 3847), false);
  assert.equal(isAllowedHost('127.0.0.1', 3847), false);
  assert.equal(isAllowedHost('', 3847), false);
  assert.equal(isAllowedHost(undefined, 3847), false);
});

test('isAllowedOrigin requires the exact local origin when Origin is sent', () => {
  assert.equal(isAllowedOrigin(undefined, 3847), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:3847', 3847), true);
  assert.equal(isAllowedOrigin('http://localhost:3847', 3847), true);
  assert.equal(isAllowedOrigin('http://localhost:5173', 3847), false);
  assert.equal(isAllowedOrigin('https://evil.example', 3847), false);
  assert.equal(isAllowedOrigin('null', 3847), false);
  assert.equal(isAllowedOrigin('https://127.0.0.1:3847', 3847), false);
});

test('resolveStaticPath blocks traversal', () => {
  const root = path.resolve('/srv/public');
  assert.equal(resolveStaticPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolveStaticPath(root, '/lib/github.js'), path.join(root, 'lib/github.js'));
  assert.equal(resolveStaticPath(root, '/../server.mjs'), null);
  assert.equal(resolveStaticPath(root, '/%2e%2e/server.mjs'), null);
  assert.equal(resolveStaticPath(root, '/a%00b'), null);
  assert.equal(resolveStaticPath(root, '/%E0%A4%A'), null);
});
