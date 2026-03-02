#!/bin/bash
# Auto-deploy: fetch git, rebuild if changed, restart nginx
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

LOG_FILE="$DIR/deploy.log"
MAX_LOG_SIZE=1048576  # 1 MB

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_SIZE" ]; then
    tail -n 200 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }

git fetch origin main --quiet 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "New version: ${LOCAL:0:8} → ${REMOTE:0:8}"

git pull origin main --quiet 2>>"$LOG_FILE"
npm install --legacy-peer-deps --silent 2>>"$LOG_FILE"
npm run build 2>>"$LOG_FILE"
docker restart ibhelm-dashboard >>"$LOG_FILE" 2>&1

log "Deploy complete: $(git rev-parse --short HEAD)"
