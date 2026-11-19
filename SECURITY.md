# Security Policy

## How GitHub Tokens Are Handled

**GitHub Follow Housekeeping** is built with a strict zero-backend-storage model for credentials:

1. **🌐 Web App Mode (Cloudflare)**:
   - Runs 100% client-side in the user's browser.
   - Any optional GitHub Personal Access Token (PAT) entered by a user is stored exclusively in the browser's tab-scoped `sessionStorage` and sent directly to `https://api.github.com`.
   - Tokens are **never** transmitted to Cloudflare Workers, analytics, logs, or any third-party server.
2. **💻 Local CLI Mode (`npx` / `node server.mjs`)**:
   - Binds strictly to `127.0.0.1` (localhost).
   - Reads the local `gh auth token` on demand in memory and never writes tokens to disk or exposes them to client JavaScript.
3. **Ownership Verification**:
   - State-changing actions (`DELETE /user/following/{username}`) are locked unless the verified token owner matches the currently scanned profile (`viewerLogin === profile.login`).

## Reporting a Vulnerability

If you discover a security issue (such as an XSS vector, SSRF, or credential exposure risk), please report it privately using [GitHub Security Advisories](https://github.com/rauell1/github-housekeeping/security/advisories/new) rather than opening a public issue.
