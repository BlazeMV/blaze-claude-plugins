---
description: Enable/disable autostart for the claude-timeline server (launchd on macOS, systemd user unit on Linux). The server starts at login and auto-restarts on crash.
---

The user wants to manage autostart. Argument is `status` (default), `enable`, or `disable`.

Before running anything destructive (enable/disable), explain what will change:

**Enable:**
- **macOS:** writes `~/Library/LaunchAgents/com.blaze.claude-timeline.plist` and runs `launchctl load`. Server starts at login, restarts on crash. Graceful stop (via `/claude-timeline:timeline-stop`) stays stopped until reboot.
- **Linux:** writes `~/.config/systemd/user/claude-timeline.service` and runs `systemctl --user enable --now`. Same behavior. Note: requires `loginctl enable-linger $USER` (run by user, requires sudo) for the service to stay alive after logout — mention this if relevant.
- Any manually-started server will be stopped first to avoid port conflicts.

**Disable:**
- Unloads/disables the service and removes the unit file. Manual `/claude-timeline:timeline` still works.

**Status:**
- Prints platform, whether the unit file exists, and whether it's currently loaded/active.

For `enable` and `disable`, ask the user to confirm before proceeding. For `status`, just run it.

Run: `node ${CLAUDE_PLUGIN_ROOT}/scripts/autostart.mjs <action>`
