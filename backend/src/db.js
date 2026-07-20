// /opt/git-manager/backend/src/db.js
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });

export const db = new Database(config.sqlitePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tech_lead','developer','viewer')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  detail TEXT,
  status TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
`);

// Seed admin
export function seedAdmin() {
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(config.admin.username);
  if (row) return { seeded: false, id: row.id };
  if (!config.admin.initialPassword) {
    console.warn('[db] ADMIN_INITIAL_PASSWORD is empty; skip seed admin');
    return { seeded: false };
  }
  const hash = bcrypt.hashSync(config.admin.initialPassword, 10);
  const info = db.prepare(
    `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run(config.admin.username, config.admin.email, hash, config.admin.role);
  console.log(`[db] seeded admin id=${info.lastInsertRowid}`);
  return { seeded: true, id: info.lastInsertRowid };
}

export function audit({ userId, username, action, resource, detail, status = 'ok', ip }) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (user_id, username, action, resource, detail, status, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId || null, username || null, action, resource || null,
          typeof detail === 'string' ? detail : JSON.stringify(detail || null),
          status, ip || null);
  } catch (e) {
    console.error('[audit] failed', e);
  }
}
