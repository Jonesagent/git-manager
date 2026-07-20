#!/usr/bin/env bash
# /opt/git-manager/scripts/create-branch.sh
# 通用分支创建：从指定源分支创建新分支并推送
# 用法：./create-branch.sh <repo> <new-branch> <source-branch> [--push]
# 退出码：0=成功 10=已存在跳过 20=参数错误 其他=失败
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo required}"
new_branch="${2:?new branch name required}"
source_branch="${3:-main}"
DO_PUSH="${PUSH:-1}"

dest="$(repo_path "$name")"
[[ -d "$dest/.git" ]] || { echo "RESULT:repo_not_found"; exit 20; }
cd "$dest"

log "[$name] fetch origin"
timeout 60 git fetch origin --tags 2>&1 || true

# 检查远端
if git ls-remote --exit-code --heads origin "$new_branch" >/dev/null 2>&1; then
  log "[$name] SKIP: remote already has $new_branch"
  echo "RESULT:exists_remote"
  exit 10
fi

# 解析源分支
if git rev-parse --verify "origin/$source_branch" >/dev/null 2>&1; then
  src_sha=$(git rev-parse "origin/$source_branch")
elif git rev-parse --verify "$source_branch" >/dev/null 2>&1; then
  src_sha=$(git rev-parse "$source_branch")
else
  echo "RESULT:source_not_found"
  exit 20
fi

# 检查本地是否已有
if git rev-parse --verify "refs/heads/$new_branch" >/dev/null 2>&1; then
  log "[$name] SKIP: local branch $new_branch exists"
  echo "RESULT:exists_local"
  exit 10
fi

log "[$name] creating $new_branch from $source_branch ($src_sha)"
git branch "$new_branch" "$src_sha"

if [[ "$DO_PUSH" == "1" ]]; then
  if git push -u origin "$new_branch" 2>&1; then
    log "[$name] pushed $new_branch"
    echo "RESULT:created"
  else
    log "[$name] push failed, cleaning up local branch"
    git branch -D "$new_branch" 2>/dev/null || true
    echo "RESULT:push_failed"
    exit 1
  fi
else
  echo "RESULT:created_local"
fi

exit 0
