// /opt/git-manager/backend/src/db.js
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import path from 'node:path';

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

// ---- schema ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  status TEXT DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS managed_repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT UNIQUE NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  private INTEGER DEFAULT 0,
  default_branch TEXT DEFAULT 'main',
  html_url TEXT DEFAULT '',
  ssh_url TEXT DEFAULT '',
  clone_url TEXT DEFAULT '',
  local_path TEXT DEFAULT '',
  added_at TEXT DEFAULT (datetime('now')),
  added_by TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT,
  resource TEXT,
  detail TEXT,
  status TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---- seed ----
function seed() {
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || 'admin123', 10);
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('admin', email, hash, 'tech_lead');
    console.log('[db] seeded admin id=1');
  }

  // Seed default managed repos if empty
  const count = db.prepare('SELECT COUNT(*) AS c FROM managed_repos').get().c;
  if (count === 0) {
    const defaults = config.github.org
      ? ['agent-center', 'auth-center', 'common-base', 'config-center', 'data-center', 'docs', 'register-center', 'task-center', 'technical-center']
      : [];
    const org = config.github.org;
    const insertRepo = db.prepare('INSERT OR IGNORE INTO managed_repos (full_name, owner, name, local_path, added_by) VALUES (?, ?, ?, ?, ?)');
    for (const name of defaults) {
      const fullName = `${org}/${name}`;
      const localPath = path.join(config.reposDir, name);
      insertRepo.run(fullName, org, name, localPath, 'system');
    }
    console.log(`[db] seeded ${defaults.length} managed repos`);
  }

  // Sync managedRepos array from DB
  syncManagedRepos();
}

// ---- sync config.managedRepos from DB ----
export function syncManagedRepos() {
  const rows = db.prepare('SELECT name FROM managed_repos ORDER BY name').all();
  config.managedRepos = rows.map(r => r.name);
}

// ---- audit ----
export function audit({ userId, username, action, resource, detail, status, ip }) {
  db.prepare(`INSERT INTO audit_logs (user_id, username, action, resource, detail, status, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, username, action, resource, typeof detail === 'string' ? detail : JSON.stringify(detail), status, ip);
}

// ---- repo management ----
export function addManagedRepo({ full_name, owner, name, private: isPrivate, default_branch, html_url, ssh_url, clone_url, local_path, added_by }) {
  db.prepare(`INSERT OR IGNORE INTO managed_repos
    (full_name, owner, name, private, default_branch, html_url, ssh_url, clone_url, local_path, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(full_name, owner || full_name.split('/')[0], name || full_name.split('/')[1],
      isPrivate ? 1 : 0, default_branch || 'main', html_url || '', ssh_url || '', clone_url || '',
      local_path || '', added_by || 'admin');
  syncManagedRepos();
}

export function removeManagedRepo(name) {
  // Support both "name" and "owner/name"
  const row = db.prepare('SELECT * FROM managed_repos WHERE name = ? OR full_name = ?').get(name, name);
  db.prepare('DELETE FROM managed_repos WHERE id = ?').run(row?.id);
  syncManagedRepos();
  return row;
}

export function updateRepoLocalPath(name, localPath) {
  db.prepare('UPDATE managed_repos SET local_path = ? WHERE name = ? OR full_name = ?').run(localPath, name, name);
}

export function getManagedRepos() {
  return db.prepare('SELECT * FROM managed_repos ORDER BY owner, name').all();
}

export function getManagedRepo(name) {
  return db.prepare('SELECT * FROM managed_repos WHERE name = ? OR full_name = ?').get(name, name);
}

seed();
export { db };
