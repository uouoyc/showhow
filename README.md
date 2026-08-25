# Showhow

A self-hosted tool for recording browser interactions and publishing interactive Walkthroughs.

[中文](README.zh-CN.md)

## Quick start

### Requirements

- Node.js >= 24.14.0
- pnpm >= 11.22.0
- Chrome

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure AI (optional)

```bash
cp web/.env.example web/.env
```

Edit `web/.env` and configure a provider compatible with the OpenAI Responses API:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_TOKEN=your-token
AI_MODEL=gpt-5-mini
```

Without `AI_TOKEN`, Step descriptions use the recorded element labels.

### 3. Start the service

```bash
pnpm dev
```

The Web application runs at `http://localhost:3000`.

### 4. Load the extension

```bash
pnpm --filter extension build
```

Open `chrome://extensions` in Chrome, enable Developer mode, choose Load unpacked, and select the `extension/` directory.

### 5. Record and publish

1. The extension connects to `http://localhost:3000`; enter a title and click **Start recording**.
2. Complete the browser flow, then click **Stop recording**.
3. The extension opens the editor, where you can:
   - edit the Walkthrough title and CTA URL;
   - edit each Step title and description;
   - reorder Steps by dragging the directory or using Up/Down;
   - delete Steps, download screenshots, and export JSON.
4. Copy the public link (`/w/[slug]`) or iframe embed code.

The CTA URL is shown as a **Continue** button after the reader completes the final Step.

## Project structure

```text
showhow/
├── extension/          # Chrome MV3 extension (recording, screenshots, uploads)
├── web/                # Next.js 16 app (editor, Replay, API)
│   ├── data/           # SQLite + screenshots directory (set by DATA_DIR)
│   └── drizzle/        # database migrations (do not delete)
```

**Capture path:**

```text
page click → content script → service worker screenshot → Web API → SQLite + screenshots/
```

## Deployment

### Docker Compose

For the first launch or after code changes:

```bash
docker compose up -d --build
```

When the image is already up to date:

```bash
docker compose up -d
```

### Data directory

The default is `web/data/`:

```text
web/data/
├── showhow.db
└── screenshots/
```

## Maintenance

### Backup

Stop the service and copy the entire `DATA_DIR`, including `showhow.db` and `screenshots/`. Restore them to the same directory before starting the service again.

### Tests

```bash
pnpm format      # format
pnpm lint        # lint
pnpm typecheck   # type check
pnpm test        # unit tests
pnpm test:e2e    # E2E tests
pnpm build       # build
```

E2E coverage includes Walkthrough creation, screenshot persistence, the editor, drag-and-drop ordering, public Replay, Hotspot activation, and completion statistics.

## Limitations

- The original click is not blocked or replayed, so a screenshot may already show the post-click state.
- Screenshots are captured serially with at least 500ms between calls.
- Pending uploads are not recovered after the extension or service worker restarts.
- A Recording is bound to its original tab; clicks in another tab are rejected.
- Chrome internal pages, the Chrome Web Store, and pages that reject content scripts cannot be recorded.
- Cross-origin iframe clicks capture the outer page; sandboxed or unavailable frames, rotated transforms, and skewed transforms may cause capture failures or Hotspot offsets.
