// Shared GitHub API layer used by BOTH the browser (Web App Mode) and the
// local Node.js server (Local CLI Mode). It must stay free of DOM and Node
// specific APIs so the same file runs in both places.

export const GITHUB_API = 'https://api.github.com';
export const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
export const REPO_FULLNAME_REGEX = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/;

// Serial pacing between state-changing requests (GitHub secondary rate limits)
export const UNFOLLOW_DELAY_MS = 300;
export const MUTATION_DELAY_MS = 350;

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_MAX_WAIT_MS = 90_000;
const MAX_PAGES = 50;

/** Error raised when the caller cancels an operation through an AbortSignal. */
export class AbortedError extends Error {
  constructor(message = 'Operation cancelled.') {
    super(message);
    this.name = 'AbortedError';
    this.code = 'ABORTED';
  }
}

/** Error raised when a single request takes longer than its timeout. */
export class TimeoutError extends Error {
  constructor(url, timeoutMs) {
    super(
      `GitHub did not respond within ${Math.round(timeoutMs / 1000)}s. Check your connection and try again.`
    );
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.url = url;
  }
}

export function isAbortError(err) {
  return err instanceof AbortedError || err?.code === 'ABORTED';
}

export function buildGitHubHeaders(token, { userAgent } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (userAgent) headers['User-Agent'] = userAgent;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Abortable sleep. Rejects with AbortedError when the signal fires. */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    function onAbort() {
      clearTimeout(timer);
      reject(new AbortedError());
    }
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

function backoffMs(attempt) {
  // 1s, 2s, 4s, 8s ... capped at 30s
  return Math.min(30_000, 1000 * 2 ** attempt);
}

/**
 * Decides whether a response should be retried and how long to wait first.
 * Returns { retry: false } or { retry: true, waitMs, reason }.
 *
 * Follows GitHub's guidance:
 *  - Retry-After header present: wait that many seconds.
 *  - x-ratelimit-remaining is 0: wait until x-ratelimit-reset.
 *  - 403/429 secondary limit without headers: wait at least one minute.
 *  - 502/503/504: exponential backoff.
 */
export async function getRetryDecision(res, attempt, now = Date.now()) {
  const status = res.status;

  if (status === 502 || status === 503 || status === 504) {
    return { retry: true, waitMs: backoffMs(attempt), reason: 'server' };
  }

  if (status !== 403 && status !== 429) {
    return { retry: false };
  }

  const retryAfter = res.headers.get('retry-after');
  if (retryAfter !== null && retryAfter !== '') {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return { retry: true, waitMs: seconds * 1000, reason: 'secondary' };
    }
  }

  if (res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0);
    const waitMs = reset > 0 ? Math.max(1000, reset * 1000 - now + 1000) : backoffMs(attempt);
    return { retry: true, waitMs, reason: 'primary', resetAt: reset > 0 ? reset * 1000 : null };
  }

  if (status === 429) {
    return { retry: true, waitMs: Math.max(60_000, backoffMs(attempt)), reason: 'secondary' };
  }

  // Plain 403: only a rate limit if the body says so (otherwise it is a permission error)
  const message = await res
    .clone()
    .json()
    .then((b) => String(b?.message || ''))
    .catch(() => '');
  if (/secondary rate limit|abuse/i.test(message)) {
    return { retry: true, waitMs: Math.max(60_000, backoffMs(attempt)), reason: 'secondary' };
  }

  return { retry: false };
}

/**
 * fetch() wrapper with a per-attempt timeout, user cancellation, and automatic
 * retries for GitHub rate limits and transient server errors.
 *
 * Resolves with the final Response (which may still be !ok, for example when a
 * rate-limit wait would exceed maxWaitMs). Rejects with TimeoutError or
 * AbortedError.
 */
export async function githubFetch(url, options = {}) {
  const {
    token = '',
    method = 'GET',
    body,
    headers: extraHeaders = {},
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    onRetry,
    fetchImpl = globalThis.fetch,
    userAgent,
    now = () => Date.now(),
  } = options;

  const headers = { ...buildGitHubHeaders(token, { userAgent }), ...extraHeaders };
  let payload = body;
  if (body !== undefined && typeof body !== 'string') {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new AbortedError();

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener?.('abort', onOuterAbort, { once: true });

    let res;
    try {
      res = await fetchImpl(url, { method, headers, body: payload, signal: controller.signal });
    } catch (err) {
      if (signal?.aborted) throw new AbortedError();
      if (timedOut) {
        if (attempt < maxRetries && method === 'GET') {
          await sleep(backoffMs(attempt), signal);
          continue;
        }
        throw new TimeoutError(url, timeoutMs);
      }
      // Network failure: retry idempotent reads only
      if (attempt < maxRetries && method === 'GET') {
        await sleep(backoffMs(attempt), signal);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onOuterAbort);
    }

    if (res.ok || attempt >= maxRetries) return res;

    const decision = await getRetryDecision(res, attempt, now());
    if (!decision.retry || decision.waitMs > maxWaitMs) return res;

    onRetry?.({ attempt: attempt + 1, waitMs: decision.waitMs, reason: decision.reason, status: res.status });
    await sleep(decision.waitMs, signal);
  }
}

/** Builds a human readable error message from a failed GitHub response. */
export async function readErrorMessage(res, fallback) {
  const body = await res
    .clone()
    .json()
    .catch(() => ({}));
  const message = String(body?.message || '');

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0);
    if (remaining === '0' || /rate limit/i.test(message)) {
      const when = reset > 0 ? ` It resets at ${new Date(reset * 1000).toLocaleTimeString()}.` : '';
      const unauth = res.headers.get('x-ratelimit-limit') === '60';
      return unauth
        ? `GitHub's public rate limit (60 requests/hr per IP) was reached.${when} Connect a free GitHub token to unlock 5,000 requests/hr.`
        : `GitHub API rate limit reached.${when}`;
    }
  }
  return message || fallback || `GitHub API returned ${res.status}`;
}

export function parseScopes(res) {
  return (res.headers.get('x-oauth-scopes') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readRateLimit(res) {
  return {
    limit: Number(res.headers.get('x-ratelimit-limit') || 0),
    remaining: Number(res.headers.get('x-ratelimit-remaining') || 0),
    reset: Number(res.headers.get('x-ratelimit-reset') || 0),
  };
}

export function isFineGrainedToken(token) {
  return String(token || '').startsWith('github_pat_');
}

/**
 * Verifies a token and reports the account and permissions behind it.
 * The caller adds mode/source fields.
 */
export async function getTokenStatus(token, opts = {}) {
  if (!token) {
    return {
      authenticated: false,
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
      hasRepoScope: false,
      hasDeleteRepoScope: false,
      rateLimit: null,
    };
  }

  const res = await githubFetch(`${GITHUB_API}/user`, { ...opts, token });
  if (!res.ok) {
    return {
      authenticated: false,
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
      hasRepoScope: false,
      hasDeleteRepoScope: false,
      rateLimit: readRateLimit(res),
      error: await readErrorMessage(res),
    };
  }

  const user = await res.json();
  const scopes = parseScopes(res);
  const isFineGrained = isFineGrainedToken(token);
  return {
    authenticated: true,
    viewerLogin: user.login,
    viewerName: user.name || user.login,
    viewerAvatar: user.avatar_url,
    scopes,
    isFineGrained,
    hasFollowScope: isFineGrained || scopes.includes('user') || scopes.includes('user:follow'),
    hasRepoScope: isFineGrained || scopes.includes('repo'),
    hasDeleteRepoScope: isFineGrained || scopes.includes('delete_repo'),
    rateLimit: readRateLimit(res),
  };
}

// ---------------------------------------------------------------------------
// Data mapping
// ---------------------------------------------------------------------------

export const USER_NODE_FIELDS = `
  login
  name
  avatarUrl
  url
  bio
  company
  location
  websiteUrl
  UpdatedAt: updatedAt
  followers { totalCount }
  following { totalCount }
  repositories(privacy: PUBLIC) { totalCount }
`;

export function mapGraphQLUser(node) {
  return {
    login: node.login,
    name: node.name || '',
    avatarUrl: node.avatarUrl || `https://github.com/${node.login}.png`,
    url: node.url || `https://github.com/${node.login}`,
    bio: node.bio || '',
    company: node.company || '',
    location: node.location || '',
    websiteUrl: node.websiteUrl || '',
    updatedAt: node.UpdatedAt || null,
    followersCount: node.followers?.totalCount ?? null,
    followingCount: node.following?.totalCount ?? null,
    publicReposCount: node.repositories?.totalCount ?? null,
  };
}

export function mapRestUser(u) {
  return {
    login: u.login,
    name: '',
    avatarUrl: u.avatar_url,
    url: u.html_url,
    bio: '',
    company: '',
    location: '',
    websiteUrl: '',
    updatedAt: null,
    followersCount: null,
    followingCount: null,
    publicReposCount: null,
  };
}

export function mapRepo(r, fallbackOwner = '') {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner?.login || fallbackOwner,
    htmlUrl: r.html_url,
    description: r.description || '',
    isPrivate: Boolean(r.private),
    isFork: Boolean(r.fork),
    isArchived: Boolean(r.archived),
    language: r.language || '',
    stargazersCount: Number(r.stargazers_count || 0),
    forksCount: Number(r.forks_count || 0),
    openIssuesCount: Number(r.open_issues_count || 0),
    sizeKb: Number(r.size || 0),
    pushedAt: r.pushed_at || r.updated_at || null,
    updatedAt: r.updated_at || null,
    createdAt: r.created_at || null,
  };
}

/** Splits following/followers into non-followers, mutuals and fans. */
export function categorizeConnections(following, followers) {
  const followerSet = new Set(followers.map((u) => u.login.toLowerCase()));
  const followingSet = new Set(following.map((u) => u.login.toLowerCase()));

  const nonFollowers = [];
  const mutuals = [];
  following.forEach((user, index) => {
    const item = {
      ...user,
      followOrder: index + 1,
      followsBack: followerSet.has(user.login.toLowerCase()),
    };
    (item.followsBack ? mutuals : nonFollowers).push(item);
  });

  const fans = followers
    .filter((u) => !followingSet.has(u.login.toLowerCase()))
    .map((user, index) => ({ ...user, followOrder: index + 1, followsBack: true }));

  return { nonFollowers, mutuals, fans };
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function fetchGraphQLConnection(token, username, connectionName, opts = {}) {
  const { onProgress } = opts;
  const items = [];
  let hasNextPage = true;
  let afterCursor = null;
  let pageCount = 0;

  const query = `
    query($login: String!, $after: String) {
      user(login: $login) {
        ${connectionName}(first: 100, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { ${USER_NODE_FIELDS} }
        }
      }
    }
  `;

  while (hasNextPage && pageCount < MAX_PAGES) {
    pageCount++;
    const res = await githubFetch(`${GITHUB_API}/graphql`, {
      ...opts,
      token,
      method: 'POST',
      body: { query, variables: { login: username, after: afterCursor } },
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `GraphQL HTTP error ${res.status}`));

    const payload = await res.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message || 'GraphQL error');

    const conn = payload?.data?.user?.[connectionName];
    if (!conn) throw new Error(`User '${username}' not found.`);

    for (const node of conn.nodes || []) {
      if (node?.login) items.push(mapGraphQLUser(node));
    }
    hasNextPage = Boolean(conn.pageInfo?.hasNextPage);
    afterCursor = conn.pageInfo?.endCursor || null;
    onProgress?.({ kind: connectionName, fetched: items.length, total: conn.totalCount ?? null });
  }
  return items;
}

export async function fetchRestList(token, username, listType, opts = {}) {
  const { onProgress } = opts;
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${GITHUB_API}/users/${encodeURIComponent(username)}/${listType}?per_page=100&page=${page}`;
    const res = await githubFetch(url, { ...opts, token });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const u of data) items.push(mapRestUser(u));
    onProgress?.({ kind: listType, fetched: items.length, total: null });
    if (data.length < 100) break;
  }
  return items;
}

/**
 * Full follow analysis for a user.
 * opts.maxUnauthenticatedConnections guards the 60 req/hr public limit.
 */
export async function analyzeUser(token, username, opts = {}) {
  if (!USERNAME_REGEX.test(username)) {
    throw new Error('Invalid GitHub username format.');
  }
  const { allowlist = {}, maxUnauthenticatedConnections = Infinity } = opts;

  const profileRes = await githubFetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, {
    ...opts,
    token,
  });
  if (!profileRes.ok) {
    throw new Error(
      await readErrorMessage(profileRes, `Could not fetch user '${username}' (${profileRes.status})`)
    );
  }
  const profileData = await profileRes.json();

  const totalConnections = Number(profileData.followers || 0) + Number(profileData.following || 0);
  if (!token && totalConnections > maxUnauthenticatedConnections) {
    throw new Error(
      `@${profileData.login} has ${totalConnections.toLocaleString()} combined followers/following. Scanning an account this large without a token would exhaust GitHub's 60 req/hr public limit. Connect a free GitHub token to scan large accounts.`
    );
  }

  let following;
  let followers;
  let enriched = false;
  if (token) {
    try {
      [following, followers] = await Promise.all([
        fetchGraphQLConnection(token, username, 'following', opts),
        fetchGraphQLConnection(token, username, 'followers', opts),
      ]);
      enriched = true;
    } catch (err) {
      if (isAbortError(err)) throw err;
      [following, followers] = await Promise.all([
        fetchRestList(token, username, 'following', opts),
        fetchRestList(token, username, 'followers', opts),
      ]);
    }
  } else {
    [following, followers] = await Promise.all([
      fetchRestList('', username, 'following', opts),
      fetchRestList('', username, 'followers', opts),
    ]);
  }

  const { nonFollowers, mutuals, fans } = categorizeConnections(following, followers);

  return {
    analyzedAt: new Date().toISOString(),
    enriched,
    profile: {
      login: profileData.login,
      name: profileData.name || profileData.login,
      avatarUrl: profileData.avatar_url,
      url: profileData.html_url,
      bio: profileData.bio || '',
      followersCount: profileData.followers,
      followingCount: profileData.following,
    },
    counts: {
      following: following.length,
      followers: followers.length,
      nonFollowers: nonFollowers.length,
      mutuals: mutuals.length,
      fans: fans.length,
    },
    nonFollowers,
    mutuals,
    fans,
    allowlist,
  };
}

/** Lists repositories owned by `username`. Private repos are included when isOwner. */
export async function fetchRepos(token, username, opts = {}) {
  if (!USERNAME_REGEX.test(username)) {
    throw new Error('Invalid GitHub username format.');
  }
  const { isOwner = false, onProgress } = opts;
  const repos = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const endpoint = isOwner
      ? `${GITHUB_API}/user/repos?per_page=100&affiliation=owner&sort=updated&page=${page}`
      : `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=updated&page=${page}`;
    const res = await githubFetch(endpoint, { ...opts, token });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) repos.push(mapRepo(r, username));
    onProgress?.({ kind: 'repositories', fetched: repos.length, total: null });
    if (batch.length < 100) break;
  }
  return { username, includesPrivate: Boolean(isOwner), count: repos.length, repos };
}

// ---------------------------------------------------------------------------
// Write operations. Each returns { ok, status, error?, code? } and never throws
// for HTTP errors. code 'MISSING_SCOPE' means the token lacks permission.
// ---------------------------------------------------------------------------

function lacksPermission(res, token, requiredScopes, message) {
  if (![401, 403, 404].includes(res.status)) return false;
  if (res.status === 401) return true;
  if (isFineGrainedToken(token)) {
    return /not accessible|permission/i.test(message);
  }
  const scopes = parseScopes(res);
  return !requiredScopes.some((s) => scopes.includes(s));
}

async function mutationResult(res, token, requiredScopes, successCheck) {
  if (successCheck(res)) return { ok: true, status: res.status };
  const error = await readErrorMessage(res);
  if (lacksPermission(res, token, requiredScopes, error)) {
    return { ok: false, status: res.status, error, code: 'MISSING_SCOPE' };
  }
  return { ok: false, status: res.status, error };
}

export async function unfollowUser(token, login, opts = {}) {
  const res = await githubFetch(`${GITHUB_API}/user/following/${encodeURIComponent(login)}`, {
    ...opts,
    token,
    method: 'DELETE',
  });
  return mutationResult(res, token, ['user', 'user:follow'], (r) => r.status === 204);
}

export async function followUser(token, login, opts = {}) {
  const res = await githubFetch(`${GITHUB_API}/user/following/${encodeURIComponent(login)}`, {
    ...opts,
    token,
    method: 'PUT',
    headers: { 'Content-Length': '0' },
  });
  return mutationResult(res, token, ['user', 'user:follow'], (r) => r.status === 204);
}

export async function deleteRepo(token, fullName, opts = {}) {
  const [owner, name] = fullName.split('/');
  const res = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    { ...opts, token, method: 'DELETE' }
  );
  return mutationResult(res, token, ['delete_repo'], (r) => r.status === 204);
}

export async function setRepoArchived(token, fullName, archived, opts = {}) {
  const [owner, name] = fullName.split('/');
  const res = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    { ...opts, token, method: 'PATCH', body: { archived } }
  );
  if (res.ok) return { ok: true, status: res.status, archived };
  const result = await mutationResult(res, token, ['repo'], () => false);
  // Archiving an already archived repo returns 403 "Repository was archived"
  if (archived && res.status === 403 && /archived/i.test(result.error || '')) {
    return { ok: true, status: res.status, archived: true, alreadyArchived: true };
  }
  return result;
}

/**
 * Ownership guard for repository mutations: only the token owner's own repos.
 * Returns null when allowed, or an error string.
 */
export function checkRepoOwnership(fullName, viewerLogin) {
  if (!REPO_FULLNAME_REGEX.test(String(fullName || ''))) return 'Invalid repository name';
  const owner = fullName.split('/')[0];
  if (!viewerLogin || owner.toLowerCase() !== String(viewerLogin).toLowerCase()) {
    return `Ownership check failed: only @${viewerLogin || 'the token owner'} can change their own repositories`;
  }
  return null;
}

/**
 * Runs `worker(item, index)` over items one at a time with a pause between
 * requests. Stops early when the signal aborts or a worker reports
 * code 'MISSING_SCOPE'.
 *
 * Returns { results, aborted, stoppedForScope }.
 */
export async function runSerialBatch(items, worker, opts = {}) {
  const { delayMs = MUTATION_DELAY_MS, signal, onProgress } = opts;
  const results = [];
  let aborted = false;
  let stoppedForScope = false;
  let didRequest = false;

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }
    try {
      if (didRequest && delayMs > 0) await sleep(delayMs, signal);
      const result = await worker(items[i], i);
      if (result?.requested !== false) didRequest = true;
      results.push({ item: items[i], ...result });
      if (result?.code === 'MISSING_SCOPE') {
        stoppedForScope = true;
        break;
      }
    } catch (err) {
      if (isAbortError(err)) {
        aborted = true;
        break;
      }
      didRequest = true;
      results.push({ item: items[i], ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    onProgress?.({ done: i + 1, total: items.length, results });
  }
  return { results, aborted, stoppedForScope };
}
