# 项目可扩展性改进规范

## Why

当前项目存在以下问题导致扩展功能困难、修改容易引入bug：

1. **类型安全问题严重**：大量使用 `any` 类型，导致IDE无法提供准确的自动补全和类型检查
2. **组件职责过重**：`ControlPanel` 和 `TaskList` 等组件承担了UI、业务逻辑、数据获取等多重职责
3. **API调用分散**：组件直接使用 axios 调用 API，重复代码多，难以统一管理
4. **类型定义缺失**：缺少任务、图片、模型等核心业务类型定义
5. **错误处理不一致**：错误格式不统一，处理逻辑分散
6. **配置硬编码**：配置项直接硬编码，难以根据环境切换

## What Changes

- **新增类型定义层**：建立完整的 TypeScript 类型系统
- **抽取 API 服务层**：创建独立的 API 服务模块，统一管理所有接口调用
- **抽取常量配置层**：将硬编码值迁移到配置/常量文件
- **优化 Store 结构**：改进 Zustand store 的类型安全和职责分离
- **统一错误处理**：建立标准的错误类型和处理流程
- **拆分大型组件**：将大组件中的业务逻辑和数据获取分离
- **环境变量配置**：SD WebUI 地址迁移到 .env 环境变量文件

## Impact

- **受影响的功能**：所有前后端交互功能（生成任务、图片管理、设置管理）
- **受影响的代码**：
  - `src/store/generationStore.ts`
  - `src/components/custom/ControlPanel.tsx`
  - `src/components/custom/TaskList.tsx`
  - `src/lib/queue.ts`
  - `src/app/api/*/route.ts`

## ADDED Requirements

### Requirement: 核心类型定义
系统 SHALL 提供完整的类型定义，涵盖：
- Task 相关类型（Task, TaskStatus, TaskWithImages）
- Image 相关类型（GeneratedImage）
- API 相关类型（ApiResponse, ApiError, Request/Response types）
- 配置相关类型（SystemConfig）

#### Scenario: 类型安全的数据流
- **WHEN** 组件之间传递任务数据时
- **THEN** 应使用完整类型定义，IDE 能准确提示可用属性

### Requirement: API 服务层
系统 SHALL 提供统一的 API 服务模块，包含：
- models service
- styles service
- tasks service
- assets service
- settings service
- progress service

#### Scenario: 集中的 API 调用
- **WHEN** 需要调用后端 API 时
- **THEN** 应使用对应的 service 方法，而非直接在组件中使用 axios

### Requirement: 常量配置层
系统 SHALL 提供集中的常量配置：
- 应用常量（API 路径、默认参数等）
- UI 常量（尺寸限制、动画时长等）
- 生成参数常量（默认步数、尺寸等）

#### Scenario: 配置统一管理
- **WHEN** 需要修改默认生成参数时
- **THEN** 应在 constants.ts 中修改，影响所有使用处

### Requirement: 统一错误处理
系统 SHALL 提供标准化的错误类型和处理流程：
- 业务错误类（BusinessError）
- API 错误类（ApiError）
- 统一的错误处理工具函数

#### Scenario: 一致的错误展示
- **WHEN** API 调用失败时
- **THEN** 应返回结构化的错误信息，前端可统一处理

### Requirement: 环境变量配置
系统 SHALL 通过 .env 文件管理环境相关配置：
- SD_WEBUI_BASE_URL 必须通过环境变量配置
- 提供 .env.example 作为配置模板
- 确保回退机制，保留当前硬编码值作为默认值

#### Scenario: 环境切换
- **WHEN** 需要切换 SD WebUI 服务器地址时
- **THEN** 修改 .env 文件中的 SD_WEBUI_BASE_URL 即可

## MODIFIED Requirements

### Requirement: GenerationStore 类型安全
**原要求**：使用 any 类型处理 task 数据
**新要求**：
- 移除 fillFromTask 中的 any 类型
- 使用完整的 Task 类型定义
- 提供完整的类型推导

### Requirement: ControlPanel 组件重构
**原要求**：组件内直接调用 axios 获取 models/styles
**新要求**：
- 组件只负责 UI 渲染
- 数据获取通过 service 层
- 使用 service 层方法管理数据请求状态

### Requirement: TaskList 组件重构
**原要求**：组件内直接调用 axios 进行任务操作
**新要求**：
- 组件只负责 UI 渲染和交互
- 任务操作通过 service 层
- 类型安全的数据展示

## REMOVED Requirements

### Requirement: 硬编码的 SD WebUI 地址
**Reason**: 当前硬编码在 sdConfig.ts 中，难以切换环境
**Migration**: 迁移到环境变量配置，sdConfig.ts 只做读取，提供 .env 文件

### Requirement: 组件内的重复 API 调用逻辑
**Reason**: ControlPanel 和 TaskList 中都有 axios 调用，分散且难以维护
**Migration**: 统一迁移到 service 层

## 兼容性要求

- **必须保证**：所有现有功能完全可用，不受影响
- **必须保证**：API 接口保持兼容，不改变现有接口契约
- **必须保证**：Store 持久化数据格式兼容，不破坏现有存储
- **必须保证**：.env 文件不存在时，使用当前硬编码的默认值（向后兼容）
