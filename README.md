# GitHub Follow Housekeeping

A lightweight, zero-dependency tool to audit your GitHub following list, identify accounts that do not follow you back, curate a protected **Allowlist (Ignore List)**, and perform safe batch unfollowing.

Built as a **Dual-Mode Hybrid Application** so both non-technical browser users and command-line developers can use the workflow that fits their environment.

---

## What This Tool Does

1. **Audits Follow Reciprocity & Repositories**
   - Scans any GitHub account and categorizes connections into five views:
     - **Not Following Back (Actionable)**: Accounts you follow that do not follow you back, excluding your protected allowlist.
     - **Allowlist / Ignored (Protected)**: Accounts you want to keep following even if they do not follow back (such as open-source maintainers, mentors, and organizations).
     - **Mutuals**: Accounts where both users follow each other.
     - **Followers You Don't Follow**: Accounts that follow you whom you have not followed back.
     - **Repositories**: Lists owned repositories (including private repositories when signed in as the account owner) with filters for **Forks**, **Private**, **Public**, **Archived**, **Dormant (> 1 year)**, and **0 Stars**, plus safe batch deletion with a typed `DELETE` confirmation guardrail.
2. **Smart Housekeeping & 2026 Realtime Insights**
   - **Realtime Snapshot Diff**: Compares your current followers against your previous scan locally in your browser and highlights who unfollowed you (`- @username`) or newly followed you (`+ @username`) since your last visit.
   - **1-Click Auto-Shield Creators (>= 1k Followers)**: Automatically detects high-follower creators and maintainers in your non-followers list and moves them to your protected Allowlist in one click.
   - **Dormancy & Activity Detection**: Displays when each account was last active on GitHub and lets you filter or sort by **Dormant (> 1 year inactive)** or **0 Public Repositories**.
   - **Grid & High-Density Compact Views**: Switch between visual profile cards and a compact table list, with **Light Mode** (default) and **Dark Mode** themes, `/` search shortcut, and `Shift + Click` range selection.
   - **CSV & JSON Portability**: Export any filtered view to CSV, or export and import your Allowlist as JSON.
3. **1-Click Pre-Filled Token Helper for Non-Technical Users**
   - Includes a direct link to GitHub's token creation page with the token description and the minimum required `user:follow` permission checkbox pre-selected, alongside a 3-step visual guide.

---

## Dual-Mode Architecture: Web App vs. Local CLI

| Capability | 🌐 Mode 1: Web App (Cloudflare) | 💻 Mode 2: Local CLI (`npx` / `gh` CLI) |
| :--- | :--- | :--- |
| **Target Audience** | External users and teams wanting instant browser access with zero installation | Developers and engineers who already use the official GitHub CLI (`gh`) |
| **How to Launch** | Open the hosted Cloudflare URL in any browser | Run `npx github:rauell1/github-housekeeping --open` |
| **Public Read-Only Scan** | Enter any `@username` (queries `api.github.com` directly from the visitor's browser) | Enter any `@username` or auto-detect the signed-in `gh` account |
| **Authenticated Scan & Unfollow** | Browser-only Personal Access Token stored in tab `sessionStorage` | Uses your local `gh auth` session automatically (or an optional local token) |
| **Allowlist Persistence** | Browser `localStorage` + JSON Export/Import | Local disk (`~/.github-housekeeping/allowlist.json` or `./data/allowlist.json`) |
| **Network Path** | Direct Browser -> `https://api.github.com` | Browser -> Localhost (`127.0.0.1:3847`) -> `https://api.github.com` |

---

## Corporate, Enterprise & Security Readiness

This project is designed to pass strict corporate and open-source security reviews:

- **Zero Supply-Chain Dependencies**: `package.json` has zero runtime npm dependencies (`dependencies` is empty). The local server uses native Node.js modules (`node:http`, `node:fs`, `node:child_process`, native `fetch`), and the frontend uses pure HTML, CSS, and ES Modules.
- **Principle of Least Privilege (Incremental Scopes)**:
  - For **Follow Housekeeping only**, the tool only requests `user:follow`. It cannot read private repositories or code.
  - For **Repository Deletion**, users can optionally grant `delete_repo` (and `repo` to manage private repositories). Deletion is never enabled without explicit `delete_repo` permission and typed `DELETE` confirmation.
- **Zero Backend Token or Data Storage**:
  - In **Web App Mode**, tokens are held exclusively in the user's browser `sessionStorage` and sent directly to `https://api.github.com`. No Cloudflare Worker or external database ever receives or logs user tokens.
  - Strict `Content-Security-Policy` headers in [`public/_headers`](./public/_headers) restrict network connections (`connect-src`) exclusively to `'self'` and `https://api.github.com`.
- **Strict Ownership Enforcement**: Unfollow actions are locked in the UI and API unless the authenticated token owner matches the scanned profile (`viewerLogin === profile.login`).
- **GitHub API & Acceptable Use Compliance**:
  - Contains no auto-follow, mass-follow, or follow-churn automation.
  - Executes all `DELETE /user/following/{username}` mutations serially with a `300ms` delay between requests to respect GitHub's secondary rate limits.

---

## Quick Start

### 1. Run Locally via `npx` (No Clone Required)

Requires Node.js v18 or newer:

```bash
npx github:rauell1/github-housekeeping --open
```

### 2. Clone and Run from Source

```bash
git clone https://github.com/rauell1/github-housekeeping.git
cd github-housekeeping
npm start
```

Then open **http://127.0.0.1:3847** in your browser.

#### Enabling Unfollow Permission in GitHub CLI (`gh`)
If you use the local `gh` CLI and want to unfollow directly from the dashboard, grant the `user:follow` scope to your local session once:

```bash
gh auth refresh -h github.com -s user:follow
```

---

## Self-Hosting on Cloudflare

The project is pre-configured in [`wrangler.toml`](./wrangler.toml) to deploy `./public` as Cloudflare Workers Static Assets:

```bash
# Test locally with Wrangler
npm run cf:dev

# Deploy to Cloudflare
npm run cf:deploy
```

Or connect your fork in the **Cloudflare Dashboard** under **Workers & Pages -> Create -> Connect to Git** using the default `npx wrangler deploy` command.

---

## Project Structure

- [`server.mjs`](./server.mjs): Zero-dependency local Node.js CLI server (`127.0.0.1:3847`), `gh` CLI token bridge, GraphQL/REST analyzer, disk allowlist manager, and rate-limited unfollow endpoint.
- [`public/index.html`](./public/index.html): Dashboard layout, mode comparison guide, 3-step token creator modal, and unfollow confirmation dialog.
- [`public/styles.css`](./public/styles.css): Responsive Light Mode (default) and Dark Mode theme variables, sticky toolbar, card grid, and compact list view styles.
- [`public/app.js`](./public/app.js): Dual-mode runtime engine (`local-cli` and `web-client`), realtime follower snapshot diffing, filtering, sorting, batch selection, and CSV/JSON export.
- [`public/_headers`](./public/_headers): Production HTTP security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [`wrangler.toml`](./wrangler.toml): Cloudflare deployment configuration.

---

## Community & Collaboration

- **Contributing Guide**: See [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Code of Conduct**: See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- **Security Policy**: See [`SECURITY.md`](./SECURITY.md)
- **Issues & Feature Requests**: Open a ticket on [GitHub Issues](https://github.com/rauell1/github-housekeeping/issues)

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 Roy Otieno ([@rauell1](https://github.com/rauell1)).
