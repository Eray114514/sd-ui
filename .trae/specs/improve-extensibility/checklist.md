# Checklist

## Task 1: 类型定义文件
- [x] src/types/index.ts 创建完成，包含 Task, GeneratedImage, SystemConfig 类型
- [x] src/types/api.ts 创建完成，包含 ApiResponse, ApiError 类型
- [x] src/types/generation.ts 创建完成，包含 GenerationParams, GenerationPayload 类型
- [x] 类型文件导出正确，可从 @/types 导入

## Task 2: API 服务层
- [x] src/services/apiClient.ts 创建完成，配置了请求/响应拦截器
- [x] src/services/modelsService.ts 提供 getModels 方法
- [x] src/services/stylesService.ts 提供 getStyles 方法
- [x] src/services/tasksService.ts 提供 getTasks, deleteTask 方法
- [x] src/services/assetsService.ts 提供 deleteAsset, updateAsset, getAssetDownloadUrl 方法
- [x] src/services/generateService.ts 提供 generate 方法
- [x] src/services/progressService.ts 提供 getProgress 方法
- [x] 所有 service 方法返回类型正确

## Task 3: 常量配置层
- [x] src/constants/index.ts 创建完成
- [x] 生成参数默认值已迁移（steps, cfg, width, height, sampler 等）
- [x] UI 常量已添加（动画时长、尺寸限制等）
- [x] sdConfig.ts 支持从环境变量读取 SD_WEBUI_BASE_URL

## Task 4: 统一错误处理
- [x] src/errors/index.ts 创建完成，定义了 BusinessError, ApiError 类
- [x] src/errors/errorHandler.ts 创建完成，提供 parseError, getHttpErrorMessage, getNetworkErrorMessage 等工具函数
- [x] API 服务层可使用统一错误处理

## Task 5: 环境变量配置
- [x] .env 文件创建完成，SD_WEBUI_BASE_URL 使用当前硬编码值
- [x] .env.example 创建完成，作为配置模板
- [x] .gitignore 已包含 .env*，确保 .env 不被提交
- [x] sdConfig.ts 向后兼容，.env 不存在时使用默认值

## Task 6: GenerationStore 优化
- [x] GenerationStore 引入 Task 类型
- [x] fillFromTask 方法不再使用 any 类型
- [x] 使用 constants.ts 中的默认值

## Task 7: ControlPanel 重构
- [x] 使用 modelsService 获取模型列表
- [x] 使用 stylesService 获取风格列表
- [x] 使用 generateService 创建生成任务
- [x] 移除组件内直接使用 axios 的代码
- [x] 所有状态使用正确的类型定义

## Task 8: TaskList 重构
- [x] 使用 tasksService 获取和操作任务
- [x] 使用 assetsService 操作图片
- [x] 使用 getProgress 获取进度
- [x] 移除组件内直接使用 axios 的代码
- [x] 任务数据使用正确类型定义
- [x] 错误展示使用统一错误处理

## Task 9: 整体验证
- [x] TypeScript 编译检查通过 (tsc --noEmit)
- [ ] npm run build 执行成功
- [x] 所有组件功能正常工作
- [x] 项目使用体验与修改前完全一致
