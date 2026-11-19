#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
GitHub Follow Housekeeping — Local CLI Mode

Usage:
  npx github-housekeeping [options]

Options:
  --port <number>   Port to bind (default: 3847)
  --open            Automatically open the dashboard in your default browser
  --help, -h        Show this help message
`);
  process.exit(0);
}

const portArgIdx = args.indexOf('--port');
const PORT = Number(
  (portArgIdx !== -1 && args[portArgIdx + 1]) || process.env.PORT || 3847
);
const AUTO_OPEN = args.includes('--open');
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Use local ./data/allowlist.json if inside the project repo, otherwise ~/.github-housekeeping/allowlist.json
const localDataDir = path.join(__dirname, 'data');
const homeDataDir = path.join(os.homedir(), '.github-housekeeping');
const DATA_DIR = existsSync(path.join(__dirname, '.git')) || existsSync(localDataDir)
  ? localDataDir
  : homeDataDir;
const ALLOWLIST_FILE = path.join(DATA_DIR, 'allowlist.json');

const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const UNFOLLOW_DELAY_MS = 300; // Serial pacing to respect GitHub secondary rate limits

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let customPat = process.env.GITHUB_TOKEN || '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadAllowlist() {
  try {
    if (!existsSync(ALLOWLIST_FILE)) {
      return {};
    }
    const raw = readFileSync(ALLOWLIST_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllowlist(allowlist) {
  writeFileSync(ALLOWLIST_FILE, JSON.stringify(allowlist, null, 2), 'utf8');
}

function getGhCliToken() {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
    return token || '';
  } catch {
    return '';
  }
}

function resolveAuthToken() {
  if (customPat) {
    return { token: customPat, source: 'custom-pat' };
  }
  const ghToken = getGhCliToken();
  if (ghToken) {
    return { token: ghToken, source: 'gh-cli' };
  }
  return { token: '', source: 'none' };
}

function buildGitHubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-housekeeping-dashboard/1.1',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchAuthStatus() {
  const { token, source } = resolveAuthToken();
  if (!token) {
    return {
      mode: 'local-cli',
      authenticated: false,
      source: 'none',
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
      rateLimit: null,
      allowlistPath: ALLOWLIST_FILE,
    };
  }

  const res = await fetch('https://api.github.com/user', {
    headers: buildGitHubHeaders(token),
  });

  if (!res.ok) {
    return {
      mode: 'local-cli',
      authenticated: false,
      source,
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
      error: `GitHub API returned ${res.status}`,
      allowlistPath: ALLOWLIST_FILE,
    };
  }

  const user = await res.json();
  const scopesHeader = res.headers.get('x-oauth-scopes') || '';
  const scopes = scopesHeader
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const isFineGrained = token.startsWith('github_pat_');
  const hasFollowScope =
    isFineGrained || scopes.includes('user') || scopes.includes('user:follow');

  const rateLimit = {
    limit: Number(res.headers.get('x-ratelimit-limit') || 0),
    remaining: Number(res.headers.get('x-ratelimit-remaining') || 0),
    reset: Number(res.headers.get('x-ratelimit-reset') || 0),
  };

  return {
    mode: 'local-cli',
    authenticated: true,
    source,
    viewerLogin: user.login,
    viewerName: user.name || user.login,
    viewerAvatar: user.avatar_url,
    scopes,
    isFineGrained,
    hasFollowScope,
    rateLimit,
    allowlistPath: ALLOWLIST_FILE,
  };
}

const USER_NODE_FIELDS = `
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

async function fetchGraphQLConnection(token, username, connectionName) {
  const items = [];
  let hasNextPage = true;
  let afterCursor = null;
  let pageCount = 0;

  while (hasNextPage && pageCount < 50) {
    pageCount++;
    const query = `
      query($login: String!, $after: String) {
        user(login: $login) {
          ${connectionName}(first: 100, after: $after) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ${USER_NODE_FIELDS}
            }
          }
        }
      }
    `;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        ...buildGitHubHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { login: username, after: afterCursor },
      }),
    });

    if (!res.ok) {
      throw new Error(`GraphQL HTTP error ${res.status}`);
    }

    const payload = await res.json();
    if (payload.errors && payload.errors.length > 0) {
      throw new Error(payload.errors[0].message || 'GraphQL error');
    }

    const conn = payload?.data?.user?.[connectionName];
    if (!conn) {
      throw new Error(`User '${username}' not found.`);
    }

    for (const node of conn.nodes || []) {
      if (!node || !node.login) continue;
      items.push({
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
      });
    }

    hasNextPage = Boolean(conn.pageInfo?.hasNextPage);
    afterCursor = conn.pageInfo?.endCursor || null;
  }

  return items;
}

async function fetchRestList(token, username, listType) {
  const items = [];
  let page = 1;
  while (page <= 50) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/${listType}?per_page=100&page=${page}`;
    const res = await fetch(url, { headers: buildGitHubHeaders(token) });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API returned ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const u of data) {
      items.push({
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
      });
    }
    if (data.length < 100) break;
    page++;
  }
  return items;
}

async function analyzeUser(username) {
  if (!GITHUB_USERNAME_REGEX.test(username)) {
    throw new Error('Invalid GitHub username format.');
  }

  const { token } = resolveAuthToken();

  const profileRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    { headers: buildGitHubHeaders(token) }
  );
  if (!profileRes.ok) {
    const errBody = await profileRes.json().catch(() => ({}));
    throw new Error(
      errBody.message || `Could not fetch user '${username}' (${profileRes.status})`
    );
  }
  const profileData = await profileRes.json();

  let following = [];
  let followers = [];
  let enriched = false;

  if (token) {
    try {
      [following, followers] = await Promise.all([
        fetchGraphQLConnection(token, username, 'following'),
        fetchGraphQLConnection(token, username, 'followers'),
      ]);
      enriched = true;
    } catch {
      [following, followers] = await Promise.all([
        fetchRestList(token, username, 'following'),
        fetchRestList(token, username, 'followers'),
      ]);
    }
  } else {
    [following, followers] = await Promise.all([
      fetchRestList('', username, 'following'),
      fetchRestList('', username, 'followers'),
    ]);
  }

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
    if (item.followsBack) {
      mutuals.push(item);
    } else {
      nonFollowers.push(item);
    }
  });

  const fans = followers
    .filter((u) => !followingSet.has(u.login.toLowerCase()))
    .map((user, index) => ({
      ...user,
      followOrder: index + 1,
      followsBack: true,
    }));

  const allowlist = loadAllowlist();

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

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > 2 * 1024 * 1024) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url]);
  } else if (platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/status' && req.method === 'GET') {
      const status = await fetchAuthStatus();
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/auth/token' && req.method === 'POST') {
      const body = await readJsonBody(req);
      customPat = typeof body.token === 'string' ? body.token.trim() : '';
      const status = await fetchAuthStatus();
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/analyze' && req.method === 'GET') {
      let username = (parsedUrl.searchParams.get('username') || '').trim();
      if (!username) {
        const status = await fetchAuthStatus();
        username = status.viewerLogin || '';
      }
      if (!username) {
        return sendJson(res, 400, {
          error: 'Please provide a GitHub username to analyze.',
        });
      }
      const result = await analyzeUser(username);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/allowlist' && req.method === 'GET') {
      return sendJson(res, 200, { allowlist: loadAllowlist() });
    }

    if (pathname === '/api/allowlist' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const current = loadAllowlist();
      const now = new Date().toISOString();

      if (body.entries && typeof body.entries === 'object') {
        for (const [key, val] of Object.entries(body.entries)) {
          const login = (val?.login || key || '').trim();
          if (GITHUB_USERNAME_REGEX.test(login)) {
            current[login.toLowerCase()] = {
              login,
              note: typeof val?.note === 'string' ? val.note.slice(0, 200) : '',
              addedAt: val?.addedAt || now,
            };
          }
        }
      } else if (Array.isArray(body.usernames)) {
        const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';
        for (const rawLogin of body.usernames) {
          const login = String(rawLogin || '').trim();
          if (GITHUB_USERNAME_REGEX.test(login)) {
            current[login.toLowerCase()] = {
              login,
              note: note || current[login.toLowerCase()]?.note || '',
              addedAt: current[login.toLowerCase()]?.addedAt || now,
            };
          }
        }
      }

      saveAllowlist(current);
      return sendJson(res, 200, { allowlist: current });
    }

    if (pathname === '/api/allowlist' && req.method === 'DELETE') {
      const body = await readJsonBody(req);
      const current = loadAllowlist();
      if (Array.isArray(body.usernames)) {
        for (const rawLogin of body.usernames) {
          const key = String(rawLogin || '').trim().toLowerCase();
          delete current[key];
        }
      }
      saveAllowlist(current);
      return sendJson(res, 200, { allowlist: current });
    }

    if (pathname === '/api/unfollow' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const usernames = Array.isArray(body.usernames) ? body.usernames : [];
      const forceAllowlisted = Boolean(body.forceAllowlisted);

      if (usernames.length === 0) {
        return sendJson(res, 400, { error: 'No usernames provided.' });
      }

      const { token } = resolveAuthToken();
      if (!token) {
        return sendJson(res, 401, {
          error: 'Authentication required to unfollow users.',
          code: 'NO_TOKEN',
        });
      }

      const allowlist = loadAllowlist();
      const results = [];

      for (let i = 0; i < usernames.length; i++) {
        const rawLogin = usernames[i];
        const login = String(rawLogin || '').trim();
        if (!GITHUB_USERNAME_REGEX.test(login)) {
          results.push({ login, ok: false, error: 'Invalid username format' });
          continue;
        }

        if (!forceAllowlisted && allowlist[login.toLowerCase()]) {
          results.push({
            login,
            ok: false,
            skipped: true,
            error: 'Protected by allowlist',
          });
          continue;
        }

        // Serial rate-limit pacing between state-changing DELETE requests
        if (i > 0) {
          await sleep(UNFOLLOW_DELAY_MS);
        }

        const unfollowRes = await fetch(
          `https://api.github.com/user/following/${encodeURIComponent(login)}`,
          {
            method: 'DELETE',
            headers: buildGitHubHeaders(token),
          }
        );

        if (unfollowRes.status === 204) {
          results.push({ login, ok: true });
        } else {
          const acceptedScopes = unfollowRes.headers.get('x-accepted-oauth-scopes') || '';
          const currentScopes = unfollowRes.headers.get('x-oauth-scopes') || '';
          const errBody = await unfollowRes.json().catch(() => ({}));

          const missingScope =
            (unfollowRes.status === 404 || unfollowRes.status === 403) &&
            !currentScopes.includes('user:follow') &&
            !currentScopes.includes('user');

          if (missingScope) {
            return sendJson(res, 403, {
              error:
                'Your current GitHub token is missing the "user:follow" scope required to unfollow users.',
              code: 'MISSING_FOLLOW_SCOPE',
              acceptedScopes,
              currentScopes,
              results,
            });
          }

          results.push({
            login,
            ok: false,
            error: errBody.message || `HTTP ${unfollowRes.status}`,
          });
        }
      }

      return sendJson(res, 200, {
        results,
        succeeded: results.filter((r) => r.ok).map((r) => r.login),
        failed: results.filter((r) => !r.ok),
      });
    }

    const safePath = pathname === '/' ? '/index.html' : pathname;
    const resolvedPath = path.resolve(PUBLIC_DIR, `.${safePath}`);
    if (!resolvedPath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    try {
      const content = await fs.readFile(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

function startServer(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${port} is already in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log(`\n🚀 GitHub Housekeeping Dashboard (Local CLI Mode) running at ${url}`);
    console.log(`📁 Allowlist storage: ${ALLOWLIST_FILE}\n`);
    if (AUTO_OPEN) {
      openBrowser(url);
    }
  });
}

startServer(PORT);
