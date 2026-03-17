# Local configuration (JSON5)

Oracle reads an optional per-user config from `~/.oracle/config.json`. The file uses JSON5 parsing, so comments and trailing commas are allowed.

This fork is browser-only. Legacy provider settings are deprecated and ignored or rejected depending on whether they actively request removed behavior.

## Example

```json5
{
  model: "gpt-5.4-pro",

  notify: {
    enabled: true,
    sound: false,
    muteIn: ["CI", "SSH"],
  },

  browser: {
    chromeProfile: "Default",
    chromePath: null,
    chromeCookiePath: null,
    chatgptUrl: "https://chatgpt.com/",
    url: null, // legacy alias for chatgptUrl

    remoteHost: "127.0.0.1:9473",
    remoteToken: "<token>",
    remoteViaSshReverseTunnel: { ssh: "user@linux-host", remotePort: 9473 },

    debugPort: null,
    timeoutMs: 1200000,
    inputTimeoutMs: 120000,
    cookieSyncWaitMs: 0,
    assistantRecheckDelayMs: 0,
    assistantRecheckTimeoutMs: 120000,
    reuseChromeWaitMs: 10000,
    profileLockTimeoutMs: 300000,
    autoReattachDelayMs: 5000,
    autoReattachIntervalMs: 3000,
    autoReattachTimeoutMs: 60000,

    modelStrategy: "select",
    thinkingTime: "extended",
    manualLogin: true,
    manualLoginProfileDir: null,
    headless: false,
    hideWindow: false,
    keepBrowser: false,
  },

  heartbeatSeconds: 30,
  maxFileSizeBytes: 2097152,
  filesReport: false,
  sessionRetentionHours: 72,
  promptSuffix: "// signed-off by me",
}
```

## Active settings

- `model`: default ChatGPT/GPT browser model
- `notify.*`: completion notifications
- `browser.*`: ChatGPT browser automation defaults
- `heartbeatSeconds`: default heartbeat interval
- `maxFileSizeBytes`: file attachment safety guard
- `filesReport`: default file token report
- `sessionRetentionHours`: prune old cached sessions before new runs
- `promptSuffix`: append text to every prompt

## Deprecated settings

These no longer define supported behavior in this fork:

- `engine`
- `search`
- `background`
- `apiBaseUrl`
- `azure`

Behavior:

- `engine: "api"` is rejected.
- non-ChatGPT models are rejected.
- stale provider-related keys are warned about and ignored.

## Precedence

CLI flags override `config.json`, then environment variables, then built-in defaults.

Relevant current precedence points:

- `--model` overrides `config.model`
- `--remote-host/--remote-token` override `browser.remoteHost` / `browser.remoteToken`
- `--retain-hours` overrides `sessionRetentionHours`
- `ORACLE_RETAIN_HOURS` overrides `sessionRetentionHours` when the CLI flag is absent
- `ORACLE_MAX_FILE_SIZE_BYTES` overrides `maxFileSizeBytes`

## Session retention

- `--retain-hours <n>` deletes sessions older than `<n>` hours before a new run starts
- `sessionRetentionHours` applies the same behavior by default
- `oracle session --clear` and `oracle status --clear` still exist for explicit cleanup

## Notes

- `browser.chatgptUrl` accepts the root ChatGPT URL or a project/folder URL
- `browser.manualLogin` defaults to `true`; set it to `false` if you intentionally want Chrome cookie copy instead of the persistent automation profile
- `browser.remoteHost` / `browser.remoteToken` are the preferred persistent settings for remote browser service usage

For browser behavior details, see [browser-mode.md](browser-mode.md).
