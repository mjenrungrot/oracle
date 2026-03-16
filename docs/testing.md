# Testing quickstart

Current supported validation in this fork is browser-focused:

- unit/type tests: `pnpm test` and `pnpm run check`
- build: `pnpm run build`
- browser smokes: `pnpm test:browser`
- fast live browser smoke: `ORACLE_LIVE_TEST=1 pnpm test:live`

Deprecated test surfaces are intentionally excluded from the default suite:

- MCP
- API mode
- multi-model fan-out
- Gemini / Claude / Grok / OpenRouter provider paths

If browser DevTools is blocked on WSL, allow the chosen port (`ORACLE_BROWSER_PORT` / `ORACLE_BROWSER_DEBUG_PORT`) and rerun the browser smoke.
