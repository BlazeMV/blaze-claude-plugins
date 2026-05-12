# blaze-claude-plugins

A Claude Code plugin marketplace by [BlazeMV](https://github.com/BlazeMV).

## Install the marketplace

In Claude Code:

```
/plugin marketplace add BlazeMV/blaze-claude-plugins
```

Then install any plugin from the list below:

```
/plugin install <plugin-name>@blaze-claude-plugins
```

Restart Claude Code after installing.

## Plugins

### [claude-timeline](./plugins/claude-timeline)

Live web dashboard of your Claude Code 5h-session usage and per-prompt cost. Open the dashboard in a browser tab and watch usage tick up in real time — see exactly which prompt is eating your rate-limit budget.

**Features:**
- Real-time chart of cumulative usage % and prompt count over the 5-hour window
- Per-prompt cost breakdown with sortable table (which prompt cost the most?)
- Projected exhaustion time at current burn rate
- Reads authoritative rate-limit data from Anthropic API response headers (via Claude Code's statusLine stdin)
- Optionally chains transparently through an existing statusLine command (e.g. [`leeguooooo/claude-code-usage-bar`](https://github.com/leeguooooo/claude-code-usage-bar)) — both tools keep working

**Install:**
```
/plugin install claude-timeline@blaze-claude-plugins
```

**Commands:**
| Command | What it does |
|---------|--------------|
| `/timeline` | Start the local web server (default port 7373) and open the dashboard in your browser |
| `/timeline-stop` | Stop the server |
| `/timeline-setup` | Install the statusLine wrapper so the plugin captures rate-limit data first-party. Detects and chains any existing statusLine command. |

**Config:** `~/.claude/claude-timeline.json`

```json
{
  "port": 7373,
  "source": "auto",
  "downstream_statusline": null,
  "refresh_ms": 2500
}
```

- `port` — local server port
- `source` — `"auto"` (prefer own capture, fall back to claude-statusbar cache), `"self"`, or `"statusbar"`
- `downstream_statusline` — command to chain through (auto-populated by `/timeline-setup` if you had one)
- `refresh_ms` — server poll/push interval

See the [plugin README](./plugins/claude-timeline/README.md) for more.

## License

MIT — see [LICENSE](./LICENSE).
