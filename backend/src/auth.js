// /opt/git-manager/backend/src/auth.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, audit } from './db.js';
import { config } from './config.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = verifyToken(m[1]);
    const user = db.prepare('SELECT id, username, email, role, status FROM users WHERE id=?').get(payload.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      audit({
        userId: req.user?.id, username: req.user?.username,
        action: 'access_denied', resource: req.originalUrl,
        detail: { need: roles }, status: 'denied', ip: req.ip
      });
      return res.status(403).json({ error: 'forbidden', need: roles });
    }
    next();
  };
}

export function login(username, password, ip) {
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || user.status !== 'active') {
    audit({ username, action: 'login', status: 'fail', detail: 'user_not_found', ip });
    return null;
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    audit({ userId: user.id, username, action: 'login', status: 'fail', detail: 'bad_password', ip });
    return null;
  }
  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id=?').run(user.id);
  audit({ userId: user.id, username, action: 'login', status: 'ok', ip });
  return { user: { id: user.id, username: user.username, email: user.email, role: user.role }, token: signToken(user) };
}

export function changePassword(userId, oldPassword, newPassword) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!u) return { ok: false, error: 'user_not_found' };
  if (!bcrypt.compareSync(oldPassword, u.password_hash)) {
    return { ok: false, error: 'bad_old_password' };
  }
  if (!newPassword || newPassword.length < 8) return { ok: false, error: 'weak_password' };
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, userId);
  audit({ userId, username: u.username, action: 'change_password', status: 'ok' });
  return { ok: true };
}
