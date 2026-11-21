// HTML templates for cards and chips. Every dynamic value goes through
// escapeHtml() or a numeric formatter, so these are safe to assign to
// innerHTML. Covered by test/templates.test.mjs.

import { escapeHtml, safeHttpUrl, formatCount, formatSizeKb } from './format.js';
import { formatRelativeActivity, CREATOR_FOLLOWER_THRESHOLD } from './filters.js';

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

export function getLanguageColor(lang) {
  return Object.prototype.hasOwnProperty.call(LANG_COLORS, lang) ? LANG_COLORS[lang] : '#8b949e';
}

const profileUrl = (login) => `https://github.com/${encodeURIComponent(login)}`;

export function userChipHtml(login) {
  return `<span class="preview-chip">@${escapeHtml(login)}</span>`;
}

export function repoChipHtml(fullName, repo) {
  const vis = repo?.isPrivate ? '🔒 Private' : '🌐 Public';
  const stars = repo ? ` · ★${formatCount(repo.stargazersCount)}` : '';
  return `<span class="preview-chip">${escapeHtml(fullName)} (${vis}${stars})</span>`;
}

export function diffChipHtml(login, kind) {
  const cls = kind === 'lost' ? 'diff-chip-lost' : 'diff-chip-gained';
  const sign = kind === 'lost' ? '−' : '+';
  return `<a href="${escapeHtml(profileUrl(login))}" target="_blank" rel="noopener noreferrer" class="${cls}">${sign} @${escapeHtml(login)}</a>`;
}

/**
 * ctx: { tab, isOwner, viewerLogin, profileLogin, selected, allowlisted, now }
 */
export function userCardHtml(u, ctx) {
  const loginEsc = escapeHtml(u.login);
  const nameEsc = escapeHtml(u.name || u.login);
  const bioEsc = escapeHtml(u.bio || '');
  const companyEsc = escapeHtml(u.company || '');
  const locationEsc = escapeHtml(u.location || '');
  const avatarEsc = escapeHtml(safeHttpUrl(u.avatarUrl));
  const urlEsc = escapeHtml(safeHttpUrl(u.url));
  const { tab, isOwner, viewerLogin, profileLogin, selected, allowlisted, now } = ctx;
  const signedInAsDifferentUser = Boolean(viewerLogin) && !isOwner;

  let statusBadge;
  if (allowlisted) statusBadge = `<span class="badge badge-allowlisted">🛡 Allowlisted</span>`;
  else if (!u.followsBack) statusBadge = `<span class="badge badge-nonfollower">Not following back</span>`;
  else statusBadge = `<span class="badge badge-mutual">Follows back</span>`;

  const creatorBadge =
    (u.followersCount ?? 0) >= CREATOR_FOLLOWER_THRESHOLD
      ? `<span class="badge badge-creator" title="Popular creator / maintainer (1,000+ followers)">⭐ Creator 1k+</span>`
      : '';

  const act = formatRelativeActivity(u.updatedAt, now);
  const activityBadge = act
    ? `<span class="badge ${act.dormant ? 'badge-dormant' : 'badge-active'}" title="Last GitHub profile/repo update: ${escapeHtml(u.updatedAt)}">${escapeHtml(act.label)}</span>`
    : '';

  const order = Number(u.followOrder);
  const orderBadge =
    Number.isFinite(order) && order > 0 && order < 99999
      ? `<span class="badge badge-order" title="Order in list">#${order}</span>`
      : '';

  const metaParts = [];
  if (companyEsc) metaParts.push(`<span>🏢 ${companyEsc}</span>`);
  if (locationEsc) metaParts.push(`<span>📍 ${locationEsc}</span>`);

  let actionButtonHtml;
  if (tab === 'fans') {
    actionButtonHtml = `<a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">View Profile ↗</a>`;
  } else if (isOwner) {
    actionButtonHtml = `<button type="button" class="btn btn-sm btn-danger" data-action="unfollow-single" data-login="${loginEsc}">Unfollow</button>`;
  } else if (signedInAsDifferentUser) {
    actionButtonHtml = `<button type="button" class="btn btn-sm btn-secondary" disabled title="You are signed in as @${escapeHtml(viewerLogin)}. You cannot unfollow on behalf of @${escapeHtml(profileLogin)}.">🔒 Not Your Account</button>`;
  } else {
    actionButtonHtml = `<button type="button" class="btn btn-sm btn-secondary" data-action="prompt-signin" title="Verify ownership of @${escapeHtml(profileLogin)} with a token to enable unfollowing">🔑 Sign in to Unfollow</button>`;
  }

  return `
    <article class="user-card ${selected ? 'selected' : ''} ${allowlisted ? 'allowlisted' : ''}" data-login="${loginEsc}">
      <div>
        <div class="card-top">
          <div class="card-check-wrap">
            <input type="checkbox" class="card-checkbox" data-action="toggle-select" data-login="${loginEsc}" ${selected ? 'checked' : ''} aria-label="Select ${loginEsc}" />
          </div>
          <img class="card-avatar" src="${avatarEsc}" alt="${loginEsc}" loading="lazy" />
          <div class="card-identity">
            <div class="card-title-row">
              <span class="card-name" title="${nameEsc}">${nameEsc}</span>
              ${orderBadge}
            </div>
            <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="card-handle">@${loginEsc} ↗</a>
            <div class="card-badges">${statusBadge}${creatorBadge}${activityBadge}</div>
          </div>
        </div>
        ${bioEsc ? `<p class="card-bio card-gap" title="${bioEsc}">${bioEsc}</p>` : ''}
        ${metaParts.length ? `<div class="card-meta-tags card-gap-sm">${metaParts.join('')}</div>` : ''}
      </div>
      <div class="card-right-group">
        <div class="card-metrics">
          <div class="metric-item"><span class="metric-val">${formatCount(u.followersCount)}</span><span class="metric-lbl">Followers</span></div>
          <div class="metric-item"><span class="metric-val">${formatCount(u.followingCount)}</span><span class="metric-lbl">Following</span></div>
          <div class="metric-item"><span class="metric-val">${formatCount(u.publicReposCount)}</span><span class="metric-lbl">Repos</span></div>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-sm btn-shield ${allowlisted ? 'active' : ''}" data-action="toggle-allowlist" data-login="${loginEsc}" title="${allowlisted ? 'Remove from Allowlist' : 'Keep / Add to Allowlist'}">
            ${allowlisted ? '🛡 Kept (Remove)' : '🛡 Keep (Allowlist)'}
          </button>
          ${actionButtonHtml}
        </div>
      </div>
    </article>`;
}

/**
 * ctx: { isOwner, viewerLogin, selected, now }
 */
export function repoCardHtml(r, ctx) {
  const fullEsc = escapeHtml(r.fullName);
  const nameEsc = escapeHtml(r.name);
  const descEsc = escapeHtml(r.description || '');
  const urlEsc = escapeHtml(safeHttpUrl(r.htmlUrl));
  const langEsc = escapeHtml(r.language || '');
  const { isOwner, viewerLogin, selected, now } = ctx;
  const signedInAsDifferentUser = Boolean(viewerLogin) && !isOwner;
  const act = formatRelativeActivity(r.pushedAt, now);

  const visBadge = r.isPrivate
    ? `<span class="badge badge-private">🔒 Private</span>`
    : `<span class="badge badge-public">🌐 Public</span>`;
  const forkBadge = r.isFork ? `<span class="badge badge-fork">⑂ Fork</span>` : '';
  const archBadge = r.isArchived ? `<span class="badge badge-archived">📦 Archived</span>` : '';
  const activityBadge = act
    ? `<span class="badge ${act.dormant ? 'badge-dormant' : 'badge-active'}">${escapeHtml(act.label)}</span>`
    : '';

  const metaParts = [];
  if (langEsc) {
    metaParts.push(
      `<span><span class="lang-dot" style="background-color:${getLanguageColor(r.language)};"></span>${langEsc}</span>`
    );
  }
  metaParts.push(`<span>💾 ${formatSizeKb(r.sizeKb)}</span>`);

  let actionButtonHtml;
  if (isOwner) {
    actionButtonHtml = `
      <button type="button" class="btn btn-sm btn-secondary" data-action="toggle-repo-archive" data-repo="${fullEsc}" data-archived="${r.isArchived ? 'true' : 'false'}" title="${r.isArchived ? 'Unarchive repository' : 'Make read-only (reversible)'}">
        ${r.isArchived ? 'Unarchive' : '📦 Archive'}
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-repo-single" data-repo="${fullEsc}">🗑 Delete</button>`;
  } else if (signedInAsDifferentUser) {
    actionButtonHtml = `<button type="button" class="btn btn-sm btn-secondary" disabled>🔒 Not Your Account</button>`;
  } else {
    actionButtonHtml = `<button type="button" class="btn btn-sm btn-secondary" data-action="prompt-signin">🔑 Sign in to Manage</button>`;
  }

  return `
    <article class="user-card ${selected ? 'selected' : ''}" data-repo="${fullEsc}">
      <div>
        <div class="card-top">
          <div class="card-check-wrap">
            <input type="checkbox" class="card-checkbox" data-action="toggle-repo-select" data-repo="${fullEsc}" ${selected ? 'checked' : ''} aria-label="Select ${fullEsc}" />
          </div>
          <div class="card-identity">
            <div class="card-title-row"><span class="card-name" title="${fullEsc}">${nameEsc}</span></div>
            <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="card-handle">${fullEsc} ↗</a>
            <div class="card-badges">${visBadge}${forkBadge}${archBadge}${activityBadge}</div>
          </div>
        </div>
        ${
          descEsc
            ? `<p class="card-bio card-gap" title="${descEsc}">${descEsc}</p>`
            : `<p class="card-bio card-bio-empty card-gap">No description provided</p>`
        }
        <div class="card-meta-tags card-gap-sm">${metaParts.join('')}</div>
      </div>
      <div class="card-right-group">
        <div class="card-metrics">
          <div class="metric-item"><span class="metric-val">${formatCount(r.stargazersCount)}</span><span class="metric-lbl">Stars</span></div>
          <div class="metric-item"><span class="metric-val">${formatCount(r.forksCount)}</span><span class="metric-lbl">Forks</span></div>
          <div class="metric-item"><span class="metric-val">${formatSizeKb(r.sizeKb)}</span><span class="metric-lbl">Size</span></div>
        </div>
        <div class="card-actions">
          <a href="${urlEsc}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">View ↗</a>
          ${actionButtonHtml}
        </div>
      </div>
    </article>`;
}
