# claude-timeline

Live web dashboard of your Claude Code 5h-session usage and per-prompt cost. See exactly which prompt is eating your rate-limit budget, in real time.

## What it shows

- **Cumulative usage %** over your 5-hour rolling window — pinned to Anthropic's actual rate-limit number, not estimated
- **Cumulative prompts** alongside, so you can spot expensive prompts at a glance (steep usage rise + flat prompt line = costly turn)
- **Per-prompt markers** sized by tokens spent; hover for the prompt text and a per-prompt cost
- **Projected exhaustion time** at your current burn rate
- **Sortable table** of every prompt in the current session, ranked by cost

The page subscribes to a Server-Sent Events stream and updates every ~2.5 seconds — leave the tab pinned.

## How the data is sourced

Claude Code pipes a JSON payload to whatever you configure as your `statusLine` command, and that payload includes:

```json
"rate_limits": {
  "five_hour": { "used_percentage": 83, "resets_at": 1778611200 },
  "seven_day": { "used_percentage":  8, "resets_at": 1779123600 }
}
```

This plugin ships a tiny statusLine **wrapper** (`scripts/capture.mjs`) that:
1. Reads Claude Code's stdin
2. Writes it to `~/.cache/claude-timeline/last_stdin.json` (our own cache)
3. *Optionally* execs a downstream statusLine command (e.g. `cs render` from [leeguooooo/claude-code-usage-bar](https://github.com/leeguooooo/claude-code-usage-bar)) with the same stdin so your visible status bar keeps working

The web server reads our own cache. If `/timeline-setup` hasn't been run yet, it falls back to reading claude-statusbar's cache when present, and to a prompt-gap heuristic otherwise.

## Install

```
/plugin marketplace add BlazeMV/blaze-claude-plugins
/plugin install claude-timeline@blaze-claude-plugins
```

Restart Claude Code.

## Usage

| Command | What it does |
|---------|--------------|
| `/timeline` | Start the local server (default port 7373) and open the dashboard |
| `/timeline-stop` | Stop the server |
| `/timeline-setup` | Install the statusLine wrapper (first-party capture). Detects and chains any existing statusLine. |
| `/timeline-setup uninstall` | Restore your original statusLine command |

## Config (`~/.claude/claude-timeline.json`)

```json
{
  "port": 7373,
  "source": "auto",
  "downstream_statusline": null,
  "refresh_ms": 2500
}
```

- **`port`** — local server port (default 7373)
- **`source`** — where to read rate-limit data:
  - `"auto"` — prefer own capture, fall back to claude-statusbar cache, then heuristic
  - `"self"` — only our cache (requires `/timeline-setup`)
  - `"statusbar"` — read claude-statusbar's cache (no install required)
- **`downstream_statusline`** — auto-populated by `/timeline-setup` if a statusLine was already configured
- **`refresh_ms`** — server poll/push interval

## Compatibility with claude-statusbar

If you already use [leeguooooo/claude-code-usage-bar](https://github.com/leeguooooo/claude-code-usage-bar), `/timeline-setup` detects `cs render` (or whatever you have set) and chains through it. Both tools keep working with independent caches.

If you don't run `/timeline-setup`, the plugin transparently reads claude-statusbar's cache as a fallback — zero coupling, no install required.

## License

MIT
