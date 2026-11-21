// UI controller. Data access lives in js/backend.js, GitHub logic in
// lib/github.js, and pure helpers in lib/*.js (all covered by tests).

import { USERNAME_REGEX, isAbortError } from './lib/github.js';
import { isAllowlisted as allowlistHas } from './lib/allowlist.js';
import { escapeHtml, safeHttpUrl, formatDuration, plural, toCsv } from './lib/format.js';
import {
  getUsersForTab,
  filterAndSortUsers,
  filterAndSortRepos,
  getUnshieldedCreators,
  rangeBetween,
  diffFollowers,
} from './lib/filters.js';
import { userCardHtml, repoCardHtml, userChipHtml, repoChipHtml, diffChipHtml } from './lib/templates.js';
import { createBackend, detectMode, loadLocalAllowlist, saveLocalAllowlist } from './js/backend.js';
import { KEYS, local, session } from './js/storage.js';

const UNDO_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const state = {
  runtimeMode: 'detecting', // 'local-cli' | 'web-client'
  backend: null,
  theme: 'light',
  viewMode: 'grid',
  auth: null,
  data: null,
  reposData: null,
  allowlist: {},
  activeTab: 'non-followers', // 'non-followers' | 'allowlist' | 'mutuals' | 'fans' | 'repos'
  showAllowlistedInNonFollowers: false,
  searchQuery: '',
  preset: 'all',
  repoPreset: 'all',
  sortBy: 'order-asc',
  repoSortBy: 'pushed-desc',
  selectedLogins: new Set(),
  selectedRepos: new Set(),
  lastClickedLogin: null,
  lastClickedRepo: null,
  pendingUnfollowLogins: [],
  pendingDeleteRepos: [],
  scanController: null,
  opController: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  scanForm: $('scan-form'),
  usernameInput: $('username-input'),
  scanBtn: $('scan-btn'),
  modeBadgeBtn: $('mode-badge-btn'),
  themeToggleBtn: $('theme-toggle-btn'),
  themeIcon: $('theme-icon'),
  themeLabel: $('theme-label'),
  guideBtn: $('guide-btn'),
  authBtn: $('auth-btn'),
  authDot: $('auth-dot'),
  authLabel: $('auth-label'),

  modesExplainer: $('modes-explainer'),
  closeModesExplainer: $('close-modes-explainer'),
  modeCardWeb: $('mode-card-web'),
  modeCardCli: $('mode-card-cli'),
  webActivePill: $('web-active-pill'),
  cliActivePill: $('cli-active-pill'),

  scopeBanner: $('scope-banner'),
  scopeBadgeLabel: $('scope-badge-label'),
  scopeBannerText: $('scope-banner-text'),
  bannerCreateTokenLink: $('banner-create-token-link'),
  copyGhCmdBtn: $('copy-gh-cmd-btn'),
  openAuthModalBtn: $('open-auth-modal-btn'),

  summarySection: $('summary-section'),
  profileAvatar: $('profile-avatar'),
  profileName: $('profile-name'),
  profileLink: $('profile-link'),
  scanModeChip: $('scan-mode-chip'),
  ownershipChip: $('ownership-chip'),
  switchToViewerBtn: $('switch-to-viewer-btn'),
  rescanBtn: $('rescan-btn'),
  copyListBtn: $('copy-list-btn'),
  snapshotDiffBanner: $('snapshot-diff-banner'),
  undoBanner: $('undo-banner'),
  undoBannerText: $('undo-banner-text'),
  undoRefollowBtn: $('undo-refollow-btn'),
  undoDismissBtn: $('undo-dismiss-btn'),
  profileBio: $('profile-bio'),
  exportCsvBtn: $('export-csv-btn'),
  exportAllowlistBtn: $('export-allowlist-btn'),
  importAllowlistInput: $('import-allowlist-input'),

  statActionable: $('stat-actionable'),
  statNonFollowersTotal: $('stat-nonfollowers-total'),
  statAllowlisted: $('stat-allowlisted'),
  statAllowlistStorage: $('stat-allowlist-storage'),
  statMutuals: $('stat-mutuals'),
  statReciprocity: $('stat-reciprocity'),
  statFans: $('stat-fans'),
  statTotals: $('stat-totals'),
  statRepos: $('stat-repos'),
  statReposMeta: $('stat-repos-meta'),
  statCards: document.querySelectorAll('.stat-card'),

  controlsSection: $('controls-section'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabCountNonFollowers: $('tab-count-non-followers'),
  tabCountAllowlist: $('tab-count-allowlist'),
  tabCountMutuals: $('tab-count-mutuals'),
  tabCountFans: $('tab-count-fans'),
  tabCountRepos: $('tab-count-repos'),
  includeAllowlistedWrap: $('include-allowlisted-wrap'),
  showAllowlistedCheckbox: $('show-allowlisted-in-nonfollowers'),

  searchInput: $('search-input'),
  userPresetPills: $('user-preset-pills'),
  repoPresetPills: $('repo-preset-pills'),
  presetBtns: document.querySelectorAll('.pill-btn[data-preset]'),
  repoPresetBtns: document.querySelectorAll('.repo-pill-btn[data-repo-preset]'),
  userSortBox: $('user-sort-box'),
  repoSortBox: $('repo-sort-box'),
  sortSelect: $('sort-select'),
  repoSortSelect: $('repo-sort-select'),
  viewGridBtn: $('view-grid-btn'),
  viewCompactBtn: $('view-compact-btn'),

  selectAllCheckbox: $('select-all-checkbox'),
  selectionSummary: $('selection-summary'),
  clearSelectionBtn: $('clear-selection-btn'),
  autoShieldPopularBtn: $('auto-shield-popular-btn'),
  batchAllowlistAddBtn: $('batch-allowlist-add-btn'),
  batchAllowlistRemoveBtn: $('batch-allowlist-remove-btn'),
  batchUnfollowBtn: $('batch-unfollow-btn'),
  batchArchiveReposBtn: $('batch-archive-repos-btn'),
  batchUnarchiveReposBtn: $('batch-unarchive-repos-btn'),
  batchDeleteReposBtn: $('batch-delete-repos-btn'),

  activityBar: $('activity-bar'),
  activityText: $('activity-text'),
  activityProgressBar: $('activity-progress-bar'),
  activityStopBtn: $('activity-stop-btn'),

  welcomeState: $('welcome-state'),
  loadingState: $('loading-state'),
  loadingText: $('loading-text'),
  loadingSubtext: $('loading-subtext'),
  cancelScanBtn: $('cancel-scan-btn'),
  errorState: $('error-state'),
  errorTitle: $('error-title'),
  errorMessage: $('error-message'),
  errorActions: $('error-actions'),
  errorAuthCtaBtn: $('error-auth-cta-btn'),
  errorRetryBtn: $('error-retry-btn'),
  emptyState: $('empty-state'),
  emptyTitle: $('empty-title'),
  emptySubtitle: $('empty-subtitle'),
  cardsGrid: $('cards-grid'),

  unfollowModal: $('unfollow-modal'),
  unfollowModalTitle: $('unfollow-modal-title'),
  unfollowModalDesc: $('unfollow-modal-desc'),
  unfollowPreviewList: $('unfollow-preview-list'),
  unfollowProgressWrap: $('unfollow-progress-wrap'),
  unfollowProgressBar: $('unfollow-progress-bar'),
  unfollowProgressText: $('unfollow-progress-text'),
  unfollowModalError: $('unfollow-modal-error'),
  closeUnfollowModal: $('close-unfollow-modal'),
  cancelUnfollowBtn: $('cancel-unfollow-btn'),
  confirmUnfollowBtn: $('confirm-unfollow-btn'),

  deleteRepoModal: $('delete-repo-modal'),
  deleteRepoModalTitle: $('delete-repo-modal-title'),
  deleteRepoModalDesc: $('delete-repo-modal-desc'),
  deleteRepoPreviewList: $('delete-repo-preview-list'),
  deleteRepoConfirmWrap: $('delete-repo-confirm-wrap'),
  deleteRepoConfirmInput: $('delete-repo-confirm-input'),
  deleteRepoProgressWrap: $('delete-repo-progress-wrap'),
  deleteRepoProgressBar: $('delete-repo-progress-bar'),
  deleteRepoProgressText: $('delete-repo-progress-text'),
  deleteRepoModalError: $('delete-repo-modal-error'),
  closeDeleteRepoModal: $('close-delete-repo-modal'),
  cancelDeleteRepoBtn: $('cancel-delete-repo-btn'),
  confirmDeleteRepoBtn: $('confirm-delete-repo-btn'),

  authModal: $('auth-modal'),
  closeAuthModal: $('close-auth-modal'),
  modalRuntimeMode: $('modal-runtime-mode'),
  modalAuthSource: $('modal-auth-source'),
  modalAuthUser: $('modal-auth-user'),
  modalAuthScopes: $('modal-auth-scopes'),
  modalFollowPerm: $('modal-follow-perm'),
  modalRepoPerm: $('modal-repo-perm'),
  modalDeleteRepoPerm: $('modal-delete-repo-perm'),
  modalRateLimit: $('modal-rate-limit'),
  modalCreateTokenLink: $('modal-create-token-link'),
  modalCreateRepoTokenLink: $('modal-create-repo-token-link'),
  modalGhCliSection: $('modal-gh-cli-section'),
  modalCopyGhBtn: $('modal-copy-gh-btn'),
  customPatInput: $('custom-pat-input'),
  clearPatBtn: $('clear-pat-btn'),
  savePatBtn: $('save-pat-btn'),

  toastContainer: $('toast-container'),
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const show = (el, visible = true) => el?.classList.toggle('hidden', !visible);
const hide = (el) => show(el, false);
const errorText = (err) => (err instanceof Error ? err.message : String(err));
const isAllowlisted = (login) => allowlistHas(state.allowlist, login);
const isCli = () => state.runtimeMode === 'local-cli';

function showToast(message, type = 'success', { action, onAction, duration = 4200 } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  if (action && onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action;
    btn.addEventListener('click', () => {
      toast.remove();
      onAction();
    });
    toast.appendChild(btn);
  }
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function retryMessage({ waitMs, reason }) {
  const why = reason === 'server' ? 'GitHub is temporarily unavailable' : 'GitHub rate limit reached';
  return `${why}. Waiting ${formatDuration(waitMs)} before retrying automatically...`;
}

function openAuthModal() {
  updateTokenCreationLinks();
  show(els.authModal);
}

// ---------------------------------------------------------------------------
// Theme and view mode
// ---------------------------------------------------------------------------

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  local.set(KEYS.theme, theme);
  els.themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
  els.themeLabel.textContent = theme === 'light' ? 'Dark' : 'Light';
}

function applyViewMode(mode) {
  state.viewMode = mode;
  local.set(KEYS.view, mode);
  els.cardsGrid.classList.toggle('compact-view', mode === 'compact');
  els.viewGridBtn.classList.toggle('active', mode === 'grid');
  els.viewCompactBtn.classList.toggle('active', mode === 'compact');
  els.viewGridBtn.setAttribute('aria-pressed', String(mode === 'grid'));
  els.viewCompactBtn.setAttribute('aria-pressed', String(mode === 'compact'));
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

function saveWorkspaceState() {
  session.setJson(KEYS.uiState, {
    username: state.data?.profile?.login || els.usernameInput.value.trim() || '',
    activeTab: state.activeTab,
    showAllowlistedInNonFollowers: state.showAllowlistedInNonFollowers,
    searchQuery: state.searchQuery,
    preset: state.preset,
    repoPreset: state.repoPreset,
    sortBy: state.sortBy,
    repoSortBy: state.repoSortBy,
    selectedLogins: [...state.selectedLogins],
    selectedRepos: [...state.selectedRepos],
  });
}

function saveScanCache() {
  if (!state.data?.profile?.login) return;
  session.setJson(KEYS.scanCache, {
    username: state.data.profile.login,
    data: state.data,
    reposData: state.reposData,
    cachedAt: new Date().toISOString(),
  });
}

function syncControlsFromState() {
  els.searchInput.value = state.searchQuery;
  els.showAllowlistedCheckbox.checked = state.showAllowlistedInNonFollowers;
  els.sortSelect.value = state.sortBy;
  els.repoSortSelect.value = state.repoSortBy;
  els.presetBtns.forEach((b) => b.classList.toggle('active', b.dataset.preset === state.preset));
  els.repoPresetBtns.forEach((b) => b.classList.toggle('active', b.dataset.repoPreset === state.repoPreset));
}

function tryRestoreWorkspaceSession(preferredUsername) {
  const cache = session.getJson(KEYS.scanCache);
  if (!cache?.data?.profile?.login) return false;
  if (preferredUsername && cache.username.toLowerCase() !== preferredUsername.toLowerCase()) return false;

  state.data = cache.data;
  state.reposData = cache.reposData || null;
  state.allowlist = isCli() ? cache.data.allowlist || loadLocalAllowlist() : loadLocalAllowlist();

  const ui = session.getJson(KEYS.uiState);
  if (ui) {
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

  els.usernameInput.value = cache.username;
  updateTokenCreationLinks(cache.username);
  syncControlsFromState();
  show(els.summarySection);
  show(els.controlsSection);
  hide(els.welcomeState);
  hide(els.loadingState);

  renderModeAndAuthUI();
  renderProfileAndStats();
  renderUndoBanner();
  renderActiveView();
  return true;
}

// ---------------------------------------------------------------------------
// Realtime follower diff
// ---------------------------------------------------------------------------

function computeAndRenderSnapshotDiff(payload) {
  const storageKey = `${KEYS.snapshotPrefix}${payload.profile.login.toLowerCase()}`;
  const currentFollowers = [...payload.mutuals, ...payload.fans].map((u) => u.login);
  const prev = local.getJson(storageKey);
  local.setJson(storageKey, { scannedAt: new Date().toISOString(), followers: currentFollowers });

  if (!prev || !Array.isArray(prev.followers)) return hide(els.snapshotDiffBanner);
  const { lost, gained } = diffFollowers(prev.followers, currentFollowers);
  if (lost.length === 0 && gained.length === 0) return hide(els.snapshotDiffBanner);

  const parts = [];
  if (lost.length) parts.push(`<strong>${lost.length}</strong> unfollowed you`);
  if (gained.length) parts.push(`<strong>${gained.length}</strong> new follower${gained.length === 1 ? '' : 's'}`);
  const chips = [
    ...lost.slice(0, 12).map((l) => diffChipHtml(l, 'lost')),
    ...gained.slice(0, 12).map((l) => diffChipHtml(l, 'gained')),
  ].join('');

  els.snapshotDiffBanner.innerHTML = `
    <div>
      <strong>🔔 Changes Since Last Scan:</strong>
      <span>${parts.join(' · ')}</span>
      <div class="diff-chips">${chips}</div>
    </div>`;
  show(els.snapshotDiffBanner);
}

// ---------------------------------------------------------------------------
// Auth and token helper
// ---------------------------------------------------------------------------

function updateTokenCreationLinks(targetUsername) {
  const cleanUser = (targetUsername || state.data?.profile?.login || els.usernameInput.value || '')
    .trim()
    .replace(/^@/, '');
  const suffix = cleanUser ? ` (@${cleanUser})` : '';
  const tokenUrl = (description, scopes) =>
    `https://github.com/settings/tokens/new?description=${encodeURIComponent(description)}&scopes=${scopes}`;

  const followUrl = tokenUrl(`GitHub Housekeeping: Follow${suffix}`, 'user:follow');
  const fullUrl = tokenUrl(`GitHub Housekeeping: Follow + Repos${suffix}`, 'user:follow,repo,delete_repo');

  els.bannerCreateTokenLink.href = followUrl;
  els.bannerCreateTokenLink.textContent = cleanUser
    ? `1. Generate Token for @${cleanUser} ↗`
    : '1. Generate Token on GitHub ↗';
  els.modalCreateTokenLink.href = followUrl;
  els.modalCreateTokenLink.textContent = 'Follow Housekeeping Only (user:follow) ↗';
  els.modalCreateRepoTokenLink.href = fullUrl;
  els.modalCreateRepoTokenLink.textContent = 'Full Housekeeping: Follow + Archive/Delete Repos (user:follow, repo, delete_repo) ↗';
}

function isViewingOwnVerifiedAccount() {
  const viewer = state.auth?.authenticated ? state.auth.viewerLogin : null;
  const scanned = state.data?.profile?.login;
  return Boolean(viewer && scanned && viewer.toLowerCase() === scanned.toLowerCase());
}

function authSourceLabel(source) {
  if (source === 'gh-cli') return 'gh CLI';
  if (source === 'browser-pat') return 'Browser PAT';
  return 'PAT';
}

function renderModeAndAuthUI() {
  const cli = isCli();
  const s = state.auth;
  updateTokenCreationLinks();

  els.modeBadgeBtn.textContent = cli ? '💻 Local CLI Mode' : '🌐 Web App Mode';
  els.modeBadgeBtn.className = `mode-badge ${cli ? 'mode-cli' : 'mode-web'}`;
  els.modeCardCli.classList.toggle('active-mode', cli);
  els.modeCardWeb.classList.toggle('active-mode', !cli);
  show(els.cliActivePill, cli);
  show(els.webActivePill, !cli);
  els.statAllowlistStorage.textContent = cli ? 'Saved to disk (allowlist.json)' : 'Saved in browser localStorage';
  els.modalRuntimeMode.textContent = cli ? '💻 Local CLI Server (127.0.0.1)' : '🌐 Web App Mode (Browser-Direct)';
  show(els.modalGhCliSection, cli);
  els.clearPatBtn.textContent = cli ? 'Use Default (gh CLI)' : 'Clear Browser Token';

  const scannedLogin = state.data?.profile?.login;
  const viewingDifferentAccount =
    s?.authenticated && s.viewerLogin && scannedLogin && s.viewerLogin.toLowerCase() !== scannedLogin.toLowerCase();

  if (!s?.authenticated) {
    els.authDot.className = 'status-dot';
    els.authLabel.textContent = 'Sign In / Get Token';
    show(els.scopeBanner);
    els.scopeBadgeLabel.textContent = 'Public Read-Only View';
    show(els.bannerCreateTokenLink);
    show(els.copyGhCmdBtn, cli);
    els.scopeBannerText.innerHTML =
      'Anyone can view public GitHub following lists, but <strong>unfollowing and repository changes are locked</strong> until you verify account ownership with a token.';
  } else if (viewingDifferentAccount) {
    els.authDot.className = 'status-dot readonly';
    els.authLabel.textContent = `Signed in as @${s.viewerLogin}`;
    show(els.scopeBanner);
    // textContent: no escaping needed (escaping here would show &amp; literally)
    els.scopeBadgeLabel.textContent = `Viewing @${scannedLogin} (Read-Only)`;
    hide(els.bannerCreateTokenLink);
    hide(els.copyGhCmdBtn);
    els.scopeBannerText.innerHTML = `You are signed in as <strong>@${escapeHtml(s.viewerLogin)}</strong>, so changes are disabled while browsing <strong>@${escapeHtml(scannedLogin)}</strong>'s public profile.`;
  } else if (s.hasFollowScope) {
    els.authDot.className = 'status-dot online';
    els.authLabel.textContent = `@${s.viewerLogin} (${authSourceLabel(s.source)} · Verified Owner)`;
    hide(els.scopeBanner);
  } else {
    els.authDot.className = 'status-dot readonly';
    els.authLabel.textContent = `@${s.viewerLogin} (${authSourceLabel(s.source)} · Read-Only)`;
    show(els.scopeBanner);
    els.scopeBadgeLabel.textContent = 'Missing user:follow Permission';
    show(els.bannerCreateTokenLink);
    show(els.copyGhCmdBtn, cli);
    els.scopeBannerText.innerHTML =
      'Your token is verified, but lacks the <code>user:follow</code> permission needed to unfollow users. Click <strong>1. Generate Token</strong> to create one with <code>user:follow</code> pre-selected.';
  }

  if (s?.authenticated) {
    els.modalAuthSource.textContent =
      s.source === 'gh-cli'
        ? 'GitHub CLI (gh auth)'
        : s.source === 'browser-pat'
        ? 'Browser Session Token (Client-Direct)'
        : 'Custom Personal Access Token';
    els.modalAuthUser.textContent = `@${s.viewerLogin} (${s.viewerName || ''})`;
    els.modalAuthScopes.textContent = s.isFineGrained ? 'Fine-grained PAT' : s.scopes?.length ? s.scopes.join(', ') : 'none';
    els.modalFollowPerm.textContent = s.hasFollowScope ? '✅ Enabled (can unfollow and re-follow)' : '⚠️ Missing user:follow scope (Read-only)';
    els.modalRepoPerm.textContent = s.hasRepoScope
      ? '✅ Enabled (can view private repos and archive/unarchive)'
      : '⚠️ Missing repo scope (public repos only; cannot archive)';
    els.modalDeleteRepoPerm.textContent = s.hasDeleteRepoScope
      ? '✅ Enabled (can delete repos)'
      : '⚠️ Missing delete_repo scope (cannot delete repos)';
  } else {
    els.modalAuthSource.textContent = 'None (Public Read-Only API)';
    els.modalAuthUser.textContent = 'Not signed in';
    els.modalAuthScopes.textContent = 'none';
    els.modalFollowPerm.textContent = '❌ Sign in with a token to verify ownership and unfollow';
    els.modalRepoPerm.textContent = '❌ Sign in with a repo token to archive repos';
    els.modalDeleteRepoPerm.textContent = '❌ Sign in with a delete_repo token to delete repos';
  }
  renderRateLimit();
}

function renderRateLimit() {
  const rl = state.auth?.rateLimit;
  if (rl?.limit) {
    const reset = rl.reset ? ` (resets ${new Date(rl.reset * 1000).toLocaleTimeString()})` : '';
    els.modalRateLimit.textContent = `${rl.remaining.toLocaleString()} / ${rl.limit.toLocaleString()} requests remaining${reset}`;
  } else {
    els.modalRateLimit.textContent = state.auth?.authenticated
      ? '5,000 requests/hr'
      : '60 requests/hr (unauthenticated public limit)';
  }
}

async function refreshAuth() {
  try {
    state.auth = await state.backend.status();
  } catch (err) {
    state.auth = { authenticated: false, error: errorText(err) };
  }
  renderModeAndAuthUI();
  return state.auth;
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function showLoading(text, { cancellable = false } = {}) {
  els.loadingText.textContent = text;
  els.loadingSubtext.textContent = '';
  hide(els.loadingSubtext);
  show(els.cancelScanBtn, cancellable);
  show(els.loadingState);
  hide(els.errorState);
  hide(els.emptyState);
  els.cardsGrid.innerHTML = '';
}

function showError(title, message, { retry, tokenCta = false } = {}) {
  hide(els.loadingState);
  show(els.errorState);
  els.errorTitle.textContent = title;
  els.errorMessage.textContent = message;
  show(els.errorAuthCtaBtn, tokenCta);
  show(els.errorRetryBtn, Boolean(retry));
  els.errorRetryBtn.onclick = retry || null;
  show(els.errorActions, tokenCta || Boolean(retry));
}

function progressText(kindLabel) {
  return ({ kind, fetched, total }) => {
    const of = total ? ` of ${total.toLocaleString()}` : '';
    els.loadingText.textContent = `${kindLabel}: fetched ${fetched.toLocaleString()}${of} ${kind}...`;
    hide(els.loadingSubtext);
  };
}

function onLoadingRetry(info) {
  els.loadingSubtext.textContent = retryMessage(info);
  show(els.loadingSubtext);
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

async function scanAccount(username) {
  const cleanUser = (username || '').trim().replace(/^@/, '');
  if (!cleanUser) return show(els.welcomeState);
  if (!USERNAME_REGEX.test(cleanUser)) {
    hide(els.welcomeState);
    return showError('Invalid username', `"${cleanUser}" is not a valid GitHub username.`);
  }

  state.scanController?.abort();
  const controller = new AbortController();
  state.scanController = controller;

  els.usernameInput.value = cleanUser;
  updateTokenCreationLinks(cleanUser);
  hide(els.welcomeState);
  els.scanBtn.disabled = true;
  els.scanBtn.textContent = 'Scanning...';
  showLoading(`Scanning @${cleanUser}'s following and followers...`, { cancellable: true });

  try {
    const payload = await state.backend.analyze(cleanUser, {
      signal: controller.signal,
      onProgress: progressText(`Scanning @${cleanUser}`),
      onRetry: onLoadingRetry,
    });

    state.data = payload;
    state.reposData = null;
    state.allowlist = payload.allowlist || {};
    saveLocalAllowlist(state.allowlist);
    state.selectedLogins.clear();
    state.selectedRepos.clear();
    state.lastClickedLogin = null;
    state.lastClickedRepo = null;
    els.tabCountRepos.textContent = '-';

    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('user', payload.profile.login);
      window.history.replaceState({}, '', nextUrl.toString());
    } catch {
      // ignore
    }

    computeAndRenderSnapshotDiff(payload);
    show(els.summarySection);
    show(els.controlsSection);
    hide(els.loadingState);

    refreshAuth(); // update rate-limit readout in the background
    renderModeAndAuthUI();
    renderProfileAndStats();
    renderUndoBanner();
    saveScanCache();
    saveWorkspaceState();
    if (state.activeTab === 'repos') await loadAndRenderRepos();
    else renderUserCards();
  } catch (err) {
    if (isAbortError(err)) {
      if (state.scanController === controller) {
        hide(els.loadingState);
        if (state.data) renderActiveView();
        else show(els.welcomeState);
        showToast('Scan cancelled', 'info');
      }
      return;
    }
    const msg = errorText(err);
    const tokenCta = !state.auth?.authenticated && /rate limit|token/i.test(msg);
    showError('Could not complete scan', msg, { tokenCta, retry: () => scanAccount(cleanUser) });
  } finally {
    if (state.scanController === controller) {
      state.scanController = null;
      els.scanBtn.disabled = false;
      els.scanBtn.textContent = 'Scan Account';
      hide(els.cancelScanBtn);
    }
  }
}

async function loadAndRenderRepos(force = false) {
  if (!state.data?.profile?.login) return;
  const username = state.data.profile.login;

  if (!force && state.reposData?.username?.toLowerCase() === username.toLowerCase()) {
    renderProfileAndStats();
    renderRepoCards();
    return;
  }

  state.scanController?.abort();
  const controller = new AbortController();
  state.scanController = controller;
  showLoading(`Loading repositories for @${username}...`, { cancellable: true });

  try {
    state.reposData = await state.backend.repos(username, {
      isOwner: isViewingOwnVerifiedAccount(),
      signal: controller.signal,
      onProgress: progressText(`Loading @${username}`),
      onRetry: onLoadingRetry,
    });
    hide(els.loadingState);
    saveScanCache();
    renderProfileAndStats();
    renderRepoCards();
  } catch (err) {
    if (isAbortError(err)) {
      if (state.scanController === controller) {
        hide(els.loadingState);
        show(els.emptyState);
        els.emptyTitle.textContent = 'Repository loading was cancelled';
        els.emptySubtitle.textContent = 'Click "Refresh Live" or switch tabs to try again.';
      }
      return;
    }
    showError('Could not load repositories', errorText(err), { retry: () => loadAndRenderRepos(true) });
  } finally {
    if (state.scanController === controller) {
      state.scanController = null;
      hide(els.cancelScanBtn);
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderProfileAndStats() {
  if (!state.data) return;
  const { profile, nonFollowers, mutuals, fans, enriched } = state.data;

  els.profileAvatar.src = safeHttpUrl(profile.avatarUrl);
  els.profileAvatar.alt = profile.login;
  els.profileName.textContent = profile.name || profile.login;
  els.profileLink.textContent = `@${profile.login} ↗`;
  els.profileLink.href = safeHttpUrl(profile.url);
  els.profileBio.textContent = profile.bio || '';
  els.scanModeChip.textContent = enriched ? '⚡ Enriched GraphQL Scan' : 'Public REST Scan';

  const isOwner = isViewingOwnVerifiedAccount();
  if (isOwner) {
    els.ownershipChip.textContent = '✅ Verified Account Owner';
    els.ownershipChip.className = 'scan-chip chip-verified';
    hide(els.switchToViewerBtn);
  } else if (state.auth?.authenticated && state.auth.viewerLogin) {
    els.ownershipChip.textContent = `👁 Read-Only (Not @${state.auth.viewerLogin})`;
    els.ownershipChip.className = 'scan-chip chip-foreign';
    els.switchToViewerBtn.textContent = `Switch to My Account (@${state.auth.viewerLogin})`;
    show(els.switchToViewerBtn);
  } else {
    els.ownershipChip.textContent = '👁 Public Read-Only View';
    els.ownershipChip.className = 'scan-chip chip-foreign';
    hide(els.switchToViewerBtn);
  }

  const totalNonFollowers = nonFollowers.length;
  const allowlistedNonFollowers = nonFollowers.filter((u) => isAllowlisted(u.login)).length;
  const actionable = totalNonFollowers - allowlistedNonFollowers;
  const totalAllowlisted = Object.keys(state.allowlist).length;
  const totalFollowing = totalNonFollowers + mutuals.length;
  const totalFollowers = mutuals.length + fans.length;
  const reciprocity = totalFollowing > 0 ? Math.round((mutuals.length / totalFollowing) * 100) : 0;

  els.statActionable.textContent = actionable.toLocaleString();
  els.statNonFollowersTotal.textContent =
    allowlistedNonFollowers > 0
      ? `${totalNonFollowers} total (${allowlistedNonFollowers} allowlisted)`
      : `${totalNonFollowers} total non-followers`;
  els.statAllowlisted.textContent = totalAllowlisted.toLocaleString();
  els.statMutuals.textContent = mutuals.length.toLocaleString();
  els.statReciprocity.textContent = `${reciprocity}% reciprocity rate`;
  els.statFans.textContent = fans.length.toLocaleString();
  els.statTotals.textContent = `${totalFollowing} Following · ${totalFollowers} Followers`;

  els.tabCountNonFollowers.textContent = state.showAllowlistedInNonFollowers ? totalNonFollowers : actionable;
  els.tabCountAllowlist.textContent = totalAllowlisted;
  els.tabCountMutuals.textContent = mutuals.length;
  els.tabCountFans.textContent = fans.length;

  if (state.reposData) {
    const repos = state.reposData.repos;
    const priv = repos.filter((r) => r.isPrivate).length;
    const archived = repos.filter((r) => r.isArchived).length;
    els.tabCountRepos.textContent = repos.length;
    els.statRepos.textContent = repos.length.toLocaleString();
    const vis = state.reposData.includesPrivate ? `${repos.length - priv} public · ${priv} private` : `${repos.length} public`;
    els.statReposMeta.textContent = archived ? `${vis} · ${archived} archived` : vis;
  } else {
    els.statRepos.textContent = '-';
    els.statReposMeta.textContent = 'Click to inspect and clean up';
  }

  els.statCards.forEach((card) => card.classList.toggle('active', card.dataset.tab === state.activeTab));
  els.tabBtns.forEach((btn) => {
    const active = btn.dataset.tab === state.activeTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const isRepoTab = state.activeTab === 'repos';
  show(els.includeAllowlistedWrap, state.activeTab === 'non-followers');
  show(els.userPresetPills, !isRepoTab);
  show(els.repoPresetPills, isRepoTab);
  show(els.userSortBox, !isRepoTab);
  show(els.repoSortBox, isRepoTab);
  els.searchInput.placeholder = isRepoTab
    ? 'Filter by repository name, description, or language... (Press /)'
    : 'Filter by username, name, bio, company, or location... (Press /)';

  show(els.batchAllowlistRemoveBtn, state.activeTab === 'allowlist');
  show(els.batchAllowlistAddBtn, state.activeTab !== 'allowlist' && !isRepoTab);
  show(els.batchUnfollowBtn, !isRepoTab && state.activeTab !== 'fans');
  show(els.batchArchiveReposBtn, isRepoTab && state.repoPreset !== 'archived');
  show(els.batchUnarchiveReposBtn, isRepoTab && state.repoPreset === 'archived');
  show(els.batchDeleteReposBtn, isRepoTab);
}

function getVisibleUsers() {
  const base = getUsersForTab(state.data, state.activeTab, state.allowlist, {
    includeAllowlisted: state.showAllowlistedInNonFollowers,
  });
  return filterAndSortUsers(base, { query: state.searchQuery, preset: state.preset, sortBy: state.sortBy });
}

function getVisibleRepos() {
  return filterAndSortRepos(state.reposData?.repos || [], {
    query: state.searchQuery,
    preset: state.repoPreset,
    sortBy: state.repoSortBy,
  });
}

function updateSelectAll(visibleIds, selectedSet, noun) {
  const selectedCount = selectedSet.size;
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  els.selectAllCheckbox.checked = allSelected;
  els.selectAllCheckbox.indeterminate = !allSelected && visibleIds.some((id) => selectedSet.has(id));
  els.selectionSummary.textContent =
    selectedCount > 0
      ? `${plural(selectedCount, noun)} selected (of ${visibleIds.length} visible)`
      : `Select All Visible (${visibleIds.length})`;
  show(els.clearSelectionBtn, selectedCount > 0);
  document.querySelectorAll('.sel-count').forEach((el) => {
    el.textContent = String(selectedCount);
  });
  return selectedCount;
}

function updateSelectionToolbar(visibleUsers) {
  const selectedCount = updateSelectAll(visibleUsers.map((u) => u.login), state.selectedLogins, 'user');

  const creators = getUnshieldedCreators(state.data?.nonFollowers, state.allowlist);
  const showAutoShield = state.activeTab === 'non-followers' && creators.length > 0;
  show(els.autoShieldPopularBtn, showAutoShield);
  if (showAutoShield) els.autoShieldPopularBtn.textContent = `✨ Auto-Shield Creators (${creators.length})`;

  const isOwner = isViewingOwnVerifiedAccount();
  const busy = Boolean(state.opController);
  els.batchAllowlistAddBtn.disabled = selectedCount === 0;
  els.batchAllowlistRemoveBtn.disabled = selectedCount === 0;
  els.batchUnfollowBtn.disabled = selectedCount === 0 || state.activeTab === 'fans' || !isOwner || busy;
  els.batchUnfollowBtn.title = !isOwner ? 'Sign in with a token matching this GitHub account to enable batch unfollowing' : '';
}

function renderEmpty(title, subtitle) {
  els.cardsGrid.innerHTML = '';
  show(els.emptyState);
  els.emptyTitle.textContent = title;
  els.emptySubtitle.textContent = subtitle;
}

function renderUserCards() {
  if (!state.data) return;
  hide(els.errorState);
  const visible = getVisibleUsers();
  updateSelectionToolbar(visible);

  if (visible.length === 0) {
    if (state.activeTab === 'non-followers' && state.data.nonFollowers.length > 0) {
      renderEmpty(
        'All non-followers are either filtered out or on your Allowlist!',
        'Check the "Allowlist / Ignored" tab or adjust your search and filter pills above.'
      );
    } else if (state.activeTab === 'allowlist') {
      renderEmpty('Your Allowlist is currently empty', 'Click "Keep (Allowlist)" on any user card to protect them from housekeeping unfollows.');
    } else {
      renderEmpty('No users match this view', 'Try adjusting your search or filter settings.');
    }
    saveWorkspaceState();
    return;
  }

  hide(els.emptyState);
  const ctx = {
    tab: state.activeTab,
    isOwner: isViewingOwnVerifiedAccount(),
    viewerLogin: state.auth?.authenticated ? state.auth.viewerLogin : null,
    profileLogin: state.data.profile.login,
    now: Date.now(),
  };
  els.cardsGrid.innerHTML = visible
    .map((u) => userCardHtml(u, { ...ctx, selected: state.selectedLogins.has(u.login), allowlisted: isAllowlisted(u.login) }))
    .join('');
  saveWorkspaceState();
}

function updateRepoSelectionToolbar(visibleRepos) {
  const selectedCount = updateSelectAll(visibleRepos.map((r) => r.fullName), state.selectedRepos, 'repo');
  hide(els.autoShieldPopularBtn);
  const isOwner = isViewingOwnVerifiedAccount();
  const disabled = selectedCount === 0 || !isOwner || Boolean(state.opController);
  els.batchArchiveReposBtn.disabled = disabled;
  els.batchUnarchiveReposBtn.disabled = disabled;
  els.batchDeleteReposBtn.disabled = disabled;
  els.batchDeleteReposBtn.title = !isOwner
    ? 'Sign in with a token matching this GitHub account (with delete_repo scope) to delete repositories'
    : '';
}

function renderRepoCards() {
  if (!state.reposData) return;
  hide(els.errorState);
  const visible = getVisibleRepos();
  updateRepoSelectionToolbar(visible);

  if (visible.length === 0) {
    renderEmpty('No repositories match this view', 'Try adjusting your search or repository filter pills.');
    saveWorkspaceState();
    return;
  }

  hide(els.emptyState);
  const ctx = {
    isOwner: isViewingOwnVerifiedAccount(),
    viewerLogin: state.auth?.authenticated ? state.auth.viewerLogin : null,
    now: Date.now(),
  };
  els.cardsGrid.innerHTML = visible
    .map((r) => repoCardHtml(r, { ...ctx, selected: state.selectedRepos.has(r.fullName) }))
    .join('');
  saveWorkspaceState();
}

function renderActiveView() {
  if (state.activeTab === 'repos') loadAndRenderRepos();
  else renderUserCards();
}

function rerenderCurrent() {
  renderProfileAndStats();
  if (state.activeTab === 'repos') renderRepoCards();
  else renderUserCards();
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

async function updateAllowlist(usernames, add) {
  if (!usernames?.length) return;
  try {
    state.allowlist = add
      ? await state.backend.allowlistAdd(state.allowlist, usernames)
      : await state.backend.allowlistRemove(state.allowlist, usernames);
    if (state.data) state.data.allowlist = state.allowlist;
    usernames.forEach((u) => state.selectedLogins.delete(u));
    saveScanCache();
    rerenderCurrent();
    showToast(`${add ? 'Added' : 'Removed'} ${plural(usernames.length, 'user')} ${add ? 'to' : 'from'} Allowlist`);
  } catch (err) {
    showToast(`Could not update allowlist: ${errorText(err)}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Batch operations (shared progress/stop handling)
// ---------------------------------------------------------------------------

/**
 * Runs a backend mutation and reports progress through `ui`:
 *   ui.progress(done, total, okCount) and ui.retry(message)
 */
async function runMutation(kind, items, ui) {
  const controller = new AbortController();
  state.opController = controller;
  try {
    return await state.backend.mutate(kind, items, {
      signal: controller.signal,
      viewerLogin: state.auth?.viewerLogin,
      onRetry: (info) => ui.retry(retryMessage(info)),
      onProgress: ({ done, total, results }) => ui.progress(done, total, results.filter((r) => r.ok).length),
    });
  } finally {
    state.opController = null;
  }
}

function stopCurrentOperation() {
  state.opController?.abort();
}

function setModalProgress(barEl, textEl, done, total, text) {
  barEl.style.width = `${total ? Math.max(4, Math.round((done / total) * 100)) : 4}%`;
  textEl.textContent = text;
}

function summarizeFailures(results) {
  const failed = results.filter((r) => !r.ok && !r.skipped);
  if (!failed.length) return '';
  const sample = failed
    .slice(0, 3)
    .map((r) => `${r.item}: ${r.error || 'failed'}`)
    .join('; ');
  return ` ${plural(failed.length, 'item')} failed (${sample}${failed.length > 3 ? '; ...' : ''}).`;
}

function showScopeError(errorEl, { scope, ghScope, onOpenAuth }) {
  const cli = isCli();
  errorEl.innerHTML = cli
    ? `<strong>Missing <code>${escapeHtml(scope)}</code> permission.</strong><br/>
       Run <code>gh auth refresh -h github.com -s ${escapeHtml(ghScope)}</code> in your terminal or open
       <button type="button" class="btn-link" data-open-auth>Auth Settings</button> to paste a token.`
    : `<strong>A token with <code>${escapeHtml(scope)}</code> permission is required.</strong><br/>
       Open <button type="button" class="btn-link" data-open-auth>Auth Settings</button> to generate one with the scope pre-selected.`;
  errorEl.querySelector('[data-open-auth]')?.addEventListener('click', onOpenAuth);
  show(errorEl);
}

// ---------------------------------------------------------------------------
// Unfollow (+ undo via re-follow)
// ---------------------------------------------------------------------------

function undoKey() {
  return `${KEYS.undoPrefix}${String(state.auth?.viewerLogin || '').toLowerCase()}`;
}

function getUndoBatch() {
  if (!state.auth?.viewerLogin) return null;
  const batch = local.getJson(undoKey());
  if (!batch || !Array.isArray(batch.logins) || batch.logins.length === 0) return null;
  if (Date.now() - Date.parse(batch.at || 0) > UNDO_MAX_AGE_MS) return null;
  return batch;
}

function renderUndoBanner() {
  const batch = isViewingOwnVerifiedAccount() ? getUndoBatch() : null;
  if (!batch) return hide(els.undoBanner);
  const when = new Date(batch.at).toLocaleString();
  els.undoBannerText.textContent = `You unfollowed ${plural(batch.logins.length, 'account')} on ${when}.`;
  els.undoRefollowBtn.textContent = `↩ Re-follow ${batch.logins.length}`;
  els.undoRefollowBtn.disabled = Boolean(state.opController);
  show(els.undoBanner);
}

function openUnfollowModal(usernames) {
  if (!isViewingOwnVerifiedAccount()) return openAuthModal();
  const actionable = usernames.filter((u) => !isAllowlisted(u));
  const skipped = usernames.length - actionable.length;
  if (actionable.length === 0) {
    showToast('Selected user(s) are protected by your Allowlist. Remove them from the Allowlist first.', 'error');
    return;
  }

  state.pendingUnfollowLogins = actionable;
  els.unfollowModalTitle.textContent = `Confirm Unfollow (${plural(actionable.length, 'user')})`;
  els.unfollowModalDesc.textContent =
    `You are about to unfollow ${plural(actionable.length, 'user')} from @${state.auth.viewerLogin}.` +
    (skipped ? ` ${skipped} allowlisted user(s) were excluded.` : '') +
    ' Requests are paced one at a time, and you can undo this with "Re-follow" afterwards.';
  els.unfollowPreviewList.innerHTML = actionable.map(userChipHtml).join('');
  hide(els.unfollowProgressWrap);
  hide(els.unfollowModalError);
  els.confirmUnfollowBtn.disabled = false;
  show(els.confirmUnfollowBtn);
  els.confirmUnfollowBtn.textContent = `Unfollow ${plural(actionable.length, 'User')}`;
  els.cancelUnfollowBtn.textContent = 'Cancel';
  show(els.unfollowModal);
  els.confirmUnfollowBtn.focus();
}

function closeUnfollowModal() {
  if (state.opController) return stopCurrentOperation();
  hide(els.unfollowModal);
  state.pendingUnfollowLogins = [];
}

async function executePendingUnfollow() {
  const logins = [...state.pendingUnfollowLogins];
  if (logins.length === 0 || state.opController) return;

  els.confirmUnfollowBtn.disabled = true;
  els.cancelUnfollowBtn.textContent = '■ Stop';
  hide(els.unfollowModalError);
  show(els.unfollowProgressWrap);
  setModalProgress(els.unfollowProgressBar, els.unfollowProgressText, 0, logins.length, `Unfollowing ${plural(logins.length, 'user')}...`);

  const outcome = await runMutation('unfollow', logins, {
    progress: (done, total, ok) =>
      setModalProgress(els.unfollowProgressBar, els.unfollowProgressText, done, total, `Unfollowed ${ok} of ${total}...`),
    retry: (msg) => {
      els.unfollowProgressText.textContent = msg;
    },
  });

  els.cancelUnfollowBtn.textContent = 'Close';
  const succeeded = outcome.results.filter((r) => r.ok).map((r) => r.item);
  applyUnfollowed(succeeded);

  if (succeeded.length) {
    local.setJson(undoKey(), { at: new Date().toISOString(), logins: succeeded });
    renderUndoBanner();
  }

  if (outcome.stoppedForScope) {
    hide(els.unfollowProgressWrap);
    showScopeError(els.unfollowModalError, {
      scope: 'user:follow',
      ghScope: 'user:follow',
      onOpenAuth: () => {
        closeUnfollowModal();
        openAuthModal();
      },
    });
    return;
  }

  const failures = summarizeFailures(outcome.results);
  if (outcome.aborted || failures) {
    els.unfollowProgressText.textContent =
      `${outcome.aborted ? 'Stopped. ' : ''}Unfollowed ${succeeded.length} of ${logins.length}.` + failures;
    hide(els.confirmUnfollowBtn);
    return;
  }

  hide(els.unfollowModal);
  state.pendingUnfollowLogins = [];
  showToast(`Unfollowed ${plural(succeeded.length, 'user')}`, 'success', {
    action: 'Undo',
    onAction: () => refollowLastBatch(),
    duration: 8000,
  });
}

function applyUnfollowed(logins) {
  if (!logins.length) return;
  const gone = new Set(logins.map((l) => l.toLowerCase()));
  logins.forEach((l) => state.selectedLogins.delete(l));
  if (state.data) {
    state.data.nonFollowers = state.data.nonFollowers.filter((u) => !gone.has(u.login.toLowerCase()));
    // Unfollowed mutuals still follow you, so they move to "Followers You Don't Follow"
    const nowFans = state.data.mutuals.filter((u) => gone.has(u.login.toLowerCase()));
    state.data.mutuals = state.data.mutuals.filter((u) => !gone.has(u.login.toLowerCase()));
    state.data.fans = [...nowFans, ...state.data.fans];
    saveScanCache();
  }
  rerenderCurrent();
}

/** Activity bar: inline progress + Stop for operations without a modal. */
function startActivity(text) {
  els.activityText.textContent = text;
  els.activityProgressBar.style.width = '4%';
  els.activityStopBtn.disabled = false;
  show(els.activityBar);
  return {
    progress: (done, total, ok, label) => {
      els.activityProgressBar.style.width = `${Math.max(4, Math.round((done / total) * 100))}%`;
      els.activityText.textContent = `${label} ${ok} of ${total}...`;
    },
    retry: (msg) => {
      els.activityText.textContent = msg;
    },
    end: () => hide(els.activityBar),
  };
}

async function refollowLastBatch() {
  const batch = getUndoBatch();
  if (!batch || state.opController) return;
  if (!isViewingOwnVerifiedAccount()) return openAuthModal();

  const activity = startActivity(`Re-following ${plural(batch.logins.length, 'account')}...`);
  els.undoRefollowBtn.disabled = true;
  let outcome;
  try {
    outcome = await runMutation('follow', batch.logins, {
      progress: (done, total, ok) => activity.progress(done, total, ok, 'Re-followed'),
      retry: activity.retry,
    });
  } finally {
    activity.end();
  }

  const succeeded = new Set(outcome.results.filter((r) => r.ok).map((r) => r.item.toLowerCase()));
  const remaining = batch.logins.filter((l) => !succeeded.has(l.toLowerCase()));
  if (remaining.length) local.setJson(undoKey(), { ...batch, logins: remaining });
  else local.remove(undoKey());
  renderUndoBanner();

  if (outcome.stoppedForScope) {
    showToast('Your token is missing the user:follow scope needed to re-follow.', 'error');
    return openAuthModal();
  }
  const failures = summarizeFailures(outcome.results);
  showToast(
    `${outcome.aborted ? 'Stopped. ' : ''}Re-followed ${succeeded.size} of ${batch.logins.length}.${failures}` +
      (succeeded.size ? ' Click "Refresh Live" to update the lists.' : ''),
    failures || outcome.aborted ? 'error' : 'success',
    { duration: 7000 }
  );
}

// ---------------------------------------------------------------------------
// Repository delete / archive
// ---------------------------------------------------------------------------

function openDeleteRepoModal(repoFullNames) {
  if (!isViewingOwnVerifiedAccount()) return openAuthModal();
  if (!repoFullNames?.length) return;

  state.pendingDeleteRepos = [...repoFullNames];
  const repoMap = new Map((state.reposData?.repos || []).map((r) => [r.fullName, r]));
  const n = repoFullNames.length;
  const noun = n === 1 ? 'Repository' : 'Repositories';

  els.deleteRepoModalTitle.textContent = `Permanently Delete ${n} ${noun}`;
  els.deleteRepoModalDesc.textContent = `You are about to permanently delete ${n} ${noun.toLowerCase()} from @${state.auth.viewerLogin}. This cannot be undone. Consider archiving instead: it is reversible.`;
  els.deleteRepoPreviewList.innerHTML = repoFullNames.map((name) => repoChipHtml(name, repoMap.get(name))).join('');
  els.deleteRepoConfirmInput.value = '';
  els.deleteRepoConfirmInput.disabled = false;
  els.confirmDeleteRepoBtn.disabled = true;
  show(els.confirmDeleteRepoBtn);
  els.confirmDeleteRepoBtn.textContent = `Permanently Delete ${n} Repo${n === 1 ? '' : 's'}`;
  els.cancelDeleteRepoBtn.textContent = 'Cancel';
  show(els.deleteRepoConfirmWrap);
  hide(els.deleteRepoProgressWrap);
  hide(els.deleteRepoModalError);
  show(els.deleteRepoModal);
  els.deleteRepoConfirmInput.focus();
}

function closeDeleteRepoModal() {
  if (state.opController) return stopCurrentOperation();
  hide(els.deleteRepoModal);
  state.pendingDeleteRepos = [];
  els.deleteRepoConfirmInput.value = '';
}

async function executePendingRepoDelete() {
  const repos = [...state.pendingDeleteRepos];
  if (!repos.length || state.opController) return;
  if (els.deleteRepoConfirmInput.value.trim() !== 'DELETE') return;

  els.confirmDeleteRepoBtn.disabled = true;
  els.deleteRepoConfirmInput.disabled = true;
  els.cancelDeleteRepoBtn.textContent = '■ Stop';
  hide(els.deleteRepoModalError);
  show(els.deleteRepoProgressWrap);
  setModalProgress(els.deleteRepoProgressBar, els.deleteRepoProgressText, 0, repos.length, `Deleting ${plural(repos.length, 'repository', 'repositories')}...`);

  const outcome = await runMutation('delete', repos, {
    progress: (done, total, ok) =>
      setModalProgress(els.deleteRepoProgressBar, els.deleteRepoProgressText, done, total, `Deleted ${ok} of ${total}...`),
    retry: (msg) => {
      els.deleteRepoProgressText.textContent = msg;
    },
  });

  els.cancelDeleteRepoBtn.textContent = 'Close';
  const deleted = new Set(outcome.results.filter((r) => r.ok).map((r) => r.item.toLowerCase()));
  if (deleted.size && state.reposData) {
    state.reposData.repos = state.reposData.repos.filter((r) => !deleted.has(r.fullName.toLowerCase()));
    deleted.forEach((d) => {
      for (const s of state.selectedRepos) if (s.toLowerCase() === d) state.selectedRepos.delete(s);
    });
    saveScanCache();
    rerenderCurrent();
  }

  if (outcome.stoppedForScope) {
    hide(els.deleteRepoProgressWrap);
    showScopeError(els.deleteRepoModalError, {
      scope: 'delete_repo',
      ghScope: 'delete_repo',
      onOpenAuth: () => {
        closeDeleteRepoModal();
        openAuthModal();
      },
    });
    return;
  }

  const failures = summarizeFailures(outcome.results);
  if (outcome.aborted || failures) {
    els.deleteRepoProgressText.textContent =
      `${outcome.aborted ? 'Stopped. ' : ''}Deleted ${deleted.size} of ${repos.length}.` + failures;
    hide(els.confirmDeleteRepoBtn);
    return;
  }

  hide(els.deleteRepoModal);
  state.pendingDeleteRepos = [];
  showToast(`Permanently deleted ${plural(deleted.size, 'repository', 'repositories')}`);
}

async function archiveRepos(repoFullNames, archived = true) {
  if (!isViewingOwnVerifiedAccount()) return openAuthModal();
  if (!repoFullNames?.length || state.opController) return;

  const repoMap = new Map((state.reposData?.repos || []).map((r) => [r.fullName.toLowerCase(), r]));
  const targets = repoFullNames.filter((name) => {
    const r = repoMap.get(name.toLowerCase());
    return !r || Boolean(r.isArchived) !== Boolean(archived);
  });
  if (!targets.length) {
    showToast(archived ? 'All selected repositories are already archived' : 'All selected repositories are already active', 'info');
    return;
  }

  const verb = archived ? 'Archived' : 'Unarchived';
  const activity = startActivity(`${archived ? 'Archiving' : 'Unarchiving'} ${plural(targets.length, 'repository', 'repositories')}...`);
  rerenderCurrent(); // disable batch buttons while running
  let outcome;
  try {
    outcome = await runMutation(archived ? 'archive' : 'unarchive', targets, {
      progress: (done, total, ok) => activity.progress(done, total, ok, verb),
      retry: activity.retry,
    });
  } finally {
    activity.end();
  }

  const updated = new Set(outcome.results.filter((r) => r.ok).map((r) => r.item.toLowerCase()));
  for (const r of state.reposData?.repos || []) {
    if (updated.has(r.fullName.toLowerCase())) r.isArchived = archived;
  }
  for (const s of [...state.selectedRepos]) if (updated.has(s.toLowerCase())) state.selectedRepos.delete(s);
  if (updated.size) saveScanCache();
  rerenderCurrent();

  if (outcome.stoppedForScope) {
    showToast('Your token is missing the "repo" scope. Use the Full Housekeeping link in Auth Settings.', 'error');
    return openAuthModal();
  }
  const failures = summarizeFailures(outcome.results);
  showToast(
    `${outcome.aborted ? 'Stopped. ' : ''}${verb} ${updated.size} of ${plural(targets.length, 'repository', 'repositories')}.${failures}`,
    failures || outcome.aborted ? 'error' : 'success',
    { duration: failures ? 8000 : 4200 }
  );
}

// ---------------------------------------------------------------------------
// Export / copy
// ---------------------------------------------------------------------------

function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportCurrentViewCsv() {
  const date = new Date().toISOString().slice(0, 10);
  if (state.activeTab === 'repos') {
    const repos = getVisibleRepos();
    if (!repos.length) return showToast('No repositories in current view to export', 'error');
    const csv = toCsv(
      ['full_name', 'url', 'visibility', 'is_fork', 'is_archived', 'language', 'stars', 'forks', 'size_kb', 'pushed_at', 'description'],
      repos.map((r) => [
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
      ])
    );
    return downloadFile(csv, `github-repos-${date}.csv`, 'text/csv;charset=utf-8;');
  }

  const users = getVisibleUsers();
  if (!users.length) return showToast('No users in current view to export', 'error');
  const csv = toCsv(
    ['login', 'name', 'url', 'follows_back', 'allowlisted', 'followers_count', 'following_count', 'public_repos_count', 'company', 'location', 'bio'],
    users.map((u) => [
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
    ])
  );
  downloadFile(csv, `github-${state.activeTab}-${date}.csv`, 'text/csv;charset=utf-8;');
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast('Clipboard access was blocked by the browser', 'error');
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function switchTab(tab) {
  if (!tab || tab === state.activeTab) return;
  state.activeTab = tab;
  state.selectedLogins.clear();
  state.selectedRepos.clear();
  renderProfileAndStats();
  renderActiveView();
}

function bindEvents() {
  els.usernameInput.addEventListener('input', (e) => updateTokenCreationLinks(e.target.value));
  els.scanForm.addEventListener('submit', (e) => {
    e.preventDefault();
    scanAccount(els.usernameInput.value);
  });
  els.cancelScanBtn.addEventListener('click', () => state.scanController?.abort());
  els.themeToggleBtn.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
  els.switchToViewerBtn.addEventListener('click', () => {
    if (state.auth?.viewerLogin) scanAccount(state.auth.viewerLogin);
  });
  els.rescanBtn.addEventListener('click', () => {
    const target = state.data?.profile?.login || els.usernameInput.value;
    if (target) scanAccount(target);
  });

  els.copyListBtn.addEventListener('click', () => {
    const lines =
      state.activeTab === 'repos' ? getVisibleRepos().map((r) => r.fullName) : getVisibleUsers().map((u) => `@${u.login}`);
    if (!lines.length) return showToast('Nothing in current view to copy', 'error');
    copyText(lines.join('\n'), `Copied ${plural(lines.length, 'item')} to clipboard`);
  });

  els.viewGridBtn.addEventListener('click', () => applyViewMode('grid'));
  els.viewCompactBtn.addEventListener('click', () => applyViewMode('compact'));

  els.autoShieldPopularBtn.addEventListener('click', () => {
    const creators = getUnshieldedCreators(state.data?.nonFollowers, state.allowlist).map((u) => u.login);
    if (creators.length) updateAllowlist(creators, true);
  });

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      e.preventDefault();
      els.searchInput.focus();
    }
    if (e.key === 'Escape') {
      if (!els.authModal.classList.contains('hidden')) hide(els.authModal);
      else if (!els.unfollowModal.classList.contains('hidden') && !state.opController) closeUnfollowModal();
      else if (!els.deleteRepoModal.classList.contains('hidden') && !state.opController) closeDeleteRepoModal();
    }
  });

  const toggleModesExplainer = () => els.modesExplainer.classList.toggle('hidden');
  els.modeBadgeBtn.addEventListener('click', toggleModesExplainer);
  els.guideBtn.addEventListener('click', toggleModesExplainer);
  els.closeModesExplainer.addEventListener('click', () => hide(els.modesExplainer));

  els.statCards.forEach((card) => card.addEventListener('click', () => switchTab(card.dataset.tab)));
  els.tabBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  els.showAllowlistedCheckbox.addEventListener('change', (e) => {
    state.showAllowlistedInNonFollowers = e.target.checked;
    renderProfileAndStats();
    renderUserCards();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    if (state.activeTab === 'repos') renderRepoCards();
    else renderUserCards();
  });

  els.presetBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      state.preset = btn.dataset.preset;
      els.presetBtns.forEach((b) => b.classList.toggle('active', b === btn));
      renderUserCards();
    })
  );
  els.repoPresetBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      state.repoPreset = btn.dataset.repoPreset;
      els.repoPresetBtns.forEach((b) => b.classList.toggle('active', b === btn));
      renderProfileAndStats();
      renderRepoCards();
    })
  );
  els.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderUserCards();
  });
  els.repoSortSelect.addEventListener('change', (e) => {
    state.repoSortBy = e.target.value;
    renderRepoCards();
  });

  els.selectAllCheckbox.addEventListener('change', (e) => {
    const repos = state.activeTab === 'repos';
    const ids = repos ? getVisibleRepos().map((r) => r.fullName) : getVisibleUsers().map((u) => u.login);
    const set = repos ? state.selectedRepos : state.selectedLogins;
    ids.forEach((id) => (e.target.checked ? set.add(id) : set.delete(id)));
    if (repos) renderRepoCards();
    else renderUserCards();
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

  els.batchAllowlistAddBtn.addEventListener('click', () => updateAllowlist([...state.selectedLogins], true));
  els.batchAllowlistRemoveBtn.addEventListener('click', () => updateAllowlist([...state.selectedLogins], false));
  els.batchUnfollowBtn.addEventListener('click', () => openUnfollowModal([...state.selectedLogins]));
  els.batchArchiveReposBtn.addEventListener('click', () => archiveRepos([...state.selectedRepos], true));
  els.batchUnarchiveReposBtn.addEventListener('click', () => archiveRepos([...state.selectedRepos], false));
  els.batchDeleteReposBtn.addEventListener('click', () => openDeleteRepoModal([...state.selectedRepos]));

  els.activityStopBtn.addEventListener('click', () => {
    els.activityStopBtn.disabled = true;
    els.activityText.textContent = 'Stopping after the current request...';
    stopCurrentOperation();
  });
  els.undoRefollowBtn.addEventListener('click', refollowLastBatch);
  els.undoDismissBtn.addEventListener('click', () => {
    local.remove(undoKey());
    hide(els.undoBanner);
  });

  els.cardsGrid.addEventListener('click', onCardClick);

  els.closeUnfollowModal.addEventListener('click', closeUnfollowModal);
  els.cancelUnfollowBtn.addEventListener('click', closeUnfollowModal);
  els.confirmUnfollowBtn.addEventListener('click', executePendingUnfollow);

  els.closeDeleteRepoModal.addEventListener('click', closeDeleteRepoModal);
  els.cancelDeleteRepoBtn.addEventListener('click', closeDeleteRepoModal);
  els.deleteRepoConfirmInput.addEventListener('input', (e) => {
    els.confirmDeleteRepoBtn.disabled = e.target.value.trim() !== 'DELETE';
  });
  els.deleteRepoConfirmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !els.confirmDeleteRepoBtn.disabled) executePendingRepoDelete();
  });
  els.confirmDeleteRepoBtn.addEventListener('click', executePendingRepoDelete);

  const openAuthFresh = async () => {
    await refreshAuth();
    openAuthModal();
  };
  els.authBtn.addEventListener('click', openAuthFresh);
  els.openAuthModalBtn.addEventListener('click', openAuthFresh);
  els.errorAuthCtaBtn.addEventListener('click', openAuthFresh);
  els.closeAuthModal.addEventListener('click', () => hide(els.authModal));

  const copyGhCommand = () =>
    copyText('gh auth refresh -h github.com -s user:follow', 'Copied command: gh auth refresh -h github.com -s user:follow');
  els.copyGhCmdBtn.addEventListener('click', copyGhCommand);
  els.modalCopyGhBtn.addEventListener('click', copyGhCommand);

  els.savePatBtn.addEventListener('click', async () => {
    const token = els.customPatInput.value.trim();
    try {
      state.auth = await state.backend.setToken(token);
    } catch (err) {
      return showToast(`Could not verify token: ${errorText(err)}`, 'error');
    }
    renderModeAndAuthUI();
    els.customPatInput.value = '';
    hide(els.authModal);
    if (state.auth.authenticated) {
      showToast(`Verified as @${state.auth.viewerLogin}`);
      await scanAccount(state.auth.viewerLogin);
    } else {
      rerenderCurrent();
      showToast(state.auth.error ? `Token rejected: ${state.auth.error}` : 'Token cleared or invalid', 'error');
    }
  });

  els.clearPatBtn.addEventListener('click', async () => {
    try {
      state.auth = await state.backend.setToken('');
    } catch (err) {
      return showToast(errorText(err), 'error');
    }
    showToast(isCli() ? 'Switched to default GitHub CLI authentication' : 'Cleared browser token');
    renderModeAndAuthUI();
    renderUndoBanner();
    if (state.data) rerenderCurrent();
    els.customPatInput.value = '';
  });

  els.exportCsvBtn.addEventListener('click', exportCurrentViewCsv);
  els.exportAllowlistBtn.addEventListener('click', () =>
    downloadFile(
      JSON.stringify(state.allowlist, null, 2),
      `github-allowlist-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    )
  );
  els.importAllowlistInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const before = Object.keys(state.allowlist).length;
      state.allowlist = await state.backend.allowlistImport(state.allowlist, parsed);
      if (state.data) state.data.allowlist = state.allowlist;
      saveScanCache();
      rerenderCurrent();
      showToast(`Imported allowlist (${Object.keys(state.allowlist).length - before} new entries)`);
    } catch {
      showToast('Invalid allowlist JSON file', 'error');
    } finally {
      e.target.value = '';
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.opController) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function toggleSelection(set, id, checked, anchor, shiftKey, visibleIds) {
  const ids = shiftKey && anchor && anchor !== id ? rangeBetween(visibleIds, anchor, id) : [id];
  ids.forEach((x) => (checked ? set.add(x) : set.delete(x)));
}

function onCardClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const { action, login, repo } = actionEl.dataset;

  switch (action) {
    case 'prompt-signin':
      return openAuthModal();
    case 'toggle-repo-select':
      toggleSelection(
        state.selectedRepos,
        repo,
        actionEl.checked,
        state.lastClickedRepo,
        e.shiftKey,
        getVisibleRepos().map((r) => r.fullName)
      );
      state.lastClickedRepo = repo;
      return renderRepoCards();
    case 'toggle-repo-archive':
      return archiveRepos([repo], actionEl.dataset.archived !== 'true');
    case 'delete-repo-single':
      return openDeleteRepoModal([repo]);
    case 'toggle-select':
      toggleSelection(
        state.selectedLogins,
        login,
        actionEl.checked,
        state.lastClickedLogin,
        e.shiftKey,
        getVisibleUsers().map((u) => u.login)
      );
      state.lastClickedLogin = login;
      return renderUserCards();
    case 'toggle-allowlist':
      return updateAllowlist([login], !isAllowlisted(login));
    case 'unfollow-single':
      return openUnfollowModal([login]);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

(async function init() {
  applyTheme(local.get(KEYS.theme) === 'dark' ? 'dark' : 'light');
  applyViewMode(local.get(KEYS.view) === 'compact' ? 'compact' : 'grid');
  bindEvents();

  const { mode, status } = await detectMode();
  state.runtimeMode = mode;
  state.backend = createBackend(mode);
  if (mode === 'web-client') state.allowlist = loadLocalAllowlist();
  if (status) {
    state.auth = status;
    renderModeAndAuthUI();
  } else {
    await refreshAuth();
  }

  const params = new URLSearchParams(window.location.search);
  const queryUser = (params.get('user') || params.get('username') || '').trim();
  const initialUser = queryUser || state.auth?.viewerLogin || '';

  if (tryRestoreWorkspaceSession(initialUser)) return;

  if (initialUser) {
    await scanAccount(initialUser);
  } else {
    updateTokenCreationLinks('');
    show(els.modesExplainer);
    show(els.welcomeState);
  }
})();
