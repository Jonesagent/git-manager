#!/usr/bin/env bash
# /opt/git-manager/scripts/clone-repo.sh
# 克隆仓库到本地（SSH 方式）
# 用法：./clone-repo.sh <ssh_url> <dest_dir_name>
# 退出码：0=成功 10=已存在 20=参数错误 其他=失败
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

ssh_url="${1:?ssh_url required}"
dest_name="${2:?dest dir name required}"

REPOS_DIR="${REPOS_DIR:-/opt/openhands/projects}"
dest="$REPOS_DIR/$dest_name"

if [[ -d "$dest/.git" ]]; then
  log "[$dest_name] already exists at $dest"
  echo "RESULT:exists"
  exit 10
fi

log "[$dest_name] cloning from $ssh_url"
if timeout 300 git clone --depth 50 "$ssh_url" "$dest" 2>&1; then
  log "[$dest_name] cloned successfully"
  echo "RESULT:cloned"
  exit 0
else
  log "[$dest_name] clone failed"
  echo "RESULT:clone_failed"
  exit 1
fi
