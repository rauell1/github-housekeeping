// Small wrappers around localStorage/sessionStorage that never throw
// (private browsing, quota errors, disabled storage).

export const KEYS = {
  allowlist: 'gh_housekeeping_allowlist_v1',
  theme: 'gh_housekeeping_theme_v2',
  view: 'gh_housekeeping_view_v1',
  snapshotPrefix: 'gh_housekeeping_snapshot_v1_',
  undoPrefix: 'gh_housekeeping_last_unfollow_v1_',
  pat: 'gh_housekeeping_pat_v1',
  uiState: 'gh_housekeeping_ui_state_v1',
  scanCache: 'gh_housekeeping_scan_cache_v1',
};

function make(area) {
  return {
    get(key, fallback = null) {
      try {
        const raw = area().getItem(key);
        return raw === null ? fallback : raw;
      } catch {
        return fallback;
      }
    },
    getJson(key, fallback = null) {
      try {
        const raw = area().getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        area().setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    setJson(key, value) {
      try {
        area().setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        area().removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export const local = make(() => window.localStorage);
export const session = make(() => window.sessionStorage);
