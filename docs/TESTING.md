# Testing

## 目标

这个项目的测试分成三层：

- 本地代码构建和功能验证
- Windows 安装包级验证
- GitHub 仓库、工作流和 release 资产验证

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

验证：

- `packages/shared`
- `packages/runtime-manager`
- `packages/adapter`
- `apps/desktop/frontend`
- `apps/desktop/electron`

### `npm run smoke`

验证：

- mock OpenAI-compatible provider
- provider connection test
- SSE 流式消息返回
- 文本附件被真正带入模型请求

### `npm run test:e2e`

验证：

- `/bootstrap-state`
- `/settings/provider`
- `/settings/provider/test`
- `/settings/app`
- `/capabilities`
- `/sessions` 创建、更新、删除、消息读取
- `/attachments/prepare`
- `/attachments/commit`
- `/attachments/:id`
- `/sessions/:id/messages` 流式发送
- `/sessions/:id/messages/:messageId/cancel`
- `/health`
- `/status/runtime`
- `/diagnostics/export`
- `/updates/state`
- `/updates/check`
- `/updates/download`
- `/updates/install`
- `/updates/toggle-auto`

### `npm run test:package:win`

验证：

- 生成 Windows `setup.exe`
- 生成 Windows `portable.exe`
- `app.asar` 内关键依赖未被错误裁剪
- 静默安装到临时目录
- 安装版应用可以启动
- 便携版应用可以启动
- 打包日志未退回默认 Electron 图标

### `npm run test:github`

验证：

- GitHub 仓库存在且可访问
- release tag 存在
- release 非 draft
- Windows / macOS / Linux 资产齐全
- CI workflow 最近一次运行成功
- Release workflow 最近一次运行成功
- README 中引用的媒体资源在默认分支可访问

可选环境变量：

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TAG`
- `GITHUB_TOKEN`

公共仓库可匿名校验，但带 `GITHUB_TOKEN` 时更稳。
