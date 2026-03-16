# Bridge

Oracle’s bridge workflow is still supported for remote ChatGPT browser automation.

Use it when one machine hosts the signed-in ChatGPT browser session and another machine runs the CLI.

## Commands

- `oracle bridge host`
- `oracle bridge client`
- `oracle bridge doctor`

## Typical flow

### 1. Host

Run this on the machine that already has ChatGPT available in Chrome:

```bash
oracle bridge host --token auto --ssh user@your-linux-host
```

This starts a local `oracle serve` instance, optionally keeps an SSH reverse tunnel alive, and writes a connection artifact under `~/.oracle/`.

### 2. Client

Copy the connection artifact to the client machine, then run:

```bash
oracle bridge client --connect ~/bridge-connection.json --write-config --test
```

This stores `browser.remoteHost` and `browser.remoteToken` in `~/.oracle/config.json`.

After that, normal CLI runs route through the remote host automatically:

```bash
oracle -p "hello" --file README.md
```

### 3. Diagnostics

```bash
oracle bridge doctor
```

This checks remote configuration, reachability, and local browser prerequisites.

## Deprecated helpers

The old MCP config helpers are deprecated in this fork:

- `oracle bridge codex-config`
- `oracle bridge claude-config`

Use `oracle` directly or `oracle serve` instead.
