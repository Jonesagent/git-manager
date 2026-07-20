#!/usr/bin/env bash
# /opt/git-manager/scripts/clone-all.sh
# 首次克隆或同步 8 个 lionking-cloud 仓库
# 默认走 HTTPS + PAT（快、稳定），可用 AUTH_MODE=ssh 切换
# 支持 PARALLEL=N 并行、SHALLOW=1 浅克隆
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/opt/git-manager/scripts/git-env.sh
source "$SCRIPT_DIR/git-env.sh"

REPOS_DIR="/opt/git-manager/repos"
mkdir -p "$REPOS_DIR"

PARALLEL="${PARALLEL:-3}"
SHALLOW="${SHALLOW:-1}"
SINGLE_BRANCH="${SINGLE_BRANCH:-1}"
DEPTH_ARGS=()
if [[ "$SHALLOW" == "1" ]]; then
  DEPTH_ARGS+=(--depth 50)
fi
if [[ "$SINGLE_BRANCH" == "1" ]]; then
  DEPTH_ARGS+=(--single-branch)
fi

clone_one() {
  local name="$1"
  local url dest sanitized
  url="$(git_url "$name")"
  dest="$REPOS_DIR/$name"
  sanitized="$(sanitize_url "$url")"

  if [[ -d "$dest/.git" ]]; then
    log "[$name] exists, fetching..."
    if ! (cd "$dest" && git fetch --all --prune --tags --progress 2>&1); then
      log "[$name] FETCH FAILED"
      return 1
    fi
  else
    log "[$name] cloning $sanitized"
    if ! git clone --progress "${DEPTH_ARGS[@]}" "$url" "$dest" 2>&1; then
      log "[$name] CLONE FAILED"
      rm -rf "$dest"
      return 1
    fi
    # 立即把 remote 里的 PAT 隐藏（改为不带凭据的 URL；后续同步走 GIT_ASKPASS）
    (cd "$dest" && git remote set-url origin "https://github.com/${GITHUB_ORG}/${name}.git")
  fi
  log "[$name] OK"
}

export -f clone_one log sanitize_url git_url
export AUTH_MODE GITHUB_PAT GITHUB_ORG SHALLOW
export REPOS_DIR
export -a DEPTH_ARGS

failed=0
if command -v xargs >/dev/null 2>&1 && [[ "$PARALLEL" -gt 1 ]]; then
  log "parallel=$PARALLEL  shallow=$SHALLOW  auth=$AUTH_MODE"
  printf '%s\n' "${REPOS[@]}" | xargs -n1 -P"$PARALLEL" -I{} bash -c 'clone_one "$@"' _ {} || failed=1
else
  for name in "${REPOS[@]}"; do
    clone_one "$name" || failed=1
  done
fi

if [[ "$failed" -ne 0 ]]; then
  log "some repos failed."
  exit 1
fi

log "all repos synced."
