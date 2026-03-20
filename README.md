# SD-UI - Stable Diffusion Web 界面

一个基于 Next.js 构建的现代化 Stable Diffusion Web UI，提供直观的图像生成任务管理和参数配置功能。

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=flat-square&logo=prisma)

## ✨ 功能特性

### 🎨 图像生成
- **提示词编辑**：支持正向提示词和反向提示词输入
- **风格预设**：支持多种风格标签管理，可快速应用常用风格组合
- **模型选择**：自动获取并管理可用的 Stable Diffusion 模型
- **参数配置**：
  - 采样器（Sampler）选择
  - 采样步数（Steps）调节
  - CFG Scale 控制
  - 图像尺寸（宽度/高度）设置
  - 种子（Seed）设置（支持随机种子）
  - 批次数量（Batch Size）设置

### 📋 任务管理
- **任务队列**：创建、查看和管理图像生成任务
- **实时状态**：跟踪任务状态（待处理、处理中、已完成、失败）
- **历史记录**：保存所有生成历史，支持查看详情
- **一键重试**：失败任务可快速重新生成

### 🖼️ 图片管理
- **图片预览**：查看生成的图片详情
- **收藏功能**：标记喜欢的图片
- **本地存储**：自定义图片保存目录
- **批量下载**：支持下载生成的图片

### ⚙️ 系统设置
- **目录配置**：设置图片输出目录
- **模型管理**：添加、删除和查看可用模型
- **风格管理**：自定义和管理风格预设

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | Next.js 16 + React 19 |
| **开发语言** | TypeScript 5 |
| **样式方案** | Tailwind CSS 4 + shadcn/ui |
| **状态管理** | Zustand |
| **数据库** | SQLite + Prisma ORM |
| **HTTP 客户端** | Axios |
| **图标库** | Lucide React |
| **通知组件** | Sonner |

## 📁 项目结构

```
sd-ui/
├── package.json              # 根目录依赖（Zustand）
├── src/
│   └── components/
│       └── layout/           # 布局组件
│
└── ui/                       # 主项目目录
    ├── package.json          # 项目依赖配置
    ├── next.config.ts        # Next.js 配置
    ├── tsconfig.json         # TypeScript 配置
    ├── tailwind.config.ts    # Tailwind CSS 配置
    ├── prisma/
    │   ├── schema.prisma     # 数据库模型定义
    │   └── dev.db            # SQLite 数据库文件
    │
    ├── src/
    │   ├── app/              # Next.js App Router
    │   │   ├── page.tsx      # 首页（任务列表 + 控制面板）
    │   │   ├── layout.tsx    # 根布局
    │   │   ├── globals.css   # 全局样式
    │   │   ├── api/          # API 路由
    │   │   │   ├── assets/   # 静态资源服务
    │   │   │   ├── fs/       # 文件系统操作
    │   │   │   ├── generate/ # 图像生成接口
    │   │   │   ├── image/    # 图片管理接口
    │   │   │   ├── models/   # 模型管理接口
    │   │   │   ├── settings/ # 系统设置接口
    │   │   │   ├── styles/   # 风格管理接口
    │   │   │   └── tasks/    # 任务管理接口
    │   │   └── assets/       # 资源页面
    │   │
    │   ├── components/
    │   │   ├── ui/           # shadcn/ui 基础组件
    │   │   ├── custom/       # 自定义业务组件
    │   │   │   ├── ControlPanel.tsx      # 控制面板（底部参数配置）
    │   │   │   ├── TaskList.tsx          # 任务列表
    │   │   │   ├── ImageDetailModal.tsx  # 图片详情弹窗
    │   │   │   ├── DirectoryPicker.tsx   # 目录选择器
    │   │   │   └── SettingsDialog.tsx    # 设置对话框
    │   │   ├── layout/       # 布局组件
    │   │   └── theme-provider.tsx  # 主题提供者
    │   │
    │   ├── lib/
    │   │   ├── db.ts         # Prisma 数据库客户端
    │   │   ├── utils.ts      # 工具函数
    │   │   ├── paths.ts      # 路径配置
    │   │   └── queue.ts      # 队列处理
    │   │
    │   └── store/
    │       └── generationStore.ts  # 生成参数状态管理
    │
    └── public/               # 静态资源
```

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd sd-ui/ui
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或
   yarn install
   ```

3. **配置环境变量**
   
   创建 `.env` 文件：
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```

4. **初始化数据库**
   ```bash
   npx prisma db push
   # 或
   npx prisma migrate dev
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
   # 或
   yarn dev
   ```

   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 📊 数据库模型

### Task（生成任务）
- 存储图像生成任务的参数和状态
- 关联生成的图片
- 支持状态追踪：pending, processing, completed, failed

### GeneratedImage（生成图片）
- 存储生成的图片路径
- 支持收藏标记
- 关联所属任务

### SdModel（模型）
- 管理可用的 Stable Diffusion 模型
- 模型名称唯一约束

### Style（风格）
- 管理风格预设标签
- 支持自定义风格

### SystemConfig（系统配置）
- 存储系统级配置
- 图片输出目录设置

## 🔌 API 接口

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建新任务
- `GET /api/tasks/:id` - 获取任务详情
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 图像生成
- `POST /api/generate` - 提交生成请求
- `GET /api/generate/status` - 获取生成状态

### 图片管理
- `GET /api/image` - 获取图片列表
- `GET /api/image/:id` - 获取单张图片
- `PUT /api/image/:id/favorite` - 切换收藏状态
- `DELETE /api/image/:id` - 删除图片

### 模型管理
- `GET /api/models` - 获取模型列表
- `POST /api/models` - 添加模型
- `DELETE /api/models/:id` - 删除模型

### 风格管理
- `GET /api/styles` - 获取风格列表
- `POST /api/styles` - 添加风格
- `DELETE /api/styles/:id` - 删除风格

### 系统设置
- `GET /api/settings` - 获取系统配置
- `PUT /api/settings` - 更新系统配置

## 🎨 界面预览

### 主界面布局
- **顶部**：任务列表区域，显示所有生成任务
- **底部**：控制面板，包含参数配置和生成按钮

### 控制面板功能
- 提示词输入区（支持展开/收起）
- 风格标签选择
- 模型下拉选择
- 参数滑块调节（Steps、CFG、尺寸等）
- 生成按钮

### 任务列表
- 卡片式任务展示
- 实时状态指示
- 图片预览缩略图
- 操作按钮（查看、重试、删除）

## ⚙️ 配置说明

### 默认生成参数
```typescript
{
  model: "waiillustriousSDXL_v160.safetensors",
  width: 896,
  height: 1152,
  sampler: "Euler",
  steps: 30,
  cfg: 5,
  seed: -1,      // -1 表示随机种子
  batchSize: 1
}
```

### 支持的采样器
- Euler
- Euler a
- Heun
- DPM++ 2M
- DPM++ SDE
- 等常见采样器

## 🔧 开发指南

### 添加新组件

使用 shadcn/ui CLI 添加组件：
```bash
npx shadcn add <component-name>
```

### 数据库迁移

修改 `prisma/schema.prisma` 后执行：
```bash
npx prisma migrate dev --name <migration-name>
```

### 生成 Prisma Client

```bash
npx prisma generate
```

## 📝 注意事项

1. **图片存储**：默认图片保存目录为 `/home/user/ai_images`，可在设置中修改
2. **数据库**：使用 SQLite 便于部署，生产环境可考虑 PostgreSQL
3. **模型路径**：确保 Stable Diffusion 模型路径正确配置
4. **端口占用**：开发服务器默认使用 3000 端口

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Prisma](https://www.prisma.io/) - ORM 工具
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理

---

<p align="center">Made with ❤️ for AI Art enthusiasts</p>
