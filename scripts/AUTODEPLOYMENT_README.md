# SD-UI 热部署系统文档

## 概述

SD-UI 采用 **Windows 开发 → Linux 自动部署** 的工作流。当代码推送到 GitHub 后，Linux 服务器自动检测更新并完成构建、部署、重启，全程无需人工干预。

```
Windows (开发/推送)
       │
       ▼
   GitHub
       │
       ▼
Linux (自动检测 + 部署)
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

| 文件类型         | 示例                                | 部署行为                |
| ------------ | --------------------------------- | ------------------- |
| **Shell 脚本** | `scripts/*.sh`                    | 仅更新脚本，不重启服务         |
| **前端代码**     | `ui/src/*`, `*.css`               | 重建 + 同步静态文件，**不重启** |
| **后端/API**   | `ui/src/app/api/*`, `ui/prisma/*` | 完整热部署，等待任务完成后重启     |
| **依赖文件**     | `package.json`, `yarn.lock`       | 触发完整热部署             |
| **文档/配置**    | `README.md`, `*.yml`              | 完全忽略，不执行任何操作        |

### 为什么这样设计？

- **脚本修改不重启**：避免打断正在运行的定时任务
- **前端修改不重启**：Next.js 自带 HMR（热模块替换），重启反而慢
- **后端修改需重启**：API 路由、数据库 Schema 变更需要新进程加载
- **等待处理中的任务**：图片生成等长时间任务会被等待完成后才重启

## 系统组件

### 核心脚本

| 脚本                           | 位置         | 功能                          |
| ---------------------------- | ---------- | --------------------------- |
| `check-git-update.sh`        | `scripts/` | Cron 调用，检测更新并触发部署           |
| `hot-deploy.sh`              | `scripts/` | 完整热部署：备份→安装依赖→构建→重启         |
| `send_email.py`              | `scripts/` | Python 发邮件脚本，通过 Resend API 发送通知 |
| `sync-standalone-static.mjs` | `scripts/` | Next.js standalone 模式静态文件同步 |
| `nginx-dev.conf`             | `scripts/` | Nginx 反向代理配置（端口 3000→3001）  |

### 目录结构

```
sd-ui/
├── scripts/                    # 部署脚本
│   ├── check-git-update.sh     # ← Cron 每分钟执行
│   ├── hot-deploy.sh           # 完整热部署
│   ├── sync-standalone-static.mjs
│   ├── nginx-dev.conf
│   └── enable_autostart_ubuntu.sh
├── ui/                         # Next.js 应用
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── dev.db             # SQLite 数据库
│   ├── .next/
│   │   └── standalone/         # Next.js 独立部署模式
│   └── src/
└── ...

~/.local/share/sd-ui/          # Linux 运行时数据
├── logs/
│   ├── git-pull.log           # 更新检测日志
│   └── hot-deploy.log         # 部署日志
└── backups/                   # 数据库备份
```

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
# Windows
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
# Windows
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
# Windows
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

| 文件 | 功能 |
|------|------|
| `send_email.py` | Python 发邮件脚本，使用标准库 `urllib`，无需额外依赖 |
| `check-git-update.sh` | 调用 Python 发送更新通知 |
| `hot-deploy.sh` | 调用 Python 发送部署结果通知 |

### 工作流程

```
Shell 脚本 → 构造 HTML → 写入临时文件 → 调用 Python → Python 读取文件 → API 发送邮件
```

### Python 依赖

`send_email.py` 使用 Python 标准库（`urllib`、`json`），**无需安装额外依赖**。确保 Linux 上有 Python 3：

```bash
python3 --version
```

### 通知触发条件

| 事件 | 发送通知 | 冷却机制 |
|------|---------|---------|
| 部署成功 | ✅ | 成功后清除错误计数 |
| 部署失败 | ✅ | 连续 3 次失败后抑制 |
| 拉取失败 | ✅ | 有冷却期 |
| 仅脚本更新 | ✅ | 成功后通知 |

### 邮件内容示例

HTML 邮件包含：
- 状态标签（成功/失败/警告）
- 时间戳
- 操作消息
- 详细日志（可选）

### 邮件配置

**重要**：请在 Linux 服务器上创建 `ui/.env` 文件，脚本会自动加载：

```bash
# 创建 /home/<USER>/projects/sd-ui/ui/.env
RESEND_API_KEY="<YOUR_RESEND_API_KEY>"      # Resend API Key
EMAIL_FROM="<YOUR_EMAIL_FROM>"              # 发件邮箱
EMAIL_TO="<YOUR_EMAIL_TO>"                    # 收件邮箱
```

脚本启动时会自动 source 此文件加载环境变量。

### 防邮件轰炸机制

- **失败只发一次**：部署失败时发送通知，后续失败不再发送
- **成功重置**：部署成功后，下次失败会重新发送
- 连续失败期间不会重复打扰，直到你解决问题并成功部署一次

## 自动处理本地修改

如果 Linux 本地有未提交的修改（暂存或未暂存），系统会自动：

1. 检测本地修改
2. `git stash` 暂存本地修改
3. 执行 `git pull`
4. 尝试还原本地修改（`git stash pop`）
5. 如拉取失败，本地修改会被恢复

这确保了：
- Linux 上的调试修改不会被覆盖
- 多设备使用时不会丢失本地更改

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

## 日志查看

```bash
# 实时查看更新检测日志
tail -f ~/.local/share/sd-ui/logs/git-pull.log

# 实时查看部署日志
tail -f ~/.local/share/sd-ui/logs/hot-deploy.log

# 查看 Cron 执行情况
tail -f ~/.local/share/sd-ui/logs/cron.log
```

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
cp -r ~/.next/standalone ~/.local/share/sd-ui/backups/$(date +%Y%m%d_%H%M%S)/

# 回滚到指定版本
git checkout <previous-tag>
npm run build
systemctl --user restart sd-ui
```

## 许可证

MIT License - 公开仓库，可自由使用和修改。
