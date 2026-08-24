# Showhow

Showhow is a personal, self-hosted tool for recording browser interactions and publishing them as interactive Walkthroughs.

## Architecture

- `extension/`: Chrome MV3 popup, content script, and service worker that capture clicks and visible-tab screenshots.
- `web/`: Next.js 16 App Router editor, public Replay, and HTTP API.
- SQLite and screenshots: stored together under `DATA_DIR`; Drizzle migrations run automatically when the server opens the database.

The capture path is:

```text
page click → content script → service worker screenshot → Web API → SQLite + screenshots/
```

Readers open `/w/[slug]`, start the Replay, and activate each recorded Hotspot. The editor supports Step titles and descriptions, reordering, deletion, a final CTA, JSON/image exports, public-link copying, iframe embed code, and local view/completion totals.

## Requirements

- Node.js 24.14.0
- pnpm 11.22.0
- Chrome for recording and Playwright E2E tests

## Install and develop

```powershell
pnpm install
pnpm dev
```

The Web application listens on port 3000. The root workspace owns the lockfile and starts only the Web application in development.

## Optional AI descriptions

Copy `web/.env.example` to `web/.env` and configure any Responses-compatible provider:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_TOKEN=
AI_MODEL=gpt-5-mini
```

`AI_BASE_URL` and `AI_MODEL` are configurable. Without `AI_TOKEN`, recorded element labels remain the Step descriptions. Provider or parsing failures also retain those labels and appear as a non-blocking editor warning.

Never commit `web/.env`; real environment files are ignored.

## Build and load the Chrome extension

```powershell
pnpm --filter extension build
```

In Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the repository's `extension/` directory.
5. Reload any already-open page that you want to record.

The extension popup defaults to `http://localhost:3000`. Enter a Walkthrough title, start the Recording, click through the browser flow, then stop. Stop waits for queued captures, optionally drafts descriptions, and opens the editor.

## Data location

`DATA_DIR` is resolved from the Web process working directory. Its development default is `web/data/`:

```text
web/data/
├── showhow.db
└── screenshots/
```

The complete directory is ignored by Git. Docker sets `DATA_DIR=/data` and mounts a named volume there. For direct production use, prefer an absolute path.

## Export and backup

- Export JSON from the editor. It contains Walkthrough metadata and ordered Step capture data.
- Download each screenshot directly from its Step card.
- There is intentionally no ZIP export.

For a consistent backup, stop the server and copy the entire `DATA_DIR`. Restore by placing both `showhow.db` and `screenshots/` into the configured directory before starting the server.

## Recording limitations

- Showhow does not block, delay, or replay the page's original click. A screenshot can therefore show the state immediately after navigation or a synchronous UI change.
- Screenshots are captured serially with at least 500 milliseconds between calls. Wait for each capture when recording fast-changing interfaces.
- Pending capture queues are memory-only and are not recovered after Chrome or the extension service worker restarts.
- Chrome internal pages, the Chrome Web Store, and other pages that reject content-script injection cannot be recorded.
- Cross-origin iframe clicks capture the complete outer tab. Ordinary iframe borders and scaling are translated, but sandboxed/unavailable frames and rotated or skewed transforms can prevent capture or offset the Hotspot.
- Right-click menus and browser-owned dialogs are outside the page capture boundary.

## Tests and checks

```powershell
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm test:e2e` runs the complete create → capture payload → SQLite/screenshot persistence → public Replay → Hotspot → completion path against an isolated temporary data directory.

## Deploy with Docker Compose

```powershell
docker compose up --build
```

The multi-stage image uses `node:24.14.0`. Its build stage verifies `python3`, `make`, and `g++` before installing `better-sqlite3`. The runtime contains only the sanitized standalone server, static assets, Drizzle migrations, and traced runtime dependencies. `web/.env` is optional and is injected at runtime, never copied into the image.

Back up the `showhow-data` volume or mount `/data` to a host directory managed by your backup system.

## Deploy the standalone Node server

Build and enter the standalone application directory before starting it so migrations resolve correctly:

```powershell
pnpm build
$env:DATA_DIR = 'C:\showhow-data'
$env:HOSTNAME = '127.0.0.1'
$env:PORT = '3000'
Set-Location web\.next\standalone\web
node server.js
```

On Linux, use the same `server.js` with an absolute `DATA_DIR`. Put Caddy, nginx, Traefik, or another reverse proxy in front of port 3000 and terminate TLS there. Only `/w/*`, screenshot reads, and public Replay statistics need to be Internet-accessible; protect the editor and capture/mutation API with reverse-proxy authentication, a VPN, or network access rules.

## Deliberate exclusions

Showhow has no accounts, billing, telemetry, hosted control plane, team workspace, shared asset library, SSO, personalization variables, visitor identity, Step funnel, or third-party analytics.

Engineering workflow and project terminology are documented in `AGENTS.md`, `docs/agents/`, and `CONTEXT.md`.
