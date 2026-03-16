# Browser Mode

Oracle in this fork is browser-only. Every run goes through ChatGPT in Chrome; there is no separate API engine anymore.

## What browser mode does

1. Assembles your prompt and file bundle locally.
2. Launches or reuses Chrome.
3. Reuses a persistent manual-login profile by default and waits for ChatGPT login on first use.
4. Selects the requested ChatGPT/GPT browser model.
5. Pastes or uploads the bundle.
6. Captures the final answer and stores the run under `~/.oracle/sessions`.

## Supported model inputs

Supported browser targets are ChatGPT/GPT models only:

- `gpt-5.4-pro`
- `gpt-5.4`
- `gpt-5.2`
- `gpt-5.2-thinking`
- `gpt-5.2-instant`

Legacy GPT aliases such as `gpt-5.1`, `gpt-5.1-pro`, `gpt-5-pro`, and `gpt-5.2-pro` still map to current ChatGPT picker targets.

Non-ChatGPT providers and model families are deprecated in this repository.

## Common usage

```bash
oracle \
  --model gpt-5.4-pro \
  -p "Review the storage migration plan" \
  --file "src/**/*.ts"
```

## Browser-specific options

- `--chatgpt-url`: target a specific ChatGPT workspace or project URL
- `--browser-model-strategy <select|current|ignore>`: control model picker behavior
- `--browser-thinking-time <light|standard|extended|heavy>`: tune ChatGPT thinking intensity
- `--browser-manual-login`: explicit/manual override for the persistent automation-profile flow Oracle already uses by default
- `--browser-keep-browser`: leave Chrome open after the run
- `--browser-timeout`, `--browser-input-timeout`: main browser time budgets
- `--browser-recheck-delay`, `--browser-recheck-timeout`: delayed retry capture after timeout
- `--browser-auto-reattach-delay`, `--browser-auto-reattach-interval`, `--browser-auto-reattach-timeout`: periodic reattach attempts for long-running responses
- `--browser-attachments <auto|never|always>`: choose inline vs upload behavior
- `--browser-inline-files`: force inline paste
- `--browser-bundle-files`: bundle attachments before upload
- `--remote-host`, `--remote-token`: delegate the run to `oracle serve`
- `--remote-chrome <host:port>`: attach to an existing Chrome DevTools endpoint

## Persistent profile default

The default `oracle -p "..."` path already uses a dedicated automation profile and waits for ChatGPT login when needed.

```bash
oracle \
  -p "hi"
```

- Oracle creates a persistent profile under `~/.oracle/browser-profile`
- sign into ChatGPT once in that window on the first run
- later runs reuse the same profile automatically
- add `--browser-keep-browser` when you want the window left open after completion

## Remote browser service

`oracle serve` remains the preferred way to run ChatGPT automation on another machine:

```bash
# host
oracle serve

# client
oracle --remote-host 192.168.64.2:9473 --remote-token <token> \
  -p "Summarize the incident doc" \
  --file docs/incidents/latest.md
```

## Preview mode

`--preview [summary|json|full]` stays useful in browser mode. It shows:

- estimated prompt size
- whether files would be inlined or uploaded
- the composer text / preview JSON depending on the selected preview mode

`--dry-run` is now the manual handoff path: it launches ChatGPT, applies the real browser prompt/file preparation, fills the composer, and stops before send with the browser left open.

## Deprecated browser pages

Older Gemini-specific browser docs are retained only as deprecation notes. They are not active features in this fork anymore.
