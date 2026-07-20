#!/usr/bin/env bash
# /opt/git-manager/scripts/delete-branch.sh
# 删除分支（本地+远程）
# 用法：./delete-branch.sh <repo> <branch> [--remote-only] [--force]
# 注意：main 分支不允许删除
# 退出码：0=成功 10=不存在 20=参数错误 30=受保护 40=删除失败
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo required}"
branch="${2:?branch name required}"
REMOTE_ONLY="${REMOTE_ONLY:-0}"
FORCE="${FORCE:-0}"

dest="$(repo_path "$name")"
[[ -d "$dest/.git" ]] || { echo "RESULT:repo_not_found"; exit 20; }
cd "$dest"

# 受保护分支检查
protected="main master"
if [[ " $protected " == *" $branch "* ]]; then
  echo "RESULT:protected"
  exit 30
fi

if [[ "$FORCE" != "1" ]]; then
  # 二次确认由后端 API 负责，脚本直接执行
  :
fi

deleted_something=0
errors=""

# 删除远程
if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  log "[$name] deleting remote branch $branch"
  if git push origin --delete "$branch" 2>&1; then
    log "[$name] remote branch $branch deleted"
    deleted_something=1
  else
    errors+="failed to delete remote; "
  fi
fi

# 删除本地
if [[ "$REMOTE_ONLY" != "1" ]]; then
  if git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
    log "[$name] deleting local branch $branch"
    if git branch -D "$branch" 2>&1; then
      log "[$name] local branch $branch deleted"
      deleted_something=1
    else
      errors+="failed to delete local; "
    fi
  fi
fi

if [[ "$deleted_something" == "1" ]]; then
  echo "RESULT:deleted"
  exit 0
elif [[ -n "$errors" ]]; then
  echo "RESULT:errors:$errors"
  exit 40
else
  echo "RESULT:not_found"
  exit 10
fi
