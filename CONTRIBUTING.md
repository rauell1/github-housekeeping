# Contributing to GitHub Follow Housekeeping

Thank you for your interest in contributing to **GitHub Follow Housekeeping**! Because this project is intentionally lightweight, zero-dependency, and runs in both **Cloudflare Web Mode** and **Local CLI Mode**, keeping contributions simple and secure makes it easy for everyone to maintain.

---

## Architecture Overview

1. **`public/` (`index.html`, `styles.css`, `app.js`)**:
   - The frontend dashboard.
   - Must work in **both** runtime modes:
     - **🌐 Web App Mode (Cloudflare Static Assets)**: Talks directly to `https://api.github.com` from the visitor's browser, stores the allowlist in `localStorage`, and stores optional PATs strictly in `sessionStorage`.
     - **💻 Local CLI Mode (`node server.mjs` / `npx`)**: Talks to the local Node.js server (`/api/*`), reuses the developer's local `gh auth` session, and persists the allowlist to disk (`allowlist.json`).
2. **`server.mjs`**:
   - Zero-dependency Node.js (v18+) local HTTP server bound strictly to `127.0.0.1`.

---

## Development Setup

```bash
git clone https://github.com/rauell1/github-housekeeping.git
cd github-housekeeping

# Run in Local CLI Mode (http://127.0.0.1:3847)
npm start

# Or test Cloudflare Workers Static Assets mode locally
npm run cf:dev
```

---

## Design & Security Principles

- **Zero Runtime npm Dependencies**: Keep `server.mjs` and `public/` free of heavy bundler or runtime dependencies so `npx github:rauell1/github-housekeeping` starts instantaneously.
- **GitHub Policy & Rate-Limit Compliance**:
  - Never add automated mass-follow or follow-churn features.
  - Always pace state-changing requests (`DELETE /user/following/{username}`) serially (`>= 300ms` delay).
  - Keep unfollow actions strictly locked to the verified token owner (`viewerLogin === profile.login`).
- **XSS & Token Safety**:
  - Escape all untrusted GitHub profile strings (`escapeHtml`) before rendering.
  - Never log, persist to disk, or send Personal Access Tokens to any non-GitHub origin.

---

## Submitting a Pull Request

1. Fork the repository and create a branch (`git checkout -b feat/your-feature`).
2. Test your changes in both **Light** and **Dark** themes.
3. Open a Pull Request with a clear summary of the change.
