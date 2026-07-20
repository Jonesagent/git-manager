// /opt/git-manager/backend/src/stream.js
// SSE（Server-Sent Events）执行器：实时输出脚本执行过程
// 用于创建/合并/删除分支等操作，前端能看到命令行式滚动输出
import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from './config.js';

export function runScriptStream(res, scriptName, args, { timeoutMs = 5 * 60_000, env = {} } = {}) {
  const script = path.join(config.scriptsDir, scriptName);
  const child = spawn('bash', ['-c', `bash ${script} ${args.map(a => `'${a}'`).join(' ')}`], {
    env: { ...process.env, ...env },
    cwd: config.scriptsDir,
  });

  let fullStdout = '';
  let fullStderr = '';
  let done = false;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    if (done) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  send('start', { script: scriptName, args, pid: child.pid });

  child.stdout.on('data', (buf) => {
    const text = buf.toString();
    fullStdout += text;
    // 按行发送，模拟终端体验
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim()) send('stdout', { line });
    }
  });

  child.stderr.on('data', (buf) => {
    const text = buf.toString();
    fullStderr += text;
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim()) send('stderr', { line });
    }
  });

  const timeout = setTimeout(() => {
    if (!done) {
      send('timeout', { msg: 'execution timeout' });
      try { child.kill('SIGKILL'); } catch {}
    }
  }, timeoutMs);

  child.on('close', (code) => {
    done = true;
    clearTimeout(timeout);
    let result = null;
    const m = fullStdout.match(/RESULT:(\S+)/);
    if (m) result = m[1];
    // 先发 done 事件
    try {
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ code, result, stdout: fullStdout, stderr: fullStderr })}\n\n`);
    } catch {}
    // 再关闭
    res.end();
  });

  child.on('error', (err) => {
    done = true;
    clearTimeout(timeout);
    send('error', { message: err.message });
    res.end();
  });

  // 客户端断开
  res.on('close', () => {
    if (!done) {
      try { child.kill('SIGTERM'); } catch {}
    }
  });
}
