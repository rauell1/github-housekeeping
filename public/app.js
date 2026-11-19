const LOCAL_STORAGE_ALLOWLIST_KEY = 'gh_housekeeping_allowlist_v1';
const LOCAL_STORAGE_THEME_KEY = 'gh_housekeeping_theme_v1';
const SESSION_STORAGE_PAT_KEY = 'gh_housekeeping_pat_v1';
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const UNFOLLOW_DELAY_MS = 300;

const state = {
  runtimeMode: 'detecting', // 'local-cli' | 'web-client'
  theme: 'dark', // 'dark' | 'light'
  auth: null,
  data: null,
  allowlist: {},
  activeTab: 'non-followers', // 'non-followers' | 'allowlist' | 'mutuals' | 'fans'
  showAllowlistedInNonFollowers: false,
  searchQuery: '',
  preset: 'all', // 'all' | 'popular' | 'regular' | 'zero-repos'
  sortBy: 'order-asc',
  selectedLogins: new Set(),
  pendingUnfollowLogins: [],
};

const els = {
  scanForm: document.getElementById('scan-form'),
  usernameInput: document.getElementById('username-input'),
  scanBtn: document.getElementById('scan-btn'),
  modeBadgeBtn: document.getElementById('mode-badge-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeIcon: document.getElementById('theme-icon'),
  themeLabel: document.getElementById('theme-label'),
  guideBtn: document.getElementById('guide-btn'),
  authBtn: document.getElementById('auth-btn'),
  authDot: document.getElementById('auth-dot'),
  authLabel: document.getElementById('auth-label'),

  modesExplainer: document.getElementById('modes-explainer'),
  closeModesExplainer: document.getElementById('close-modes-explainer'),
  modeCardWeb: document.getElementById('mode-card-web'),
  modeCardCli: document.getElementById('mode-card-cli'),
  webActivePill: document.getElementById('web-active-pill'),
  cliActivePill: document.getElementById('cli-active-pill'),

  scopeBanner: document.getElementById('scope-banner'),
  scopeBadgeLabel: document.getElementById('scope-badge-label'),
  scopeBannerText: document.getElementById('scope-banner-text'),
  bannerCreateTokenLink: document.getElementById('banner-create-token-link'),
  copyGhCmdBtn: document.getElementById('copy-gh-cmd-btn'),
  openAuthModalBtn: document.getElementById('open-auth-modal-btn'),

  summarySection: document.getElementById('summary-section'),
  profileAvatar: document.getElementById('profile-avatar'),
  profileName: document.getElementById('profile-name'),
  profileLink: document.getElementById('profile-link'),
  scanModeChip: document.getElementById('scan-mode-chip'),
  ownershipChip: document.getElementById('ownership-chip'),
  switchToViewerBtn: document.getElementById('switch-to-viewer-btn'),
  profileBio: document.getElementById('profile-bio'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  exportAllowlistBtn: document.getElementById('export-allowlist-btn'),
  importAllowlistInput: document.getElementById('import-allowlist-input'),

  statActionable: document.getElementById('stat-actionable'),
  statNonFollowersTotal: document.getElementById('stat-nonfollowers-total'),
  statAllowlisted: document.getElementById('stat-allowlisted'),
  statAllowlistStorage: document.getElementById('stat-allowlist-storage'),
  statMutuals: document.getElementById('stat-mutuals'),
  statReciprocity: document.getElementById('stat-reciprocity'),
  statFans: document.getElementById('stat-fans'),
  statTotals: document.getElementById('stat-totals'),
  statCards: document.querySelectorAll('.stat-card'),

  controlsSection: document.getElementById('controls-section'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabCountNonFollowers: document.getElementById('tab-count-non-followers'),
  tabCountAllowlist: document.getElementById('tab-count-allowlist'),
  tabCountMutuals: document.getElementById('tab-count-mutuals'),
  tabCountFans: document.getElementById('tab-count-fans'),
  includeAllowlistedWrap: document.getElementById('include-allowlisted-wrap'),
  showAllowlistedCheckbox: document.getElementById('show-allowlisted-in-nonfollowers'),

  searchInput: document.getElementById('search-input'),
  presetBtns: document.querySelectorAll('.pill-btn'),
  sortSelect: document.getElementById('sort-select'),

  selectAllCheckbox: document.getElementById('select-all-checkbox'),
  selectionSummary: document.getElementById('selection-summary'),
  clearSelectionBtn: document.getElementById('clear-selection-btn'),
  batchAllowlistAddBtn: document.getElementById('batch-allowlist-add-btn'),
  batchAllowlistRemoveBtn: document.getElementById('batch-allowlist-remove-btn'),
  batchUnfollowBtn: document.getElementById('batch-unfollow-btn'),

  welcomeState: document.getElementById('welcome-state'),
  loadingState: document.getElementById('loading-state'),
  loadingText: document.getElementById('loading-text'),
  errorState: document.getElementById('error-state'),
  errorMessage: document.getElementById('error-message'),
  emptyState: document.getElementById('empty-state'),
  emptyTitle: document.getElementById('empty-title'),
  emptySubtitle: document.getElementById('empty-subtitle'),
  cardsGrid: document.getElementById('cards-grid'),

  // Unfollow Modal
  unfollowModal: document.getElementById('unfollow-modal'),
  unfollowModalTitle: document.getElementById('unfollow-modal-title'),
  unfollowModalDesc: document.getElementById('unfollow-modal-desc'),
  unfollowPreviewList: document.getElementById('unfollow-preview-list'),
  unfollowProgressWrap: document.getElementById('unfollow-progress-wrap'),
  unfollowProgressBar: document.getElementById('unfollow-progress-bar'),
  unfollowProgressText: document.getElementById('unfollow-progress-text'),
  unfollowModalError: document.getElementById('unfollow-modal-error'),
  closeUnfollowModal: document.getElementById('close-unfollow-modal'),
  cancelUnfollowBtn: document.getElementById('cancel-unfollow-btn'),
  confirmUnfollowBtn: document.getElementById('confirm-unfollow-btn'),

  // Auth Modal
  authModal: document.getElementById('auth-modal'),
  closeAuthModal: document.getElementById('close-auth-modal'),
  modalRuntimeMode: document.getElementById('modal-runtime-mode'),
  modalAuthSource: document.getElementById('modal-auth-source'),
  modalAuthUser: document.getElementById('modal-auth-user'),
  modalAuthScopes: document.getElementById('modal-auth-scopes'),
  modalFollowPerm: document.getElementById('modal-follow-perm'),
  modalCreateTokenLink: document.getElementById('modal-create-token-link'),
  modalGhCliSection: document.getElementById('modal-gh-cli-section'),
  modalPatHeading: document.getElementById('modal-pat-heading'),
  modalPatDesc: document.getElementById('modal-pat-desc'),
  modalCopyGhBtn: document.getElementById('modal-copy-gh-btn'),
  customPatInput: document.getElementById('custom-pat-input'),
  clearPatBtn: document.getElementById('clear-pat-btn'),
  savePatBtn: document.getElementById('save-pat-btn'),

  toastContainer: document.getElementById('toast-container'),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(num) {
  if (num === null || num === undefined) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3600);
}

// Theme Management (Dark + Light/White Mode)
function initTheme() {
  let saved = 'dark';
  try {
    saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY) || 'dark';
  } catch {
    // ignore
  }
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
  } catch {
    // ignore
  }
  if (theme === 'light') {
    els.themeIcon.textContent = '🌙';
    els.themeLabel.textContent = 'Dark';
  } else {
    els.themeIcon.textContent = '☀️';
    els.themeLabel.textContent = 'Light';
  }
}

// Build pre-filled GitHub Token creation URL tailored to the account entered
function updateTokenCreationLinks(targetUsername) {
  const cleanUser = (
    targetUsername ||
    state.data?.profile?.login ||
    els.usernameInput.value ||
    ''
  )
    .trim()
    .replace(/^@/, '');

  const description = cleanUser
    ? `GitHub Follow Housekeeping (@${cleanUser})`
    : 'GitHub Follow Housekeeping';

  const url = `https://github.com/settings/tokens/new?description=${encodeURIComponent(
    description
  )}&scopes=user:follow`;

  if (els.bannerCreateTokenLink) {
    els.bannerCreateTokenLink.href = url;
    els.bannerCreateTokenLink.textContent = cleanUser
      ? `1. Generate Token for @${cleanUser} ↗`
      : '1. Generate Token on GitHub ↗';
  }
  if (els.modalCreateTokenLink) {
    els.modalCreateTokenLink.href = url;
    els.modalCreateTokenLink.textContent = cleanUser
      ? `Open GitHub Token Generator for @${cleanUser} (Pre-filled) ↗`
      : 'Open GitHub Token Generator (Pre-filled) ↗';
  }
}

// Returns true ONLY when authenticated AND the scanned account belongs to the authenticated user
function isViewingOwnVerifiedAccount() {
  if (!state.auth?.authenticated || !state.auth?.viewerLogin || !state.data?.profile?.login) {
    return false;
  }
  return (
    state.auth.viewerLogin.toLowerCase() === state.data.profile.login.toLowerCase()
  );
}

function isAllowlisted(login) {
  return Boolean(state.allowlist[String(login).toLowerCase()]);
}

function loadLocalAllowlist() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ALLOWLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalAllowlist(allowlist) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ALLOWLIST_KEY, JSON.stringify(allowlist));
  } catch {
    // ignore
  }
}

function getBrowserPat() {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_PAT_KEY) || '';
  } catch {
    return '';
  }
}

function setBrowserPat(token) {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_STORAGE_PAT_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_PAT_KEY);
    }
  } catch {
    // ignore
  }
}

function buildGitHubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function checkWebClientAuthStatus() {
  const token = getBrowserPat();
  if (!token) {
    return {
      mode: 'web-client',
      authenticated: false,
      source: 'none',
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
    };
  }

  const res = await fetch('https://api.github.com/user', {
    headers: buildGitHubHeaders(token),
  });

  if (!res.ok) {
    return {
      mode: 'web-client',
      authenticated: false,
      source: 'browser-pat',
      viewerLogin: null,
      viewerName: null,
      viewerAvatar: null,
      scopes: [],
      hasFollowScope: false,
      error: `GitHub API returned ${res.status}`,
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

  return {
    mode: 'web-client',
    authenticated: true,
    source: 'browser-pat',
    viewerLogin: user.login,
    viewerName: user.name || user.login,
    viewerAvatar: user.avatar_url,
    scopes,
    isFineGrained,
    hasFollowScope,
  };
}

async function detectRuntimeAndAuth() {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const status = await res.json();
      state.runtimeMode = 'local-cli';
      state.auth = status;
      renderModeAndAuthUI();
      return status;
    }
  } catch {
    // Fallback to Web Client mode
  }

  state.runtimeMode = 'web-client';
  state.allowlist = loadLocalAllowlist();
  const status = await checkWebClientAuthStatus();
  state.auth = status;
  renderModeAndAuthUI();
  return status;
}

function renderModeAndAuthUI() {
  const isCli = state.runtimeMode === 'local-cli';
  const s = state.auth;
  updateTokenCreationLinks();

  if (isCli) {
    els.modeBadgeBtn.textContent = '💻 Local CLI Mode';
    els.modeBadgeBtn.className = 'mode-badge mode-cli';
    els.modeCardCli.classList.add('active-mode');
    els.modeCardWeb.classList.remove('active-mode');
    els.cliActivePill.classList.remove('hidden');
    els.webActivePill.classList.add('hidden');
    els.statAllowlistStorage.textContent = 'Saved to disk (allowlist.json)';
    els.modalRuntimeMode.textContent = '💻 Local CLI Server (127.0.0.1)';
    els.modalGhCliSection.classList.remove('hidden');
    els.clearPatBtn.textContent = 'Use Default (gh CLI)';
  } else {
    els.modeBadgeBtn.textContent = '🌐 Web App Mode';
    els.modeBadgeBtn.className = 'mode-badge mode-web';
    els.modeCardWeb.classList.add('active-mode');
    els.modeCardCli.classList.remove('active-mode');
    els.webActivePill.classList.remove('hidden');
    els.cliActivePill.classList.add('hidden');
    els.statAllowlistStorage.textContent = 'Saved in browser localStorage';
    els.modalRuntimeMode.textContent = '🌐 Web App Mode (Cloudflare Browser-Direct)';
    els.modalGhCliSection.classList.add('hidden');
    els.clearPatBtn.textContent = 'Clear Browser Token';
  }

  // Check if user is signed in AND whether they are viewing another user's profile
  const scannedLogin = state.data?.profile?.login;
  const viewingDifferentAccount =
    s?.authenticated &&
    s?.viewerLogin &&
    scannedLogin &&
    s.viewerLogin.toLowerCase() !== scannedLogin.toLowerCase();

  if (!s || !s.authenticated) {
    els.authDot.className = 'status-dot';
    els.authLabel.textContent = 'Sign In / Get Token';
    els.scopeBanner.classList.remove('hidden');
    els.scopeBadgeLabel.textContent = 'Public Read-Only View';
    els.bannerCreateTokenLink.classList.remove('hidden');
    els.copyGhCmdBtn.classList.toggle('hidden', !isCli);
    els.scopeBannerText.innerHTML =
      'Anyone can view public GitHub following lists, but <strong>unfollowing is locked</strong> until you verify account ownership with a token.';
  } else if (viewingDifferentAccount) {
    els.authDot.className = 'status-dot readonly';
    els.authLabel.textContent = `Signed in as @${s.viewerLogin}`;
    els.scopeBanner.classList.remove('hidden');
    els.scopeBadgeLabel.textContent = `Viewing @${escapeHtml(scannedLogin)} (Read-Only)`;
    els.bannerCreateTokenLink.classList.add('hidden');
    els.copyGhCmdBtn.classList.add('hidden');
    els.scopeBannerText.innerHTML = `You are signed in as <strong>@${escapeHtml(
      s.viewerLogin
    )}</strong>, so unfollowing is disabled while browsing <strong>@${escapeHtml(
      scannedLogin
    )}</strong>'s public profile.`;
  } else if (s.hasFollowScope) {
    els.authDot.className = 'status-dot online';
    const src =
      s.source === 'gh-cli'
        ? 'gh CLI'
        : s.source === 'browser-pat'
        ? 'Browser PAT'
        : 'PAT';
    els.authLabel.textContent = `@${s.viewerLogin} (${src} · Verified Owner)`;
    els.scopeBanner.classList.add('hidden');
  } else {
    els.authDot.className = 'status-dot readonly';
    const src =
      s.source === 'gh-cli'
        ? 'gh CLI'
        : s.source === 'browser-pat'
        ? 'Browser PAT'
        : 'PAT';
    els.authLabel.textContent = `@${s.viewerLogin} (${src} · Read-Only)`;
    els.scopeBanner.classList.remove('hidden');
    els.scopeBadgeLabel.textContent = 'Missing user:follow Permission';
    els.bannerCreateTokenLink.classList.remove('hidden');
    els.copyGhCmdBtn.classList.toggle('hidden', !isCli);
    els.scopeBannerText.innerHTML =
      'Your token is verified, but lacks the <code>user:follow</code> permission needed to unfollow users. Click <strong>1. Generate Token</strong> to create one with <code>user:follow</code> pre-selected.';
  }

  // Modal details
  if (s && s.authenticated) {
    els.modalAuthSource.textContent =
      s.source === 'gh-cli'
        ? 'GitHub CLI (gh auth)'
        : s.source === 'browser-pat'
        ? 'Browser Session Token (Client-Direct)'
        : 'Custom Personal Access Token';
    els.modalAuthUser.textContent = `@${s.viewerLogin} (${s.viewerName || ''})`;
    els.modalAuthScopes.textContent = s.isFineGrained
      ? 'Fine-grained PAT'
      : s.scopes && s.scopes.length > 0
      ? s.scopes.join(', ')
      : 'none';
    els.modalFollowPerm.textContent = s.hasFollowScope
      ? '✅ Enabled (Verified owner can unfollow)'
      : '⚠️ Missing user:follow scope (Read-only)';
  } else {
    els.modalAuthSource.textContent = 'None (Public Read-Only API)';
    els.modalAuthUser.textContent = 'Not signed in';
    els.modalAuthScopes.textContent = 'none';
    els.modalFollowPerm.textContent = '❌ Sign in with token to verify ownership & unfollow';
  }
}

// Client-Side Direct Analyzer (for Cloudflare Web App Mode)
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

async function fetchClientGraphQLConnection(token, username, connectionName) {
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

    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
    const payload = await res.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message);

    const conn = payload?.data?.user?.[connectionName];
    if (!conn) throw new Error(`User '${username}' not found.`);

    for (const node of conn.nodes || []) {
      if (!node?.login) continue;
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

async function fetchClientRestList(token, username, listType) {
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

async function analyzeUserClientDirect(username) {
  if (!GITHUB_USERNAME_REGEX.test(username)) {
    throw new Error('Invalid GitHub username format.');
  }

  const token = getBrowserPat();
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
        fetchClientGraphQLConnection(token, username, 'following'),
        fetchClientGraphQLConnection(token, username, 'followers'),
      ]);
      enriched = true;
    } catch {
      [following, followers] = await Promise.all([
        fetchClientRestList(token, username, 'following'),
        fetchClientRestList(token, username, 'followers'),
      ]);
    }
  } else {
    [following, followers] = await Promise.all([
      fetchClientRestList('', username, 'following'),
      fetchClientRestList('', username, 'followers'),
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

  const allowlist = loadLocalAllowlist();

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

async function scanAccount(username) {
  const cleanUser = (username || '').trim().replace(/^@/, '');
  if (!cleanUser) {
    els.welcomeState.classList.remove('hidden');
    return;
  }

  els.usernameInput.value = cleanUser;
  updateTokenCreationLinks(cleanUser);
  els.welcomeState.classList.add('hidden');
  els.scanBtn.disabled = true;
  els.scanBtn.textContent = 'Scanning...';
  els.loadingText.textContent = `Scanning @${cleanUser}'s following & followers...`;
  els.loadingState.classList.remove('hidden');
  els.errorState.classList.add('hidden');
  els.emptyState.classList.add('hidden');
  els.cardsGrid.innerHTML = '';

  try {
    let payload;
    if (state.runtimeMode === 'local-cli') {
      const res = await fetch(`/api/analyze?username=${encodeURIComponent(cleanUser)}`);
      payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
    } else {
      payload = await analyzeUserClientDirect(cleanUser);
    }

    state.data = payload;
    state.allowlist = payload.allowlist || {};
    saveLocalAllowlist(state.allowlist);
    state.selectedLogins.clear();

    els.summarySection.classList.remove('hidden');
    els.controlsSection.classList.remove('hidden');
    els.loadingState.classList.add('hidden');

    renderModeAndAuthUI();
    renderProfileAndStats();
    renderUserCards();
  } catch (err) {
    els.loadingState.classList.add('hidden');
    els.errorState.classList.remove('hidden');
    els.errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    els.scanBtn.disabled = false;
    els.scanBtn.textContent = 'Scan Account';
  }
}

function getAllowlistedUsersList() {
  if (!state.data) return [];
  const allFollowingMap = new Map();
  for (const u of state.data.nonFollowers) {
    allFollowingMap.set(u.login.toLowerCase(), u);
  }
  for (const u of state.data.mutuals) {
    allFollowingMap.set(u.login.toLowerCase(), u);
  }

  const list = [];
  for (const [key, entry] of Object.entries(state.allowlist)) {
    const found = allFollowingMap.get(key);
    if (found) {
      list.push(found);
    } else {
      list.push({
        login: entry.login || key,
        name: entry.login || key,
        avatarUrl: `https://github.com/${encodeURIComponent(entry.login || key)}.png`,
        url: `https://github.com/${encodeURIComponent(entry.login || key)}`,
        bio: entry.note || 'On your allowlist',
        company: '',
        location: '',
        followersCount: null,
        followingCount: null,
        publicReposCount: null,
        followOrder: 99999,
        followsBack: false,
      });
    }
  }
  return list;
}

function renderProfileAndStats() {
  if (!state.data) return;
  const { profile, nonFollowers, mutuals, fans, enriched } = state.data;

  els.profileAvatar.src = profile.avatarUrl;
  els.profileAvatar.alt = profile.login;
  els.profileName.textContent = profile.name || profile.login;
  els.profileLink.textContent = `@${profile.login} ↗`;
  els.profileLink.href = profile.url;
  els.profileBio.textContent = profile.bio || '';
  els.scanModeChip.textContent = enriched
    ? '⚡ Enriched GraphQL Scan'
    : 'Public REST Scan';

  const isOwner = isViewingOwnVerifiedAccount();
  if (isOwner) {
    els.ownershipChip.textContent = '✅ Verified Account Owner';
    els.ownershipChip.className = 'scan-chip chip-verified';
    els.switchToViewerBtn.classList.add('hidden');
  } else if (state.auth?.authenticated && state.auth?.viewerLogin) {
    els.ownershipChip.textContent = `👁 Read-Only (Not @${state.auth.viewerLogin})`;
    els.ownershipChip.className = 'scan-chip chip-foreign';
    els.switchToViewerBtn.textContent = `Switch to My Account (@${state.auth.viewerLogin})`;
    els.switchToViewerBtn.classList.remove('hidden');
  } else {
    els.ownershipChip.textContent = '👁 Public Read-Only View';
    els.ownershipChip.className = 'scan-chip chip-foreign';
    els.switchToViewerBtn.classList.add('hidden');
  }

  const totalNonFollowers = nonFollowers.length;
  const allowlistedNonFollowersCount = nonFollowers.filter((u) => isAllowlisted(u.login)).length;
  const actionableNonFollowersCount = totalNonFollowers - allowlistedNonFollowersCount;
  const totalAllowlistedCount = Object.keys(state.allowlist).length;
  const totalFollowing = totalNonFollowers + mutuals.length;
  const totalFollowers = mutuals.length + fans.length;
  const reciprocity =
    totalFollowing > 0 ? Math.round((mutuals.length / totalFollowing) * 100) : 0;

  els.statActionable.textContent = actionableNonFollowersCount.toLocaleString();
  els.statNonFollowersTotal.textContent =
    allowlistedNonFollowersCount > 0
      ? `${totalNonFollowers} total (${allowlistedNonFollowersCount} allowlisted)`
      : `${totalNonFollowers} total non-followers`;
  els.statAllowlisted.textContent = totalAllowlistedCount.toLocaleString();
  els.statMutuals.textContent = mutuals.length.toLocaleString();
  els.statReciprocity.textContent = `${reciprocity}% reciprocity rate`;
  els.statFans.textContent = fans.length.toLocaleString();
  els.statTotals.textContent = `${totalFollowing} Following · ${totalFollowers} Followers`;

  els.tabCountNonFollowers.textContent = state.showAllowlistedInNonFollowers
    ? totalNonFollowers
    : actionableNonFollowersCount;
  els.tabCountAllowlist.textContent = totalAllowlistedCount;
  els.tabCountMutuals.textContent = mutuals.length;
  els.tabCountFans.textContent = fans.length;

  els.statCards.forEach((card) => {
    card.classList.toggle('active', card.dataset.tab === state.activeTab);
  });
  els.tabBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
  });

  els.includeAllowlistedWrap.classList.toggle('hidden', state.activeTab !== 'non-followers');
  els.batchAllowlistRemoveBtn.classList.toggle('hidden', state.activeTab !== 'allowlist');
  els.batchAllowlistAddBtn.classList.toggle('hidden', state.activeTab === 'allowlist');
}

function getFilteredAndSortedUsers() {
  if (!state.data) return [];

  let base = [];
  if (state.activeTab === 'non-followers') {
    base = state.showAllowlistedInNonFollowers
      ? [...state.data.nonFollowers]
      : state.data.nonFollowers.filter((u) => !isAllowlisted(u.login));
  } else if (state.activeTab === 'allowlist') {
    base = getAllowlistedUsersList();
  } else if (state.activeTab === 'mutuals') {
    base = [...state.data.mutuals];
  } else if (state.activeTab === 'fans') {
    base = [...state.data.fans];
  }

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    base = base.filter((u) => {
      return (
        u.login.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.bio && u.bio.toLowerCase().includes(q)) ||
        (u.company && u.company.toLowerCase().includes(q)) ||
        (u.location && u.location.toLowerCase().includes(q))
      );
    });
  }

  if (state.preset === 'popular') {
    base = base.filter((u) => (u.followersCount ?? 0) >= 1000);
  } else if (state.preset === 'regular') {
    base = base.filter((u) => u.followersCount === null || u.followersCount < 1000);
  } else if (state.preset === 'zero-repos') {
    base = base.filter((u) => u.publicReposCount === 0);
  }

  base.sort((a, b) => {
    switch (state.sortBy) {
      case 'order-asc':
        return (a.followOrder || 0) - (b.followOrder || 0);
      case 'order-desc':
        return (b.followOrder || 0) - (a.followOrder || 0);
      case 'followers-desc':
        return (b.followersCount ?? -1) - (a.followersCount ?? -1);
      case 'followers-asc':
        return (a.followersCount ?? 999999999) - (b.followersCount ?? 999999999);
      case 'repos-asc':
        return (a.publicReposCount ?? 999999) - (b.publicReposCount ?? 999999);
      case 'login-asc':
        return a.login.localeCompare(b.login);
      default:
        return 0;
    }
  });

  return base;
}

function updateSelectionToolbar(visibleUsers) {
  const visibleLogins = visibleUsers.map((u) => u.login);
  const selectedCount = state.selectedLogins.size;
  const allVisibleSelected =
    visibleLogins.length > 0 && visibleLogins.every((login) => state.selectedLogins.has(login));

  els.selectAllCheckbox.checked = allVisibleSelected;
  els.selectAllCheckbox.indeterminate =
    !allVisibleSelected && visibleLogins.some((login) => state.selectedLogins.has(login));

  if (selectedCount > 0) {
    els.selectionSummary.textContent = `${selectedCount} selected (of ${visibleLogins.length} visible)`;
    els.clearSelectionBtn.classList.remove('hidden');
  } else {
    els.selectionSummary.textContent = `Select All Visible (${visibleLogins.length})`;
    els.clearSelectionBtn.classList.add('hidden');
  }

  document.querySelectorAll('.sel-count').forEach((el) => {
    el.textContent = String(selectedCount);
  });

  const isOwner = isViewingOwnVerifiedAccount();
  els.batchAllowlistAddBtn.disabled = selectedCount === 0;
  els.batchAllowlistRemoveBtn.disabled = selectedCount === 0;
  els.batchUnfollowBtn.disabled =
    selectedCount === 0 || state.activeTab === 'fans' || !isOwner;
  els.batchUnfollowBtn.title = !isOwner
    ? 'Sign in with a token matching this GitHub account to enable batch unfollowing'
    : '';
}

function renderUserCards() {
  if (!state.data) return;
  const visibleUsers = getFilteredAndSortedUsers();
  updateSelectionToolbar(visibleUsers);

  if (visibleUsers.length === 0) {
    els.cardsGrid.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    if (state.activeTab === 'non-followers' && state.data.nonFollowers.length > 0) {
      els.emptyTitle.textContent = 'All non-followers are either filtered out or on your Allowlist!';
      els.emptySubtitle.textContent =
        'Check the "Allowlist / Ignored" tab or adjust your search and filter pills above.';
    } else if (state.activeTab === 'allowlist') {
      els.emptyTitle.textContent = 'Your Allowlist is currently empty';
      els.emptySubtitle.textContent =
        'Click "Keep (Allowlist)" on any user card to protect them from housekeeping unfollows.';
    } else {
      els.emptyTitle.textContent = 'No users match this view';
      els.emptySubtitle.textContent = 'Try adjusting your search or filter settings.';
    }
    return;
  }

  els.emptyState.classList.add('hidden');
  const isOwner = isViewingOwnVerifiedAccount();
  const signedInAsDifferentUser =
    state.auth?.authenticated && state.auth?.viewerLogin && !isOwner;

  const html = visibleUsers
    .map((u) => {
      const loginEsc = escapeHtml(u.login);
      const nameEsc = escapeHtml(u.name || u.login);
      const bioEsc = escapeHtml(u.bio || '');
      const companyEsc = escapeHtml(u.company || '');
      const locationEsc = escapeHtml(u.location || '');
      const avatarEsc = escapeHtml(u.avatarUrl);
      const urlEsc = escapeHtml(u.url);
      const isSel = state.selectedLogins.has(u.login);
      const allowlisted = isAllowlisted(u.login);

      let statusBadge = '';
      if (allowlisted) {
        statusBadge = `<span class="badge badge-allowlisted">🛡 Allowlisted</span>`;
      } else if (!u.followsBack) {
        statusBadge = `<span class="badge badge-nonfollower">Not following back</span>`;
      } else {
        statusBadge = `<span class="badge badge-mutual">Follows back</span>`;
      }

      const orderBadge =
        u.followOrder && u.followOrder < 99999
          ? `<span class="badge badge-order" title="Order in list">#${u.followOrder}</span>`
          : '';

      const metaParts = [];
      if (companyEsc) metaParts.push(`<span>🏢 ${companyEsc}</span>`);
      if (locationEsc) metaParts.push(`<span>📍 ${locationEsc}</span>`);

      let actionButtonHtml = '';
      if (state.activeTab === 'fans') {
        actionButtonHtml = `<a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">View Profile ↗</a>`;
      } else if (isOwner) {
        actionButtonHtml = `
          <button
            type="button"
            class="btn btn-sm btn-danger"
            data-action="unfollow-single"
            data-login="${loginEsc}"
          >
            Unfollow
          </button>`;
      } else if (signedInAsDifferentUser) {
        actionButtonHtml = `
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            disabled
            title="You are signed in as @${escapeHtml(
              state.auth.viewerLogin
            )}. You cannot unfollow on behalf of @${escapeHtml(state.data.profile.login)}."
          >
            🔒 Not Your Account
          </button>`;
      } else {
        actionButtonHtml = `
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            data-action="prompt-signin"
            title="Verify ownership of @${escapeHtml(
              state.data.profile.login
            )} with a token to enable unfollowing"
          >
            🔑 Sign in to Unfollow
          </button>`;
      }

      return `
        <article class="user-card ${isSel ? 'selected' : ''} ${allowlisted ? 'allowlisted' : ''}" data-login="${loginEsc}">
          <div>
            <div class="card-top">
              <div class="card-check-wrap">
                <input
                  type="checkbox"
                  class="card-checkbox"
                  data-action="toggle-select"
                  data-login="${loginEsc}"
                  ${isSel ? 'checked' : ''}
                  aria-label="Select ${loginEsc}"
                />
              </div>
              <img class="card-avatar" src="${avatarEsc}" alt="${loginEsc}" loading="lazy" />
              <div class="card-identity">
                <div class="card-title-row">
                  <span class="card-name" title="${nameEsc}">${nameEsc}</span>
                  ${orderBadge}
                </div>
                <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="card-handle">@${loginEsc} ↗</a>
                <div class="card-badges">
                  ${statusBadge}
                </div>
              </div>
            </div>

            ${bioEsc ? `<p class="card-bio" style="margin-top:10px;" title="${bioEsc}">${bioEsc}</p>` : ''}
            ${
              metaParts.length > 0
                ? `<div class="card-meta-tags" style="margin-top:8px;">${metaParts.join('')}</div>`
                : ''
            }
          </div>

          <div>
            <div class="card-metrics" style="margin-bottom:10px;">
              <div class="metric-item">
                <span class="metric-val">${formatCount(u.followersCount)}</span>
                <span class="metric-lbl">Followers</span>
              </div>
              <div class="metric-item">
                <span class="metric-val">${formatCount(u.followingCount)}</span>
                <span class="metric-lbl">Following</span>
              </div>
              <div class="metric-item">
                <span class="metric-val">${formatCount(u.publicReposCount)}</span>
                <span class="metric-lbl">Repos</span>
              </div>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="btn btn-sm btn-shield ${allowlisted ? 'active' : ''}"
                data-action="toggle-allowlist"
                data-login="${loginEsc}"
                title="${allowlisted ? 'Remove from Allowlist' : 'Keep / Add to Allowlist'}"
              >
                ${allowlisted ? '🛡 Kept (Remove)' : '🛡 Keep (Allowlist)'}
              </button>
              ${actionButtonHtml}
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  els.cardsGrid.innerHTML = html;
}

async function addToAllowlist(usernames) {
  if (!usernames || usernames.length === 0) return;

  if (state.runtimeMode === 'local-cli') {
    const res = await fetch('/api/allowlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames }),
    });
    const data = await res.json();
    if (res.ok) {
      state.allowlist = data.allowlist || {};
    }
  } else {
    const now = new Date().toISOString();
    for (const rawLogin of usernames) {
      const login = String(rawLogin || '').trim();
      if (GITHUB_USERNAME_REGEX.test(login)) {
        state.allowlist[login.toLowerCase()] = {
          login,
          note: state.allowlist[login.toLowerCase()]?.note || '',
          addedAt: state.allowlist[login.toLowerCase()]?.addedAt || now,
        };
      }
    }
  }

  saveLocalAllowlist(state.allowlist);
  usernames.forEach((u) => state.selectedLogins.delete(u));
  renderProfileAndStats();
  renderUserCards();
  showToast(`Added ${usernames.length} user${usernames.length === 1 ? '' : 's'} to Allowlist`);
}

async function removeFromAllowlist(usernames) {
  if (!usernames || usernames.length === 0) return;

  if (state.runtimeMode === 'local-cli') {
    const res = await fetch('/api/allowlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames }),
    });
    const data = await res.json();
    if (res.ok) {
      state.allowlist = data.allowlist || {};
    }
  } else {
    for (const rawLogin of usernames) {
      delete state.allowlist[String(rawLogin || '').trim().toLowerCase()];
    }
  }

  saveLocalAllowlist(state.allowlist);
  usernames.forEach((u) => state.selectedLogins.delete(u));
  renderProfileAndStats();
  renderUserCards();
  showToast(
    `Removed ${usernames.length} user${usernames.length === 1 ? '' : 's'} from Allowlist`
  );
}

function openUnfollowModal(usernames) {
  if (!isViewingOwnVerifiedAccount()) {
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
    return;
  }

  const actionable = usernames.filter((u) => !isAllowlisted(u));
  const skippedCount = usernames.length - actionable.length;

  if (actionable.length === 0) {
    showToast(
      'Selected user(s) are protected by your Allowlist. Remove them from Allowlist first to unfollow.',
      'error'
    );
    return;
  }

  state.pendingUnfollowLogins = actionable;
  els.unfollowModalTitle.textContent = `Confirm Unfollow (${actionable.length} user${
    actionable.length === 1 ? '' : 's'
  })`;
  els.unfollowModalDesc.textContent =
    skippedCount > 0
      ? `You are about to unfollow ${actionable.length} user(s) from @${state.auth.viewerLogin}. (${skippedCount} allowlisted user(s) were automatically excluded.)`
      : `You are about to unfollow ${actionable.length} GitHub user${
          actionable.length === 1 ? '' : 's'
        } from @${state.auth.viewerLogin}. Requests are paced serially (300ms apart) to respect GitHub rate limits.`;

  els.unfollowPreviewList.innerHTML = actionable
    .map((login) => `<span class="preview-chip">@${escapeHtml(login)}</span>`)
    .join('');

  els.unfollowProgressWrap.classList.add('hidden');
  els.unfollowModalError.classList.add('hidden');
  els.confirmUnfollowBtn.disabled = false;
  els.confirmUnfollowBtn.textContent = `Unfollow ${actionable.length} User${
    actionable.length === 1 ? '' : 's'
  }`;
  els.unfollowModal.classList.remove('hidden');
}

function closeUnfollowModal() {
  els.unfollowModal.classList.add('hidden');
  state.pendingUnfollowLogins = [];
}

function showMissingScopeErrorInModal() {
  const isCli = state.runtimeMode === 'local-cli';
  els.unfollowProgressWrap.classList.add('hidden');
  els.unfollowModalError.classList.remove('hidden');
  els.unfollowModalError.innerHTML = isCli
    ? `<strong>Missing <code>user:follow</code> permission scope.</strong><br/>
       Run <code>gh auth refresh -h github.com -s user:follow</code> in your terminal or click
       <button type="button" id="inline-open-auth-btn" class="btn-link">Auth Settings</button> to generate a token in 1 click.`
    : `<strong>Authentication with <code>user:follow</code> scope required.</strong><br/>
       Click <button type="button" id="inline-open-auth-btn" class="btn-link">Easy Token Creator</button> to generate a token with <code>user:follow</code> pre-selected.`;

  const inlineBtn = document.getElementById('inline-open-auth-btn');
  if (inlineBtn) {
    inlineBtn.addEventListener('click', () => {
      closeUnfollowModal();
      updateTokenCreationLinks();
      els.authModal.classList.remove('hidden');
    });
  }
  els.confirmUnfollowBtn.disabled = false;
}

async function executePendingUnfollow() {
  const logins = [...state.pendingUnfollowLogins];
  if (logins.length === 0) return;

  els.confirmUnfollowBtn.disabled = true;
  els.unfollowModalError.classList.add('hidden');
  els.unfollowProgressWrap.classList.remove('hidden');
  els.unfollowProgressBar.style.width = '8%';
  els.unfollowProgressText.textContent = `Unfollowing ${logins.length} user(s) with serial pacing...`;

  const unfollowedSet = new Set();

  if (state.runtimeMode === 'local-cli') {
    const chunkSize = 5;
    for (let i = 0; i < logins.length; i += chunkSize) {
      const batch = logins.slice(i, i + chunkSize);
      const res = await fetch('/api/unfollow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: batch }),
      });
      const payload = await res.json();

      if (!res.ok) {
        if (payload.code === 'MISSING_FOLLOW_SCOPE' || payload.code === 'NO_TOKEN') {
          showMissingScopeErrorInModal();
        } else {
          els.unfollowProgressWrap.classList.add('hidden');
          els.unfollowModalError.classList.remove('hidden');
          els.unfollowModalError.textContent = payload.error || 'Failed to unfollow users.';
          els.confirmUnfollowBtn.disabled = false;
        }
        return;
      }

      for (const login of payload.succeeded || []) {
        unfollowedSet.add(login.toLowerCase());
        state.selectedLogins.delete(login);
      }

      const pct = Math.min(100, Math.round(((i + batch.length) / logins.length) * 100));
      els.unfollowProgressBar.style.width = `${pct}%`;
      els.unfollowProgressText.textContent = `Unfollowed ${unfollowedSet.size} of ${logins.length}...`;
    }
  } else {
    const token = getBrowserPat();
    if (!token) {
      showMissingScopeErrorInModal();
      return;
    }

    for (let i = 0; i < logins.length; i++) {
      const login = logins[i];
      if (i > 0) {
        await sleep(UNFOLLOW_DELAY_MS);
      }

      const res = await fetch(
        `https://api.github.com/user/following/${encodeURIComponent(login)}`,
        {
          method: 'DELETE',
          headers: buildGitHubHeaders(token),
        }
      );

      if (res.status === 204) {
        unfollowedSet.add(login.toLowerCase());
        state.selectedLogins.delete(login);
      } else {
        const currentScopes = res.headers.get('x-oauth-scopes') || '';
        if (
          (res.status === 404 || res.status === 403 || res.status === 401) &&
          !currentScopes.includes('user:follow') &&
          !currentScopes.includes('user')
        ) {
          showMissingScopeErrorInModal();
          return;
        }
      }

      const pct = Math.min(100, Math.round(((i + 1) / logins.length) * 100));
      els.unfollowProgressBar.style.width = `${pct}%`;
      els.unfollowProgressText.textContent = `Unfollowed ${unfollowedSet.size} of ${logins.length}...`;
    }
  }

  if (state.data && unfollowedSet.size > 0) {
    state.data.nonFollowers = state.data.nonFollowers.filter(
      (u) => !unfollowedSet.has(u.login.toLowerCase())
    );
    state.data.mutuals = state.data.mutuals.filter(
      (u) => !unfollowedSet.has(u.login.toLowerCase())
    );
  }

  closeUnfollowModal();
  renderProfileAndStats();
  renderUserCards();
  showToast(
    `Successfully unfollowed ${unfollowedSet.size} user${unfollowedSet.size === 1 ? '' : 's'}!`
  );
}

function exportCurrentViewCsv() {
  const users = getFilteredAndSortedUsers();
  if (users.length === 0) {
    showToast('No users in current view to export', 'error');
    return;
  }

  const headers = [
    'login',
    'name',
    'url',
    'follows_back',
    'allowlisted',
    'followers_count',
    'following_count',
    'public_repos_count',
    'company',
    'location',
    'bio',
  ];

  const escapeCsv = (val) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = users.map((u) =>
    [
      u.login,
      u.name,
      u.url,
      u.followsBack,
      isAllowlisted(u.login),
      u.followersCount ?? '',
      u.followingCount ?? '',
      u.publicReposCount ?? '',
      u.company,
      u.location,
      u.bio,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `github-${state.activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Event Listeners
els.usernameInput.addEventListener('input', (e) => {
  updateTokenCreationLinks(e.target.value);
});

els.scanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  scanAccount(els.usernameInput.value);
});

els.themeToggleBtn.addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

els.switchToViewerBtn.addEventListener('click', () => {
  if (state.auth?.viewerLogin) {
    scanAccount(state.auth.viewerLogin);
  }
});

const toggleModesExplainer = () => {
  els.modesExplainer.classList.toggle('hidden');
};
els.modeBadgeBtn.addEventListener('click', toggleModesExplainer);
els.guideBtn.addEventListener('click', toggleModesExplainer);
els.closeModesExplainer.addEventListener('click', () => {
  els.modesExplainer.classList.add('hidden');
});

els.statCards.forEach((card) => {
  card.addEventListener('click', () => {
    state.activeTab = card.dataset.tab;
    state.selectedLogins.clear();
    renderProfileAndStats();
    renderUserCards();
  });
});

els.tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    state.selectedLogins.clear();
    renderProfileAndStats();
    renderUserCards();
  });
});

els.showAllowlistedCheckbox.addEventListener('change', (e) => {
  state.showAllowlistedInNonFollowers = e.target.checked;
  renderProfileAndStats();
  renderUserCards();
});

els.searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderUserCards();
});

els.presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.preset = btn.dataset.preset;
    els.presetBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderUserCards();
  });
});

els.sortSelect.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  renderUserCards();
});

els.selectAllCheckbox.addEventListener('change', (e) => {
  const visible = getFilteredAndSortedUsers();
  if (e.target.checked) {
    visible.forEach((u) => state.selectedLogins.add(u.login));
  } else {
    visible.forEach((u) => state.selectedLogins.delete(u.login));
  }
  renderUserCards();
});

els.clearSelectionBtn.addEventListener('click', () => {
  state.selectedLogins.clear();
  renderUserCards();
});

els.batchAllowlistAddBtn.addEventListener('click', () => {
  addToAllowlist([...state.selectedLogins]);
});

els.batchAllowlistRemoveBtn.addEventListener('click', () => {
  removeFromAllowlist([...state.selectedLogins]);
});

els.batchUnfollowBtn.addEventListener('click', () => {
  openUnfollowModal([...state.selectedLogins]);
});

els.cardsGrid.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const login = actionEl.dataset.login;

  if (action === 'prompt-signin') {
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
    return;
  }

  if (!login) return;

  if (action === 'toggle-select') {
    if (actionEl.checked) {
      state.selectedLogins.add(login);
    } else {
      state.selectedLogins.delete(login);
    }
    renderUserCards();
  } else if (action === 'toggle-allowlist') {
    if (isAllowlisted(login)) {
      removeFromAllowlist([login]);
    } else {
      addToAllowlist([login]);
    }
  } else if (action === 'unfollow-single') {
    openUnfollowModal([login]);
  }
});

// Unfollow Modal events
els.closeUnfollowModal.addEventListener('click', closeUnfollowModal);
els.cancelUnfollowBtn.addEventListener('click', closeUnfollowModal);
els.confirmUnfollowBtn.addEventListener('click', executePendingUnfollow);

// Auth Modal events
els.authBtn.addEventListener('click', async () => {
  await detectRuntimeAndAuth();
  updateTokenCreationLinks();
  els.authModal.classList.remove('hidden');
});
els.openAuthModalBtn.addEventListener('click', async () => {
  await detectRuntimeAndAuth();
  updateTokenCreationLinks();
  els.authModal.classList.remove('hidden');
});
els.closeAuthModal.addEventListener('click', () => {
  els.authModal.classList.add('hidden');
});

const copyGhCommand = async () => {
  await navigator.clipboard.writeText('gh auth refresh -h github.com -s user:follow');
  showToast('Copied command: gh auth refresh -h github.com -s user:follow');
};
els.copyGhCmdBtn.addEventListener('click', copyGhCommand);
els.modalCopyGhBtn.addEventListener('click', copyGhCommand);

els.savePatBtn.addEventListener('click', async () => {
  const token = els.customPatInput.value.trim();
  if (state.runtimeMode === 'local-cli') {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    state.auth = await res.json();
  } else {
    setBrowserPat(token);
    state.auth = await checkWebClientAuthStatus();
  }

  renderModeAndAuthUI();
  els.customPatInput.value = '';
  els.authModal.classList.add('hidden');

  if (state.auth.authenticated) {
    showToast(`Verified as @${state.auth.viewerLogin}`);
    // Automatically scan the authenticated user's own account!
    await scanAccount(state.auth.viewerLogin);
  } else {
    renderProfileAndStats();
    renderUserCards();
    showToast('Token cleared or invalid', 'error');
  }
});

els.clearPatBtn.addEventListener('click', async () => {
  if (state.runtimeMode === 'local-cli') {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });
    state.auth = await res.json();
    showToast('Switched to default GitHub CLI authentication');
  } else {
    setBrowserPat('');
    state.auth = await checkWebClientAuthStatus();
    showToast('Cleared browser token');
  }
  renderModeAndAuthUI();
  renderProfileAndStats();
  renderUserCards();
  els.customPatInput.value = '';
});

// Export / Import events
els.exportCsvBtn.addEventListener('click', exportCurrentViewCsv);

els.exportAllowlistBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.allowlist, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `github-allowlist-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importAllowlistInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (state.runtimeMode === 'local-cli') {
      const res = await fetch('/api/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: parsed }),
      });
      const payload = await res.json();
      if (res.ok) {
        state.allowlist = payload.allowlist || {};
      }
    } else {
      const now = new Date().toISOString();
      for (const [key, val] of Object.entries(parsed || {})) {
        const login = (val?.login || key || '').trim();
        if (GITHUB_USERNAME_REGEX.test(login)) {
          state.allowlist[login.toLowerCase()] = {
            login,
            note: typeof val?.note === 'string' ? val.note.slice(0, 200) : '',
            addedAt: val?.addedAt || now,
          };
        }
      }
    }
    saveLocalAllowlist(state.allowlist);
    renderProfileAndStats();
    renderUserCards();
    showToast('Imported allowlist successfully');
  } catch {
    showToast('Invalid allowlist JSON file', 'error');
  } finally {
    e.target.value = '';
  }
});

// Initial Bootstrap
(async function init() {
  initTheme();
  const status = await detectRuntimeAndAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const queryUser = (urlParams.get('user') || urlParams.get('username') || '').trim();
  const initialUser = queryUser || status.viewerLogin || '';

  if (initialUser) {
    els.usernameInput.value = initialUser;
    updateTokenCreationLinks(initialUser);
    await scanAccount(initialUser);
  } else {
    updateTokenCreationLinks('');
    els.modesExplainer.classList.remove('hidden');
    els.welcomeState.classList.remove('hidden');
  }
})();
