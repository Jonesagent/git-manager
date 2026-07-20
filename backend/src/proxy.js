// /opt/git-manager/backend/src/proxy.js
// GitHub 页面代理：绕过 X-Frame-Options 限制
// 策略：用 GitHub API 获取仓库信息，自己渲染一个仓库概览页
// 对于完整 GitHub 页面，用后端代理 HTML 并去除安全头
import { config } from './config.js';

function ghHeaders() {
  return {
    'Authorization': `token ${config.github.pat}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'git-manager',
  };
}

// 代理 GitHub 页面（去除 X-Frame-Options 和 CSP）
export async function proxyGithubPage(req, res) {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';
  const url = `https://github.com/${owner}/${repo}/${path}`;
  
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'git-manager',
        'Authorization': `token ${config.github.pat}`,
      },
      redirect: 'follow',
    });
    
    const contentType = resp.headers.get('content-type') || 'text/html';
    
    // 复制 headers 但去掉防嵌入的
    const headers = {};
    resp.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (lk === 'x-frame-options' || lk === 'content-security-policy' || lk === 'x-content-security-policy') return;
      headers[key] = value;
    });
    
    // 如果是 HTML，需要重写链接
    if (contentType.includes('text/html')) {
      let html = await resp.text();
      // 重写相对路径为绝对路径
      html = html.replace(/href="\//g, `href="https://github.com/`);
      html = html.replace(/src="\//g, `src="https://github.com/`);
      // 注入 base 标签
      html = html.replace(/<head>/, `<head><base href="https://github.com/${owner}/${repo}/">`);
      headers['content-type'] = 'text/html; charset=utf-8';
      res.set('X-Frame-Allow', '1');
      res.send(html);
    } else {
      // 非 HTML 直接透传
      res.set(headers);
      const buf = Buffer.from(await resp.arrayBuffer());
      res.send(buf);
    }
  } catch (e) {
    res.status(502).send(`Proxy error: ${e.message}`);
  }
}

// 用 GitHub API 获取仓库概览数据（更可靠）
export async function getRepoOverview(owner, repo) {
  const h = ghHeaders();
  
  const [repoResp, branchesResp, commitsResp, pullsResp] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: h }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`, { headers: h }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, { headers: h }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?per_page=10&state=all`, { headers: h }),
  ]);
  
  const repoData = await repoResp.json();
  const branches = await branchesResp.json();
  const commits = await commitsResp.json();
  const pulls = await pullsResp.json();
  
  return {
    repo: {
      full_name: repoData.full_name,
      description: repoData.description,
      html_url: repoData.html_url,
      default_branch: repoData.default_branch,
      stargazers_count: repoData.stargazers_count,
      forks_count: repoData.forks_count,
      open_issues_count: repoData.open_issues_count,
      language: repoData.language,
      license: repoData.license?.name,
      updated_at: repoData.updated_at,
    },
    branches: branches.map(b => ({
      name: b.name,
      sha: b.commit?.sha?.substring(0, 7),
      protected: b.protected,
    })),
    commits: commits.map(c => ({
      sha: c.sha?.substring(0, 7),
      message: c.commit?.message?.split('\n')[0],
      author: c.commit?.author?.name,
      date: c.commit?.author?.date,
      avatar: c.author?.avatar_url,
    })),
    pulls: pulls.map(p => ({
      number: p.number,
      title: p.title,
      state: p.state,
      user: p.user?.login,
      created_at: p.created_at,
      html_url: p.html_url,
    })),
  };
}
