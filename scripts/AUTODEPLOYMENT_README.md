# SD-UI 热部署系统文档

## 概述

SD-UI 采用 **任意开发端 → Linux 服务器自动部署** 的工作流。开发端与服务器不在同一域（跨平台、跨网络），通过 GitHub 作为中转。当代码推送到 GitHub 后，Linux 服务器自动检测更新并完成构建、部署、重启，全程无需人工干预。

```
开发端 (Windows/macOS/Linux)
       │
       ▼
   GitHub
       │
       ▼
Linux 服务器 (自动检测 + 部署)
   ┌─────────────────────────────────────┐
   │  Cron (每分钟)                        │
   │       │                              │
   │       ▼                              │
   │  check-git-update.sh                  │
   │       │                              │
   │       ├── 脚本修改? → 仅更新脚本       │
   │       ├── 前端修改? → 重建+同步        │
   │       ├── 后端修改? → 完整热部署      │
   │       └── 文档修改? → 忽略            │
   └─────────────────────────────────────┘
```

## 智能更新检测

脚本会根据修改的文件类型自动选择最优部署策略：

| 文件类型       | 示例                              | 部署行为                        |
| -------------- | --------------------------------- | ------------------------------- |
| **Shell 脚本** | `scripts/*.sh`                    | 仅更新脚本，不重启服务          |
| **前端代码**   | `ui/src/*`, `*.css`               | 重建 + 同步静态文件，**不重启** |
| **后端/API**   | `ui/src/app/api/*`, `ui/prisma/*` | 完整热部署，等待任务完成后重启  |
| **依赖文件**   | `package.json`, `yarn.lock`       | 触发完整热部署                  |
| **文档/配置**  | `README.md`, `*.yml`              | 完全忽略，不执行任何操作        |

### 为什么这样设计？

- **脚本修改不重启**：避免打断正在运行的定时任务
- **前端修改不重启**：Next.js 自带 HMR（热模块替换），重启反而慢
- **后端修改需重启**：API 路由、数据库 Schema 变更需要新进程加载
- **等待处理中的任务**：图片生成等长时间任务会被等待完成后才重启

## 系统组件

### 核心脚本

| 脚本                         | 位置       | 功能                                        |
| ---------------------------- | ---------- | ------------------------------------------- |
| `check-git-update.sh`        | `scripts/` | Cron 调用，检测更新并触发部署               |
| `hot-deploy.sh`              | `scripts/` | 完整热部署：备份→安装依赖→构建→重启         |
| `send_email.py`              | `scripts/` | Python 发邮件脚本，通过 Resend API 发送通知 |
| `nginx-dev.conf`             | `scripts/` | Nginx 反向代理配置（端口 3000→3001）        |

### 目录结构

```
sd-ui/
├── scripts/                    # 部署脚本
│   ├── check-git-update.sh     # ← Cron 每分钟执行
│   ├── hot-deploy.sh           # 完整热部署
│   ├── nginx-dev.conf
│   └── enable_autostart_ubuntu.sh
├── ui/                         # Next.js 应用
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── dev.db             # SQLite 数据库
│   ├── .next/                  # Next.js 构建产物
│   └── src/
└── ...

~/.local/share/sd-ui/          # Linux 运行时数据
├── logs/
│   ├── git-pull.log           # 更新检测日志
│   └── hot-deploy.log         # 部署日志
├── backups/                   # 数据库备份
├── state/
│   ├── version.json           # 当前部署版本信息
│   └── deploy_stats.json      # 部署统计历史
└── lock/                      # 部署锁文件（防止并发）
```

## 系统可靠性增强

热部署系统内置多重可靠性保障机制，确保部署过程稳定可靠。

### 并发控制（锁机制）

通过 PID 锁文件防止多个部署任务同时执行：

```bash
# 锁文件位置
~/.local/share/sd-ui/lock/deploy.lock

# 机制：检测到锁文件时，60 秒内的后续执行会被跳过
```

### 版本状态追踪

系统记录每次部署的状态，便于问题排查：

```bash
cat ~/.local/share/sd-ui/state/version.json
```

```json
{
  "commit": "803bafe",
  "deployed_at": "2026-03-31 22:00:35",
  "result": "success",
  "duration": 80
}
```

### 部署统计

记录历史部署记录（最近 50 条）：

```bash
cat ~/.local/share/sd-ui/state/deploy_stats.json
```

### 日志轮转

日志文件自动管理，防止占用过多磁盘空间：

- 单个日志文件超过 **10MB** 时自动压缩归档
- 保留最近 **5 个**压缩备份
- 归档文件名：`*.log.1.gz`、`*.log.2.gz`...

### HTTP 健康检查

部署完成后自动验证服务可用性：

```bash
# 检查项目
curl -f http://localhost:3001/api/health

# 检查 Nginx 代理
curl -f http://localhost:3000/
```

健康检查失败时：
1. 记录警告但不中断部署流程
2. 邮件通知中标记为"警告"状态
3. 不影响实际部署结果判定

### 环境变量验证

部署前自动检查必要环境变量：

| 变量             | 说明                          |
| ---------------- | ----------------------------- |
| `RESEND_API_KEY` | Resend API 密钥（邮件发送用） |
| `EMAIL_FROM`     | 发件邮箱地址                  |
| `EMAIL_TO`       | 收件邮箱地址                  |
| `PORT`           | 应用监听端口（默认 3001）     |

缺少环境变量时：
- 脚本继续执行（不阻断部署）
- 日志中输出警告
- 邮件通知会提示配置问题

## 部署步骤

### 1. Linux 服务器初始设置

```bash
# 进入项目目录
cd ~/projects/sd-ui

# 安装依赖
cd ui && npm install && cd ..

# 设置数据库
cd ui
DATABASE_URL="file:./prisma/dev.db" npx prisma db push

# 构建
cd ui && npm run build

# 配置 Cron（每分钟检测更新）
crontab -e
# 添加：
* * * * * /home/<YOUR_USER>/projects/sd-ui/scripts/check-git-update.sh >> /home/<YOUR_USER>/.local/share/sd-ui/logs/cron.log 2>&1
```

### 2. systemd 用户服务

`enable_autostart_ubuntu.sh` 会创建用户级 systemd 服务：

```bash
./scripts/enable_autostart_ubuntu.sh
systemctl --user enable sd-ui
systemctl --user start sd-ui
```

服务运行在 `PORT=3001`，Nginx 监听 3000 反向代理。

### 3. Git Hooks（自动修复脚本权限）

Linux 上创建 post-checkout/post-merge 钩子，确保 Git 操作后脚本权限正确：

```bash
cd ~/projects/sd-ui

cat > .git/hooks/post-checkout << 'EOF'
#!/bin/bash
if [ "$(uname)" = "Linux" ]; then
    chmod +x /home/<YOUR_USER>/projects/sd-ui/scripts/*.sh 2>/dev/null || true
fi
EOF

cp .git/hooks/post-checkout .git/hooks/post-merge
chmod +x .git/hooks/post-checkout .git/hooks/post-merge
```

**重要**：Windows 不跟踪文件执行权限。首次 clone 后需要推送一次权限：

```bash
# 仅 Windows 执行一次
git update-index --chmod=+x scripts/*.sh
git commit -m "chore: add execute permission to shell scripts"
git push
```

之后 Git 会记住权限，Linux pull 后自动有执行权限。

## 工作流示例

### 场景 1：修改前端样式

```bash
# 开发端
# 编辑 ui/src/app/globals.css
git add . && git commit -m "fix: adjust button colors" && git push
```

Linux 响应：

```
[2024-01-01 12:00:01] Detected new commits, pulling...
[2024-01-01 12:00:02] Frontend only changes, rebuilding without restart...
[2024-01-01 12:00:30] Frontend rebuilt successfully (no restart - Next.js hot reload handles it)
```

### 场景 2：修改 API 路由

```bash
# 开发端
# 编辑 ui/src/app/api/tasks/route.ts
git add . && git commit -m "feat: add batch task endpoint" && git push
```

Linux 响应：

```
[2024-01-01 12:05:01] Detected new commits, pulling...
[2024-01-01 12:05:02] Backend/API changes detected, performing hot deployment...
[2024-01-01 12:05:03] Waiting for 2 processing task(s) to complete (elapsed: 0s)...
[2024-01-01 12:05:08] No processing tasks, safe to proceed
[2024-01-01 12:05:09] Backing up database...
[2024-01-01 12:05:10] Installing dependencies...
[2024-01-01 12:05:15] Generating Prisma client...
[2024-01-01 12:05:17] Running database migrations...
[2024-01-01 12:05:20] Building...
[2024-01-01 12:05:45] Restarting service...
```

### 场景 3：更新部署脚本

```bash
# 开发端
# 编辑 scripts/hot-deploy.sh
git add . && git commit -m "enhance: add backup rotation" && git push
```

Linux 响应：

```
[2024-01-01 12:10:01] Detected new commits, pulling...
[2024-01-01 12:10:02] Only scripts changed, no restart needed
[2024-01-01 12:10:03] Scripts updated successfully
```

## 热部署核心逻辑

### wait\_for\_processing\_tasks 函数

图片生成等长时间任务需要等待完成才能安全重启：

```bash
wait_for_processing_tasks() {
    local elapsed=0
    while true; do
        PROCESSING_COUNT=$(sqlite3 "$DB_PATH" \
            "SELECT COUNT(*) FROM Task WHERE status='processing';")
        
        if [ "$PROCESSING_COUNT" -eq 0 ]; then
            return 0  # 安全，可以重启
        fi
        
        if [ "$elapsed" -ge "$SHUTDOWN_TIMEOUT" ]; then
            # 超时，强制重置任务状态
            sqlite3 "$DB_PATH" \
                "UPDATE Task SET status='pending' WHERE status='processing';"
            return 0
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
    done
}
```

**超时时间**：默认 30 秒，可通过环境变量调整。

## 数据库备份

`hot-deploy.sh` 在每次部署前自动备份数据库：

- 备份位置：`~/.local/share/sd-ui/backups/`
- 保留数量：最近 5 个备份
- 备份格式：`dev.db.20240101_120000.backup`

## 邮件通知系统

部署完成后会自动发送 HTML 邮件通知，支持状态显示、详情展示，且针对 QQ 邮箱进行了兼容性优化。

### 核心组件

| 文件                  | 功能                                                       |
| --------------------- | ---------------------------------------------------------- |
| `send_email.py`       | Python 发邮件脚本，支持多种发送方式（SDK > curl > urllib） |
| `check-git-update.sh` | 调用 Python 发送更新通知                                   |
| `hot-deploy.sh`       | 调用 Python 发送部署结果通知                               |

### 工作流程

```
Shell 脚本 → 构造 HTML → 调用 Python → 按优先级尝试发送方式 → 成功返回
```

### 发送方式优先级

1. **Resend 官方 SDK**（推荐，最规范）
2. **curl 命令**（最可靠，已验证可行）
3. **urllib**（带完整浏览器请求头，作为备选）

### Python 依赖

- **官方 SDK**（推荐）：已通过 `install_resend_sdk.sh` 安装
- **curl**：系统内置命令
- **urllib**：Python 标准库

确保 Linux 上有 Python 3：

```bash
python3 --version
```

### 通知触发条件

| 事件       | 发送通知 | 冷却机制            |
| ---------- | -------- | ------------------- |
| 部署成功   | ✅        | 成功后清除错误计数  |
| 部署失败   | ✅        | 连续 3 次失败后抑制 |
| 拉取失败   | ✅        | 有冷却期            |
| 仅脚本更新 | ✅        | 成功后通知          |

### 邮件内容示例

HTML 邮件包含：
- 状态标签（成功/失败/警告）
- 时间戳
- 操作消息
- 详细日志（可选）

# SD-UI 热部署系统文档
## 邮件通知系统
### 邮件配置

**重要**：请在 Linux 服务器上的 `scripts/.deployrc` 文件中配置，脚本会自动加载：

```bash
# 修改 /home/<USER>/projects/sd-ui/scripts/.deployrc
RESEND_API_KEY="<YOUR_RESEND_API_KEY>"      # Resend API Key
EMAIL_FROM="<YOUR_EMAIL_FROM>"              # 发件邮箱
EMAIL_TO="<YOUR_EMAIL_TO>"                  # 收件邮箱
```

脚本启动时会自动 source 此文件加载环境变量。留空这三个变量将会禁用邮件通知。

### 防邮件轰炸机制

系统内置了多重防邮件轰炸机制，防止异常情况下你的收件箱被塞满：

- **内容去重与暂停发送**：系统会对发送的每一封邮件进行 Hash 校验（包含部署状态、消息、详细信息和**当前 Commit Hash**）。如果检测到**连续 3 次**发送完全相同内容的邮件（例如一直提示自愈，或者因为同一个原因重复报错），系统会自动拦截并暂停该类通知，同时给你发送一封“通知已暂停”的警告邮件。当系统恢复正常发出不同内容的邮件（或新的成功部署）时，该计数器会自动重置。
- **成功部署不误判**：每次成功部署都会携带新的 Commit Hash，因此连续的成功部署不会被误判为重复邮件而被拦截。
- **失败只发一次**：部署失败时发送通知，如果后续的部署因为同样的原因失败（即使不是完全相同的内容），系统也会通过状态记录判断，避免重复打扰。
- **成功重置**：部署成功后，系统状态会被重置，下次失败会重新发送通知。

## 故障排查与调试增强

为了降低排查难度，热部署系统内置了详细的错误追踪机制和容错处理：

### 异常容错处理 (Fail-safe)

- **严格模式退路**：脚本使用了 `set -euo pipefail` 严格模式。当 `git pull` 失败且有未初始化的变量时，系统使用了 `${VAR:-}` 默认值语法，防止脚本意外崩溃，确保错误通知总能发到你的邮箱。
- **数据库备份降级**：如果服务器磁盘空间不足导致数据库备份失败，部署脚本不会中断，而是记录一条 `WARNING` 后继续执行，防止因日志或备份过多导致服务彻底瘫痪。
- **邮件发送防挂起**：调用 Python 脚本发送邮件时，外层套用了 `timeout 60s` 的保护。如果 Resend API 响应卡死，进程会在 60 秒后被强制终止，保证核心服务的重启流程不被阻塞。

### 全局异常捕获 (ERR Trap)

`lib.sh` 核心库中注册了全局的 `ERR` 陷阱。如果任何部署脚本在执行命令时发生未预期的非零退出（例如命令不存在、语法错误等），系统会自动：
1. 捕获发生错误的**脚本名称**和**具体行号**
2. 捕获导致崩溃的**退出码**
3. 立即通过邮件发送包含上述信息的错误通知

### 自动附带执行日志

当发生以下错误时，邮件的“详细日志”区块不仅会显示错误信息，还会**自动提取最近 100 行执行日志**，让你无需登录服务器即可排查问题：
- `npm install` 依赖安装失败
- `npm run build` 前端构建失败
- `prisma generate` 生成失败
- 热部署脚本异常退出
- 任何被全局异常捕获的意外错误

### 手动日志查看

系统会自动轮转日志并保存：
```bash
# 实时查看更新检测日志
tail -f ~/.local/share/sd-ui/logs/git-pull.log

# 实时查看部署日志
tail -f ~/.local/share/sd-ui/logs/hot-deploy.log

# 查看 Cron 执行情况
tail -f ~/.local/share/sd-ui/logs/cron.log
```

## 自动处理本地修改与冲突解决

1. 检测本地修改
2. `git stash -u` 暂存本地修改（包含未追踪的文件）
3. 执行 `git pull --ff-only`
4. **如拉取失败（如冲突或脏文件阻挡）**，系统将自动执行：
   - `git reset --hard origin/<分支名>`（硬重置，强制同步）
   - `git clean -fd`（清理未追踪文件）
5. 尝试还原本地修改（`git stash pop`）
6. 自动解决冲突（优先保留服务器端调试修改）

这确保了：
- Linux 上的调试修改不会被轻易覆盖
- **系统永远不会卡在拉取阶段**：当明明没改文件但 git 认为工作区脏了或未暂存时，系统会自动强行同步最新代码，解决冲突，保证部署链条的顺畅。

## 自动技术栈升级

`hot-deploy.sh` 内置智能检测和修复机制：

### Node.js 自动安装

如果未检测到 Node.js，自动安装：
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### npm 依赖重试

`npm install` 失败后自动重试：
1. 第一次失败 → 删除 `package-lock.json` 后重试
2. 第二次失败 → 报告错误

### Prisma 版本自动修复

自动检测 `package.json` 中的 Prisma 版本：
```bash
# 检测版本
npm install prisma@"$prisma_version" @prisma/client@"$prisma_version"
npx prisma generate
```

### Prisma 生成失败修复

`prisma generate` 失败后：
1. 删除缓存的 Prisma client
2. 重新生成

### 构建失败智能修复

构建失败后检测 "Module not found" 错误：
1. 删除 `node_modules`
2. 重新安装依赖
3. 重新构建



## 故障排查

### 脚本没有执行权限

```bash
# 检查权限
ls -la ~/projects/sd-ui/scripts/*.sh

# 手动修复
chmod +x ~/projects/sd-ui/scripts/*.sh

# 确认 Git 记录了权限
git ls-files -s scripts/*.sh
# 应该显示 100755 而非 100644
```

### Git 权限丢失

Windows 修改脚本后权限可能被重置：

```bash
# Windows 上重新设置权限并推送
git update-index --chmod=+x scripts/*.sh
git commit -m "chore: restore execute permission"
git push
```

### Cron 没有执行

```bash
# 检查 Crontab
crontab -l

# 手动测试
/home/<YOUR_USER>/projects/sd-ui/scripts/check-git-update.sh

# 检查 cron 服务
systemctl --user status cron
```

### 部署卡住

检查是否有任务一直处于 processing 状态：

```bash
sqlite3 /home/<YOUR_USER>/projects/sd-ui/ui/prisma/dev.db "SELECT * FROM Task WHERE status='processing';"
```

## 技术选型说明

### 为什么用 Nginx 而不是直接访问 3001？

- 80/443 端口被其他服务占用
- Nginx 处理静态文件和请求转发
- 便于后续添加缓存、SSL 等

### 为什么用 git pull 而不是 git reset --hard？

`git pull` 触发 `post-merge` 钩子，可以自动修复脚本权限。而 `git reset --hard` 不保证触发钩子，可能导致脚本权限丢失。

`--ff-only` 确保只做快速前进，避免合并冲突。

## 扩展建议

### 1. 添加更多通知渠道

系统已内置邮件通知。可类似添加 Slack/Discord/钉钉等：

```bash
curl -X POST "$WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d '{"text": "Deployment completed"}'
```

### 2. 健康检查

部署后验证服务是否正常：

```bash
curl -f http://localhost:3001/api/health || exit 1
```

### 3. 灰度发布

通过环境变量控制流量比例，先将小部分流量引到新版本。

### 4. 回滚机制

保存最近 N 个版本的构建产物，出问题时快速回滚：

```bash
# 保存当前版本
cp -r ~/.next ~/.local/share/sd-ui/backups/$(date +%Y%m%d_%H%M%S)/

# 回滚到指定版本
git checkout <previous-tag>
npm run build
systemctl --user restart sd-ui
```