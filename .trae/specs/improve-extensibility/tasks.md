# Tasks

- [ ] Task 1: 创建核心类型定义文件
  - [ ] SubTask 1.1: 创建 src/types/index.ts，定义 Task, GeneratedImage, SystemConfig 等核心类型
  - [ ] SubTask 1.2: 创建 src/types/api.ts，定义 API 相关类型（ApiResponse, ApiError, Request/Response types）
  - [ ] SubTask 1.3: 创建 src/types/generation.ts，定义生成参数相关类型

- [ ] Task 2: 创建 API 服务层
  - [ ] SubTask 2.1: 创建 src/services/apiClient.ts，统一配置 axios 实例和拦截器
  - [ ] SubTask 2.2: 创建 src/services/modelsService.ts，提供 getModels 方法
  - [ ] SubTask 2.3: 创建 src/services/stylesService.ts，提供 getStyles 方法
  - [ ] SubTask 2.4: 创建 src/services/tasksService.ts，提供 CRUD 操作方法
  - [ ] SubTask 2.5: 创建 src/services/assetsService.ts，提供图片操作方法
  - [ ] SubTask 2.6: 创建 src/services/generateService.ts，提供生成任务方法
  - [ ] SubTask 2.7: 创建 src/services/progressService.ts，提供进度查询方法

- [ ] Task 3: 抽取常量配置层
  - [ ] SubTask 3.1: 创建 src/constants/index.ts，整合现有 constants.ts
  - [ ] SubTask 3.2: 添加生成参数默认值常量
  - [ ] SubTask 3.3: 添加 UI 相关常量（动画时长、尺寸限制等）
  - [ ] SubTask 3.4: 更新 sdConfig.ts 从环境变量读取配置

- [ ] Task 4: 建立统一错误处理
  - [ ] SubTask 4.1: 创建 src/errors/index.ts，定义 BusinessError, ApiError 类
  - [ ] SubTask 4.2: 创建 src/errors/errorHandler.ts，提供错误处理工具函数
  - [ ] SubTask 4.3: 更新 API 服务层使用统一错误处理

- [ ] Task 5: 创建环境变量配置
  - [ ] SubTask 5.1: 创建 .env 文件，包含 SD_WEBUI_BASE_URL（使用当前硬编码值）
  - [ ] SubTask 5.2: 创建 .env.example 作为配置模板
  - [ ] SubTask 5.3: 更新 .gitignore 确保 .env 不被提交
  - [ ] SubTask 5.4: 确保 sdConfig.ts 支持 .env 不存在时的向后兼容

- [ ] Task 6: 优化 GenerationStore
  - [ ] SubTask 6.1: 引入 Task 类型，移除 fillFromTask 中的 any
  - [ ] SubTask 6.2: 使用 constants.ts 中的默认值
  - [ ] SubTask 6.3: 添加部分持久化配置的类型安全

- [ ] Task 7: 重构 ControlPanel 组件
  - [ ] SubTask 7.1: 引入 service 层获取 models 和 styles
  - [ ] SubTask 7.2: 引入类型定义，移除 any 类型使用
  - [ ] SubTask 7.3: 使用 constants.ts 中的硬编码值

- [ ] Task 8: 重构 TaskList 组件
  - [ ] SubTask 8.1: 引入 service 层进行任务操作
  - [ ] SubTask 8.2: 引入类型定义，移除 any 类型使用
  - [ ] SubTask 8.3: 优化错误解析逻辑使用统一错误处理

- [ ] Task 9: 验证项目完整性
  - [ ] SubTask 9.1: 运行 npm run lint 确保无 lint 错误
  - [ ] SubTask 9.2: 运行 npm run build 确保构建成功
  - [ ] SubTask 9.3: 检查所有组件功能是否正常

# Task Dependencies
- Task 2 依赖 Task 1 和 Task 4
- Task 3 可独立进行
- Task 5 依赖 Task 3
- Task 6 依赖 Task 1 和 Task 3
- Task 7 依赖 Task 1, Task 2, Task 3, Task 4
- Task 8 依赖 Task 1, Task 2, Task 4
- Task 9 依赖 Task 1-8 全部完成
