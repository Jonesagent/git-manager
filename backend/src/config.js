// /opt/git-manager/backend/src/config.js
import dotenv from 'dotenv';
import path from 'node:path';

// 显式加载 .env 文件
dotenv.config({ path: '/opt/git-manager/data/.env' });

export const config = {
  port: Number(process.env.PORT) || 3011,
  env: process.env.NODE_ENV || 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  dataDir: path.resolve(process.env.DATA_DIR || '/opt/git-manager/data'),
  scriptsDir: path.resolve(process.env.SCRIPTS_DIR || '/opt/git-manager/scripts'),
  reposDir: process.env.REPOS_DIR || '/opt/openhands/projects',
  dbPath: '',
  github: {
    pat: process.env.GITHUB_PAT || '',
    org: process.env.GITHUB_ORG || 'lionking-cloud',
    apiBase: 'https://api.github.com',
  },
  managedRepos: [], // 从数据库加载
};

config.dbPath = path.join(config.dataDir, 'app.db');
