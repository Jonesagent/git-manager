// /opt/git-manager/backend/src/index.js
// 占位后端服务，M1 会加入登录/RBAC/仓库同步等能力
import http from 'node:http';

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.url === '/api/health') {
    res.end(JSON.stringify({ ok: true, service: 'git-manager', ts: Date.now() }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[git-manager] listening on 127.0.0.1:${PORT}`);
});
