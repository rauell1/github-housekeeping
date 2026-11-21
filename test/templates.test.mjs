import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userCardHtml, repoCardHtml, userChipHtml, repoChipHtml, diffChipHtml, getLanguageColor } from '../public/lib/templates.js';

const XSS = `"><img src=x onerror=alert(1)>`;

function assertNoInjection(html) {
  assert.ok(!/<img src=x/i.test(html), 'raw <img> tag injected');
  assert.ok(!/onerror=alert/i.test(html.replace(/onerror=alert\(1\)&gt;/g, '')), 'unescaped handler');
  assert.ok(!/javascript:/i.test(html), 'javascript: URL present');
}

const hostileUser = {
  login: 'evil',
  name: XSS,
  bio: XSS,
  company: XSS,
  location: XSS,
  avatarUrl: 'javascript:alert(1)',
  url: 'javascript:alert(1)',
  updatedAt: XSS,
  followersCount: XSS,
  followingCount: '<b>',
  publicReposCount: 1,
  followOrder: '<script>',
  followsBack: false,
};

test('userCardHtml escapes every user-controlled field', () => {
  for (const ctx of [
    { tab: 'non-followers', isOwner: true },
    { tab: 'non-followers', isOwner: false, viewerLogin: XSS, profileLogin: XSS },
    { tab: 'fans', isOwner: false },
    { tab: 'mutuals', isOwner: false, profileLogin: XSS },
  ]) {
    const html = userCardHtml(hostileUser, { ...ctx, selected: false, allowlisted: false, now: Date.now() });
    assertNoInjection(html);
    assert.ok(html.includes('&lt;img src=x'));
    assert.ok(!html.includes('<script>'));
  }
});

test('userCardHtml shows owner actions only to the owner', () => {
  const u = { login: 'bob', followsBack: false };
  assert.match(userCardHtml(u, { tab: 'non-followers', isOwner: true }), /data-action="unfollow-single"/);
  assert.doesNotMatch(userCardHtml(u, { tab: 'non-followers', isOwner: false, viewerLogin: 'me' }), /unfollow-single/);
  assert.match(userCardHtml(u, { tab: 'non-followers', isOwner: false }), /prompt-signin/);
});

test('repoCardHtml escapes repository fields', () => {
  const repo = {
    name: XSS,
    fullName: `me/${XSS}`,
    description: XSS,
    htmlUrl: 'javascript:alert(1)',
    language: XSS,
    stargazersCount: XSS,
    forksCount: 0,
    sizeKb: XSS,
    pushedAt: null,
    isPrivate: false,
  };
  for (const isOwner of [true, false]) {
    const html = repoCardHtml(repo, { isOwner, selected: true, now: Date.now() });
    assertNoInjection(html);
    assert.ok(html.includes('background-color:#8b949e'));
  }
});

test('chips escape names', () => {
  assertNoInjection(userChipHtml(XSS));
  assertNoInjection(repoChipHtml(XSS, { isPrivate: true, stargazersCount: XSS }));
  const diff = diffChipHtml(XSS, 'lost');
  assertNoInjection(diff);
  assert.ok(diff.includes('href="https://github.com/%22%3E%3Cimg'));
});

test('getLanguageColor ignores prototype keys', () => {
  assert.equal(getLanguageColor('Go'), '#00ADD8');
  assert.equal(getLanguageColor('constructor'), '#8b949e');
  assert.equal(getLanguageColor('__proto__'), '#8b949e');
});
