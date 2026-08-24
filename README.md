# Showhow

Showhow is a personal, self-hosted tool for recording browser interactions and publishing them as interactive walkthroughs.

## Structure

- `extension/`: Chrome MV3 recorder
- `web/`: Next.js editor, Replay, and API

## Development

```powershell
pnpm install
pnpm dev
```

Engineering workflow and project terminology are documented in `AGENTS.md`, `docs/agents/`, and `CONTEXT.md`.

## Chrome extension

Build the extension, then load the `extension/` directory as an unpacked extension in Chrome:

```powershell
pnpm --filter extension build
```

Recording does not block or replay page clicks, so screenshots may show the state immediately after a click. Captures run serially with at least 500 milliseconds between screenshots. Pending captures are kept in memory and are not recovered after Chrome or the extension service worker restarts.

Cross-origin iframe clicks are translated into the outer viewport when ordinary, matching frames allow the content script to run. Sandboxed frames, unavailable frame origins, and rotated or skewed iframe transforms may prevent capture or offset the recorded position. Chrome internal pages cannot be recorded.
