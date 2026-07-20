#!/usr/bin/env bash
# /opt/git-manager/scripts/merge-to-main.sh
# 月末：将 dev_YYYYMM 合并到 main 并打 annotated tag
# 用法：./merge-to-main.sh <repo> <YYYYMM> <version> [message]
#       DRY_RUN=1 ./merge-to-main.sh auth-center 202607 v1.4.0 "2026-07 release"
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo required}"
month="${2:?month YYYYMM required}"
version="${3:?version required, e.g. v1.4.0}"
message="${4:-Release ${version}: ${month} monthly}"

branch="dev_${month}"
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "invalid version: $version"; exit 2; }

dest="$(repo_path "$name")"
[[ -d "$dest/.git" ]] || { echo "repo not found: $dest"; exit 2; }
cd "$dest"

log "[$name] fetch origin"
timeout 60 git fetch origin --tags

# 检查 tag 冲突
if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
  echo "tag $version already exists locally"; exit 3
fi
if git ls-remote --tags origin | grep -q "refs/tags/${version}\$"; then
  echo "tag $version already exists on remote"; exit 3
fi

# 检查 dev 分支存在
git rev-parse --verify "refs/remotes/origin/$branch" >/dev/null 2>&1 \
  || { echo "remote branch $branch missing"; exit 3; }

# 切到本地 main（跟踪 origin/main）
git checkout -q -B main origin/main

log "[$name] merging origin/$branch into main"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "[$name] DRY_RUN: git merge --no-ff origin/$branch"
  log "[$name] DRY_RUN: git tag -a $version -m '$message'"
  log "[$name] DRY_RUN: git push origin main --follow-tags"
  exit 0
fi

if ! git merge --no-ff -m "Merge branch '$branch' into main ($version)" "origin/$branch"; then
  log "[$name] merge conflict; aborting"
  git merge --abort || true
  exit 4
fi

git tag -a "$version" -m "$message"
log "[$name] tag $version created"

# push main 与 tag
if git push origin main --follow-tags; then
  log "[$name] pushed main + tag $version"
else
  log "[$name] push failed"
  exit 5
fi
