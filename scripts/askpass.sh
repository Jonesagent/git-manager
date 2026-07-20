#!/usr/bin/env bash
# 供 git 通过 GIT_ASKPASS 自动提供凭据（用于后续 fetch/push，不写死 URL）
# 使用：GIT_ASKPASS=/opt/git-manager/scripts/askpass.sh GIT_TERMINAL_PROMPT=0 git fetch
[[ -f /opt/git-manager/data/.env ]] && source /opt/git-manager/data/.env
case "$1" in
  *[Uu]sername*) echo "x-access-token" ;;
  *[Pp]assword*) echo "${GITHUB_PAT:-}" ;;
  *)             echo "${GITHUB_PAT:-}" ;;
esac
