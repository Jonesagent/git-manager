#!/usr/bin/env bash
# /opt/git-manager/scripts/git-env.sh
# 供其他 git 脚本 source，统一环境（专属 SSH key + 严格身份）
set -euo pipefail

export GIT_SSH_COMMAND="ssh -i /opt/git-manager/data/ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -F /dev/null"

# 加载 .env（仅取需要的字段，避免污染其他变量）
if [[ -f /opt/git-manager/data/.env ]]; then
  # shellcheck disable=SC1091
  set -o allexport
  source /opt/git-manager/data/.env
  set +o allexport
fi

# 默认 org / 仓库列表
: "${GITHUB_ORG:=lionking-cloud}"
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

git_url() {
  echo "git@github.com:${GITHUB_ORG}/$1.git"
}

log() {
  echo "[$(date +'%F %T')] $*"
}
