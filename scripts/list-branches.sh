#!/usr/bin/env bash
# /opt/git-manager/scripts/list-branches.sh
# 输出指定仓库的分支信息（JSON）
# 用法：./list-branches.sh <repo-name>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/git-env.sh"

name="${1:?repo name required}"
dest="$(repo_path "$name")"

if [[ ! -d "$dest/.git" ]]; then
  echo "{\"error\":\"repo not found\",\"repo\":\"$name\"}"
  exit 2
fi

cd "$dest"

# 输出格式 JSON 数组
python3 - "$name" <<'PY'
import json, os, subprocess, sys

repo = sys.argv[1]

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

def sh_ok(cmd):
    try:
        return sh(cmd)
    except subprocess.CalledProcessError:
        return ""

def branches():
    # 输出：ref refname committerdate:iso authorname objectname
    fmt = "%(refname:short)|%(committerdate:iso-strict)|%(authorname)|%(objectname)|%(subject)"
    out = sh_ok(f"git for-each-ref refs/heads refs/remotes --format='{fmt}'")
    seen = set()
    result = []
    for line in out.splitlines():
        parts = line.split("|", 4)
        if len(parts) < 5:
            continue
        ref, date, author, sha, subject = parts
        if ref.endswith("/HEAD") or ref == "origin":
            continue
        # 归一化：origin/xxx -> xxx，标记 remote
        is_remote = ref.startswith("origin/")
        short = ref[len("origin/"):] if is_remote else ref
        # 分类
        if short.startswith("dev_"):
            kind = "monthly"
        elif short.startswith("feature/") or short.startswith("feature_"):
            kind = "feature"
        elif short.startswith("hotfix/"):
            kind = "hotfix"
        elif short == "main":
            kind = "main"
        else:
            kind = "other"
        key = (short, is_remote)
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "name": short,
            "remote": is_remote,
            "kind": kind,
            "sha": sha[:12],
            "last_commit_date": date,
            "last_commit_author": author,
            "last_commit_subject": subject,
        })
    return result

def main_diverge():
    # 每个 dev_ 分支相对 origin/main 领先/落后多少
    try:
        main_sha = sh("git rev-parse origin/main")
    except Exception:
        return {}
    counts = {}
    for line in sh_ok("git for-each-ref refs/remotes/origin/dev_* --format='%(refname:short)'").splitlines():
        b = line.strip()
        if not b:
            continue
        try:
            ahead = int(sh(f"git rev-list --count {main_sha}..{b}"))
            behind = int(sh(f"git rev-list --count {b}..{main_sha}"))
        except Exception:
            continue
        counts[b[len('origin/'):]] = {"ahead": ahead, "behind": behind}
    return counts

data = {
    "repo": repo,
    "branches": branches(),
    "vs_main": main_diverge(),
}
print(json.dumps(data, ensure_ascii=False))
PY
