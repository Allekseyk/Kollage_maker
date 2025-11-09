#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PID_FILE="uvicorn.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "PID file not found ($PID_FILE). Server may not be running."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "Stopping server (PID $PID)..."
  kill "$PID" || true
  sleep 1
  if kill -0 "$PID" 2>/dev/null; then
    echo "Force killing server (PID $PID)..."
    kill -9 "$PID" || true
  fi
else
  echo "Process $PID is not running."
fi

rm -f "$PID_FILE"
echo "Server stopped."


