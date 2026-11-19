# GitHub Follow Housekeeping

Audit your GitHub following list, see who isn't following you back, curate a protected **Allowlist / Ignore List**, and batch unfollow accounts.

Designed as a **Dual-Mode Hybrid Tool** so users can pick the workflow that fits them best:

| Feature | 🌐 Mode 1: Web App (Cloudflare Pages) | 💻 Mode 2: Local CLI (`npx github-housekeeping`) |
| :--- | :--- | :--- |
| **Best For** | Instant browser checks with zero installation | Developers who already use the GitHub CLI (`gh`) |
| **How to Launch** | Open the hosted Cloudflare URL | Run `npx github-housekeeping --open` |
| **Authentication** | Public lookup (no token) or Browser-Only PAT (`sessionStorage`) | Automatic via local `gh auth` session (or local PAT) |
| **Allowlist Storage** | Browser `localStorage` (+ JSON Export/Import) | Local disk (`~/.github-housekeeping/allowlist.json`) |
| **Privacy** | 100% client-direct to `api.github.com` (no backend server sees your token) | 100% local (`127.0.0.1:3847`) |

---

## 🛡 GitHub Rules & API Compliance

- **Official APIs Only**: Uses documented GitHub REST (`GET /users/{username}/following`, `DELETE /user/following/{username}`) and GraphQL APIs.
- **No Follow-Churn or Spam Automation**: GitHub's Acceptable Use Policies prohibit automated mass-following / follow-for-follow churn bots. This tool **never** auto-follows accounts or runs background bots—it only performs user-initiated, manually confirmed housekeeping on your existing following list.
- **Secondary Rate-Limit Pacing**: Unfollow (`DELETE`) requests are executed **serially** (one at a time) with a `300ms` delay between requests in accordance with GitHub's secondary rate-limit best practices.

---

## 💻 Using Mode 2: Local CLI (`npx` / `gh` CLI)

Run directly from GitHub or npm with Node.js (v18+):

```bash
# Run directly from GitHub (works right now!)
npx github:rauell1/github-housekeeping --open

# Or if published to npm:
npx github-housekeeping --open
```

Or inside this repository:

```bash
cd D:\Coding\github-housekeeping
npm start
```

### Enabling 1-Click Unfollow in `gh` CLI
By default, `gh auth login` grants read access for scanning. To allow 1-click unfollowing via your local `gh` CLI session, run once:

```bash
gh auth refresh -h github.com -s user:follow
```

---

## 🌐 Deploying Mode 1: Cloudflare Pages

Because `public/` is self-contained and talks directly to `https://api.github.com` from the visitor's browser when no local CLI server is present, you can deploy it directly to **Cloudflare Pages**:

### Option A: Deploy via Wrangler CLI
```bash
cd D:\Coding\github-housekeeping
npm run cf:deploy
```
*(Or test locally with Wrangler using `npm run cf:dev`.)*

### Option B: Connect GitHub Repo in Cloudflare Dashboard
1. Push this repository to GitHub.
2. In the **Cloudflare Dashboard**, go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Set **Build output directory** to `public` (also pre-configured in [`wrangler.toml`](file:///D:/Coding/github-housekeeping/wrangler.toml)).
