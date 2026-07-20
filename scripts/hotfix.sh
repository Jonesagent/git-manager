#!/usr/bin/env bash
# /opt/git-manager/scripts/hotfix.sh
# 热修复分支创建向导：从 origin/main 拉 hotfix/<version>
# 完成 fix 后可用 hotfix-finish.sh 合入 main 并同步到当月 dev_
# 用法：./hotfix.sh <repo> <version>  例如 ./hotfix.sh auth-center v1.3.1
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo required}"
version="${2:?version required, e.g. v1.3.1}"

[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "invalid version: $version"; exit 2; }

branch="hotfix/${version}"
dest="$(repo_path "$name")"
[[ -d "$dest/.git" ]] || { echo "repo not found"; exit 2; }
cd "$dest"

timeout 60 git fetch origin main --tags

if git rev-parse --verify "refs/remotes/origin/$branch" >/dev/null 2>&1; then
  echo "$branch already exists on remote"; exit 3
fi

git checkout -q -B "$branch" origin/main

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "[$name] DRY_RUN: would push $branch"
  exit 0
fi

git push -u origin "$branch"
log "[$name] hotfix branch $branch created from origin/main"
