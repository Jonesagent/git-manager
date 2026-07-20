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

# 默认配置（可被环境变量覆盖）
: "${GITHUB_ORG:=lionking-cloud}"
: "${REPOS_ROOT:=/opt/openhands/projects}"

# 优先使用 REPOS_DIR（从后端 config 传入），回退到 REPOS_ROOT
if [[ -z "${REPOS_DIR:-}" ]]; then
  REPOS_DIR="$REPOS_ROOT"
fi

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

# SSH-based git 操作
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

git_url() {
  echo "git@github.com:${GITHUB_ORG}/$1.git"
}

repo_path() {
  echo "${REPOS_DIR}/$1"
}

sanitize_url() {
  sed -E 's|https://[^@]+@|https://***@|g' <<<"$1"
}

log() {
  echo "[$(date +'%F %T')] $*"
}
