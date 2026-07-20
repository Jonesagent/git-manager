#!/usr/bin/env bash
# /opt/git-manager/scripts/fetch-one.sh
# 拉取指定仓库的最新引用（浅克隆），可反复调用；带重试
# 用法：./fetch-one.sh <repo-name> [depth=50]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/opt/git-manager/scripts/git-env.sh
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo name required, e.g. auth-center}"
depth="${2:-50}"

REPOS_DIR="/opt/git-manager/repos"
dest="$REPOS_DIR/$name"

if [[ ! -d "$dest/.git" ]]; then
  log "[$name] not initialized, run init-repos.sh first"
  exit 2
fi

export GIT_ASKPASS="$SCRIPT_DIR/askpass.sh"
export GIT_TERMINAL_PROMPT=0

max_retry=3
attempt=0
until (( attempt >= max_retry )); do
  attempt=$(( attempt + 1 ))
  log "[$name] fetch attempt $attempt/$max_retry (depth=$depth)"
  if (cd "$dest" && timeout 300 git fetch --prune --tags --depth "$depth" origin '+refs/heads/*:refs/remotes/origin/*'); then
    log "[$name] fetch OK"
    # 首次 fetch 后，如果本地没 main，切到 origin/main
    if ! (cd "$dest" && git rev-parse --verify main >/dev/null 2>&1); then
      if (cd "$dest" && git rev-parse --verify origin/main >/dev/null 2>&1); then
        (cd "$dest" && git checkout -q -B main origin/main)
        log "[$name] main tracked to origin/main"
      fi
    fi
    exit 0
  fi
  log "[$name] fetch failed, sleeping 5s"
  sleep 5
done

log "[$name] FAILED after $max_retry attempts"
exit 1
