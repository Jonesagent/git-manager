// /opt/git-manager/backend/src/config.js
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(__dirname, '../../data/.env');
dotenv.config({ path: envFile });

export const config = {
  port: Number(process.env.PORT || 3001),
  env: process.env.NODE_ENV || 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    initialPassword: process.env.ADMIN_INITIAL_PASSWORD,
    role: process.env.ADMIN_ROLE || 'tech_lead',
  },
  github: {
    org: process.env.GITHUB_ORG || 'lionking-cloud',
    pat: process.env.GITHUB_PAT,
  },
  sshKeyPath: process.env.SSH_KEY_PATH || '/opt/git-manager/data/ssh/id_ed25519',
  sqlitePath: process.env.SQLITE_PATH || '/opt/git-manager/data/app.db',
  reposRoot: process.env.REPOS_ROOT || '/opt/openhands/projects',
  scriptsDir: path.resolve(__dirname, '../../scripts'),
  logsDir: path.resolve(__dirname, '../../logs'),
  // 8 个受管仓库（docs 不在管控范围）
  managedRepos: [
    'auth-center',
    'register-center',
    'common-base',
    'data-center',
    'agent-center',
    'task-center',
    'config-center',
    'technical-center',
  ],
};
