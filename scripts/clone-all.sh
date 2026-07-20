#!/usr/bin/env bash
# /opt/git-manager/scripts/clone-all.sh
# 首次克隆或同步 8 个 lionking-cloud 仓库（bare mirror + working copy 二选一）
# 这里用普通 clone（含工作树），便于 checkout / branch 操作
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/opt/git-manager/scripts/git-env.sh
source "$SCRIPT_DIR/git-env.sh"

REPOS_DIR="/opt/git-manager/repos"
mkdir -p "$REPOS_DIR"

for name in "${REPOS[@]}"; do
  url="$(git_url "$name")"
  dest="$REPOS_DIR/$name"
  if [[ -d "$dest/.git" ]]; then
    log "[$name] exists, fetching..."
    (cd "$dest" && git fetch --all --prune --tags)
  else
    log "[$name] cloning $url"
    git clone "$url" "$dest"
  fi
done

log "done."
