# SD-UI - Stable Diffusion Web 界面

一个基于 Next.js 15 构建的现代化 Stable Diffusion Web UI，提供直观的图像生成任务管理和参数配置功能。

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)

## ✨ 功能特性

### 🎨 图像生成
- **提示词编辑**：支持正向提示词和反向提示词输入，支持 Enter 快捷发送
- **风格预设**：多种风格标签管理，可快速应用常用风格组合
- **模型选择**：自动获取并管理可用的 Stable Diffusion 模型
- **参数配置**：
  - 画幅比例选择（1:1、3:4、4:3、9:16、16:9）
  - 迭代步数（10-50）
  - 提示词相关性 CFG（1-15）
  - 生成数量（1-8）
  - 采样器和调度器配置
  - 种子设置（支持随机种子）
- **实时进度**：生成过程中显示实时进度和预览图

### 📋 任务管理
- **任务队列**：创建、查看和管理图像生成任务
- **实时状态**：跟踪任务状态（待处理、处理中、已完成、失败）
- **历史记录**：保存所有生成历史，支持查看详情
- **一键重试**：失败任务可快速重新生成
- **自动重试**：任务失败自动重试最多 2 次

### 🖼️ 图片管理（资产画廊）
- **画廊视图**：按日期分组展示所有生成图片
- **图片预览**：查看生成的图片详情，支持同任务相关图片浏览
- **收藏功能**：标记喜欢的图片
- **搜索筛选**：支持按提示词搜索和按收藏筛选
- **批量下载**：支持下载生成的图片
- **无限滚动**：支持无限滚动加载更多图片

### ⚙️ 系统设置
- **独立设置页面**：清晰的设置界面布局
- **目录配置**：设置图片输出目录（支持可视化目录选择器）
- **模型管理**：添加、删除和查看可用模型
- **风格管理**：自定义和管理风格预设

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | Next.js 15.5 + React 19.2 |
| **开发语言** | TypeScript 5 |
| **样式方案** | Tailwind CSS 4 + shadcn/ui + @base-ui/react |
| **状态管理** | Zustand 5（持久化存储） |
| **数据库** | SQLite + Prisma ORM |
| **HTTP 客户端** | Axios |
| **图标库** | Lucide React |
| **通知组件** | Sonner |

## 📁 项目结构

```
sd-ui/
├── package.json              # 根目录依赖（Zustand）
├── README.md                  # 项目说明文档
├── logs/                      # 日志目录
│   └── app.log
│
├── scripts/                   # 启动脚本
│   ├── start_windows.bat      # Windows 启动脚本
│   ├── start_windows.ps1      # Windows PowerShell 脚本
│   ├── start_sd_ui_ubuntu.sh  # Ubuntu 启动脚本
│   └── enable_autostart_ubuntu.sh  # Ubuntu 开机自启配置
│
└── ui/                        # 主项目目录
    ├── package.json           # 项目依赖配置
    ├── next.config.mjs        # Next.js 配置
    ├── tsconfig.json          # TypeScript 配置
    ├── tailwind.config.ts     # Tailwind CSS 配置
    ├── postcss.config.mjs     # PostCSS 配置
    ├── components.json        # shadcn/ui 组件配置
    ├── eslint.config.mjs      # ESLint 配置
    │
    ├── prisma/
    │   ├── schema.prisma      # 数据库模型定义
    │   └── dev.db             # SQLite 数据库文件
    │
    ├── public/                # 静态资源
    │
    ├── scripts/               # 工具脚本
    │   ├── recover-images.js  # 图片恢复脚本
    │   └── sync-standalone-static.mjs  # 静态资源同步脚本
    │
    └── src/
        ├── app/               # Next.js App Router
        │   ├── page.tsx       # 首页（任务列表 + 控制面板）
        │   ├── layout.tsx     # 根布局
        │   ├── globals.css    # 全局样式
        │   │
        │   ├── api/           # API 路由
        │   │   ├── assets/    # 资产服务
        │   │   ├── fs/        # 文件系统操作
        │   │   ├── generate/  # 图像生成接口
        │   │   ├── image/     # 图片管理接口
        │   │   ├── models/    # 模型管理接口
        │   │   ├── progress/  # 进度查询接口
        │   │   ├── settings/  # 系统设置接口
        │   │   ├── styles/    # 风格管理接口
        │   │   └── tasks/     # 任务管理接口
        │   │
        │   ├── assets/        # 资产画廊页面
        │   └── settings/      # 系统设置页面
        │
        ├── components/
        │   ├── ui/            # shadcn/ui 基础组件
        │   ├── custom/        # 自定义业务组件
        │   │   ├── ControlPanel.tsx      # 控制面板
        │   │   ├── TaskList.tsx          # 任务列表
        │   │   ├── TaskCard.tsx          # 任务卡片
        │   │   ├── ImageDetailModal.tsx  # 图片详情弹窗
        │   │   └── DirectoryPicker.tsx   # 目录选择器
        │   ├── layout/        # 布局组件
        │   │   ├── Sidebar.tsx       # 侧边栏导航
        │   │   └── MobileNav.tsx     # 移动端导航
        │   └── theme-provider.tsx  # 主题提供者
        │
        ├── lib/               # 工具库
        │   ├── db.ts          # Prisma 数据库客户端
        │   ├── utils.ts       # 工具函数
        │   ├── paths.ts       # 路径配置
        │   ├── queue.ts       # 队列处理器（含重试逻辑）
        │   ├── sdConfig.ts    # SD WebUI 配置
        │   ├── cache.ts       # 缓存管理
        │   ├── constants.ts   # 常量定义
        │   └── pollingManager.ts  # 轮询管理器
        │
        ├── services/          # 服务层
        │   ├── apiClient.ts       # API 客户端封装
        │   ├── assetsService.ts   # 资产服务
        │   ├── generateService.ts # 生成服务
        │   ├── modelsService.ts   # 模型服务
        │   ├── progressService.ts # 进度服务
        │   ├── stylesService.ts   # 风格服务
        │   └── tasksService.ts    # 任务服务
        │
        ├── store/
        │   └── generationStore.ts  # 生成参数状态管理（Zustand）
        │
        ├── types/             # TypeScript 类型定义
        │   ├── index.ts           # 通用类型
        │   ├── api.ts             # API 类型
        │   └── generation.ts      # 生成参数类型
        │
        ├── constants/         # 常量配置
        │   └── index.ts           # UI 常量和配置
        │
        └── errors/            # 错误处理
            ├── index.ts           # 错误类型定义
            └── errorHandler.ts    # 错误处理器
```

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- Stable Diffusion WebUI（需正常运行并启用 --api 参数）

### 一键启动

**Windows:**
```bash
# 双击运行或在命令行执行
scripts\start_windows.bat
```

**Ubuntu:**
```bash
chmod +x scripts/start_sd_ui_ubuntu.sh
./scripts/start_sd_ui_ubuntu.sh
```

启动脚本会自动：
1. 检查并安装依赖
2. 生成 Prisma 客户端
3. 初始化数据库
4. 启动开发服务器并打开浏览器

### 手动安装

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd sd-ui/ui
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**

   创建 `.env` 文件：
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   SD_WEBUI_BASE_URL="http://localhost:7860"
   ```

4. **初始化数据库**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
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
- 自动重试计数（最多 2 次）

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
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tasks | 获取任务列表 |
| POST | /api/tasks | 创建新任务 |
| GET | /api/tasks/:id | 获取任务详情 |
| PUT | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |

### 图像生成
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/generate | 提交生成请求 |
| GET | /api/progress | 获取生成进度 |

### 图片管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/image | 获取单张图片 |
| GET | /api/assets | 获取资产列表（支持分页） |
| PUT | /api/assets | 更新资产（收藏） |
| DELETE | /api/assets | 删除资产 |

### 模型管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/models | 获取模型列表 |
| POST | /api/models | 添加模型 |
| DELETE | /api/models/:id | 删除模型 |

### 风格管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/styles | 获取风格列表 |
| POST | /api/styles | 添加风格 |
| DELETE | /api/styles/:id | 删除风格 |

### 系统设置
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/settings | 获取系统配置 |
| POST | /api/settings | 更新系统配置 |

## ⚙️ 配置说明

### 默认生成参数
```typescript
{
  model: "waiillustriousSDXL_v160.safetensors",
  width: 896,
  height: 1152,
  sampler: "Euler",
  scheduler: "Automatic",
  steps: 30,
  cfg: 5,
  seed: -1,      // -1 表示随机种子
  batchSize: 4,
  styles: ["Lasy", "NAI3起手-"]
}
```

### UI 常量配置
```typescript
UI_CONSTANTS = {
  CONTROL_PANEL: {
    MIN_TEXTAREA_HEIGHT: 48,
    MAX_TEXTAREA_HEIGHT: 300,
    COLLAPSED_HEIGHT: 65,
    TRANSITION_DURATION: 400,
  },
  ANIMATION: {
    SLIDE_DOWN_DURATION: 350,
    SCALE_DURATION: 200,
    TRANSITION_DURATION: 300,
  },
  POLLING: {
    TASKS_INTERVAL: 3000,     // 任务轮询间隔
    PROGRESS_INTERVAL: 1000,  // 进度轮询间隔
  },
  CACHE: {
    MODELS_TTL: 5 * 60 * 1000,   // 模型缓存 5 分钟
    STYLES_TTL: 5 * 60 * 1000,   // 风格缓存 5 分钟
  },
}
```

## 🎨 界面预览

### 页面结构
- **侧边栏**：固定左侧导航，包含生成、资产、设置页面入口
- **主区域**：任务列表或资产画廊
- **控制面板**：底部悬浮，支持展开/收起

### 控制面板功能
- 提示词输入区（支持 Enter 发送、Shift+Enter 换行）
- 风格标签选择
- 模型下拉选择
- 画幅比例快捷选择
- 参数滑块调节（迭代步数、CFG、生成数量）
- 生成按钮

### 设置页面功能
- 图片保存目录配置（支持可视化目录选择器）
- 模型管理（添加/删除）
- 风格预设管理（添加/删除）

### 资产画廊功能
- 日期分组展示
- 全部/收藏筛选
- 提示词搜索
- 无限滚动加载
- 图片详情弹窗
- 下载、收藏、删除操作

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

### 代码规范

项目使用 ESLint 进行代码检查：
```bash
npm run lint
```

## 📝 注意事项

1. **SD WebUI 连接**：确保 Stable Diffusion WebUI 已启动并添加 `--api` 参数
2. **图片存储**：默认图片保存目录可在设置页面配置
3. **数据库**：使用 SQLite 便于部署，生产环境可考虑 PostgreSQL
4. **缓存策略**：模型和风格列表有 5 分钟缓存，修改后需等待缓存过期或重启
5. **网络配置**：SD WebUI 地址在 `.env` 文件中配置

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
- [Base UI](https://base-ui.com/) - React UI 组件库

---

<p align="center">Made with ❤️ for AI Art enthusiasts</p>
