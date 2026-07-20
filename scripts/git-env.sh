#!/usr/bin/env bash
# /opt/git-manager/scripts/git-env.sh
# 供其他 git 脚本 source，统一环境
set -euo pipefail

# 加载 .env
if [[ -f /opt/git-manager/data/.env ]]; then
  set -o allexport
  # shellcheck disable=SC1091
  source /opt/git-manager/data/.env
  set +o allexport
fi

# 默认 org / 仓库列表 / 仓库根路径（复用 openhands 已下载好的目录）
: "${GITHUB_ORG:=lionking-cloud}"
: "${REPOS_ROOT:=/opt/openhands/projects}"

REPOS=(
  auth-center
  register-center
  common-base
  data-center
  agent-center
  task-center
  config-center
  technical-center
)

# SSH-based git 操作（用户反馈 SSH 快，且已有 ~/.ssh 全局 key 生效）
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

git_url() {
  echo "git@github.com:${GITHUB_ORG}/$1.git"
}

repo_path() {
  echo "${REPOS_ROOT}/$1"
}

# 用于日志脱敏
sanitize_url() {
  sed -E 's|https://[^@]+@|https://***@|g' <<<"$1"
}

log() {
  echo "[$(date +'%F %T')] $*"
}
