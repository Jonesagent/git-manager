// /opt/git-manager/backend/src/github.js
// GitHub API 集成：列出用户/组织仓库、检查分支
import { config } from './config.js';

const GITHUB_API = 'https://api.github.com';

function authHeaders() {
  return {
    'Authorization': `token ${config.github.pat}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'git-manager',
  };
}

async function ghFetch(path) {
  const resp = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders() });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text.substring(0, 200)}`);
  }
  return resp.json();
}

// 列出当前用户可访问的所有仓库（分页）
export async function listGithubRepos({ page = 1, perPage = 100, affiliation = 'owner,organization_member' } = {}) {
  const data = await ghFetch(`/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=${affiliation}`);
  return data.map(r => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    owner_avatar: r.owner.avatar_url,
    private: r.private,
    default_branch: r.default_branch,
    description: r.description || '',
    updated_at: r.updated_at,
    html_url: r.html_url,
    clone_url: r.clone_url,
    ssh_url: r.ssh_url,
  }));
}

// 列出某组织/用户的仓库
export async function listOrgRepos(org, { page = 1, perPage = 100 } = {}) {
  const data = await ghFetch(`/orgs/${org}/repos?per_page=${perPage}&page=${page}&sort=updated&type=all`);
  return data.map(r => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    owner_avatar: r.owner.avatar_url,
    private: r.private,
    default_branch: r.default_branch,
    description: r.description || '',
    updated_at: r.updated_at,
    html_url: r.html_url,
    clone_url: r.clone_url,
    ssh_url: r.ssh_url,
  }));
}

// 获取仓库信息
export async function getRepo(owner, repo) {
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  return {
    full_name: data.full_name,
    name: data.name,
    owner: data.owner.login,
    owner_avatar: data.owner.avatar_url,
    private: data.private,
    default_branch: data.default_branch,
    description: data.description || '',
    updated_at: data.updated_at,
    html_url: data.html_url,
    clone_url: data.clone_url,
    ssh_url: data.ssh_url,
  };
}
