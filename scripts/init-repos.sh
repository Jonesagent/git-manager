#!/usr/bin/env bash
# /opt/git-manager/scripts/init-repos.sh
# 快速初始化 8 个仓库的本地骨架（git init + remote），不下载完整历史
# 用途：先让服务上线可用；月度分支等实际写操作时再按需 fetch
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/opt/git-manager/scripts/git-env.sh
source "$SCRIPT_DIR/git-env.sh"

REPOS_DIR="/opt/git-manager/repos"
mkdir -p "$REPOS_DIR"

for name in "${REPOS[@]}"; do
  dest="$REPOS_DIR/$name"
  if [[ -d "$dest/.git" ]]; then
    log "[$name] exists, skip"
    continue
  fi
  log "[$name] init"
  mkdir -p "$dest"
  (
    cd "$dest"
    git init -q -b main
    # 存不带凭据的 URL；实际拉取通过 GIT_ASKPASS 提供 PAT
    git remote add origin "https://github.com/${GITHUB_ORG}/${name}.git"
    git config credential.helper ""
    git config core.hooksPath /opt/git-manager/scripts/hooks
  )
done

log "all skeletons initialized. Use fetch-one.sh <repo> or the manager UI to sync."
