# Windows compatibility notes

Keep this in sync as we learn more. Read this before doing browser runs on Windows.

- Browser automation is enabled on Windows now, but it is still flakier than macOS. If it fails, retry with `--browser-keep-browser` so you can inspect the automation profile, or use `--remote-chrome` to point at a logged-in Chrome with remote debugging.
- Oracle now uses the persistent manual-login profile by default on Windows too. The normal `oracle -p "..."` path opens `~/.oracle/browser-profile`, waits for ChatGPT sign-in on the first run, then reuses that profile later.
- Cookie sync remains available only if you explicitly opt out of manual-login mode in config. Inline cookies remain available (`--browser-inline-cookies(-file)` / `ORACLE_BROWSER_COOKIES_JSON`).
- For initial login/setup or debugging, add `--browser-keep-browser` to keep the window open after the run. `--browser-manual-login` remains available as an explicit override, but it no longer needs to be part of the standard command.
- Cookie paths: preferred path is `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\<Profile>\\Network\\Cookies`. If that errors, try the top-level `Cookies` file or supply the exact path via `--browser-cookie-path`.
- chrome-devtools tooling still requires a valid `CHROME_DEVTOOLS_URL` from a live session; otherwise calls will fail.
- agent-scripts helpers (`runner`, `scripts/committer`) are bash-based and may fail under PowerShell/CMD; run commands directly if they misbehave.
