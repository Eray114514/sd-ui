# SD-UI - Stable Diffusion WebUI 前端

一个现代化的 Stable Diffusion WebUI 前端应用，提供友好的图片生成界面和任务管理功能。

## ✨ 功能特性

- 🎨 **直观的图片生成界面** - 支持提示词输入、负面提示词、风格选择
- 📐 **灵活的参数配置** - 支持调整分辨率、迭代步数、CFG Scale、采样器等
- 📦 **任务队列管理** - 支持批量生成、任务历史查看、进度追踪
- 🖼️ **图片资源管理** - 图片收藏、浏览、删除功能
- 🌙 **深色/浅色主题** - 自动跟随系统主题
- 📱 **响应式设计** - 支持桌面和移动设备

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI**: [React 19](https://react.dev/) + [shadcn/ui](https://ui.shadcn.com/)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **状态管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **数据库**: [Prisma](https://www.prisma.io/) + SQLite
- **验证**: [Zod](https://zod.dev/)
- **日志**: [Pino](https://getpino.io/)
- **测试**: [Vitest](https://vitest.dev/) + Testing Library

## 📋 前置要求

- Node.js 18.17 或更高版本
- npm、yarn、pnpm 或 bun
- 运行中的 Stable Diffusion WebUI (AUTOMATIC1111 或兼容 API)

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd sd-ui/ui
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

环境变量说明：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | SQLite 数据库文件路径 | `file:./prisma/dev.db` |
| `SD_WEBUI_BASE_URL` | Stable Diffusion API 地址 | `http://localhost:7860` |
| `LOG_LEVEL` | 日志级别 (trace/debug/info/warn/error/fatal) | `info` |

### 4. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📁 项目结构

```
ui/
├── prisma/                 # 数据库 schema
├── public/                 # 静态资源
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API 路由
│   │   ├── assets/        # 资源管理页面
│   │   └── settings/      # 设置页面
│   ├── components/        # React 组件
│   │   ├── custom/        # 业务组件
│   │   ├── layout/        # 布局组件
│   │   └── ui/            # UI 基础组件 (shadcn)
│   ├── constants/         # 常量定义
│   ├── errors/            # 错误处理
│   ├── lib/               # 工具库
│   │   ├── validations/   # Zod 验证 schema
│   │   ├── api-response.ts # API 响应格式化
│   │   ├── db.ts          # 数据库连接
│   │   ├── env.ts         # 环境变量验证
│   │   ├── logger.ts      # 日志系统
│   │   └── queue.ts       # 任务队列处理
│   ├── services/          # API 服务层
│   ├── store/             # Zustand 状态管理
│   └── types/             # TypeScript 类型定义
├── vitest.config.ts       # Vitest 配置
└── package.json
```

## 🔧 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run test` | 启动测试 (watch 模式) |
| `npm run test:run` | 运行所有测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |

## 📡 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/generate` | 创建图片生成任务 |
| `GET` | `/api/tasks` | 获取任务列表 |
| `DELETE` | `/api/tasks` | 删除指定任务 |
| `GET` | `/api/models` | 获取可用模型列表 |
| `GET` | `/api/styles` | 获取可用风格列表 |
| `GET` | `/api/progress` | 获取生成进度 |
| `GET` | `/api/settings` | 获取系统设置 |
| `POST` | `/api/settings` | 更新系统设置 |
| `GET` | `/api/assets` | 获取图片资源列表 |
| `GET` | `/api/image` | 获取单张图片 |

## 🧪 测试

项目使用 Vitest 和 Testing Library 进行测试：

```bash
# 运行测试
npm run test

# 运行测试 (CI 模式)
npm run test:run

# 生成覆盖率报告
npm run test:coverage
```

## 🐳 部署

### Docker 部署 (推荐)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 手动部署

1. 构建项目：`npm run build`
2. 启动服务：`npm run start`

确保 Stable Diffusion WebUI 服务可访问。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
