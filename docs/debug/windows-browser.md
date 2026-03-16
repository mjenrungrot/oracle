# Windows browser cookies

Oracle reads Chrome cookies via `@steipete/sweet-cookie` (uses `node:sqlite` + PowerShell DPAPI on Windows).

Notes:

- ChatGPT cookies may be app-bound (`v20`) and can still fail to decrypt depending on the machine/account.
- Default behavior on Windows already uses the persistent manual-login profile. Cookie-reader failures should surface that path or inline-cookie guidance rather than sending users back to extra setup flags.
- Cookie-reader failures should surface the relevant manual-login or inline-cookie workaround when app-bound cookies or SQLite access break.
