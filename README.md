# GitHub Housekeeping

A lightweight, zero-dependency tool to keep your GitHub account tidy. It audits your following list, finds accounts that do not follow you back, protects the people you want to keep with an **Allowlist**, and unfollows in safe batches with **one-click undo**. It also lists your repositories so you can **archive** (reversible) or **delete** the ones you no longer need.

Built as a **Dual-Mode Hybrid Application** so both non-technical browser users and command-line developers can use the workflow that fits their environment.

---

## What This Tool Does

1. **Follow Housekeeping**
   - Scans any GitHub account and sorts connections into four views:
     - **Not Following Back (Actionable)**: Accounts you follow that do not follow you back, excluding your protected allowlist.
     - **Allowlist / Ignored (Protected)**: Accounts you want to keep following even if they do not follow back (such as open-source maintainers, mentors, and organizations).
     - **Mutuals**: Accounts where both users follow each other.
     - **Followers You Don't Follow**: Accounts that follow you whom you have not followed back.
   - **Batch unfollow with undo**: Unfollowed accounts are remembered for 7 days. Click **Undo** on the toast or **Re-follow** on the banner to follow them all again.
   - **1-Click Auto-Shield Creators (1k+ followers)**: Moves high-follower creators and maintainers from your non-followers list to your Allowlist in one click.
   - **Changes Since Last Scan**: Compares your followers with your previous scan (stored locally in your browser) and shows who unfollowed you (`- @username`) or newly followed you (`+ @username`).
   - **Dormancy and activity filters**: Shows when each account was last active and filters by **Dormant (more than 1 year)** or **0 Public Repositories**.
2. **Repository Housekeeping**
   - Lists repositories you own (including private repositories when signed in as the owner) with filters for **Forks**, **Private**, **Public**, **Not Archived**, **Archived**, **Dormant (more than 1 year)**, and **0 Stars**.
   - **Archive / Unarchive**: Makes repositories read-only. This is fully reversible, so it is the recommended first step.
   - **Delete**: Permanently deletes repositories after you type `DELETE` to confirm.
3. **Built for Reliability**
   - **Automatic rate-limit handling**: When GitHub returns a rate-limit response (403 or 429), the tool waits for the time GitHub asks for (`Retry-After` or `x-ratelimit-reset`) and retries automatically. Temporary server errors (502, 503, 504) are retried with backoff.
   - **Timeouts and Cancel**: Every request has a timeout, so a stalled connection shows an error instead of freezing. Long scans have a **Cancel** button, and batch actions have a **Stop** button that halts cleanly after the current request.
   - **Exact progress**: Batch actions run one item at a time and report exactly which items succeeded or failed.
4. **Convenience**
   - Grid and compact views, **Light Mode** (default) and **Dark Mode**, `/` to focus search, `Shift + Click` range selection, `Esc` to close dialogs.
   - Export any filtered view to CSV, copy the visible list to the clipboard, and export or import your Allowlist as JSON.
   - Your tab, filters, selections and last scan survive a page refresh.
5. **1-Click Pre-Filled Token Helper for Non-Technical Users**
   - Links straight to GitHub's token creation page with the description and the needed permission checkboxes already ticked, alongside a 3-step visual guide.

---

## Dual-Mode Architecture: Web App vs. Local CLI

| Capability | 🌐 Mode 1: Web App (Cloudflare) | 💻 Mode 2: Local CLI (`npx` / `gh` CLI) |
| :--- | :--- | :--- |
| **Target Audience** | Anyone who wants instant browser access with zero installation | Developers who already use the official GitHub CLI (`gh`) |
| **How to Launch** | Open the hosted Cloudflare URL in any browser | Run `npx github:rauell1/github-housekeeping --open` |
| **Public Read-Only Scan** | Enter any `@username` (queries `api.github.com` directly from the browser) | Enter any `@username` or auto-detect the signed-in `gh` account |
| **Authenticated Actions** | Browser-only Personal Access Token stored in tab `sessionStorage` | Uses your local `gh auth` session automatically (or `GITHUB_TOKEN`, or a token pasted in the UI) |
| **Allowlist Persistence** | Browser `localStorage` plus JSON Export/Import | Local disk (`~/.github-housekeeping/allowlist.json` or `./data/allowlist.json`) |
| **Network Path** | Browser to `https://api.github.com` | Browser to Localhost (`127.0.0.1:3847`) to `https://api.github.com` |

Both modes share the same GitHub logic (`public/lib/github.js`), so rate-limit handling, timeouts, and safety checks behave identically.

---

## Token Permissions

The tool asks for the least access each feature needs. Pick the level that matches what you want to do:

| Feature | Classic token scope | Fine-grained token permission |
| :--- | :--- | :--- |
| Scan any public account | none (no token needed) | none |
| Unfollow and re-follow | `user:follow` | Account permission **Followers: Read and write** |
| See private repos, archive / unarchive | `repo` | Repository permission **Administration: Read and write** |
| Delete repositories | `delete_repo` | Repository permission **Administration: Read and write** |

The **Auth Settings** dialog has two pre-filled links: **Follow Housekeeping Only** (`user:follow`) and **Full Housekeeping** (`user:follow`, `repo`, `delete_repo`).

For the GitHub CLI, grant the scopes you need once:

```bash
gh auth refresh -h github.com -s user:follow
```

```bash
gh auth refresh -h github.com -s repo,delete_repo
```

---

## Corporate, Enterprise and Security Readiness

- **Zero Supply-Chain Dependencies**: `package.json` has no dependencies at all (runtime or dev). The local server uses only native Node.js modules, the tests use the built-in `node:test` runner, and the frontend uses plain HTML, CSS, and ES Modules.
- **Least Privilege**: Follow features only need `user:follow`. Repository features are optional and need `repo` / `delete_repo`. Deletion always requires typed `DELETE` confirmation.
- **No Backend Token or Data Storage**:
  - In **Web App Mode**, tokens live only in the tab's `sessionStorage` and are sent only to `https://api.github.com`. No Cloudflare Worker or database ever receives them.
  - A strict `Content-Security-Policy` in [`public/_headers`](./public/_headers) limits network connections (`connect-src`) to `'self'` and `https://api.github.com`.
- **Local Server Hardening (CLI Mode)**: Binds only to `127.0.0.1`, rejects requests whose `Host` header is not the local server (blocks DNS rebinding), rejects cross-origin state changes (blocks CSRF), never returns the token to the browser, caps request sizes, and blocks path traversal.
- **Strict Ownership Enforcement**: Unfollow, archive and delete are locked unless the token owner matches the scanned profile, and repository actions are re-checked so only the token owner's own repositories can be changed.
- **Safe Rendering**: Every value from GitHub is escaped before display, URLs are limited to `http(s)`, and CSV exports neutralize spreadsheet formulas.
- **GitHub API and Acceptable Use Compliance**:
  - No auto-follow, mass-follow, or follow-churn automation. Re-follow only restores accounts you unfollowed yourself in the last 7 days.
  - State-changing requests run one at a time with a pause between them (300ms for follow changes, 350ms for repositories) and back off when GitHub asks.

---

## Quick Start

### 1. Run Locally via `npx` (No Clone Required)

Requires Node.js 18 or newer:

```bash
npx github:rauell1/github-housekeeping --open
```

Options: `--port <number>`, `--open`, `--version`, `--help`. Set `GITHUB_TOKEN` to use a specific token instead of your `gh` session.

### 2. Clone and Run from Source

```bash
git clone https://github.com/rauell1/github-housekeeping.git
```

```bash
cd github-housekeeping && npm start
```

Then open **http://127.0.0.1:3847** in your browser.

### 3. Run the Tests

```bash
npm test
```

---

## Self-Hosting on Cloudflare

The project is pre-configured in [`wrangler.toml`](./wrangler.toml) to deploy `./public` as Cloudflare Workers Static Assets:

```bash
npm run cf:dev
```

```bash
npm run cf:deploy
```

Or connect your fork in the **Cloudflare Dashboard** under **Workers & Pages, Create, Connect to Git** using the default `npx wrangler deploy` command.

---

## Project Structure

- [`server.mjs`](./server.mjs): CLI entry point (flags, port selection, opening the browser).
- [`lib/server.mjs`](./lib/server.mjs): Local HTTP server and `/api/*` routes, `gh` CLI token bridge, disk allowlist.
- [`lib/server-utils.mjs`](./lib/server-utils.mjs): Host, Origin and static path guards.
- [`public/lib/github.js`](./public/lib/github.js): Shared GitHub API layer used by both modes: retries, timeouts, cancellation, pagination, follow and repository operations, paced batch runner.
- [`public/lib/allowlist.js`](./public/lib/allowlist.js): Allowlist sanitizing and merging.
- [`public/lib/filters.js`](./public/lib/filters.js): Search, filter presets, sorting, range selection, follower diff.
- [`public/lib/templates.js`](./public/lib/templates.js): Escaped HTML templates for cards and chips.
- [`public/lib/format.js`](./public/lib/format.js): Escaping, URL sanitizing, number, size and CSV formatting.
- [`public/js/backend.js`](./public/js/backend.js): Chooses Web App or Local CLI mode and exposes one interface to the UI.
- [`public/app.js`](./public/app.js): UI controller (rendering, dialogs, progress, undo).
- [`public/index.html`](./public/index.html) and [`public/styles.css`](./public/styles.css): Layout and Light/Dark themes.
- [`public/_headers`](./public/_headers): Production HTTP security headers.
- [`test/`](./test): Unit and integration tests (`npm test`).

---

## Community and Collaboration

- **Contributing Guide**: See [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Code of Conduct**: See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- **Security Policy**: See [`SECURITY.md`](./SECURITY.md)
- **Issues and Feature Requests**: Open a ticket on [GitHub Issues](https://github.com/rauell1/github-housekeeping/issues)

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 Roy Otieno ([@rauell1](https://github.com/rauell1)).
