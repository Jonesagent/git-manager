#!/usr/bin/env bash
# /opt/git-manager/scripts/fetch-one.sh
# 拉取指定仓库的最新引用（SSH），带重试
# 用法：./fetch-one.sh <repo-name>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/opt/git-manager/scripts/git-env.sh
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo name required, e.g. auth-center}"
dest="$(repo_path "$name")"

if [[ ! -d "$dest/.git" ]]; then
  log "[$name] not a git repo: $dest"
  exit 2
fi

max_retry="${MAX_RETRY:-3}"
attempt=0
until (( attempt >= max_retry )); do
  attempt=$(( attempt + 1 ))
  log "[$name] fetch attempt $attempt/$max_retry"
  if (cd "$dest" && timeout 300 git fetch --prune --tags origin); then
    log "[$name] fetch OK"
    exit 0
  fi
  log "[$name] fetch failed, sleeping 5s"
  sleep 5
done

log "[$name] FAILED after $max_retry attempts"
exit 1
