#!/bin/bash
PID_FILE="$HOME/.cache/claude-timeline/server.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "stopped pid $PID"
  else
    echo "stale pid file, removing"
  fi
  rm -f "$PID_FILE"
else
  echo "not running"
fi
