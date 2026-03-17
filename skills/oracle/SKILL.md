---
name: oracle
description: Use your Oracle CLI command to bundle a prompt plus the right files and get a browser-only ChatGPT second-model review for debugging, refactors, design checks, or cross-validation.
---

# Oracle (CLI) — best use

Oracle bundles your prompt + selected files into one "one-shot" request, opens ChatGPT in a browser, and submits it to GPT-5.4 Pro. Browser-only. Treat outputs as advisory: verify against the codebase + tests.

## Command

```
pnpm run oracle -- [options] [prompt]
```

All examples below use this invocation.

For long prompts, pass a file path to `-p`:

```bash
pnpm run oracle -- -p prompt.md --file "src/**"
```

## Workflow

### Step 1: Preview locally (no browser, no model call)

Use `--preview` to inspect what you're about to send without opening a browser:

```bash
pnpm run oracle -- --preview summary -p "<task>" --file "src/**" --files-report
pnpm run oracle -- --preview json -p "<task>" --file "src/**"
pnpm run oracle -- --preview full -p "<task>" --file "src/**"
```

`--preview` accepts `summary` (default), `json`, or `full`. Combine with `--files-report` to spot token hogs.

### Step 2 (optional): Dry run — review before submit

`--dry-run` opens ChatGPT in the browser and fills the composer with your bundled prompt + files, but **stops before sending**. This lets the user review exactly what will be submitted.

```bash
pnpm run oracle -- --dry-run -p "<task>" --file "src/**" --file "!**/*.test.*"
```

### Step 3: Full run

Remove `--dry-run` to submit. Long-running is normal (GPT-5.4 Pro often takes ~10 minutes to ~1 hour).

```bash
pnpm run oracle -- -p "<task>" --file "src/**" --file "!src/**/*.test.ts"
```

Optionally specify a model: `--model gpt-5.4-pro` (default) or a ChatGPT picker label like `--model "5.4 Pro"`.

> **Suppress the browser window:** Add `--browser-hide-window` to hide Chrome after launch (macOS, recommended) or `--browser-headless` for true headless mode (may trigger CAPTCHAs). Both can be set as defaults in `~/.oracle/config.json`.

### Step 4: If timeout/detach — reattach, never re-run

If the CLI times out or detaches, **do not re-run**. Reattach to the stored session:

```bash
oracle status --hours 72
oracle session <id> --render
```

## Manual paste fallback

Build the bundle, print it, and copy to clipboard for manual paste into ChatGPT:

```bash
pnpm run oracle -- --render --copy-markdown -p "<task>" --file "src/**"
```

## Attaching files (`--file`)

`--file` accepts files, directories, and globs. You can pass it multiple times; entries can be comma-separated.

- Include:
  - `--file "src/**"` (directory glob)
  - `--file src/index.ts` (literal file)
  - `--file docs --file README.md` (literal directory + file)

- Exclude (prefix with `!`):
  - `--file "src/**" --file "!src/**/*.test.ts" --file "!**/*.snap"`

- Defaults:
  - Default-ignored dirs: `node_modules`, `dist`, `coverage`, `.git`, `.turbo`, `.next`, `build`, `tmp` (skipped unless explicitly passed).
  - Honors `.gitignore` when expanding globs.
  - Does not follow symlinks.
  - Dotfiles are filtered unless you opt in (e.g. `--file ".github/**"`).
  - Default cap: files > 1 MB are rejected unless you raise `ORACLE_MAX_FILE_SIZE_BYTES` or `maxFileSizeBytes` in `~/.oracle/config.json`.

## Budget + observability

- Target: keep total input under ~196k tokens.
- Use `--files-report` and/or `--preview json` to spot token hogs before spending.
- Hidden/advanced knobs: `pnpm run oracle -- --help --verbose`.

## Sessions + slugs (don't lose work)

- Stored under `~/.oracle/sessions` (override with `ORACLE_HOME_DIR`).
- Runs may detach or take a long time. If the CLI times out: don't re-run; reattach.
  - List: `oracle status --hours 72`
  - Attach: `oracle session <id> --render`
  - Interactive: `oracle tui` for a terminal UI.
- Use `--slug "<3-5 words>"` to keep session IDs readable.
- Duplicate prompt guard exists; use `--force` only when you truly want a fresh run.

## Prompt rules (high signal)

Oracle starts with **zero** project knowledge. Always include:

1. **Project briefing**: stack, build/test commands, platform constraints.
2. **Where things live**: key directories, entrypoints, config files, dependency boundaries.
3. **Exact question**: what you tried + the error text (verbatim).
4. **Constraints**: "don't change X", "must keep public API", "perf budget", etc.
5. **Desired output**: "return patch plan + tests", "list risky assumptions", "give 3 options with tradeoffs".

### Exhaustive prompt pattern (long investigations)

When this will be a long investigation, write a prompt that can stand alone:

- Top: 6-30 sentence project briefing + current goal.
- Middle: concrete repro steps + exact errors + what you already tried.
- Bottom: attach _all_ context files needed so a fresh model can fully understand (entrypoints, configs, key modules, docs).

Oracle runs are one-shot; the model doesn't remember prior runs. To reproduce context later, re-run with the same prompt + `--file` set.

## Troubleshooting: `ECONNREFUSED` or browser failures

If Oracle fails with `connect ECONNREFUSED` or other browser errors, **quit Chrome completely and retry**. Oracle launches Chrome with special DevTools Protocol (CDP) flags to control it programmatically. If Chrome is already running, the OS reuses the existing process which doesn't have those flags — so Oracle can't connect to it. Closing Chrome lets Oracle launch a fresh instance with the correct CDP configuration.

## Safety

- Don't attach secrets by default (`.env`, key files, auth tokens). Redact aggressively; share only what's required.
- Prefer "just enough context": fewer files + better prompt beats whole-repo dumps.
