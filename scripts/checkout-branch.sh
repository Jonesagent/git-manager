#!/usr/bin/env bash
# /opt/git-manager/scripts/checkout-branch.sh
# 切换本地分支
# 用法：./checkout-branch.sh <repo> <branch>
# 退出码：0=成功 10=分支不存在 20=参数错误 其他=失败
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo required}"
branch="${2:?branch name required}"

dest="$(repo_path "$name")"
[[ -d "$dest/.git" ]] || { echo "RESULT:repo_not_found"; exit 20; }
cd "$dest"

log "[$name] fetch origin"
timeout 60 git fetch origin --tags 2>&1 || true

# 检查本地是否有
if git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
  log "[$name] checkout local branch $branch"
  git checkout "$branch" 2>&1
  echo "RESULT:checkout_local"
  exit 0
fi

# 检查远程是否有
if git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
  log "[$name] checkout remote branch $branch (create tracking)"
  git checkout -b "$branch" "origin/$branch" 2>&1
  echo "RESULT:checkout_remote"
  exit 0
fi

echo "RESULT:branch_not_found"
exit 10
