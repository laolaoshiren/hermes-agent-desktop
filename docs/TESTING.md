# Testing

真实 Hermes Agent 桌面 GUI / sidecar 控制台的测试说明。  
_Testing notes for the real Hermes Agent desktop GUI and sidecar console._

## 目标

这个仓库的测试重点是验证三件事：

- 桌面构建是否真的把 Hermes sidecar、Web 资源和 Electron GUI 串起来。
- Hermes Dashboard 与 Gateway API 是否能在本地被启动、探活并被 GUI 使用。
- 打包产物、GitHub 工作流与 Release 资产是否可交付。

## 本地前置条件

- Node.js 24+
- npm 11+
- Windows：仓库内 `runtime/python` 应可用
- macOS / Linux：需要 `python3.11`，用于初始化 `runtime/python`
- 首次执行 `npm run build` 时会准备 Python 依赖并构建 vendored Hermes Web 资源

## 命令入口

```bash
npm run build
npm run smoke
npm run test:e2e
npm run test:local
npm run test:package:win
npm run test:github
```

## 覆盖范围

### `npm run build`

作用：

- 运行 `scripts/bootstrap-hermes-runtime.mjs`
- 为 sidecar 准备 Python 依赖与 patched gateway 文件
- 运行 `scripts/build-hermes-web.mjs`
- 构建 vendored Hermes Web 产物
- 编译 `packages/shared`
- 编译 `packages/runtime-manager`
- 编译 `apps/desktop/frontend`
- 编译 `apps/desktop/electron`

通过标准：

- `runtime/python` 可被桌面端和打包产物使用
- `vendor/hermes-agent/hermes_cli/web_dist` 已生成
- Electron 主进程与前端 bundle 编译成功

### `npm run smoke`

作用：

- 创建临时数据目录
- 使用 `createRuntimeManager()` 启动 Hermes sidecar
- 启动 Hermes Dashboard
- 启动 Hermes Gateway API
- 请求 Dashboard `/api/status`
- 请求 Gateway `/health`
- 停止 sidecar 并清理临时目录

通过标准：

- Dashboard 返回 `200`
- Gateway health 返回 `200`
- sidecar 可完整启动与退出

这一步验证的是真实 Hermes sidecar 探活，不是静态页面检查。

### `npm run test:e2e`

作用：

- 创建临时数据目录
- 启动 Hermes sidecar
- 调用 `POST /v1/runs`
- 使用 `GET /v1/runs/{run_id}/events` 读取 SSE
- 期待至少一个终态事件：`run.completed` 或 `run.failed`
- 停止 sidecar 并清理临时目录

通过标准：

- `/v1/runs` 可创建真实任务
- SSE 可持续返回事件
- 最终能收到 Hermes 运行终态

这一步验证的是真实 runs API 与事件流链路。

### `npm run test:local`

作用：

- 顺序执行 `npm run build`
- 顺序执行 `npm run smoke`
- 顺序执行 `npm run test:e2e`

适用场景：

- 提交前的本地回归
- 调整 Electron / runtime-manager / GUI 交互后的完整自检

### `npm run test:package:win`

作用：

- 构建或复用 Windows release 目录
- 生成 `setup.exe` 与 `portable.exe`
- 检查 `app.asar` 是否包含 Electron 主进程与前端 bundle
- 检查 `app.asar.unpacked` 是否包含 `runtime/python/python.exe`
- 检查 `app.asar.unpacked` 是否包含 Hermes Dashboard `web_dist`
- 静默安装安装版
- 启动安装版并检查不会立刻退出
- 启动便携版并检查不会立刻退出

通过标准：

- Windows 安装包与便携版都能生成
- 打包后的 sidecar 运行时与 Dashboard 资源都在正确位置
- 安装版、便携版都能成功启动

### `npm run test:github`

作用：

- 验证 GitHub 仓库、tag、Release 与工作流状态
- 检查 Windows / macOS / Linux 资产是否齐全
- 检查 README 中引用的媒体资源是否可访问

可选环境变量：

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TAG`
- `GITHUB_TOKEN`

公开仓库可匿名校验；带 `GITHUB_TOKEN` 时更稳定。

## 故障排查

### sidecar 启动失败

优先检查：

- `npm run build` 是否已经执行完成
- `runtime/python` 是否存在且可运行
- `vendor/hermes-agent/hermes_cli/web_dist` 是否已生成

### Dashboard 或 Gateway 探活失败

优先检查：

- 日志目录中的 `dashboard.log`
- 日志目录中的 `gateway.log`
- 本机端口是否被占用

### Windows 打包校验失败

优先检查：

- `release/` 或 `.package-verify-release-*` 中是否真的输出安装包
- `app.asar.unpacked` 是否保留了 `runtime/` 与 `vendor/`
- `electron-builder` 是否错误回退到默认 Electron 图标

## 建议执行顺序

```bash
npm run build
npm run smoke
npm run test:e2e
```

发布前再补充：

```bash
npm run test:package:win
npm run test:github
```
