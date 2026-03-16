# Linux Notes

- Browser engine now works on Linux (Chrome/Chromium/Edge) without the old `DISPLAY` guard. Oracle will launch whatever `chrome-launcher` finds or what you pass via `CHROME_PATH`.
- The default Linux path is the same persistent manual-login profile used elsewhere: `oracle -p "..."` opens `~/.oracle/browser-profile`, waits for ChatGPT login once, then reuses that profile later.
- If you explicitly opt out of manual-login mode in config, cookie sync supports snap-installed Chromium automatically. Common cookie DB for the Default profile:
  - `~/snap/chromium/common/chromium/Default/Cookies`
- If you use a non-default profile or a custom install, point Oracle at the correct paths:
  - `--browser-chrome-path /path/to/chrome`
  - `--browser-cookie-path /path/to/profile/Default/Cookies`
- Browser runs are headful (Cloudflare blocks headless). Keep a compositor/virtual display running if you don’t have a desktop session.
- If you explicitly opt into cookie sync and Oracle still can’t find your DB, switch back to the default persistent profile flow or dump the session cookies with `--browser-inline-cookies-file`.
