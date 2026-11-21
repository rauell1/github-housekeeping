import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAllowlist, mergeAllowlistEntries, addToAllowlist, removeFromAllowlist, isAllowlisted } from '../public/lib/allowlist.js';

const NOW = '2026-01-01T00:00:00.000Z';

test('normalizeAllowlist drops invalid logins and prototype-pollution keys', () => {
  const raw = JSON.parse('{"__proto__": {"login": "__proto__"}, "constructor": {}, "Good-User": {"note": "keep"}, "bad user": {}, "-x": {}}');
  const out = normalizeAllowlist(raw, NOW);
  assert.deepEqual(Object.keys(out), ['good-user']);
  assert.equal(out['good-user'].login, 'Good-User');
  assert.equal(out['good-user'].note, 'keep');
  assert.equal(out['good-user'].addedAt, NOW);
  assert.equal({}.polluted, undefined);
});

test('normalizeAllowlist rejects non-objects and truncates notes', () => {
  assert.deepEqual(normalizeAllowlist(null), {});
  assert.deepEqual(normalizeAllowlist([1, 2]), {});
  assert.deepEqual(normalizeAllowlist('x'), {});
  const out = normalizeAllowlist({ a: { note: 'n'.repeat(500) } }, NOW);
  assert.equal(out.a.note.length, 200);
});

test('addToAllowlist keeps existing note and addedAt', () => {
  const current = { octocat: { login: 'octocat', note: 'mentor', addedAt: '2020-01-01T00:00:00.000Z' } };
  const { allowlist, added } = addToAllowlist(current, ['Octocat', '@torvalds', 'bad name'], '', NOW);
  assert.deepEqual(added, ['Octocat', 'torvalds']);
  assert.equal(allowlist.octocat.note, 'mentor');
  assert.equal(allowlist.octocat.addedAt, '2020-01-01T00:00:00.000Z');
  assert.equal(allowlist.torvalds.addedAt, NOW);
});

test('removeFromAllowlist is case-insensitive and ignores unknown keys', () => {
  const current = { octocat: { login: 'octocat', note: '', addedAt: NOW } };
  assert.deepEqual(removeFromAllowlist(current, ['OCTOCAT', '__proto__', 'nobody']), {});
});

test('mergeAllowlistEntries lets imported entries win', () => {
  const merged = mergeAllowlistEntries({ a: { login: 'a', note: 'old', addedAt: NOW } }, { A: { login: 'A', note: 'new' } }, NOW);
  assert.equal(merged.a.note, 'new');
});

test('isAllowlisted does not match inherited properties', () => {
  assert.equal(isAllowlisted({}, 'constructor'), false);
  assert.equal(isAllowlisted({ bob: {} }, 'Bob'), true);
});
