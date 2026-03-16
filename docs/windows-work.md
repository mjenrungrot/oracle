# Windows work notes

Read this file whenever you're working from Windows and add new findings so the next agent can stay unblocked.

- Browser automation is allowed on Windows; expect more flakiness. The default path is still just `oracle -p "..."`, which uses the persistent automation profile under `~/.oracle/browser-profile`. If automation fails, retry with `--browser-keep-browser` or point `--remote-chrome` to a running Chrome with remote debugging.
- Chrome DevTools tooling still needs `CHROME_DEVTOOLS_URL` from a live session. Expect this to be unset on Windows unless you bring your own Chrome session/URL.
- agent-scripts bash helpers: `runner`/`scripts/committer` can fail under PowerShell/CMD because of CRLF and bash expectations. If they explode, run commands directly (`pnpm ...`, `git add/commit`) instead.
- browser-tools binary: not built in `agent-scripts/bin` on Windows; `pnpm tsx scripts/browser-tools.ts` also fails there (no package manifest). Use a macOS-built binary or run from macOS if you need it.
- Prefer PowerShell + pnpm directly; watch for CRLF warnings when touching tracked files.

Future Windows gotchas belong here. Update this doc when you learn something new.
