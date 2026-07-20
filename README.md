# Git Manager - lionking-cloud 分支管理平台

统一管理 lionking-cloud 组织下 8 个业务仓库的月度分支模型（`dev_YYYYMM`）、特性分支、热修复、PR 聚合、审计日志。

- 域名：`github.smallclaw.art`
- 部署：本地服务器（106.53.132.54）
- 技术栈：Vue 3 + TypeScript + Vite（前端） / Node.js + Express + SQLite（后端） / Bash 脚本（Git 操作）

## 目录结构

```
/opt/git-manager/
├── frontend/         Vue 3 SPA
├── backend/          Node.js + Express API
├── scripts/          Bash 脚本（月度分支/合并/热修复）
├── repos/            8 个仓库本地镜像
├── data/             SQLite / SSH key
└── logs/             运行日志
```

## 管理的仓库

```
auth-center      register-center   common-base       data-center
agent-center     task-center       config-center     technical-center
```

## 迭代

- **M1**：登录 + 仓库同步 + 月度分支批量创建 + 审计日志（本周）
- **M2**：合并 main + 打 Tag 向导 + 热修复向导 + PR 聚合（下周）
- **M3**：月度看板 + Changelog 生成 + Commit 校验（可选）

## 部署脚本

见 `scripts/` 目录：

- `create-monthly.sh <YYYYMM>` — 批量创建月度分支
- `merge-to-main.sh <YYYYMM> <version>` — 月末合并 + 打 Tag
- `hotfix.sh <version>` — 热修复向导

## Nginx

配置文件：`/etc/nginx/sites-available/github.smallclaw.art`

- HTTP 80 → 301 → HTTPS 443
- 静态前端：`/opt/git-manager/frontend/dist`
- API 反代：`/api/*` → `127.0.0.1:3001`
- 证书：Let's Encrypt，`certbot renew` 自动续期
