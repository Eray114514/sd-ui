#!/usr/bin/env bash
set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}开始更新 SD-UI...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UI_DIR="${REPO_ROOT}/ui"

if [[ ! -d "$UI_DIR" ]]; then
  echo -e "${RED}错误: UI 目录不存在: $UI_DIR${NC}"
  exit 1
fi

cd "$UI_DIR"

# 1. 拉取最新代码，丢弃本地修改（以仓库为准）
echo -e "${YELLOW}1/3 正在从远程仓库拉取最新代码（本地修改将被覆盖）...${NC}"
git fetch origin

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if git show-ref --verify --quiet "refs/remotes/origin/${CURRENT_BRANCH}"; then
  git reset --hard "origin/${CURRENT_BRANCH}"
else
  echo -e "${YELLOW}当前分支 '$CURRENT_BRANCH' 在远程不存在，尝试 main...${NC}"
  if git show-ref --verify --quiet "refs/remotes/origin/main"; then
    git reset --hard origin/main
  elif git show-ref --verify --quiet "refs/remotes/origin/master"; then
    git reset --hard origin/master
  else
    echo -e "${RED}错误: 无法找到远程分支 (main 或 master)${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✓ 代码已更新${NC}"

# 2. 安装依赖
echo -e "${YELLOW}2/3 正在安装依赖...${NC}"
if npm ci --prefer-offline --no-audit; then
  echo -e "${GREEN}✓ 依赖安装完成 (使用 lockfile)${NC}"
else
  echo -e "${YELLOW}⚠ lockfile 与 package.json 不匹配，使用 npm install 重新生成...${NC}"
  npm install --no-audit
  echo -e "${GREEN}✓ 依赖安装完成 (已更新 lockfile)${NC}"
fi

# 3. 重启服务
echo -e "${YELLOW}3/3 正在重启服务...${NC}"
if systemctl --user is-active --quiet sd-ui 2>/dev/null; then
  systemctl --user restart sd-ui
  echo -e "${GREEN}✓ 服务已重启${NC}"
else
  echo -e "${YELLOW}服务未运行，正在启动...${NC}"
  systemctl --user start sd-ui
  echo -e "${GREEN}✓ 服务已启动${NC}"
fi

echo ""
echo -e "${YELLOW}服务状态:${NC}"
systemctl --user status sd-ui --no-pager || true

echo ""
echo -e "${GREEN}✅ 更新完成！${NC}"
echo -e "访问地址: http://localhost:3000"
echo ""
echo -e "查看日志: journalctl --user -u sd-ui -f"
echo -e "停止服务: systemctl --user stop sd-ui"
