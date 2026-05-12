#!/bin/bash
# Start the claude-timeline server in the background and open it in browser.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$HOME/.cache/claude-timeline/server.pid"
PORT=$(node -e "import('$DIR/config.mjs').then(m => console.log(m.readConfig().port))" 2>/dev/null || echo 7373)

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "already running (pid $(cat "$PID_FILE")) on http://localhost:$PORT"
else
  mkdir -p "$HOME/.cache/claude-timeline"
  nohup node "$DIR/server.mjs" > "$HOME/.cache/claude-timeline/server.log" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 0.4
  echo "started pid $(cat "$PID_FILE") on http://localhost:$PORT"
fi

if [ "$1" != "--no-open" ]; then
  if command -v open >/dev/null; then open "http://localhost:$PORT"
  elif command -v xdg-open >/dev/null; then xdg-open "http://localhost:$PORT"
  fi
fi
