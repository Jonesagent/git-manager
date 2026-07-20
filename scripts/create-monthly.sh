#!/usr/bin/env bash
# /opt/git-manager/scripts/create-monthly.sh
# 在指定仓库创建 dev_YYYYMM 分支：基于 origin/main
# 用法：./create-monthly.sh <repo-name> <YYYYMM>
#       DRY_RUN=1 ./create-monthly.sh auth-center 202607
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo name required}"
month="${2:?month YYYYMM required}"
branch="dev_${month}"

if [[ ! "$month" =~ ^[0-9]{6}$ ]]; then
  echo "invalid month: $month (expect YYYYMM)"
  exit 2
fi

dest="$(repo_path "$name")"
if [[ ! -d "$dest/.git" ]]; then
  echo "repo not found: $dest"
  exit 2
fi

cd "$dest"

log "[$name] fetch origin main first"
timeout 60 git fetch origin main --tags

# 已存在（本地或远端）就跳过
if git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
  log "[$name] $branch already exists locally"
  exists_local=1
else
  exists_local=0
fi
if git rev-parse --verify "refs/remotes/origin/$branch" >/dev/null 2>&1; then
  log "[$name] $branch already exists on remote"
  exists_remote=1
else
  exists_remote=0
fi

if [[ "$exists_remote" == "1" ]]; then
  log "[$name] SKIP: remote already has $branch"
  exit 0
fi

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "[$name] DRY_RUN: would create $branch from origin/main and push"
  exit 0
fi

# 基于 origin/main 创建 branch
main_sha=$(git rev-parse origin/main)
log "[$name] base sha = $main_sha"

if [[ "$exists_local" == "0" ]]; then
  git branch "$branch" "$main_sha"
fi

# push（--set-upstream）
if git push -u origin "$branch"; then
  log "[$name] pushed $branch"
else
  log "[$name] push failed"
  exit 3
fi
