#!/usr/bin/env bash
# /opt/git-manager/scripts/create-monthly.sh
# 在指定仓库创建 dev_YYYYMM 分支：基于 origin/main
# 用法：./create-monthly.sh <repo-name> <YYYYMM>
#       DRY_RUN=1 ./create-monthly.sh auth-center 202607
#
# 退出码：
#   0 = 创建并推送成功
#   10 = 已存在（远端或本地），跳过（幂等）
#   20 = 参数错误
#   其他 = 失败
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo name required}"
month="${2:?month YYYYMM required}"
branch="dev_${month}"

if [[ ! "$month" =~ ^[0-9]{6}$ ]]; then
  echo "RESULT:invalid_month"
  exit 20
fi

dest="$(repo_path "$name")"
if [[ ! -d "$dest/.git" ]]; then
  echo "RESULT:repo_not_found"
  exit 20
fi

cd "$dest"

# fetch latest
log "[$name] fetching origin main"
timeout 60 git fetch origin main --tags 2>&1

# 检查远端是否已有
if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  log "[$name] SKIP: remote already has $branch (idempotent)"
  echo "RESULT:exists_remote"
  exit 10
fi

# 检查本地是否已有
if git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
  log "[$name] SKIP: local branch $branch exists (pushing if needed)"
  if git push -u origin "$branch" 2>&1; then
    echo "RESULT:exists_local_pushed"
  else
    echo "RESULT:exists_local"
  fi
  exit 10
fi

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  main_sha=$(git rev-parse origin/main)
  log "[$name] DRY_RUN: would create $branch from $main_sha and push"
  echo "RESULT:dry_run_ok"
  exit 0
fi

# 创建并推送
main_sha=$(git rev-parse origin/main)
log "[$name] creating $branch from origin/main ($main_sha)"
git branch "$branch" "$main_sha"

if git push -u origin "$branch" 2>&1; then
  log "[$name] pushed $branch"
  echo "RESULT:created"
  exit 0
else
  log "[$name] push failed"
  git branch -D "$branch" 2>/dev/null || true
  echo "RESULT:push_failed"
  exit 1
fi
