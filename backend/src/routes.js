// /opt/git-manager/backend/src/routes.js
import express from 'express';
import { authMiddleware, requireRole, login, changePassword } from './auth.js';
import { db, audit, addManagedRepo, removeManagedRepo, getManagedRepos, getManagedRepo, updateRepoLocalPath } from './db.js';
import { listRepos, listBranches, fetchRepo, createMonthly, mergeToMain, createHotfix } from './git.js';
import { runScriptStream } from './stream.js';
import { listGithubRepos, listOrgRepos, getRepo as getGithubRepo } from './github.js';
import { proxyGithubPage, getRepoOverview } from './proxy.js';
import { config } from './config.js';
import path from 'node:path';
import fs from 'node:fs';

export const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'git-manager', ts: Date.now() });
});

// ------- auth -------
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });
  const result = login(username, password, req.ip);
  if (!result) return res.status(401).json({ error: 'invalid_credentials' });
  res.json(result);
});

router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.post('/auth/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  const r = changePassword(req.user.id, oldPassword, newPassword);
  if (!r.ok) return res.status(400).json(r);
  res.json(r);
});

// ------- repos (managed) -------
router.get('/repos', authMiddleware, async (req, res) => {
  const list = await listRepos();
  const managedRows = getManagedRepos();
  res.json({
    repos: list,
    managed: config.managedRepos,
    managedDetails: managedRows.map(r => ({
      ...r,
      private: !!r.private,
    })),
    org: config.github.org,
  });
});

router.get('/repos/:name/branches', authMiddleware, async (req, res, next) => {
  try {
    const data = await listBranches(req.params.name);
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/repos/:name/fetch', authMiddleware, requireRole('tech_lead', 'developer'), async (req, res, next) => {
  try {
    const r = await fetchRepo(req.params.name);
    audit({
      userId: req.user.id, username: req.user.username,
      action: 'fetch_repo', resource: req.params.name,
      detail: { exit: r.code },
      status: r.code === 0 ? 'ok' : 'fail', ip: req.ip
    });
    if (r.code !== 0) return res.status(500).json({ ok: false, ...r });
    res.json({ ok: true, ...r });
  } catch (e) { next(e); }
});

// ------- GitHub repos discovery -------
router.get('/github/repos', authMiddleware, async (req, res, next) => {
  try {
    const { org, page = 1, search = '' } = req.query;
    let repos;
    if (org) {
      repos = await listOrgRepos(org, { page: Number(page) });
    } else {
      repos = await listGithubRepos({ page: Number(page) });
    }
    // 过滤搜索
    if (search) {
      repos = repos.filter(r => r.full_name.toLowerCase().includes(String(search).toLowerCase()));
    }
    res.json({ repos });
  } catch (e) {
    next(e);
  }
});

router.get('/github/orgs', authMiddleware, async (req, res, next) => {
  try {
    // 返回 GitHub /user/orgs
    const resp = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `token ${config.github.pat}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'git-manager',
      }
    });
    const data = await resp.json();
    const orgs = data.map(o => ({ login: o.login, avatar_url: o.avatar_url }));
    // 加上个人账号
    const userResp = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${config.github.pat}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'git-manager',
      }
    });
    const userData = await userResp.json();
    orgs.unshift({ login: userData.login, avatar_url: userData.avatar_url });
    res.json({ orgs, currentUser: userData.login });
  } catch (e) { next(e); }
});

// ------- README（优先本地文件，递归扫描子目录，回退 GitHub API）-------
router.get('/repos/:name/readme', authMiddleware, async (req, res, next) => {
  try {
    const name = req.params.name;
    const p = path.join(config.reposDir, name);
    const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README.rst', 'README.txt', 'README'];

    // 指定文件（子目录切换）
    const reqFile = req.query.file;
    if (reqFile) {
      const fp = path.join(p, String(reqFile));
      // 安全检查：防止路径穿越
      if (!fp.startsWith(p)) return res.status(400).json({ ok: false, error: 'invalid path' });
      if (fs.existsSync(fp)) {
        const content = fs.readFileSync(fp, 'utf-8');
        return res.json({ ok: true, source: 'local', filename: String(reqFile), content });
      }
      return res.status(404).json({ ok: false, error: 'file not found' });
    }

    // 1. 根目录
    for (const f of readmeNames) {
      const fp = path.join(p, f);
      if (fs.existsSync(fp)) {
        const content = fs.readFileSync(fp, 'utf-8');
        return res.json({ ok: true, source: 'local', filename: f, content });
      }
    }

    // 2. 扫描一级子目录（如 auth-center-backend/README.md）
    const found = [];
    if (fs.existsSync(p)) {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        for (const f of readmeNames) {
          const fp = path.join(p, entry.name, f);
          if (fs.existsSync(fp)) {
            found.push({ filename: `${entry.name}/${f}`, path: fp });
            break;
          }
        }
      }
    }
    if (found.length > 0) {
      // 返回第一个找到的，同时告知所有子目录 README 列表
      const first = found[0];
      const content = fs.readFileSync(first.path, 'utf-8');
      return res.json({
        ok: true, source: 'local', filename: first.filename, content,
        subReadmes: found.map(f => f.filename),
      });
    }

    // 3. 回退 GitHub API
    const row = getManagedRepo(name);
    const fullName = row?.full_name || `${config.github.org}/${name}`;
    const resp = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
      headers: {
        'Authorization': `token ${config.github.pat}`,
        'Accept': 'application/vnd.github.raw',
        'User-Agent': 'git-manager',
      },
    });
    if (!resp.ok) return res.status(404).json({ ok: false, error: 'no_readme' });
    const content = await resp.text();
    res.json({ ok: true, source: 'github', filename: 'README.md', content });
  } catch (e) { next(e); }
});

// ------- GitHub proxy (绕过 X-Frame-Options) -------
router.get('/github/proxy/:owner/:repo/*', authMiddleware, proxyGithubPage);

// ------- GitHub 仓库概览 (API 聚合) -------
router.get('/github/overview/:owner/:repo', authMiddleware, async (req, res, next) => {
  try {
    const data = await getRepoOverview(req.params.owner, req.params.repo);
    res.json(data);
  } catch (e) { next(e); }
});

// ------- 配置管理 -------
router.get('/config', authMiddleware, (req, res) => {
  res.json({
    reposDir: config.reposDir,
    scriptsDir: config.scriptsDir,
    org: config.github.org,
    managedCount: config.managedRepos.length,
  });
});

router.post('/config/repos-dir', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const { reposDir } = req.body || {};
  if (!reposDir) return res.status(400).json({ error: 'need reposDir' });
  // 验证路径存在
  if (!fs.existsSync(reposDir)) {
    try { fs.mkdirSync(reposDir, { recursive: true }); } catch {}
  }
  // 更新 config 和 .env
  config.reposDir = reposDir;
  // 写入 .env
  const envPath = '/opt/git-manager/data/.env';
  let envContent = fs.readFileSync(envPath, 'utf-8');
  if (envContent.includes('REPOS_DIR=')) {
    envContent = envContent.replace(/REPOS_DIR=.*/g, `REPOS_DIR=${reposDir}`);
  } else {
    envContent += `\nREPOS_DIR=${reposDir}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'config_change', resource: 'repos_dir',
    detail: { reposDir }, status: 'ok', ip: req.ip,
  });
  res.json({ ok: true, reposDir: config.reposDir });
});

// ------- managed repo CRUD -------
router.post('/repos/manage/add', authMiddleware, requireRole('tech_lead'), async (req, res, next) => {
  try {
    const { full_name } = req.body || {};
    if (!full_name) return res.status(400).json({ error: 'need full_name (owner/repo)' });

    // 从 GitHub 获取仓库信息
    const [owner, name] = full_name.split('/');
    if (!owner || !name) return res.status(400).json({ error: 'invalid full_name' });

    let repoInfo;
    try {
      repoInfo = await getGithubRepo(owner, name);
    } catch (e) {
      return res.status(404).json({ error: `GitHub repo not found: ${e.message}` });
    }

    // 确定 local_path
    const existing = getManagedRepo(name);
    if (existing) return res.status(409).json({ error: 'repo already managed', repo: existing });

    const localPath = path.join(config.reposDir, name);

    addManagedRepo({
      full_name: repoInfo.full_name,
      owner: repoInfo.owner,
      name: repoInfo.name,
      private: repoInfo.private,
      default_branch: repoInfo.default_branch,
      html_url: repoInfo.html_url,
      ssh_url: repoInfo.ssh_url,
      clone_url: repoInfo.clone_url,
      local_path: localPath,
      added_by: req.user.username,
    });

    audit({
      userId: req.user.id, username: req.user.username,
      action: 'repo_add', resource: full_name,
      detail: { local_path: localPath },
      status: 'ok', ip: req.ip
    });

    res.json({ ok: true, repo: getManagedRepo(name) });
  } catch (e) { next(e); }
});

router.delete('/repos/manage/:name', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const row = removeManagedRepo(req.params.name);
  if (!row) return res.status(404).json({ error: 'not found' });
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'repo_remove', resource: req.params.name,
    detail: { full_name: row.full_name },
    status: 'ok', ip: req.ip
  });
  res.json({ ok: true, removed: row });
});

// ------- clone repo (SSE) -------
router.post('/repos/manage/clone-stream', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const { ssh_url, name } = req.body || {};
  if (!ssh_url || !name) return res.status(400).json({ error: 'need ssh_url + name' });
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'repo_clone', resource: name,
    detail: { ssh_url }, status: 'started', ip: req.ip
  });
  runScriptStream(res, 'clone-repo.sh', [ssh_url, name], {
    timeoutMs: 10 * 60_000,
    env: { REPOS_DIR: config.reposDir },
  });
});

// ------- checkout branch (SSE) -------
router.post('/repos/:name/checkout-stream', authMiddleware, requireRole('tech_lead', 'developer'), (req, res) => {
  const { branch } = req.body || {};
  if (!branch) return res.status(400).json({ error: 'need branch' });
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'branch_checkout', resource: req.params.name,
    detail: { branch }, status: 'started', ip: req.ip
  });
  runScriptStream(res, 'checkout-branch.sh', [req.params.name, branch], {
    timeoutMs: 60_000,
  });
});

// ------- monthly (SSE stream) -------
router.post('/monthly/create-stream', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const { name, month, dryRun = false } = req.body || {};
  if (!name || !/^[0-9]{6}$/.test(month || '')) {
    return res.status(400).json({ error: 'invalid params (need name + month YYYYMM)' });
  }
  audit({
    userId: req.user.id, username: req.user.username,
    action: dryRun ? 'monthly_create_dryrun' : 'monthly_create',
    resource: name, detail: { month, mode: 'stream' },
    status: 'started', ip: req.ip
  });
  runScriptStream(res, 'create-monthly.sh', [name, month], {
    timeoutMs: 5 * 60_000,
    env: { DRY_RUN: dryRun ? '1' : '0' },
  });
});

router.post('/monthly/merge', authMiddleware, requireRole('tech_lead'), async (req, res) => {
  const { name, month, version, message, dryRun = false } = req.body || {};
  if (!name || !month || !version) return res.status(400).json({ error: 'missing_fields' });
  const r = await mergeToMain(name, month, version, message, { dryRun });
  audit({
    userId: req.user.id, username: req.user.username,
    action: dryRun ? 'monthly_merge_dryrun' : 'monthly_merge',
    resource: name, detail: { month, version, exit: r.code },
    status: r.code === 0 ? 'ok' : 'fail', ip: req.ip
  });
  res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, ...r });
});

// ------- hotfix (SSE stream) -------
router.post('/hotfix/create-stream', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const { name, version, dryRun = false } = req.body || {};
  if (!name || !/^v\d+\.\d+\.\d+$/.test(version || '')) {
    return res.status(400).json({ error: 'invalid params' });
  }
  audit({
    userId: req.user.id, username: req.user.username,
    action: dryRun ? 'hotfix_create_dryrun' : 'hotfix_create',
    resource: name, detail: { version, mode: 'stream' },
    status: 'started', ip: req.ip
  });
  runScriptStream(res, 'hotfix.sh', [name, version], {
    timeoutMs: 5 * 60_000,
    env: { DRY_RUN: dryRun ? '1' : '0' },
  });
});

// ------- branch CRUD: create (SSE stream) -------
router.post('/branches/create-stream', authMiddleware, requireRole('tech_lead', 'developer'), (req, res) => {
  const { name, branch, source = 'main', push = true } = req.body || {};
  if (!name || !branch) return res.status(400).json({ error: 'need name + branch' });
  if (!/^[a-zA-Z0-9._\/-]+$/.test(branch)) return res.status(400).json({ error: 'invalid branch name' });
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'branch_create', resource: name,
    detail: { branch, source }, status: 'started', ip: req.ip
  });
  runScriptStream(res, 'create-branch.sh', [name, branch, source], {
    timeoutMs: 5 * 60_000,
    env: { PUSH: push ? '1' : '0' },
  });
});

// ------- branch CRUD: delete (SSE stream) -------
router.post('/branches/delete-stream', authMiddleware, requireRole('tech_lead'), (req, res) => {
  const { name, branch, remoteOnly = false } = req.body || {};
  if (!name || !branch) return res.status(400).json({ error: 'need name + branch' });
  if (/^(main|master)$/.test(branch)) return res.status(400).json({ error: 'protected branch' });
  audit({
    userId: req.user.id, username: req.user.username,
    action: 'branch_delete', resource: name,
    detail: { branch, remoteOnly }, status: 'started', ip: req.ip
  });
  runScriptStream(res, 'delete-branch.sh', [name, branch], {
    timeoutMs: 60_000,
    env: { REMOTE_ONLY: remoteOnly ? '1' : '0' },
  });
});

// ------- audit -------
router.get('/audit', authMiddleware, (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  const rows = db.prepare(
    `SELECT id, user_id, username, action, resource, detail, status, ip, created_at
       FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  res.json({ rows, total, limit, offset });
});
