---
description: Install the claude-timeline statusLine wrapper (captures Anthropic rate-limit headers, optionally chains to existing statusLine like cs render)
---

Before making changes, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs status` and show the current state to the user.

Then explain what will change:
- `~/.claude/settings.json` `statusLine.command` will be set to `node ${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs`.
- If a previous statusLine command exists (e.g. `cs render` from leeguooooo/claude-code-usage-bar), it will be saved to `~/.claude/claude-timeline.json` as `downstream_statusline` and chained transparently — their existing status bar keeps working.
- To revert: `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs uninstall`.

Ask the user to confirm before proceeding. On confirmation, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs install` and remind them to restart Claude Code for the change to take effect.

If the user passes `uninstall`, run the uninstall path instead.
