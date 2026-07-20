#!/usr/bin/env bash
# /opt/git-manager/scripts/git-env.sh
# 供其他 git 脚本 source，统一环境（专属 SSH key + 严格身份）
set -euo pipefail

# GitHub 认证策略：
#   1) 首选 HTTPS + PAT（速度快，稳定）→ 通过 GIT_ASKPASS 或 URL 内嵌
#   2) SSH key 保留作为后备 / hooks 场景
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

# 认证方式：
#   AUTH_MODE=https   → https://x-access-token:$PAT@github.com/... （默认，快）
#   AUTH_MODE=ssh     → git@github.com:... （回退）
: "${AUTH_MODE:=https}"

git_url() {
  local name="$1"
  case "$AUTH_MODE" in
    https)
      if [[ -z "${GITHUB_PAT:-}" ]]; then
        echo "[git-env] GITHUB_PAT is empty; falling back to SSH" >&2
        echo "git@github.com:${GITHUB_ORG}/${name}.git"
      else
        echo "https://x-access-token:${GITHUB_PAT}@github.com/${GITHUB_ORG}/${name}.git"
      fi
      ;;
    *)
      echo "git@github.com:${GITHUB_ORG}/${name}.git"
      ;;
  esac
}

# 用于日志脱敏
sanitize_url() {
  sed -E 's|https://x-access-token:[^@]+@|https://x-access-token:***@|g' <<<"$1"
}

log() {
  echo "[$(date +'%F %T')] $*"
}
