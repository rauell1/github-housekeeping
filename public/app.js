const LOCAL_STORAGE_ALLOWLIST_KEY = 'gh_housekeeping_allowlist_v1';
const LOCAL_STORAGE_THEME_KEY = 'gh_housekeeping_theme_v2';
const LOCAL_STORAGE_VIEW_KEY = 'gh_housekeeping_view_v1';
const SNAPSHOT_KEY_PREFIX = 'gh_housekeeping_snapshot_v1_';
const SESSION_STORAGE_PAT_KEY = 'gh_housekeeping_pat_v1';
const SESSION_UI_STATE_KEY = 'gh_housekeeping_ui_state_v1';
const SESSION_SCAN_CACHE_KEY = 'gh_housekeeping_scan_cache_v1';
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const UNFOLLOW_DELAY_MS = 300;
const REPO_DELETE_DELAY_MS = 350;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const state = {
  runtimeMode: 'detecting', // 'local-cli' | 'web-client'
  theme: 'light', // 'light' | 'dark'
  viewMode: 'grid', // 'grid' | 'compact'
  auth: null,
  data: null,
  reposData: null, // { username, includesPrivate, repos: [...] }
  reposLoading: false,
  allowlist: {},
  activeTab: 'non-followers', // 'non-followers' | 'allowlist' | 'mutuals' | 'fans' | 'repos'
  showAllowlistedInNonFollowers: false,
  searchQuery: '',
  preset: 'all', // 'all' | 'popular' | 'regular' | 'dormant' | 'zero-repos'
  repoPreset: 'all', // 'all' | 'forks' | 'private' | 'public' | 'archived' | 'dormant' | 'zero-stars'
  sortBy: 'order-asc',
  repoSortBy: 'pushed-desc',
  selectedLogins: new Set(),
  selectedRepos: new Set(),
  lastClickedLogin: null,
  lastClickedRepo: null,
  pendingUnfollowLogins: [],
  pendingDeleteRepos: [],
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
  rescanBtn: document.getElementById('rescan-btn'),
  copyListBtn: document.getElementById('copy-list-btn'),
  snapshotDiffBanner: document.getElementById('snapshot-diff-banner'),
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
  statRepos: document.getElementById('stat-repos'),
  statReposMeta: document.getElementById('stat-repos-meta'),
  statCards: document.querySelectorAll('.stat-card'),

  controlsSection: document.getElementById('controls-section'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabCountNonFollowers: document.getElementById('tab-count-non-followers'),
  tabCountAllowlist: document.getElementById('tab-count-allowlist'),
  tabCountMutuals: document.getElementById('tab-count-mutuals'),
  tabCountFans: document.getElementById('tab-count-fans'),
  tabCountRepos: document.getElementById('tab-count-repos'),
  includeAllowlistedWrap: document.getElementById('include-allowlisted-wrap'),
  showAllowlistedCheckbox: document.getElementById('show-allowlisted-in-nonfollowers'),

  searchInput: document.getElementById('search-input'),
  userPresetPills: document.getElementById('user-preset-pills'),
  repoPresetPills: document.getElementById('repo-preset-pills'),
  presetBtns: document.querySelectorAll('.pill-btn[data-preset]'),
  repoPresetBtns: document.querySelectorAll('.repo-pill-btn[data-repo-preset]'),
  userSortBox: document.getElementById('user-sort-box'),
  repoSortBox: document.getElementById('repo-sort-box'),
  sortSelect: document.getElementById('sort-select'),
  repoSortSelect: document.getElementById('repo-sort-select'),
  viewGridBtn: document.getElementById('view-grid-btn'),
  viewCompactBtn: document.getElementById('view-compact-btn'),

  selectAllCheckbox: document.getElementById('select-all-checkbox'),
  selectionSummary: document.getElementById('selection-summary'),
  clearSelectionBtn: document.getElementById('clear-selection-btn'),
  autoShieldPopularBtn: document.getElementById('auto-shield-popular-btn'),
  batchAllowlistAddBtn: document.getElementById('batch-allowlist-add-btn'),
  batchAllowlistRemoveBtn: document.getElementById('batch-allowlist-remove-btn'),
  batchUnfollowBtn: document.getElementById('batch-unfollow-btn'),
  batchArchiveReposBtn: document.getElementById('batch-archive-repos-btn'),
  batchDeleteReposBtn: document.getElementById('batch-delete-repos-btn'),

  welcomeState: document.getElementById('welcome-state'),
  loadingState: document.getElementById('loading-state'),
  loadingText: document.getElementById('loading-text'),
  errorState: document.getElementById('error-state'),
  errorMessage: document.getElementById('error-message'),
  errorActions: document.getElementById('error-actions'),
  errorAuthCtaBtn: document.getElementById('error-auth-cta-btn'),
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

  // Delete Repo Modal
  deleteRepoModal: document.getElementById('delete-repo-modal'),
  deleteRepoModalTitle: document.getElementById('delete-repo-modal-title'),
  deleteRepoModalDesc: document.getElementById('delete-repo-modal-desc'),
  deleteRepoPreviewList: document.getElementById('delete-repo-preview-list'),
  deleteRepoConfirmWrap: document.getElementById('delete-repo-confirm-wrap'),
  deleteRepoConfirmInput: document.getElementById('delete-repo-confirm-input'),
  deleteRepoProgressWrap: document.getElementById('delete-repo-progress-wrap'),
  deleteRepoProgressBar: document.getElementById('delete-repo-progress-bar'),
  deleteRepoProgressText: document.getElementById('delete-repo-progress-text'),
  deleteRepoModalError: document.getElementById('delete-repo-modal-error'),
  closeDeleteRepoModal: document.getElementById('close-delete-repo-modal'),
  cancelDeleteRepoBtn: document.getElementById('cancel-delete-repo-btn'),
  confirmDeleteRepoBtn: document.getElementById('confirm-delete-repo-btn'),

  // Auth Modal
  authModal: document.getElementById('auth-modal'),
  closeAuthModal: document.getElementById('close-auth-modal'),
  modalRuntimeMode: document.getElementById('modal-runtime-mode'),
  modalAuthSource: document.getElementById('modal-auth-source'),
  modalAuthUser: document.getElementById('modal-auth-user'),
  modalAuthScopes: document.getElementById('modal-auth-scopes'),
  modalFollowPerm: document.getElementById('modal-follow-perm'),
  modalRepoPerm: document.getElementById('modal-repo-perm'),
  modalDeleteRepoPerm: document.getElementById('modal-delete-repo-perm'),
  modalRateLimit: document.getElementById('modal-rate-limit'),
  modalCreateTokenLink: document.getElementById('modal-create-token-link'),
  modalCreateRepoTokenLink: document.getElementById('modal-create-repo-token-link'),
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
  if (num === null || num === undefined) return '-';
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

// Theme Management (Light Mode by default + Dark Mode toggle)
function initTheme() {
  let saved = 'light';
  try {
    saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY) || 'light';
  } catch {
    // ignore
  }
  applyTheme(saved === 'dark' ? 'dark' : 'light');
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

function initViewMode() {
  let saved = 'grid';
  try {
    saved = localStorage.getItem(LOCAL_STORAGE_VIEW_KEY) || 'grid';
  } catch {
    // ignore
  }
  applyViewMode(saved === 'compact' ? 'compact' : 'grid');
}

function applyViewMode(mode) {
  state.viewMode = mode;
  try {
    localStorage.setItem(LOCAL_STORAGE_VIEW_KEY, mode);
  } catch {
    // ignore
  }
  if (els.cardsGrid) {
    els.cardsGrid.classList.toggle('compact-view', mode === 'compact');
  }
  if (els.viewGridBtn && els.viewCompactBtn) {
    els.viewGridBtn.classList.toggle('active', mode === 'grid');
    els.viewCompactBtn.classList.toggle('active', mode === 'compact');
  }
}

function saveWorkspaceState() {
  try {
    const uiSnapshot = {
      username: state.data?.profile?.login || els.usernameInput?.value?.trim() || '',
      activeTab: state.activeTab,
      showAllowlistedInNonFollowers: state.showAllowlistedInNonFollowers,
      searchQuery: state.searchQuery,
      preset: state.preset,
      repoPreset: state.repoPreset,
      sortBy: state.sortBy,
      repoSortBy: state.repoSortBy,
      selectedLogins: [...state.selectedLogins],
      selectedRepos: [...state.selectedRepos],
    };
    sessionStorage.setItem(SESSION_UI_STATE_KEY, JSON.stringify(uiSnapshot));
  } catch {
    // ignore storage errors
  }
}

function saveScanCache() {
  try {
    if (!state.data?.profile?.login) return;
    const cache = {
      username: state.data.profile.login,
      data: state.data,
      reposData: state.reposData,
      cachedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_SCAN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors on very large accounts
  }
}

function tryRestoreWorkspaceSession(preferredUsername) {
  try {
    const rawUi = sessionStorage.getItem(SESSION_UI_STATE_KEY);
    const rawCache = sessionStorage.getItem(SESSION_SCAN_CACHE_KEY);
    if (!rawCache) return false;

    const cache = JSON.parse(rawCache);
    if (!cache?.data?.profile?.login) return false;

    // If user explicitly navigated to ?user=someoneElse, don't restore a different user's cache
    if (
      preferredUsername &&
      cache.username.toLowerCase() !== preferredUsername.toLowerCase()
    ) {
      return false;
    }

    state.data = cache.data;
    state.reposData = cache.reposData || null;
    state.allowlist =
      state.runtimeMode === 'local-cli'
        ? cache.data.allowlist || loadLocalAllowlist()
        : loadLocalAllowlist();

    if (rawUi) {
      const ui = JSON.parse(rawUi);
      if (ui.activeTab) state.activeTab = ui.activeTab;
      state.showAllowlistedInNonFollowers = Boolean(ui.showAllowlistedInNonFollowers);
      state.searchQuery = ui.searchQuery || '';
      state.preset = ui.preset || 'all';
      state.repoPreset = ui.repoPreset || 'all';
      state.sortBy = ui.sortBy || 'order-asc';
      state.repoSortBy = ui.repoSortBy || 'pushed-desc';
      state.selectedLogins = new Set(Array.isArray(ui.selectedLogins) ? ui.selectedLogins : []);
      state.selectedRepos = new Set(Array.isArray(ui.selectedRepos) ? ui.selectedRepos : []);
    }

    // Sync restored UI controls
    els.usernameInput.value = cache.username;
    updateTokenCreationLinks(cache.username);
    if (els.searchInput) els.searchInput.value = state.searchQuery;
    if (els.showAllowlistedCheckbox) {
      els.showAllowlistedCheckbox.checked = state.showAllowlistedInNonFollowers;
    }
    if (els.sortSelect) els.sortSelect.value = state.sortBy;
    if (els.repoSortSelect) els.repoSortSelect.value = state.repoSortBy;
    els.presetBtns.forEach((b) => b.classList.toggle('active', b.dataset.preset === state.preset));
    els.repoPresetBtns.forEach((b) =>
      b.classList.toggle('active', b.dataset.repoPreset === state.repoPreset)
    );

    els.summarySection.classList.remove('hidden');
    els.controlsSection.classList.remove('hidden');
    els.welcomeState.classList.add('hidden');
    els.loadingState.classList.add('hidden');

    renderModeAndAuthUI();
    renderProfileAndStats();
    if (state.activeTab === 'repos') {
      if (state.reposData) {
        renderRepoCards();
      } else {
        loadAndRenderRepos();
      }
    } else {
      renderUserCards();
    }

    return true;
  } catch {
    return false;
  }
}

function isDormantUser(user) {
  if (!user?.updatedAt) return false;
  const ts = Date.parse(user.updatedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > ONE_YEAR_MS;
}

function formatRelativeActivity(updatedAt) {
  if (!updatedAt) return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return { label: 'Active today', dormant: false };
  if (diffDays < 30) return { label: `Active ${diffDays}d ago`, dormant: false };
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return { label: `Active ${diffMonths}mo ago`, dormant: false };
  const diffYears = (diffDays / 365).toFixed(1).replace(/\.0$/, '');
  return { label: `💤 Dormant (${diffYears}yr)`, dormant: true };
}

function computeAndRenderSnapshotDiff(payload) {
  if (!els.snapshotDiffBanner || !payload?.profile?.login) return;
  const loginKey = payload.profile.login.toLowerCase();
  const storageKey = `${SNAPSHOT_KEY_PREFIX}${loginKey}`;

  // Current followers = mutuals + fans
  const currentFollowers = [
    ...(payload.mutuals || []).map((u) => u.login),
    ...(payload.fans || []).map((u) => u.login),
  ];
  const currentSet = new Set(currentFollowers.map((l) => l.toLowerCase()));

  let prev = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) prev = JSON.parse(raw);
  } catch {
    // ignore
  }

  // Save current snapshot
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        scannedAt: new Date().toISOString(),
        followers: currentFollowers,
      })
    );
  } catch {
    // ignore
  }

  if (!prev || !Array.isArray(prev.followers)) {
    els.snapshotDiffBanner.classList.add('hidden');
    return;
  }

  const prevSet = new Set(prev.followers.map((l) => String(l).toLowerCase()));
  const lostFollowers = prev.followers.filter((l) => !currentSet.has(String(l).toLowerCase()));
  const newFollowers = currentFollowers.filter((l) => !prevSet.has(String(l).toLowerCase()));

  if (lostFollowers.length === 0 && newFollowers.length === 0) {
    els.snapshotDiffBanner.classList.add('hidden');
    return;
  }

  const lostChips = lostFollowers
    .slice(0, 12)
    .map(
      (l) =>
        `<a href="https://github.com/${encodeURIComponent(
          l
        )}" target="_blank" rel="noopener noreferrer" class="diff-chip-lost">− @${escapeHtml(
          l
        )}</a>`
    )
    .join('');

  const gainedChips = newFollowers
    .slice(0, 12)
    .map(
      (l) =>
        `<a href="https://github.com/${encodeURIComponent(
          l
        )}" target="_blank" rel="noopener noreferrer" class="diff-chip-gained">+ @${escapeHtml(
          l
        )}</a>`
    )
    .join('');

  els.snapshotDiffBanner.innerHTML = `
    <div>
      <strong>🔔 Realtime Diff Since Last Scan:</strong>
      <span>
        ${
          lostFollowers.length > 0
            ? `<strong>${lostFollowers.length}</strong> unfollowed you`
            : ''
        }
        ${lostFollowers.length > 0 && newFollowers.length > 0 ? ' · ' : ''}
        ${
          newFollowers.length > 0
            ? `<strong>${newFollowers.length}</strong> new follower${
                newFollowers.length === 1 ? '' : 's'
              }`
            : ''
        }
      </span>
      <div class="diff-chips">${lostChips}${gainedChips}</div>
    </div>
  `;
  els.snapshotDiffBanner.classList.remove('hidden');
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

  const repoUrl = `https://github.com/settings/tokens/new?description=${encodeURIComponent(
    cleanUser ? `GitHub Follow & Repo Housekeeping (@${cleanUser})` : 'GitHub Follow & Repo Housekeeping'
  )}&scopes=user:follow,delete_repo,repo`;

  if (els.bannerCreateTokenLink) {
    els.bannerCreateTokenLink.href = url;
    els.bannerCreateTokenLink.textContent = cleanUser
      ? `1. Generate Token for @${cleanUser} ↗`
      : '1. Generate Token on GitHub ↗';
  }
  if (els.modalCreateTokenLink) {
    els.modalCreateTokenLink.href = url;
    els.modalCreateTokenLink.textContent = cleanUser
      ? `Follow Only (@${cleanUser}: user:follow) ↗`
      : 'Follow Housekeeping Only (user:follow) ↗';
  }
  if (els.modalCreateRepoTokenLink) {
    els.modalCreateRepoTokenLink.href = repoUrl;
    els.modalCreateRepoTokenLink.textContent = cleanUser
      ? `Full Housekeeping: Follow + Archive/Delete (@${cleanUser}: repo, delete_repo) ↗`
      : 'Full Housekeeping: Follow + Archive/Delete Repos (user:follow, repo, delete_repo) ↗';
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
  const hasRepoScope = isFineGrained || scopes.includes('repo');
  const hasDeleteRepoScope = isFineGrained || scopes.includes('delete_repo');
  const rateLimit = {
    limit: Number(res.headers.get('x-ratelimit-limit') || 0),
    remaining: Number(res.headers.get('x-ratelimit-remaining') || 0),
    reset: Number(res.headers.get('x-ratelimit-reset') || 0),
  };

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
    hasRepoScope,
    hasDeleteRepoScope,
    rateLimit,
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
    if (els.modalRepoPerm) {
      els.modalRepoPerm.textContent = s.hasRepoScope
        ? '✅ Enabled (Can view private repos & archive/unarchive)'
        : '⚠️ Missing repo scope (Public repos only; cannot archive)';
    }
    if (els.modalDeleteRepoPerm) {
      els.modalDeleteRepoPerm.textContent = s.hasDeleteRepoScope
        ? '✅ Enabled (Verified owner can delete repos)'
        : '⚠️ Missing delete_repo scope (Cannot delete repos)';
    }
    if (els.modalRateLimit) {
      els.modalRateLimit.textContent = s.rateLimit?.limit
        ? `${s.rateLimit.remaining.toLocaleString()} / ${s.rateLimit.limit.toLocaleString()} requests remaining`
        : '5,000 requests/hr';
    }
  } else {
    els.modalAuthSource.textContent = 'None (Public Read-Only API)';
    els.modalAuthUser.textContent = 'Not signed in';
    els.modalAuthScopes.textContent = 'none';
    els.modalFollowPerm.textContent = '❌ Sign in with token to verify ownership & unfollow';
    if (els.modalRepoPerm) {
      els.modalRepoPerm.textContent = '❌ Sign in with repo token to archive repos';
    }
    if (els.modalDeleteRepoPerm) {
      els.modalDeleteRepoPerm.textContent = '❌ Sign in with delete_repo token to delete repos';
    }
    if (els.modalRateLimit) {
      els.modalRateLimit.textContent = '60 requests/hr (unauthenticated public limit)';
    }
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
    if (els.loadingText) {
      els.loadingText.textContent = `Scanning @${username}: fetched ${items.length.toLocaleString()} ${connectionName}...`;
    }
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
      if (res.status === 403 && (errBody.message || '').toLowerCase().includes('rate limit')) {
        throw new Error(
          'GitHub public IP rate limit reached (60 requests/hr for unauthenticated browsers). Connect a free GitHub token below to unlock 5,000 requests/hr instantly.'
        );
      }
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
    if (els.loadingText) {
      els.loadingText.textContent = `Scanning @${username}: fetched ${items.length.toLocaleString()} ${listType}...`;
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
    if (profileRes.status === 403 && (errBody.message || '').toLowerCase().includes('rate limit')) {
      throw new Error(
        'GitHub public IP rate limit reached (60 requests/hr for unauthenticated browsers). Connect a free GitHub token below to unlock 5,000 requests/hr instantly.'
      );
    }
    throw new Error(
      errBody.message || `Could not fetch user '${username}' (${profileRes.status})`
    );
  }
  const profileData = await profileRes.json();

  // Safeguard unauthenticated public quota on very large accounts (>2,500 combined followers + following)
  const totalConnections = Number(profileData.followers || 0) + Number(profileData.following || 0);
  if (!token && totalConnections > 2500) {
    throw new Error(
      `@${profileData.login} has ${totalConnections.toLocaleString()} combined followers/following. Scanning an account this large without a token would exhaust GitHub's 60 req/hr public IP limit. Connect a free GitHub token below to scan large accounts via GraphQL.`
    );
  }

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
    state.reposData = null;
    state.allowlist = payload.allowlist || {};
    saveLocalAllowlist(state.allowlist);
    state.selectedLogins.clear();
    state.selectedRepos.clear();
    state.lastClickedLogin = null;
    state.lastClickedRepo = null;
    if (els.tabCountRepos) {
      els.tabCountRepos.textContent = '-';
    }

    // Sync ?user= query param in browser URL without reloading
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('user', payload.profile.login);
      window.history.replaceState({}, '', nextUrl.toString());
    } catch {
      // ignore
    }

    computeAndRenderSnapshotDiff(payload);

    els.summarySection.classList.remove('hidden');
    els.controlsSection.classList.remove('hidden');
    els.loadingState.classList.add('hidden');

    renderModeAndAuthUI();
    renderProfileAndStats();
    saveScanCache();
    saveWorkspaceState();
    if (state.activeTab === 'repos') {
      await loadAndRenderRepos();
    } else {
      renderUserCards();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    els.loadingState.classList.add('hidden');
    els.errorState.classList.remove('hidden');
    els.errorMessage.textContent = msg;
    const needsTokenCta =
      !state.auth?.authenticated &&
      (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('token'));
    if (els.errorActions) {
      els.errorActions.classList.toggle('hidden', !needsTokenCta);
    }
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
  if (els.tabCountRepos && state.reposData) {
    els.tabCountRepos.textContent = state.reposData.repos.length;
  }
  if (els.statRepos && els.statReposMeta) {
    if (state.reposData) {
      const reposList = state.reposData.repos;
      const privCount = reposList.filter((r) => r.isPrivate).length;
      const pubCount = reposList.length - privCount;
      els.statRepos.textContent = reposList.length.toLocaleString();
      els.statReposMeta.textContent = state.reposData.includesPrivate
        ? `${pubCount} public · ${privCount} private`
        : `${pubCount} public repositories`;
    } else {
      els.statRepos.textContent = '-';
      els.statReposMeta.textContent = 'Click to inspect & clean up';
    }
  }

  els.statCards.forEach((card) => {
    card.classList.toggle('active', card.dataset.tab === state.activeTab);
  });
  els.tabBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
  });

  const isRepoTab = state.activeTab === 'repos';
  els.includeAllowlistedWrap.classList.toggle('hidden', state.activeTab !== 'non-followers');
  if (els.userPresetPills) els.userPresetPills.classList.toggle('hidden', isRepoTab);
  if (els.repoPresetPills) els.repoPresetPills.classList.toggle('hidden', !isRepoTab);
  if (els.userSortBox) els.userSortBox.classList.toggle('hidden', isRepoTab);
  if (els.repoSortBox) els.repoSortBox.classList.toggle('hidden', !isRepoTab);
  if (els.searchInput) {
    els.searchInput.placeholder = isRepoTab
      ? 'Filter by repository name, description, or language... (Press /)'
      : 'Filter by username, name, bio, company, or location... (Press /)';
  }

  els.batchAllowlistRemoveBtn.classList.toggle('hidden', state.activeTab !== 'allowlist');
  els.batchAllowlistAddBtn.classList.toggle('hidden', state.activeTab === 'allowlist' || isRepoTab);
  els.batchUnfollowBtn.classList.toggle('hidden', isRepoTab);
  if (els.batchArchiveReposBtn) {
    els.batchArchiveReposBtn.classList.toggle('hidden', !isRepoTab);
  }
  if (els.batchDeleteReposBtn) {
    els.batchDeleteReposBtn.classList.toggle('hidden', !isRepoTab);
  }
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
  } else if (state.preset === 'dormant') {
    base = base.filter((u) => isDormantUser(u));
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
      case 'activity-asc': {
        const tsA = a.updatedAt ? Date.parse(a.updatedAt) : 9999999999999;
        const tsB = b.updatedAt ? Date.parse(b.updatedAt) : 9999999999999;
        return tsA - tsB;
      }
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

function getUnshieldedPopularCreators() {
  if (!state.data?.nonFollowers) return [];
  return state.data.nonFollowers.filter(
    (u) => !isAllowlisted(u.login) && (u.followersCount ?? 0) >= 1000
  );
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

  if (els.autoShieldPopularBtn) {
    const popularCreators = getUnshieldedPopularCreators();
    const showAutoShield =
      state.activeTab === 'non-followers' && popularCreators.length > 0;
    els.autoShieldPopularBtn.classList.toggle('hidden', !showAutoShield);
    if (showAutoShield) {
      els.autoShieldPopularBtn.textContent = `✨ Auto-Shield Creators (${popularCreators.length})`;
    }
  }

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

      const creatorBadge =
        (u.followersCount ?? 0) >= 1000
          ? `<span class="badge badge-creator" title="Popular creator / maintainer (1,000+ followers)">⭐ Creator 1k+</span>`
          : '';

      const actInfo = formatRelativeActivity(u.updatedAt);
      const activityBadge = actInfo
        ? `<span class="badge ${
            actInfo.dormant ? 'badge-dormant' : 'badge-active'
          }" title="Last GitHub profile/repo update: ${escapeHtml(u.updatedAt)}">${escapeHtml(
            actInfo.label
          )}</span>`
        : '';

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
                  ${creatorBadge}
                  ${activityBadge}
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

          <div class="card-right-group">
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
  saveWorkspaceState();
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

// ==========================================
// Repository Housekeeping (List & Mass Delete)
// ==========================================

function formatSizeKb(kb) {
  if (!kb || kb <= 0) return '0 KB';
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function isDormantRepo(repo) {
  const ref = repo?.pushedAt || repo?.updatedAt;
  if (!ref) return false;
  const ts = Date.parse(ref);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > ONE_YEAR_MS;
}

async function fetchClientReposDirect(username) {
  const token = getBrowserPat();
  const isOwner =
    state.auth?.authenticated &&
    state.auth?.viewerLogin &&
    state.auth.viewerLogin.toLowerCase() === username.toLowerCase();

  const repos = [];
  let page = 1;
  while (page <= 30) {
    const endpoint = isOwner
      ? `https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated&page=${page}`
      : `https://api.github.com/users/${encodeURIComponent(
          username
        )}/repos?per_page=100&type=owner&sort=updated&page=${page}`;

    const res = await fetch(endpoint, { headers: buildGitHubHeaders(token) });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API returned ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      repos.push({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner?.login || username,
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
      });
    }

    if (batch.length < 100) break;
    page++;
  }

  return {
    username,
    includesPrivate: Boolean(isOwner),
    count: repos.length,
    repos,
  };
}

async function loadAndRenderRepos(force = false) {
  if (!state.data?.profile?.login) return;
  const username = state.data.profile.login;

  if (!force && state.reposData && state.reposData.username.toLowerCase() === username.toLowerCase()) {
    renderProfileAndStats();
    renderRepoCards();
    return;
  }

  state.reposLoading = true;
  els.loadingText.textContent = `Loading repositories for @${username}...`;
  els.loadingState.classList.remove('hidden');
  els.emptyState.classList.add('hidden');
  els.errorState.classList.add('hidden');
  els.cardsGrid.innerHTML = '';

  try {
    let payload;
    if (state.runtimeMode === 'local-cli') {
      const res = await fetch(`/api/repos?username=${encodeURIComponent(username)}`);
      payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
    } else {
      payload = await fetchClientReposDirect(username);
    }

    state.reposData = payload;
    els.loadingState.classList.add('hidden');
    saveScanCache();
    renderProfileAndStats();
    renderRepoCards();
  } catch (err) {
    els.loadingState.classList.add('hidden');
    els.errorState.classList.remove('hidden');
    els.errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    state.reposLoading = false;
  }
}

function getFilteredAndSortedRepos() {
  if (!state.reposData?.repos) return [];
  let base = [...state.reposData.repos];

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    base = base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.language && r.language.toLowerCase().includes(q))
    );
  }

  if (state.repoPreset === 'forks') {
    base = base.filter((r) => r.isFork);
  } else if (state.repoPreset === 'private') {
    base = base.filter((r) => r.isPrivate);
  } else if (state.repoPreset === 'public') {
    base = base.filter((r) => !r.isPrivate);
  } else if (state.repoPreset === 'archived') {
    base = base.filter((r) => r.isArchived);
  } else if (state.repoPreset === 'dormant') {
    base = base.filter((r) => isDormantRepo(r));
  } else if (state.repoPreset === 'zero-stars') {
    base = base.filter((r) => r.stargazersCount === 0);
  }

  base.sort((a, b) => {
    switch (state.repoSortBy) {
      case 'pushed-desc':
        return Date.parse(b.pushedAt || 0) - Date.parse(a.pushedAt || 0);
      case 'pushed-asc':
        return Date.parse(a.pushedAt || 0) - Date.parse(b.pushedAt || 0);
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

  return base;
}

function updateRepoSelectionToolbar(visibleRepos) {
  const visibleNames = visibleRepos.map((r) => r.fullName);
  const selectedCount = state.selectedRepos.size;
  const allVisibleSelected =
    visibleNames.length > 0 && visibleNames.every((name) => state.selectedRepos.has(name));

  els.selectAllCheckbox.checked = allVisibleSelected;
  els.selectAllCheckbox.indeterminate =
    !allVisibleSelected && visibleNames.some((name) => state.selectedRepos.has(name));

  if (selectedCount > 0) {
    els.selectionSummary.textContent = `${selectedCount} repo${
      selectedCount === 1 ? '' : 's'
    } selected (of ${visibleNames.length} visible)`;
    els.clearSelectionBtn.classList.remove('hidden');
  } else {
    els.selectionSummary.textContent = `Select All Visible (${visibleNames.length})`;
    els.clearSelectionBtn.classList.add('hidden');
  }

  document.querySelectorAll('.sel-count').forEach((el) => {
    el.textContent = String(selectedCount);
  });

  if (els.autoShieldPopularBtn) {
    els.autoShieldPopularBtn.classList.add('hidden');
  }

  const isOwner = isViewingOwnVerifiedAccount();
  if (els.batchArchiveReposBtn) {
    els.batchArchiveReposBtn.disabled = selectedCount === 0 || !isOwner;
  }
  if (els.batchDeleteReposBtn) {
    els.batchDeleteReposBtn.disabled = selectedCount === 0 || !isOwner;
    els.batchDeleteReposBtn.title = !isOwner
      ? 'Sign in with a token matching this GitHub account (with delete_repo scope) to delete repositories'
      : '';
  }
}

const LANG_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Shell: '#89e051',
  Dart: '#00B4AB',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Vue: '#41b883',
};

function getLanguageColor(lang) {
  return LANG_COLORS[lang] || '#8b949e';
}

function renderRepoCards() {
  if (!state.reposData) return;
  const visibleRepos = getFilteredAndSortedRepos();
  updateRepoSelectionToolbar(visibleRepos);

  if (visibleRepos.length === 0) {
    els.cardsGrid.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    els.emptyTitle.textContent = 'No repositories match this view';
    els.emptySubtitle.textContent = 'Try adjusting your search or repository filter pills.';
    return;
  }

  els.emptyState.classList.add('hidden');
  const isOwner = isViewingOwnVerifiedAccount();
  const signedInAsDifferentUser =
    state.auth?.authenticated && state.auth?.viewerLogin && !isOwner;

  const html = visibleRepos
    .map((r) => {
      const fullEsc = escapeHtml(r.fullName);
      const nameEsc = escapeHtml(r.name);
      const descEsc = escapeHtml(r.description || '');
      const urlEsc = escapeHtml(r.htmlUrl);
      const langEsc = escapeHtml(r.language || '');
      const isSel = state.selectedRepos.has(r.fullName);
      const actInfo = formatRelativeActivity(r.pushedAt);

      const visBadge = r.isPrivate
        ? `<span class="badge badge-private">🔒 Private</span>`
        : `<span class="badge badge-public">🌐 Public</span>`;
      const forkBadge = r.isFork ? `<span class="badge badge-fork">⑂ Fork</span>` : '';
      const archBadge = r.isArchived ? `<span class="badge badge-archived">📦 Archived</span>` : '';
      const activityBadge = actInfo
        ? `<span class="badge ${actInfo.dormant ? 'badge-dormant' : 'badge-active'}">${escapeHtml(
            actInfo.label
          )}</span>`
        : '';

      const metaParts = [];
      if (langEsc) {
        const langColor = getLanguageColor(r.language);
        metaParts.push(
          `<span><span class="lang-dot" style="background-color:${langColor};"></span>${langEsc}</span>`
        );
      }
      metaParts.push(`<span>💾 ${formatSizeKb(r.sizeKb)}</span>`);

      let actionButtonHtml = '';
      if (isOwner) {
        actionButtonHtml = `
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            data-action="toggle-repo-archive"
            data-repo="${fullEsc}"
            data-archived="${r.isArchived ? 'true' : 'false'}"
            title="${r.isArchived ? 'Unarchive repository' : 'Make read-only (reversible)'}"
          >
            ${r.isArchived ? 'Unarchive' : '📦 Archive'}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-danger"
            data-action="delete-repo-single"
            data-repo="${fullEsc}"
          >
            🗑 Delete
          </button>`;
      } else if (signedInAsDifferentUser) {
        actionButtonHtml = `
          <button type="button" class="btn btn-sm btn-secondary" disabled>
            🔒 Not Your Account
          </button>`;
      } else {
        actionButtonHtml = `
          <button type="button" class="btn btn-sm btn-secondary" data-action="prompt-signin">
            🔑 Sign in to Delete
          </button>`;
      }

      return `
        <article class="user-card ${isSel ? 'selected' : ''}" data-repo="${fullEsc}">
          <div>
            <div class="card-top">
              <div class="card-check-wrap">
                <input
                  type="checkbox"
                  class="card-checkbox"
                  data-action="toggle-repo-select"
                  data-repo="${fullEsc}"
                  ${isSel ? 'checked' : ''}
                  aria-label="Select ${fullEsc}"
                />
              </div>
              <div class="card-identity">
                <div class="card-title-row">
                  <span class="card-name" title="${fullEsc}">${nameEsc}</span>
                </div>
                <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="card-handle">${fullEsc} ↗</a>
                <div class="card-badges">
                  ${visBadge}
                  ${forkBadge}
                  ${archBadge}
                  ${activityBadge}
                </div>
              </div>
            </div>

            ${
              descEsc
                ? `<p class="card-bio" style="margin-top:10px;" title="${descEsc}">${descEsc}</p>`
                : `<p class="card-bio card-bio-empty" style="margin-top:10px;">No description provided</p>`
            }
            <div class="card-meta-tags" style="margin-top:8px;">${metaParts.join('')}</div>
          </div>

          <div class="card-right-group">
            <div class="card-metrics" style="margin-bottom:10px;">
              <div class="metric-item">
                <span class="metric-val">${formatCount(r.stargazersCount)}</span>
                <span class="metric-lbl">Stars</span>
              </div>
              <div class="metric-item">
                <span class="metric-val">${formatCount(r.forksCount)}</span>
                <span class="metric-lbl">Forks</span>
              </div>
              <div class="metric-item">
                <span class="metric-val">${formatSizeKb(r.sizeKb)}</span>
                <span class="metric-lbl">Size</span>
              </div>
            </div>

            <div class="card-actions">
              <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">
                View ↗
              </a>
              ${actionButtonHtml}
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  els.cardsGrid.innerHTML = html;
  saveWorkspaceState();
}

function openDeleteRepoModal(repoFullNames) {
  if (!isViewingOwnVerifiedAccount()) {
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
    return;
  }
  if (!repoFullNames || repoFullNames.length === 0) return;

  state.pendingDeleteRepos = [...repoFullNames];
  const repoMap = new Map((state.reposData?.repos || []).map((r) => [r.fullName, r]));

  els.deleteRepoModalTitle.textContent = `Permanently Delete ${repoFullNames.length} Repositor${
    repoFullNames.length === 1 ? 'y' : 'ies'
  }`;
  els.deleteRepoModalDesc.textContent = `You are about to permanently delete ${
    repoFullNames.length
  } repositor${
    repoFullNames.length === 1 ? 'y' : 'ies'
  } from @${state.auth.viewerLogin}. This cannot be undone.`;

  els.deleteRepoPreviewList.innerHTML = repoFullNames
    .map((fullName) => {
      const r = repoMap.get(fullName);
      const vis = r?.isPrivate ? '🔒 Private' : '🌐 Public';
      const stars = r ? ` · ★${r.stargazersCount}` : '';
      return `<span class="preview-chip">${escapeHtml(fullName)} (${vis}${stars})</span>`;
    })
    .join('');

  els.deleteRepoConfirmInput.value = '';
  els.confirmDeleteRepoBtn.disabled = true;
  els.confirmDeleteRepoBtn.textContent = `Permanently Delete ${repoFullNames.length} Repo${
    repoFullNames.length === 1 ? '' : 's'
  }`;
  els.deleteRepoConfirmWrap.classList.remove('hidden');
  els.deleteRepoProgressWrap.classList.add('hidden');
  els.deleteRepoModalError.classList.add('hidden');
  els.deleteRepoModal.classList.remove('hidden');
  els.deleteRepoConfirmInput.focus();
}

function closeDeleteRepoModal() {
  els.deleteRepoModal.classList.add('hidden');
  state.pendingDeleteRepos = [];
  els.deleteRepoConfirmInput.value = '';
}

function showMissingDeleteRepoScopeError() {
  const isCli = state.runtimeMode === 'local-cli';
  els.deleteRepoProgressWrap.classList.add('hidden');
  els.deleteRepoModalError.classList.remove('hidden');
  els.deleteRepoModalError.innerHTML = isCli
    ? `<strong>Missing <code>delete_repo</code> permission scope.</strong><br/>
       Run <code>gh auth refresh -h github.com -s delete_repo</code> in your terminal or open
       <button type="button" id="inline-repo-auth-btn" class="btn-link">Auth Settings</button> to paste a token with <code>delete_repo</code>.`
    : `<strong>Token with <code>delete_repo</code> scope required.</strong><br/>
       Open <button type="button" id="inline-repo-auth-btn" class="btn-link">Auth Settings</button> and use the <strong>Follow + Repo Deletion</strong> token link.`;

  const btn = document.getElementById('inline-repo-auth-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      closeDeleteRepoModal();
      updateTokenCreationLinks();
      els.authModal.classList.remove('hidden');
    });
  }
  els.confirmDeleteRepoBtn.disabled = false;
}

async function executePendingRepoDelete() {
  const repos = [...state.pendingDeleteRepos];
  if (repos.length === 0) return;
  if (els.deleteRepoConfirmInput.value.trim() !== 'DELETE') return;

  els.confirmDeleteRepoBtn.disabled = true;
  els.deleteRepoModalError.classList.add('hidden');
  els.deleteRepoProgressWrap.classList.remove('hidden');
  els.deleteRepoProgressBar.style.width = '8%';
  els.deleteRepoProgressText.textContent = `Deleting ${repos.length} repositories serially...`;

  const deletedSet = new Set();

  if (state.runtimeMode === 'local-cli') {
    const chunkSize = 5;
    for (let i = 0; i < repos.length; i += chunkSize) {
      const batch = repos.slice(i, i + chunkSize);
      const res = await fetch('/api/repos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: batch }),
      });
      const payload = await res.json();

      if (!res.ok) {
        if (payload.code === 'MISSING_DELETE_REPO_SCOPE' || payload.code === 'NO_TOKEN') {
          showMissingDeleteRepoScopeError();
        } else {
          els.deleteRepoProgressWrap.classList.add('hidden');
          els.deleteRepoModalError.classList.remove('hidden');
          els.deleteRepoModalError.textContent = payload.error || 'Failed to delete repositories.';
          els.confirmDeleteRepoBtn.disabled = false;
        }
        return;
      }

      for (const fullName of payload.succeeded || []) {
        deletedSet.add(fullName.toLowerCase());
        state.selectedRepos.delete(fullName);
      }

      const pct = Math.min(100, Math.round(((i + batch.length) / repos.length) * 100));
      els.deleteRepoProgressBar.style.width = `${pct}%`;
      els.deleteRepoProgressText.textContent = `Deleted ${deletedSet.size} of ${repos.length}...`;
    }
  } else {
    const token = getBrowserPat();
    if (!token) {
      showMissingDeleteRepoScopeError();
      return;
    }

    for (let i = 0; i < repos.length; i++) {
      const fullName = repos[i];
      const [owner, repoName] = fullName.split('/');
      if (i > 0) {
        await sleep(REPO_DELETE_DELAY_MS);
      }

      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
        {
          method: 'DELETE',
          headers: buildGitHubHeaders(token),
        }
      );

      if (res.status === 204) {
        deletedSet.add(fullName.toLowerCase());
        state.selectedRepos.delete(fullName);
      } else {
        const currentScopes = res.headers.get('x-oauth-scopes') || '';
        const isFineGrained = token.startsWith('github_pat_');
        if (
          !isFineGrained &&
          (res.status === 403 || res.status === 404) &&
          !currentScopes.includes('delete_repo')
        ) {
          showMissingDeleteRepoScopeError();
          return;
        }
      }

      const pct = Math.min(100, Math.round(((i + 1) / repos.length) * 100));
      els.deleteRepoProgressBar.style.width = `${pct}%`;
      els.deleteRepoProgressText.textContent = `Deleted ${deletedSet.size} of ${repos.length}...`;
    }
  }

  if (state.reposData?.repos && deletedSet.size > 0) {
    state.reposData.repos = state.reposData.repos.filter(
      (r) => !deletedSet.has(r.fullName.toLowerCase())
    );
  }

  closeDeleteRepoModal();
  renderProfileAndStats();
  renderRepoCards();
  showToast(
    `Permanently deleted ${deletedSet.size} repositor${deletedSet.size === 1 ? 'y' : 'ies'}`
  );
}

async function archiveRepos(repoFullNames, archived = true) {
  if (!isViewingOwnVerifiedAccount()) {
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
    return;
  }
  if (!repoFullNames || repoFullNames.length === 0) return;

  // Skip repos that are already in the target archived state
  const repoMap = new Map((state.reposData?.repos || []).map((r) => [r.fullName.toLowerCase(), r]));
  const targets = repoFullNames.filter((name) => {
    const r = repoMap.get(name.toLowerCase());
    return !r || Boolean(r.isArchived) !== Boolean(archived);
  });

  if (targets.length === 0) {
    showToast(
      archived
        ? 'All selected repositories are already archived'
        : 'All selected repositories are already active'
    );
    return;
  }

  const updatedSet = new Set();
  if (state.runtimeMode === 'local-cli') {
    const res = await fetch('/api/repos/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: targets, archived }),
    });
    const payload = await res.json();
    if (!res.ok) {
      showToast(payload.error || 'Failed to update repository archive state', 'error');
      if (payload.code === 'MISSING_REPO_SCOPE' || payload.code === 'NO_TOKEN') {
        updateTokenCreationLinks();
        els.authModal.classList.remove('hidden');
      }
      return;
    }
    for (const fullName of payload.succeeded || []) {
      updatedSet.add(fullName.toLowerCase());
      state.selectedRepos.delete(fullName);
    }
  } else {
    const token = getBrowserPat();
    if (!token) {
      updateTokenCreationLinks();
      els.authModal.classList.remove('hidden');
      return;
    }
    for (let i = 0; i < targets.length; i++) {
      const fullName = targets[i];
      const [owner, repoName] = fullName.split('/');
      if (i > 0) await sleep(REPO_DELETE_DELAY_MS);
      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
        {
          method: 'PATCH',
          headers: {
            ...buildGitHubHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ archived }),
        }
      );
      if (res.ok) {
        updatedSet.add(fullName.toLowerCase());
        state.selectedRepos.delete(fullName);
      } else {
        const currentScopes = res.headers.get('x-oauth-scopes') || '';
        const errBody = await res.json().catch(() => ({}));
        const msg = String(errBody.message || '');
        if (archived && res.status === 403 && msg.toLowerCase().includes('archived')) {
          updatedSet.add(fullName.toLowerCase());
          state.selectedRepos.delete(fullName);
          continue;
        }
        const isFineGrained = token.startsWith('github_pat_');
        if (!isFineGrained && (res.status === 403 || res.status === 404) && !currentScopes.includes('repo')) {
          showToast('Your token is missing the "repo" scope. Use the Full Housekeeping link in Auth Settings.', 'error');
          updateTokenCreationLinks();
          els.authModal.classList.remove('hidden');
          return;
        }
        showToast(msg || `Could not archive ${fullName} (HTTP ${res.status})`, 'error');
        return;
      }
    }
  }

  if (state.reposData?.repos && updatedSet.size > 0) {
    for (const r of state.reposData.repos) {
      if (updatedSet.has(r.fullName.toLowerCase())) {
        r.isArchived = archived;
      }
    }
    saveScanCache();
  }
  renderProfileAndStats();
  renderRepoCards();
  showToast(
    `${archived ? 'Archived' : 'Unarchived'} ${updatedSet.size} repositor${
      updatedSet.size === 1 ? 'y' : 'ies'
    }`
  );
}

function renderActiveView() {
  if (state.activeTab === 'repos') {
    loadAndRenderRepos();
  } else {
    renderUserCards();
  }
}

function exportCurrentViewCsv() {
  const escapeCsv = (val) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (state.activeTab === 'repos') {
    const repos = getFilteredAndSortedRepos();
    if (repos.length === 0) {
      showToast('No repositories in current view to export', 'error');
      return;
    }

    const headers = [
      'full_name',
      'url',
      'visibility',
      'is_fork',
      'is_archived',
      'language',
      'stars',
      'forks',
      'size_kb',
      'pushed_at',
      'description',
    ];
    const rows = repos.map((r) =>
      [
        r.fullName,
        r.htmlUrl,
        r.isPrivate ? 'private' : 'public',
        r.isFork,
        r.isArchived,
        r.language,
        r.stargazersCount,
        r.forksCount,
        r.sizeKb,
        r.pushedAt || '',
        r.description,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-repos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

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

if (els.rescanBtn) {
  els.rescanBtn.addEventListener('click', () => {
    const target = state.data?.profile?.login || els.usernameInput.value;
    if (target) scanAccount(target);
  });
}

if (els.copyListBtn) {
  els.copyListBtn.addEventListener('click', async () => {
    let lines = [];
    if (state.activeTab === 'repos') {
      lines = getFilteredAndSortedRepos().map((r) => r.fullName);
    } else {
      lines = getFilteredAndSortedUsers().map((u) => `@${u.login}`);
    }
    if (lines.length === 0) {
      showToast('Nothing in current view to copy', 'error');
      return;
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast(`Copied ${lines.length} item${lines.length === 1 ? '' : 's'} to clipboard`);
  });
}

if (els.viewGridBtn && els.viewCompactBtn) {
  els.viewGridBtn.addEventListener('click', () => applyViewMode('grid'));
  els.viewCompactBtn.addEventListener('click', () => applyViewMode('compact'));
}

if (els.autoShieldPopularBtn) {
  els.autoShieldPopularBtn.addEventListener('click', async () => {
    const creators = getUnshieldedPopularCreators().map((u) => u.login);
    if (creators.length > 0) {
      await addToAllowlist(creators);
    }
  });
}

// Keyboard shortcut: Press '/' anywhere (outside inputs) to focus search box
window.addEventListener('keydown', (e) => {
  if (
    e.key === '/' &&
    document.activeElement &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    els.searchInput?.focus();
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
    state.selectedRepos.clear();
    renderProfileAndStats();
    renderActiveView();
  });
});

els.tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    state.selectedLogins.clear();
    state.selectedRepos.clear();
    renderProfileAndStats();
    renderActiveView();
  });
});

els.showAllowlistedCheckbox.addEventListener('change', (e) => {
  state.showAllowlistedInNonFollowers = e.target.checked;
  renderProfileAndStats();
  renderUserCards();
});

els.searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  if (state.activeTab === 'repos') {
    renderRepoCards();
  } else {
    renderUserCards();
  }
});

els.presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.preset = btn.dataset.preset;
    els.presetBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderUserCards();
  });
});

els.repoPresetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.repoPreset = btn.dataset.repoPreset;
    els.repoPresetBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderRepoCards();
  });
});

els.sortSelect.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  renderUserCards();
});

if (els.repoSortSelect) {
  els.repoSortSelect.addEventListener('change', (e) => {
    state.repoSortBy = e.target.value;
    renderRepoCards();
  });
}

els.selectAllCheckbox.addEventListener('change', (e) => {
  if (state.activeTab === 'repos') {
    const visible = getFilteredAndSortedRepos();
    if (e.target.checked) {
      visible.forEach((r) => state.selectedRepos.add(r.fullName));
    } else {
      visible.forEach((r) => state.selectedRepos.delete(r.fullName));
    }
    renderRepoCards();
    return;
  }

  const visible = getFilteredAndSortedUsers();
  if (e.target.checked) {
    visible.forEach((u) => state.selectedLogins.add(u.login));
  } else {
    visible.forEach((u) => state.selectedLogins.delete(u.login));
  }
  renderUserCards();
});

els.clearSelectionBtn.addEventListener('click', () => {
  if (state.activeTab === 'repos') {
    state.selectedRepos.clear();
    renderRepoCards();
  } else {
    state.selectedLogins.clear();
    renderUserCards();
  }
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

if (els.batchArchiveReposBtn) {
  els.batchArchiveReposBtn.addEventListener('click', () => {
    archiveRepos([...state.selectedRepos], true);
  });
}

if (els.batchDeleteReposBtn) {
  els.batchDeleteReposBtn.addEventListener('click', () => {
    openDeleteRepoModal([...state.selectedRepos]);
  });
}

els.cardsGrid.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const login = actionEl.dataset.login;
  const repo = actionEl.dataset.repo;

  if (action === 'prompt-signin') {
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
    return;
  }

  if (action === 'toggle-repo-select' && repo) {
    const isChecked = actionEl.checked;
    if (e.shiftKey && state.lastClickedRepo && state.lastClickedRepo !== repo) {
      const visibleRepos = getFilteredAndSortedRepos().map((r) => r.fullName);
      const startIdx = visibleRepos.indexOf(state.lastClickedRepo);
      const endIdx = visibleRepos.indexOf(repo);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = from; i <= to; i++) {
          if (isChecked) {
            state.selectedRepos.add(visibleRepos[i]);
          } else {
            state.selectedRepos.delete(visibleRepos[i]);
          }
        }
      }
    } else if (isChecked) {
      state.selectedRepos.add(repo);
    } else {
      state.selectedRepos.delete(repo);
    }
    state.lastClickedRepo = repo;
    renderRepoCards();
    return;
  }

  if (action === 'toggle-repo-archive' && repo) {
    const currentlyArchived = actionEl.dataset.archived === 'true';
    archiveRepos([repo], !currentlyArchived);
    return;
  }

  if (action === 'delete-repo-single' && repo) {
    openDeleteRepoModal([repo]);
    return;
  }

  if (!login) return;

  if (action === 'toggle-select') {
    const isChecked = actionEl.checked;
    if (e.shiftKey && state.lastClickedLogin && state.lastClickedLogin !== login) {
      const visibleLogins = getFilteredAndSortedUsers().map((u) => u.login);
      const startIdx = visibleLogins.indexOf(state.lastClickedLogin);
      const endIdx = visibleLogins.indexOf(login);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = from; i <= to; i++) {
          if (isChecked) {
            state.selectedLogins.add(visibleLogins[i]);
          } else {
            state.selectedLogins.delete(visibleLogins[i]);
          }
        }
      }
    } else if (isChecked) {
      state.selectedLogins.add(login);
    } else {
      state.selectedLogins.delete(login);
    }
    state.lastClickedLogin = login;
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

// Delete Repo Modal events
if (els.closeDeleteRepoModal) {
  els.closeDeleteRepoModal.addEventListener('click', closeDeleteRepoModal);
}
if (els.cancelDeleteRepoBtn) {
  els.cancelDeleteRepoBtn.addEventListener('click', closeDeleteRepoModal);
}
if (els.deleteRepoConfirmInput) {
  els.deleteRepoConfirmInput.addEventListener('input', (e) => {
    const valid = e.target.value.trim() === 'DELETE';
    if (els.confirmDeleteRepoBtn) {
      els.confirmDeleteRepoBtn.disabled = !valid;
    }
  });
}
if (els.confirmDeleteRepoBtn) {
  els.confirmDeleteRepoBtn.addEventListener('click', executePendingRepoDelete);
}

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
if (els.errorAuthCtaBtn) {
  els.errorAuthCtaBtn.addEventListener('click', async () => {
    await detectRuntimeAndAuth();
    updateTokenCreationLinks();
    els.authModal.classList.remove('hidden');
  });
}
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
  initViewMode();
  const status = await detectRuntimeAndAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const queryUser = (urlParams.get('user') || urlParams.get('username') || '').trim();
  const initialUser = queryUser || status.viewerLogin || '';

  // Restore exact tab, filters, selections, and cached scan across page refreshes
  const restored = tryRestoreWorkspaceSession(queryUser || status.viewerLogin || '');
  if (restored) {
    return;
  }

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
