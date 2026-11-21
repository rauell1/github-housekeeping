# Security Policy

## How GitHub Tokens Are Handled

**GitHub Housekeeping** is built with a strict zero-backend-storage model for credentials:

1. **🌐 Web App Mode (Cloudflare)**:
   - Runs 100% client-side in the user's browser.
   - Any optional GitHub Personal Access Token (PAT) is stored only in the browser's tab-scoped `sessionStorage` and sent only to `https://api.github.com`.
   - Tokens are **never** sent to Cloudflare Workers, analytics, logs, or any third-party server. The Content-Security-Policy restricts network access to `'self'` and `https://api.github.com`.
2. **💻 Local CLI Mode (`npx` / `node server.mjs`)**:
   - Binds only to `127.0.0.1`.
   - Reads the local `gh auth token` (or `GITHUB_TOKEN`) in memory and never writes tokens to disk or returns them to browser JavaScript.
   - Rejects any request whose `Host` header is not the local server, which blocks DNS rebinding attacks from malicious websites.
   - Rejects state-changing requests from any other origin, which blocks cross-site request forgery.
3. **Ownership Verification**:
   - Unfollow, re-follow, archive and delete are locked unless the verified token owner matches the scanned profile (`viewerLogin === profile.login`).
   - Repository changes are re-checked per repository, so only repositories owned by the token owner can be archived or deleted.
   - Repository deletion requires typed `DELETE` confirmation.

## Permissions Requested

| Feature | Classic scope |
| :--- | :--- |
| Unfollow and re-follow | `user:follow` |
| Private repos, archive and unarchive | `repo` |
| Delete repositories | `delete_repo` |

Scanning public accounts needs no token at all. Grant only the scopes for the features you use.

## Supported Versions

Security fixes are released for the latest version on the `main` branch.

## Reporting a Vulnerability

If you discover a security issue (such as an XSS vector, SSRF, DNS rebinding, CSRF, or credential exposure risk), please report it privately using [GitHub Security Advisories](https://github.com/rauell1/github-housekeeping/security/advisories/new) rather than opening a public issue.
