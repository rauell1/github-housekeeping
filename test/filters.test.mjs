import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortUsers,
  filterAndSortRepos,
  getUsersForTab,
  buildAllowlistedUsers,
  getUnshieldedCreators,
  rangeBetween,
  diffFollowers,
  formatRelativeActivity,
  isDormantRepo,
} from '../public/lib/filters.js';

const NOW = Date.parse('2026-06-01T00:00:00Z');
const users = [
  { login: 'zed', name: 'Zed', followOrder: 1, followersCount: 5000, publicReposCount: 3, updatedAt: '2026-05-30T00:00:00Z', company: 'Acme' },
  { login: 'amy', name: 'Amy', followOrder: 2, followersCount: 10, publicReposCount: 0, updatedAt: '2024-01-01T00:00:00Z', location: 'Nairobi' },
  { login: 'bob', name: '', followOrder: 3, followersCount: null, publicReposCount: null, updatedAt: null },
];

test('filterAndSortUsers searches across fields', () => {
  assert.deepEqual(filterAndSortUsers(users, { query: 'nairobi' }).map((u) => u.login), ['amy']);
  assert.deepEqual(filterAndSortUsers(users, { query: 'ACME' }).map((u) => u.login), ['zed']);
});

test('filterAndSortUsers presets', () => {
  const ids = (preset) => filterAndSortUsers(users, { preset, now: NOW }).map((u) => u.login);
  assert.deepEqual(ids('popular'), ['zed']);
  assert.deepEqual(ids('regular'), ['amy', 'bob']);
  assert.deepEqual(ids('dormant'), ['amy']);
  assert.deepEqual(ids('zero-repos'), ['amy']);
});

test('filterAndSortUsers sorts and puts unknown values last', () => {
  const ids = (sortBy) => filterAndSortUsers(users, { sortBy }).map((u) => u.login);
  assert.deepEqual(ids('order-desc'), ['bob', 'amy', 'zed']);
  assert.deepEqual(ids('followers-desc'), ['zed', 'amy', 'bob']);
  assert.deepEqual(ids('followers-asc'), ['amy', 'zed', 'bob']);
  assert.deepEqual(ids('activity-asc'), ['amy', 'zed', 'bob']);
  assert.deepEqual(ids('login-asc'), ['amy', 'bob', 'zed']);
});

test('filterAndSortUsers does not mutate input', () => {
  const copy = [...users];
  filterAndSortUsers(users, { sortBy: 'login-asc' });
  assert.deepEqual(users, copy);
});

const repos = [
  { name: 'old', fullName: 'me/old', isFork: true, isPrivate: false, isArchived: true, stargazersCount: 0, sizeKb: 10, pushedAt: '2020-01-01T00:00:00Z', language: 'Go', description: '' },
  { name: 'new', fullName: 'me/new', isFork: false, isPrivate: true, isArchived: false, stargazersCount: 7, sizeKb: 999, pushedAt: '2026-05-01T00:00:00Z', language: 'Rust', description: 'shiny' },
];

test('filterAndSortRepos presets and search', () => {
  const ids = (opts) => filterAndSortRepos(repos, { now: NOW, ...opts }).map((r) => r.name);
  assert.deepEqual(ids({ preset: 'forks' }), ['old']);
  assert.deepEqual(ids({ preset: 'private' }), ['new']);
  assert.deepEqual(ids({ preset: 'archived' }), ['old']);
  assert.deepEqual(ids({ preset: 'active' }), ['new']);
  assert.deepEqual(ids({ preset: 'dormant' }), ['old']);
  assert.deepEqual(ids({ preset: 'zero-stars' }), ['old']);
  assert.deepEqual(ids({ query: 'shiny' }), ['new']);
  assert.deepEqual(ids({ sortBy: 'pushed-asc' }), ['old', 'new']);
  assert.deepEqual(ids({ sortBy: 'size-desc' }), ['new', 'old']);
});

test('getUsersForTab hides allowlisted non-followers unless asked', () => {
  const data = { nonFollowers: [{ login: 'A' }, { login: 'b' }], mutuals: [{ login: 'm' }], fans: [{ login: 'f' }] };
  const allow = { a: { login: 'A' } };
  assert.deepEqual(getUsersForTab(data, 'non-followers', allow).map((u) => u.login), ['b']);
  assert.deepEqual(getUsersForTab(data, 'non-followers', allow, { includeAllowlisted: true }).map((u) => u.login), ['A', 'b']);
  assert.deepEqual(getUsersForTab(data, 'fans', allow).map((u) => u.login), ['f']);
  assert.deepEqual(getUsersForTab(null, 'fans', allow), []);
});

test('buildAllowlistedUsers enriches known users and stubs unknown ones', () => {
  const data = { nonFollowers: [{ login: 'Known', followersCount: 3 }], mutuals: [] };
  const list = buildAllowlistedUsers(data, { known: { login: 'Known' }, ghost: { login: 'ghost', note: 'mentor' } });
  assert.equal(list[0].followersCount, 3);
  assert.equal(list[1].bio, 'mentor');
  assert.equal(list[1].url, 'https://github.com/ghost');
});

test('getUnshieldedCreators', () => {
  const list = getUnshieldedCreators(users, { zed: {} });
  assert.deepEqual(list, []);
  assert.deepEqual(getUnshieldedCreators(users, {}).map((u) => u.login), ['zed']);
});

test('rangeBetween selects inclusive ranges in either direction', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(rangeBetween(ids, 'b', 'd'), ['b', 'c', 'd']);
  assert.deepEqual(rangeBetween(ids, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(rangeBetween(ids, 'x', 'b'), ['b']);
});

test('diffFollowers is case-insensitive', () => {
  assert.deepEqual(diffFollowers(['A', 'b'], ['a', 'c']), { lost: ['b'], gained: ['c'] });
});

test('formatRelativeActivity and dormancy', () => {
  assert.equal(formatRelativeActivity(null), null);
  assert.equal(formatRelativeActivity('2026-05-31T12:00:00Z', NOW).label, 'Active today');
  assert.equal(formatRelativeActivity('2026-05-20T00:00:00Z', NOW).label, 'Active 12d ago');
  assert.equal(formatRelativeActivity('2024-06-01T00:00:00Z', NOW).dormant, true);
  assert.equal(isDormantRepo({ pushedAt: 'garbage' }, NOW), false);
});
