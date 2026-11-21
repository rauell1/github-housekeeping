# Contributing to GitHub Housekeeping

Thank you for your interest in contributing to **GitHub Housekeeping**! The project is intentionally lightweight, has zero dependencies, and runs in both **Cloudflare Web Mode** and **Local CLI Mode**. Keeping contributions simple and secure makes it easy for everyone to maintain.

---

## Architecture Overview

1. **`public/lib/`**: Shared, pure ES modules with no DOM or Node specific code. They run in the browser **and** are imported by the local server.
   - `github.js`: All GitHub API calls. Use `githubFetch()` for every request so you get timeouts, cancellation and rate-limit retries for free.
   - `allowlist.js`, `filters.js`, `format.js`, `templates.js`: Pure helpers with unit tests.
2. **`public/js/backend.js`**: The runtime adapter. The UI calls one interface; the adapter talks either to `https://api.github.com` directly (Web App Mode) or to the local server's `/api/*` routes (Local CLI Mode).
3. **`public/app.js`**, **`index.html`**, **`styles.css`**: The UI. It must work in **both** runtime modes:
   - **🌐 Web App Mode (Cloudflare Static Assets)**: Stores the allowlist in `localStorage` and optional tokens strictly in `sessionStorage`.
   - **💻 Local CLI Mode (`node server.mjs` / `npx`)**: Reuses the developer's `gh auth` session and saves the allowlist to disk (`allowlist.json`).
4. **`lib/server.mjs`**: Zero-dependency Node.js (v18+) HTTP server bound to `127.0.0.1`. `createAppServer()` builds it without starting it, so tests can run it with a fake GitHub API.
5. **`server.mjs`**: The CLI entry point.

---

## Development Setup

```bash
git clone https://github.com/rauell1/github-housekeeping.git
```

```bash
cd github-housekeeping && npm start
```

Run the tests (Node's built-in test runner, nothing to install):

```bash
npm test
```

Test Cloudflare Workers Static Assets mode locally:

```bash
npm run cf:dev
```

---

## Design and Security Principles

- **Zero npm Dependencies**: Keep `package.json` free of `dependencies` and `devDependencies` so `npx github:rauell1/github-housekeeping` starts instantly and the supply chain stays empty. CI enforces this.
- **Write tests**: New logic belongs in `public/lib/` (or `lib/` for server-only code) with a test in `test/`. Add a template test for anything that renders user data.
- **GitHub Policy and Rate-Limit Compliance**:
  - Never add automated mass-follow or follow-churn features. Re-follow is limited to restoring the user's own recent unfollows.
  - Run state-changing requests through `runSerialBatch()` so they stay serial and paced (at least 300ms apart), stop on missing permissions, and honor the Stop button.
  - Keep follow and repository actions locked to the verified token owner (`viewerLogin === profile.login`), and use `checkRepoOwnership()` for repository changes.
- **XSS and Token Safety**:
  - Escape all GitHub strings with `escapeHtml()` and pass URLs through `safeHttpUrl()` before rendering. Prefer `textContent` when no markup is needed.
  - Never log, persist to disk, or send tokens to any origin other than `https://api.github.com`. The local server must never return the token to the browser.

---

## Submitting a Pull Request

1. Fork the repository and create a branch (`git checkout -b feat/your-feature`).
2. Run `npm test` and make sure it passes.
3. Check your change in both **Web App Mode** and **Local CLI Mode**, and in both **Light** and **Dark** themes.
4. Open a Pull Request with a clear summary of the change.
