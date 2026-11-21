// Allowlist helpers shared by the browser and the local server.
// The allowlist is a plain object keyed by lowercase login:
//   { "octocat": { login: "octocat", note: "", addedAt: "2026-01-01T00:00:00.000Z" } }

import { USERNAME_REGEX } from './github.js';

export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_NOTE_LENGTH = 200;

function cleanLogin(raw) {
  const login = String(raw ?? '').trim().replace(/^@/, '');
  const lower = login.toLowerCase();
  if (!USERNAME_REGEX.test(login) || FORBIDDEN_KEYS.has(lower)) return null;
  return { login, lower };
}

function cleanNote(note) {
  return typeof note === 'string' ? note.slice(0, MAX_NOTE_LENGTH) : '';
}

function cleanDate(value, fallback) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

/** Returns a sanitized copy of an untrusted allowlist object (file, import, storage). */
export function normalizeAllowlist(raw, now = new Date().toISOString()) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, val] of Object.entries(raw)) {
    const parsed = cleanLogin(val?.login || key);
    if (!parsed) continue;
    out[parsed.lower] = {
      login: parsed.login,
      note: cleanNote(val?.note),
      addedAt: cleanDate(val?.addedAt, now),
    };
  }
  return out;
}

/** Merges imported entries into the current allowlist (imported values win). */
export function mergeAllowlistEntries(current, entries, now = new Date().toISOString()) {
  return { ...normalizeAllowlist(current, now), ...normalizeAllowlist(entries, now) };
}

/** Adds usernames, keeping any existing note and addedAt. */
export function addToAllowlist(current, usernames, note = '', now = new Date().toISOString()) {
  const next = normalizeAllowlist(current, now);
  const added = [];
  for (const raw of Array.isArray(usernames) ? usernames : []) {
    const parsed = cleanLogin(raw);
    if (!parsed) continue;
    const prev = next[parsed.lower];
    next[parsed.lower] = {
      login: parsed.login,
      note: cleanNote(note) || prev?.note || '',
      addedAt: prev?.addedAt || now,
    };
    added.push(parsed.login);
  }
  return { allowlist: next, added };
}

export function removeFromAllowlist(current, usernames) {
  const next = normalizeAllowlist(current);
  for (const raw of Array.isArray(usernames) ? usernames : []) {
    const key = String(raw ?? '').trim().replace(/^@/, '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(next, key)) delete next[key];
  }
  return next;
}

export function isAllowlisted(allowlist, login) {
  return Object.prototype.hasOwnProperty.call(allowlist || {}, String(login).toLowerCase());
}
