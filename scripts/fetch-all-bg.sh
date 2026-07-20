#!/usr/bin/env bash
# /opt/git-manager/scripts/fetch-all-bg.sh
# 后台串行拉取剩余仓库（对每个仓库调用 fetch-one.sh），日志写到 logs/fetch-YYYYMMDD.log
# 用法：nohup bash /opt/git-manager/scripts/fetch-all-bg.sh &
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

LOG_DIR="/opt/git-manager/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/fetch-$(date +%Y%m%d-%H%M%S).log"

{
  log "=== batch fetch start ==="
  for name in "${REPOS[@]}"; do
    if [[ -d "/opt/git-manager/repos/$name/.git" ]]; then
      # 已有 origin/main 就跳过
      if (cd "/opt/git-manager/repos/$name" && git rev-parse --verify origin/main >/dev/null 2>&1); then
        log "[$name] already has origin/main, skip"
        continue
      fi
    fi
    bash "$SCRIPT_DIR/fetch-one.sh" "$name" 50 || log "[$name] failed, continue"
    sleep 2
  done
  log "=== batch fetch done ==="
} | tee -a "$LOG"
