// Pure filtering, sorting and selection logic for users and repositories.

import { isAllowlisted } from './allowlist.js';

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const CREATOR_FOLLOWER_THRESHOLD = 1000;

export function isOlderThanAYear(dateStr, now = Date.now()) {
  if (!dateStr) return false;
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) return false;
  return now - ts > ONE_YEAR_MS;
}

export const isDormantUser = (user, now) => isOlderThanAYear(user?.updatedAt, now);
export const isDormantRepo = (repo, now) => isOlderThanAYear(repo?.pushedAt || repo?.updatedAt, now);

export function formatRelativeActivity(dateStr, now = Date.now()) {
  if (!dateStr) return null;
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) return null;
  const diffDays = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return { label: 'Active today', dormant: false };
  if (diffDays < 30) return { label: `Active ${diffDays}d ago`, dormant: false };
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return { label: `Active ${diffMonths}mo ago`, dormant: false };
  const diffYears = (diffDays / 365).toFixed(1).replace(/\.0$/, '');
  return { label: `💤 Dormant (${diffYears}yr)`, dormant: true };
}

const includesQ = (value, q) => Boolean(value) && String(value).toLowerCase().includes(q);

/** Base list for a follow tab before search/preset/sort. */
export function getUsersForTab(data, tab, allowlist, { includeAllowlisted = false } = {}) {
  if (!data) return [];
  switch (tab) {
    case 'non-followers':
      return includeAllowlisted
        ? [...data.nonFollowers]
        : data.nonFollowers.filter((u) => !isAllowlisted(allowlist, u.login));
    case 'allowlist':
      return buildAllowlistedUsers(data, allowlist);
    case 'mutuals':
      return [...data.mutuals];
    case 'fans':
      return [...data.fans];
    default:
      return [];
  }
}

/** Allowlist entries enriched with scan data when available. */
export function buildAllowlistedUsers(data, allowlist) {
  const known = new Map();
  for (const u of [...(data?.nonFollowers || []), ...(data?.mutuals || [])]) {
    known.set(u.login.toLowerCase(), u);
  }
  return Object.entries(allowlist || {}).map(([key, entry]) => {
    const found = known.get(key);
    if (found) return found;
    const login = entry.login || key;
    return {
      login,
      name: login,
      avatarUrl: `https://github.com/${encodeURIComponent(login)}.png`,
      url: `https://github.com/${encodeURIComponent(login)}`,
      bio: entry.note || 'On your allowlist',
      company: '',
      location: '',
      followersCount: null,
      followingCount: null,
      publicReposCount: null,
      followOrder: 99999,
      followsBack: false,
    };
  });
}

export function filterAndSortUsers(users, { query = '', preset = 'all', sortBy = 'order-asc', now = Date.now() } = {}) {
  let list = [...users];
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (u) =>
        includesQ(u.login, q) ||
        includesQ(u.name, q) ||
        includesQ(u.bio, q) ||
        includesQ(u.company, q) ||
        includesQ(u.location, q)
    );
  }

  if (preset === 'popular') {
    list = list.filter((u) => (u.followersCount ?? 0) >= CREATOR_FOLLOWER_THRESHOLD);
  } else if (preset === 'regular') {
    list = list.filter((u) => u.followersCount === null || u.followersCount === undefined || u.followersCount < CREATOR_FOLLOWER_THRESHOLD);
  } else if (preset === 'dormant') {
    list = list.filter((u) => isDormantUser(u, now));
  } else if (preset === 'zero-repos') {
    list = list.filter((u) => u.publicReposCount === 0);
  }

  const ts = (d) => (d ? Date.parse(d) : Number.MAX_SAFE_INTEGER);
  list.sort((a, b) => {
    switch (sortBy) {
      case 'order-asc':
        return (a.followOrder || 0) - (b.followOrder || 0);
      case 'order-desc':
        return (b.followOrder || 0) - (a.followOrder || 0);
      case 'followers-desc':
        return (b.followersCount ?? -1) - (a.followersCount ?? -1);
      case 'followers-asc':
        return (a.followersCount ?? Number.MAX_SAFE_INTEGER) - (b.followersCount ?? Number.MAX_SAFE_INTEGER);
      case 'activity-asc':
        return ts(a.updatedAt) - ts(b.updatedAt);
      case 'repos-asc':
        return (a.publicReposCount ?? Number.MAX_SAFE_INTEGER) - (b.publicReposCount ?? Number.MAX_SAFE_INTEGER);
      case 'login-asc':
        return a.login.localeCompare(b.login);
      default:
        return 0;
    }
  });
  return list;
}

export function filterAndSortRepos(repos, { query = '', preset = 'all', sortBy = 'pushed-desc', now = Date.now() } = {}) {
  let list = [...repos];
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) => includesQ(r.name, q) || includesQ(r.fullName, q) || includesQ(r.description, q) || includesQ(r.language, q)
    );
  }

  const presets = {
    forks: (r) => r.isFork,
    private: (r) => r.isPrivate,
    public: (r) => !r.isPrivate,
    archived: (r) => r.isArchived,
    active: (r) => !r.isArchived,
    dormant: (r) => isDormantRepo(r, now),
    'zero-stars': (r) => r.stargazersCount === 0,
  };
  if (presets[preset]) list = list.filter(presets[preset]);

  const ts = (d) => Date.parse(d || 0) || 0;
  list.sort((a, b) => {
    switch (sortBy) {
      case 'pushed-desc':
        return ts(b.pushedAt) - ts(a.pushedAt);
      case 'pushed-asc':
        return ts(a.pushedAt) - ts(b.pushedAt);
      case 'stars-asc':
        return a.stargazersCount - b.stargazersCount;
      case 'stars-desc':
        return b.stargazersCount - a.stargazersCount;
      case 'size-desc':
        return b.sizeKb - a.sizeKb;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
  return list;
}

export function getUnshieldedCreators(nonFollowers, allowlist) {
  return (nonFollowers || []).filter(
    (u) => !isAllowlisted(allowlist, u.login) && (u.followersCount ?? 0) >= CREATOR_FOLLOWER_THRESHOLD
  );
}

/**
 * Shift+Click range selection. Returns the ids between anchor and target
 * (inclusive) in visible order, or [target] if either is not visible.
 */
export function rangeBetween(visibleIds, anchor, target) {
  const a = visibleIds.indexOf(anchor);
  const b = visibleIds.indexOf(target);
  if (a === -1 || b === -1) return [target];
  const [from, to] = a < b ? [a, b] : [b, a];
  return visibleIds.slice(from, to + 1);
}

/** Followers diff between two snapshots (arrays of logins). */
export function diffFollowers(previous, current) {
  const prevSet = new Set(previous.map((l) => String(l).toLowerCase()));
  const currSet = new Set(current.map((l) => String(l).toLowerCase()));
  return {
    lost: previous.filter((l) => !currSet.has(String(l).toLowerCase())),
    gained: current.filter((l) => !prevSet.has(String(l).toLowerCase())),
  };
}
