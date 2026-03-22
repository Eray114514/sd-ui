# 前端性能优化规范

## Why

当前项目前端存在以下性能问题导致用户体验卡顿：

1. **过度轮询**：任务列表每3秒无条件轮询，进度每1秒轮询，即使页面在后台运行或没有处理中任务
2. **缺乏缓存机制**：Models 和 Styles 数据每次组件挂载都重新获取，无客户端缓存
3. **不必要的重渲染**：TaskCard 组件未使用 React.memo，内部回调函数未使用 useCallback
4. **状态同步问题**：tasks 同时使用 useState 和 useRef，容易导致状态不一致
5. **图片加载低效**：图片通过 Next.js API 路由代理，增加不必要的网络开销
6. **进度数据管理混乱**：progressData 使用普通 state 且在每次轮询时全量更新
7. **组件职责不清晰**：ControlPanel 处理过多状态逻辑，频繁触发联动更新

## What Changes

* **优化轮询策略**：实现智能轮询，仅在任务处理中且页面可见时轮询，页面后台时暂停

* **添加 Models/Styles 缓存**：利用已有的 cache.ts 实现客户端缓存，避免重复请求

* **React.memo 优化**：对 TaskCard 等展示组件使用 memo + useCallback 优化

* **简化状态管理**：移除 tasksRef，合并为单一状态源

* **优化进度数据**：使用 useRef 存储进度数据避免触发重渲染，仅传递需要的数据给子组件

* **批量状态更新**：使用批量更新机制减少 React 重渲染次数

* **懒加载优化**：增强图片懒加载策略，预加载可见区域图片

## Impact

* **受影响的功能**：首页任务列表、控制面板、任务卡片

* **受影响的代码**：

  * `src/components/custom/ControlPanel.tsx`

  * `src/components/custom/TaskList.tsx`

  * `src/components/custom/TaskCard.tsx`

  * `src/services/modelsService.ts`

  * `src/services/stylesService.ts`

  * `src/services/progressService.ts`

  * `src/constants/index.ts`

## ADDED Requirements

### Requirement: 智能轮询系统

系统 SHALL 实现智能轮询机制：

* 页面可见时正常轮询，页面隐藏时暂停轮询

* 仅当存在处理中任务时才轮询进度

* 轮询间隔可配置，默认 tasks 3s，progress 1s

* 使用 Web Visibility API 检测页面可见性

* 使用 ref 存储轮询状态，避免闭包问题

#### Scenario: 页面后台运行时暂停轮询

* **WHEN** 用户切换到其他标签页或最小化浏览器

* **THEN** 所有轮询立即暂停，不消耗网络和CPU资源

* **WHEN** 用户切回页面

* **THEN** 立即恢复轮询并同步最新数据

#### Scenario: 无处理中任务时跳过进度轮询

* **WHEN** 所有任务状态都不是 'processing'

* **THEN** 进度轮询完全停止，不发送任何请求

### Requirement: Models/Styles 客户端缓存

系统 SHALL 实现 Models 和 Styles 的客户端缓存：

* 首次加载后缓存一定时间（默认5分钟）

* 缓存过期后后台静默刷新，不阻塞UI

* 手动刷新机制可强制更新缓存

* 缓存键使用 cacheKeys 统一管理

#### Scenario: 缓存命中时直接使用

* **WHEN** 用户访问首页且缓存未过期

* **THEN** Models 和 Styles 直接从缓存返回，无网络请求

* **THEN** 页面渲染不受API响应影响

### Requirement: TaskCard 渲染优化

系统 SHALL 优化 TaskCard 组件渲染性能：

* 使用 React.memo 包装组件

* 回调函数使用 useCallback 包裹

* 纯展示逻辑组件无内部状态依赖

#### Scenario: 父组件状态变化时避免子组件重渲染

* **WHEN** 父组件中 unrelated 状态变化时

* **THEN** 未变化的 TaskCard 不应重新渲染

### Requirement: 进度数据优化

系统 SHALL 优化进度数据的存储和传递：

* 进度数据使用 useRef 存储，不触发重渲染

* 仅当进度数据变化且对应任务可见时才更新UI

* 使用 requestAnimationFrame 节流进度更新

#### Scenario: 快速进度更新时避免卡顿

* **WHEN** 后端进度频繁更新（1秒多次）

* **THEN** 前端使用 RAF 节流，限制最高更新频率为 10fps

* **THEN** 仅更新真正变化的任务进度

## MODIFIED Requirements

### Requirement: TaskList 状态管理重构

**原要求**：tasks 使用 useState + useRef 双存储
**新要求**：

* 仅使用 useState 存储任务列表

* 使用 useCallback 管理异步更新

* 使用 batch update 批量处理状态更新

### Requirement: ControlPanel 数据获取重构

**原要求**：每次挂载都重新获取 models/styles
**新要求**：

* 优先从缓存读取

* 缓存不存在或过期时才请求

* 缓存刷新在后台进行，不阻塞UI

### Requirement: 轮询配置常量化

**原要求**：轮询间隔硬编码在组件内
**新要求**：

* 轮询间隔统一在 constants/index.ts 管理

* 支持环境变量覆盖

* 提供运行时修改接口（可选）

## 兼容性要求

* **必须保证**：所有现有功能完全可用，行为不变

* **必须保证**：项目重启后能直接继续使用，不会丢失任何东西

* **必须保证**：轮询变化不导致任务丢失或重复

* **必须保证**：缓存失效时平滑回退到正常请求

* **必须保证**：后台运行时状态最终一致性

