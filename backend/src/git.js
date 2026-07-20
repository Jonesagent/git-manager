// /opt/git-manager/backend/src/git.js
// 封装 shell 调用 + 一些直接 API（速度更快，避免 fork bash）
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';

const pExecFile = promisify(execFile);

function repoPath(name) {
  return path.join(config.reposDir, name);
}

function assertManaged(name) {
  if (!config.managedRepos.includes(name)) {
    const err = new Error('unknown_repo');
    err.status = 400;
    throw err;
  }
  const p = repoPath(name);
  if (!fs.existsSync(path.join(p, '.git'))) {
    const err = new Error('repo_not_initialized');
    err.status = 404;
    throw err;
  }
  return p;
}

async function gitInRepo(name, args, { timeout = 30_000 } = {}) {
  const cwd = assertManaged(name);
  const { stdout, stderr } = await pExecFile('git', args, {
    cwd,
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=no',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return { stdout, stderr };
}

export async function listRepos() {
  const repos = [];
  for (const name of config.managedRepos) {
    const p = repoPath(name);
    const initialized = fs.existsSync(path.join(p, '.git'));
    let head = null, headSha = null;
    if (initialized) {
      try {
        const r = await pExecFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: p, timeout: 5000 });
        head = r.stdout.trim();
        const r2 = await pExecFile('git', ['rev-parse', 'HEAD'], { cwd: p, timeout: 5000 });
        headSha = r2.stdout.trim().slice(0, 12);
      } catch {}
    }
    repos.push({ name, initialized, head, headSha, path: p });
  }
  return repos;
}

export async function listBranches(name) {
  assertManaged(name);
  const script = path.join(config.scriptsDir, 'list-branches.sh');
  const { stdout } = await pExecFile('bash', [script, name], {
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  try { return JSON.parse(stdout); }
  catch { return { repo: name, branches: [], vs_main: {}, raw: stdout }; }
}

export async function fetchRepo(name) {
  assertManaged(name);
  const script = path.join(config.scriptsDir, 'fetch-one.sh');
  return runScript(script, [name], { timeoutMs: 6 * 60_000 });
}

// 通用脚本执行，收集 stdout/stderr/exitCode
export function runScript(script, args, { timeoutMs = 60_000, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn('bash', [script, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = '', stderr = '';
    let done = false;
    const to = setTimeout(() => {
      if (!done) {
        try { child.kill('SIGKILL'); } catch {}
      }
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      done = true;
      clearTimeout(to);
      resolve({ code, stdout, stderr });
    });
    child.on('error', err => {
      done = true;
      clearTimeout(to);
      resolve({ code: -1, stdout, stderr: (stderr || '') + '\n' + err.message });
    });
  });
}

export async function createMonthly(name, month, { dryRun = false } = {}) {
  assertManaged(name);
  const script = path.join(config.scriptsDir, 'create-monthly.sh');
  return runScript(script, [name, month], {
    timeoutMs: 5 * 60_000,
    env: { DRY_RUN: dryRun ? '1' : '0' },
  });
}

export async function mergeToMain(name, month, version, message, { dryRun = false } = {}) {
  assertManaged(name);
  const script = path.join(config.scriptsDir, 'merge-to-main.sh');
  return runScript(script, [name, month, version, message || ''], {
    timeoutMs: 10 * 60_000,
    env: { DRY_RUN: dryRun ? '1' : '0' },
  });
}

export async function createHotfix(name, version, { dryRun = false } = {}) {
  assertManaged(name);
  const script = path.join(config.scriptsDir, 'hotfix.sh');
  return runScript(script, [name, version], {
    timeoutMs: 5 * 60_000,
    env: { DRY_RUN: dryRun ? '1' : '0' },
  });
}
