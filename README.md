# oracle 🧿 — Whispering your tokens to the silicon sage

<p align="center">
  <img src="./README-header.png" alt="Oracle CLI header banner" width="1100">
</p>

<p align="center">
  <a href="https://github.com/mjenrungrot/oracle"><img src="https://img.shields.io/badge/repo-mjenrungrot%2Foracle-black?style=for-the-badge&logo=github" alt="Fork repository"></a>
  <a href="https://github.com/mjenrungrot/oracle/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mjenrungrot/oracle/ci.yml?branch=main&style=for-the-badge&label=tests" alt="CI Status"></a>
  <a href="https://github.com/mjenrungrot/oracle"><img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-blue?style=for-the-badge" alt="Platforms"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License"></a>
</p>

Oracle is now a browser-only ChatGPT CLI in this fork. It bundles your prompt and files, drives ChatGPT in Chrome, and stores sessions locally so you can inspect, reattach, and restart runs.

This repository no longer supports:

- MCP / `oracle-mcp`
- API mode
- Azure / custom API base URLs
- multi-model fan-out
- Gemini, Claude, Grok, OpenRouter, or custom provider models

## Working from your fork

Clone the fork, install dependencies, and build the local binaries:

```bash
git clone https://github.com/mjenrungrot/oracle.git
cd oracle
pnpm install
pnpm build
```

Run the built CLI directly, or add a local alias:

```bash
alias oracle='node ./dist/bin/oracle-cli.js'
```

## First-time browser setup

Run Oracle normally. On the first run, it opens a persistent automation profile at `~/.oracle/browser-profile`, waits for you to sign into ChatGPT, then continues and sends the original prompt:

```bash
oracle -p "hi"
```

Later runs reuse that saved profile automatically:

```bash
oracle \
  -p "Review the current storage flow" \
  --file "src/**/*.ts" \
  --file "!src/**/*.test.ts"
```

For setup debugging, add `--browser-keep-browser` to leave the window open after the run. `--browser-manual-login` still exists as an explicit override, but it is already the default path in this fork.

## Quick start

```bash
# Browser run with local files
oracle -p "Write a concise architecture note for the storage adapters" \
  --file src/storage/README.md

# Preview without launching Chrome
oracle --preview summary \
  -p "Check release notes" \
  --file docs/release-notes.md

# Launch ChatGPT, fill the composer, and stop before send
oracle --dry-run \
  -p "Check release notes" \
  --file docs/release-notes.md

# Copy the assembled bundle for a manual paste
oracle --render --copy \
  -p "Review the TS data layer for schema drift" \
  --file "src/**/*.ts" \
  --file "!src/**/*.test.ts"

# Sessions
oracle status --hours 72
oracle session <id> --render
oracle restart <id>

# Interactive TUI
oracle tui
```

Supported model inputs are ChatGPT/GPT browser labels only. Typical choices:

- `gpt-5.4-pro`
- `gpt-5.4`
- `gpt-5.2`
- `gpt-5.2-thinking`
- `gpt-5.2-instant`
- legacy GPT aliases like `gpt-5.1`, `gpt-5.1-pro`, and `gpt-5-pro` still resolve to current ChatGPT picker targets

## Remote browser workflows

Remote browser automation stays supported.

Use `oracle serve` on a machine with Chrome installed, then run the CLI from another machine with `--remote-host` and `--remote-token`. The host now defaults to the same persistent manual-login profile flow, so the first remote run may open ChatGPT for sign-in once and later runs reuse that profile.

```bash
# on the browser host
oracle serve

# on the client
oracle \
  --remote-host 192.168.64.2:9473 \
  --remote-token <token> \
  -p "Summarize the incident doc" \
  --file docs/incidents/latest.md
```

The bridge helpers for Windows/Linux browser hosting are still available:

- `oracle bridge host`
- `oracle bridge client`
- `oracle bridge doctor`

## Deprecated surfaces

These commands remain only to fail with explicit guidance:

- `oracle-mcp`
- `oracle oracle-mcp`
- `oracle bridge codex-config`
- `oracle bridge claude-config`

## Configuration

Use `~/.oracle/config.json` for browser defaults like:

- default GPT model
- notification settings
- ChatGPT URL / project URL
- browser profile and timeout settings
- remote host defaults

See [docs/configuration.md](docs/configuration.md) for the current browser-only schema.

## More docs

- Browser behavior: [docs/browser-mode.md](docs/browser-mode.md)
- Configuration: [docs/configuration.md](docs/configuration.md)
- Bridge workflows: [docs/bridge.md](docs/bridge.md)
- Manual verification: [docs/manual-tests.md](docs/manual-tests.md)
- Testing: [docs/testing.md](docs/testing.md)

Deprecated feature pages remain in `docs/` only as migration notes so older references do not look like active support.
