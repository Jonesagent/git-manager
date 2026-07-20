// /opt/git-manager/backend/src/routes.js
import express from 'express';
import { authMiddleware, requireRole, login, changePassword } from './auth.js';
import { db, audit } from './db.js';
import { listRepos, listBranches, fetchRepo, createMonthly, mergeToMain, createHotfix } from './git.js';
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

// ------- monthly -------
router.post('/monthly/create', authMiddleware, requireRole('tech_lead'), async (req, res) => {
  const { month, repos, dryRun = false } = req.body || {};
  if (!/^[0-9]{6}$/.test(month || '')) return res.status(400).json({ error: 'invalid_month' });
  const targets = Array.isArray(repos) && repos.length > 0 ? repos : config.managedRepos;
  const results = [];
  for (const name of targets) {
    try {
      const r = await createMonthly(name, month, { dryRun });
      results.push({ repo: name, ...r });
      audit({
        userId: req.user.id, username: req.user.username,
        action: dryRun ? 'monthly_create_dryrun' : 'monthly_create',
        resource: name, detail: { month, exit: r.code },
        status: r.code === 0 ? 'ok' : 'fail', ip: req.ip
      });
    } catch (e) {
      results.push({ repo: name, error: e.message });
    }
  }
  res.json({ month, dryRun, results });
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

// ------- hotfix -------
router.post('/hotfix/create', authMiddleware, requireRole('tech_lead'), async (req, res) => {
  const { name, version, dryRun = false } = req.body || {};
  if (!name || !version) return res.status(400).json({ error: 'missing_fields' });
  const r = await createHotfix(name, version, { dryRun });
  audit({
    userId: req.user.id, username: req.user.username,
    action: dryRun ? 'hotfix_create_dryrun' : 'hotfix_create',
    resource: name, detail: { version, exit: r.code },
    status: r.code === 0 ? 'ok' : 'fail', ip: req.ip
  });
  res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, ...r });
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
