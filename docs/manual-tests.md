# Manual Test Suite

These checks cover the active local feature set: ChatGPT browser automation, session persistence, and remote browser workflows.

## Prerequisites

- Node 22+
- `pnpm install`
- Chrome installed
- a ChatGPT account you can sign into on first run

## Core browser checks

1. First-run/manual-login flow

```bash
oracle -p "hi"
```

Confirm Chrome opens, you can sign in, and the session completes. For setup/debugging, repeat with `--browser-keep-browser` if you need the window left open after the run.

2. Standard browser run

```bash
oracle \
  --model gpt-5.4-pro \
  -p "Summarize the storage design" \
  --file "src/**/*.ts"
```

Confirm the answer is captured and the session is stored.

3. Preview path

```bash
oracle --preview summary -p "Check release notes" --file docs/RELEASING.md
```

Confirm no browser launches and the preview summarizes the planned browser bundle.

3a. Dry-run handoff

```bash
oracle --dry-run -p "Check release notes" --file docs/RELEASING.md
```

Confirm ChatGPT opens, the composer is filled, attachments are prepared, and nothing is sent.

4. Session replay

```bash
oracle status --hours 72
oracle session <id> --render
oracle restart <id>
```

Confirm the stored session renders correctly and restart launches a new browser session.

## Remote browser check

1. On the host:

```bash
oracle serve
```

2. On the client:

```bash
oracle \
  --remote-host <host:port> \
  --remote-token <token> \
  -p "Summarize the incident doc" \
  --file docs/incidents/latest.md
```

Confirm the remote host executes the browser automation and the local client receives the answer.

## Deprecated surfaces

Do not use the old manual checks for:

- MCP
- direct OpenAI / Azure endpoints
- Gemini browser mode
- non-ChatGPT provider integrations
- multi-model fan-out
