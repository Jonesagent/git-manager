// /opt/git-manager/backend/src/routes.js
import express from 'express';
import { authMiddleware, requireRole, login, changePassword } from './auth.js';
import { db, audit } from './db.js';
import { listRepos, listBranches, fetchRepo, createMonthly, mergeToMain, createHotfix } from './git.js';
import { runScriptStream } from './stream.js';
import { config } from './config.js';

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

// ------- repos -------
router.get('/repos', authMiddleware, async (req, res) => {
  const list = await listRepos();
  res.json({ repos: list, managed: config.managedRepos, org: config.github.org });
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

// ------- monthly (SSE stream 版本) -------
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

// ------- 分支管理：通用创建 (SSE stream) -------
router.post('/branches/create-stream', authMiddleware, requireRole('tech_lead', 'developer'), (req, res) => {
  const { name, branch, source = 'main', push = true } = req.body || {};
  if (!name || !branch) return res.status(400).json({ error: 'need name + branch' });
  // 安全校验：分支名不能含特殊字符
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

// ------- 分支管理：通用删除 (SSE stream) -------
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
