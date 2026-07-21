# Git Manager - lionking-cloud 分支管理平台

统一管理 lionking-cloud 组织下 8 个业务仓库的月度分支模型（`dev_YYYYMM`）、特性分支、热修复、PR 聚合、审计日志。

- 域名：`github.smallclaw.art`
- 部署：本地服务器（106.53.132.54）
- 技术栈：Vue 3 + TypeScript + Vite（前端） / Node.js + Express + SQLite（后端） / Bash 脚本（Git 操作）

---

## 📖 使用指南

### 登录系统

访问 `https://github.smallclaw.art`，使用用户名和密码登录。系统支持三种用户角色，不同角色拥有不同的操作权限。

### 用户角色与权限矩阵

| 操作功能 | tech_lead (技术负责人) | developer (开发者) | viewer (访客) |
|---------|-----------------------|-------------------|---------------|
| **仓库管理** | | | |
| 添加仓库 | ✅ | ❌ | ❌ |
| 移除仓库 | ✅ | ❌ | ❌ |
| 同步仓库 | ✅ | ✅ | ❌ |
| 查看仓库列表 | ✅ | ✅ | ✅ |
| **分支管理** | | | |
| 创建分支 | ✅ | ✅ | ❌ |
| 删除分支 | ✅ | ❌ | ❌ |
| 切换分支 | ✅ | ✅ | ❌ |
| 查看分支列表 | ✅ | ✅ | ✅ |
| **月度分支** | | | |
| 创建月度分支 | ✅ | ❌ | ❌ |
| 合并月度分支 | ✅ | ❌ | ❌ |
| **热修复** | | | |
| 创建热修复分支 | ✅ | ❌ | ❌ |
| **系统配置** | | | |
| 修改仓库目录 | ✅ | ❌ | ❌ |
| 修改密码 | ✅ | ✅ | ✅ |
| **审计日志** | | | |
| 查看审计日志 | ✅ | ✅ | ✅ |

---

## 🗂️ 功能模块说明

### 1. 总览 (Dashboard)
查看系统概况，包括仓库数量、分支统计、最近活动等信息。

### 2. 仓库管理 (Repos)
- **查看仓库**：查看所有已管理的 Git 仓库及其状态
- **添加仓库**：从 GitHub 组织中选择仓库添加管理（仅 tech_lead）
- **同步仓库**：拉取远程最新代码到本地镜像（tech_lead/developer）
- **移除仓库**：从管理列表中移除仓库（仅 tech_lead）

### 3. 分支管理 (Branches)
- **全局分支列表**：查看所有仓库的所有分支
- **分支类型标签**：主分支(main)、月度(monthly)、特性(feature)、热修复(hotfix)
- **创建分支**：基于源分支创建新的特性分支（tech_lead/developer）
- **删除分支**：删除不需要的分支（仅 tech_lead）

### 4. 仓库详情 (Repo Detail)
点击仓库卡片进入详情页，包含三个标签页：
- **分支列表**：该仓库的分支管理（切换、创建、删除）
- **GitHub 概览**：PR 列表、最近提交、分支状态等 GitHub 数据
- **README**：查看仓库 README 文档
- **文件浏览**：浏览仓库文件目录和内容

### 5. 月度分支 (Monthly)
- **批量创建**：为所有仓库创建统一格式的月度分支 `dev_YYYYMM`
- **合并向导**：月末将月度分支合并到 main 并打 Tag（仅 tech_lead）

### 6. 热修复 (Hotfix)
- **热修复向导**：创建 `hotfix/vX.X.X` 分支，修复后合并回 main 和当前月度分支（仅 tech_lead）

### 7. 审计日志 (Audit)
- 记录所有用户的关键操作
- 包括：登录、创建分支、删除分支、合并、配置变更等
- 记录操作人、时间、IP 地址、操作结果

### 8. 设置 (Settings)
- **修改密码**：用户可修改自己的登录密码
- **仓库目录**：配置本地仓库存储路径（仅 tech_lead）
- **用户信息**：显示当前登录用户的角色信息

---

## 📁 目录结构

```
/opt/git-manager/
├── frontend/         Vue 3 SPA
├── backend/          Node.js + Express API
├── scripts/          Bash 脚本（月度分支/合并/热修复）
├── repos/            8 个仓库本地镜像
├── data/             SQLite / SSH key
└── logs/             运行日志
```

## 🏭 管理的仓库

```
auth-center      register-center   common-base       data-center
agent-center     task-center       config-center     technical-center
```

## 🚀 迭代计划

- **M1**：登录 + 仓库同步 + 月度分支批量创建 + 审计日志（完成）
- **M2**：合并 main + 打 Tag 向导 + 热修复向导 + PR 聚合（进行中）
- **M3**：月度看板 + Changelog 生成 + Commit 校验（可选）

## 📜 部署脚本

见 `scripts/` 目录：

- `create-monthly.sh <YYYYMM>` — 批量创建月度分支
- `merge-to-main.sh <YYYYMM> <version>` — 月末合并 + 打 Tag
- `hotfix.sh <version>` — 热修复向导

## 🌐 Nginx 配置

配置文件：`/etc/nginx/sites-available/github.smallclaw.art`

- HTTP 80 → 301 → HTTPS 443
- 静态前端：`/opt/git-manager/frontend/dist`
- API 反代：`/api/*` → `127.0.0.1:3001`
- 证书：Let's Encrypt，`certbot renew` 自动续期

---

## 🔧 常见问题

### Q: viewer 角色能做什么？
A: viewer 为只读权限，可以查看仓库、分支、文件、审计日志等，但不能执行任何修改操作。

### Q: 分支删除后能否恢复？
A: 删除分支前请谨慎操作，建议确保分支代码已合并或备份。

### Q: 如何添加新用户？
A: 用户管理需通过数据库操作，目前由系统管理员统一管理账号。
