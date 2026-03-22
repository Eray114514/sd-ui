# Tasks - 前端性能优化

## 任务列表

- [x] Task 1: 创建轮询管理模块 (PollingManager)
  - [x] SubTask 1.1: 创建 src/lib/pollingManager.ts 实现智能轮询控制类
  - [x] SubTask 1.2: 实现页面可见性检测 (Visibility API)
  - [x] SubTask 1.3: 实现轮询暂停/恢复逻辑
  - [x] SubTask 1.4: 添加单例导出

- [x] Task 2: 优化 TaskList 组件轮询逻辑
  - [x] SubTask 2.1: 使用 PollingManager 重构任务轮询
  - [x] SubTask 2.2: 使用 PollingManager 重构进度轮询
  - [x] SubTask 2.3: 移除 tasksRef，统一使用 use State
  - [x] SubTask 2.4: 添加 batch update 机制

- [x] Task 3: 优化 modelsService 和 stylesService 缓存
  - [x] SubTask 3.1: 在 modelsService 中实现缓存逻辑
  - [x] SubTask 3.2: 在 stylesService 中实现缓存逻辑
  - [x] SubTask 3.3: 添加缓存过期配置（默认5分钟）
  - [x] SubTask 3.4: 添加手动刷新接口

- [x] Task 4: 优化 TaskCard 组件渲染
  - [x] SubTask 4.1: 使用 React.memo 包装 TaskCard
  - [x] SubTask 4.2: 使用 useCallback 优化回调函数
  - [x] SubTask 4.3: 优化 ErrorDisplay 子组件

- [x] Task 5: 优化进度数据更新
  - [x] SubTask 5.1: 使用 useRef 存储 progressData
  - [x] SubTask 5.2: 实现 RAF 节流机制
  - [x] SubTask 5.3: 仅更新可见任务的进度

- [x] Task 6: 更新轮询常量配置
  - [x] SubTask 6.1: 在 constants/index.ts 添加轮询配置
  - [x] SubTask 6.2: 添加缓存TTL配置
  - [x] SubTask 6.3: 添加进度更新节流配置

- [x] Task 7: 优化 ControlPanel 数据获取
  - [x] SubTask 7.1: 修改 ControlPanel 使用带缓存的 service
  - [x] SubTask 7.2: 确保缓存优先，UI不阻塞

- [x] Task 8: 验证和测试
  - [x] SubTask 8.1: 运行 lint 检查
  - [x] SubTask 8.2: 运行 typecheck 检查
  - [x] SubTask 8.3: 手动功能验证

## 任务依赖

- Task 1 (PollingManager) 是 Task 2 的前置依赖
- Task 3 可独立进行
- Task 4 依赖 Task 2 完成后的代码结构
- Task 5 依赖 Task 1 的 RAF 实现
- Task 6 依赖所有其他任务完成后的配置汇总
- Task 7 依赖 Task 3
- Task 8 在所有任务完成后执行

## 并行执行建议

以下任务可以并行执行：
- Task 1, Task 3, Task 6 可以并行开发
- Task 4 可以在 Task 2 开始后独立进行
- Task 5 可以在 Task 1 后独立进行
