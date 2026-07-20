// /opt/git-manager/backend/src/index.js
import express from 'express';
import { config } from './config.js';
import { seedAdmin } from './db.js';
import { router } from './routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api', router);

// 全局错误
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal_error' });
});

// 启动前 seed admin
seedAdmin();

app.listen(config.port, '127.0.0.1', () => {
  console.log(`[git-manager] listening on 127.0.0.1:${config.port} (env=${config.env})`);
});
