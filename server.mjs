#!/usr/bin/env node
// Local CLI entry point: parses flags and starts the server from lib/server.mjs.
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createAppServer } from './lib/server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
GitHub Housekeeping ${pkg.version} (Local CLI Mode)

Usage:
  npx github-housekeeping [options]

Options:
  --port <number>   Port to bind (default: 3847)
  --open            Automatically open the dashboard in your default browser
  --version, -v     Print the version
  --help, -h        Show this help message

Environment:
  GITHUB_TOKEN      Use this token instead of the gh CLI session
`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

const portArgIdx = args.indexOf('--port');
const PORT = Number((portArgIdx !== -1 && args[portArgIdx + 1]) || process.env.PORT || 3847);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid port: ${args[portArgIdx + 1] ?? process.env.PORT}`);
  process.exit(1);
}
const AUTO_OPEN = args.includes('--open');
const HOST = '127.0.0.1';

// Use ./data/allowlist.json inside the project repo, otherwise ~/.github-housekeeping/allowlist.json
const localDataDir = path.join(__dirname, 'data');
const DATA_DIR =
  existsSync(path.join(__dirname, '.git')) || existsSync(localDataDir)
    ? localDataDir
    : path.join(os.homedir(), '.github-housekeeping');
const ALLOWLIST_FILE = path.join(DATA_DIR, 'allowlist.json');

function openBrowser(url) {
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url]);
  else if (process.platform === 'darwin') execFile('open', [url]);
  else execFile('xdg-open', [url]);
}

const server = createAppServer({
  publicDir: path.join(__dirname, 'public'),
  allowlistFile: ALLOWLIST_FILE,
  initialToken: process.env.GITHUB_TOKEN || '',
  userAgent: `github-housekeeping/${pkg.version}`,
});

function start(port, attemptsLeft = 10) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} is already in use, trying ${port + 1}...`);
      start(port + 1, attemptsLeft - 1);
    } else {
      console.error('Server error:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log(`\nGitHub Housekeeping ${pkg.version} (Local CLI Mode) running at ${url}`);
    console.log(`Allowlist storage: ${ALLOWLIST_FILE}\n`);
    if (AUTO_OPEN) openBrowser(url);
  });
}

start(PORT);
