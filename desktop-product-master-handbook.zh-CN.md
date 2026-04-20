# 跨平台桌面 AI 产品总手册

**文档类型**: 主规范 / 开发手册 / 产品规划 / 架构约束 / 交接文档  
**状态**: 可直接执行  
**适用对象**: 新的 AI 开发者、工程实现代理、后续维护者  
**语言**: 中文  
**来源**: 本文档是当前项目的唯一完整上下文来源，默认读者没有任何额外聊天记录；本文已内置产品目标、工程方案、执行打法、团队配置、预算估算、维护策略与外部参考资料。  
**目标**: 基于 `NousResearch/hermes-agent` 内核，实现一个独立品牌的跨平台桌面 AI 产品。  

---

## 1. 最高优先级说明

这不是一个“给 Hermes 做图形外壳”的任务，而是一个“基于 Hermes 内核能力构建独立桌面产品”的任务。

### 1.1 最核心定义

最终交付物必须满足以下产品认知：

1. 对最终用户来说，这是一款独立桌面产品，不是 Hermes 的 GUI 套壳。
2. 用户在视觉、操作、文案、命令、系统信息、更新流程上都不应感知到 Hermes。
3. Hermes 只是底层运行时之一，产品层必须与其内部实现解耦。
4. 第一版的核心价值是：
   - 安装即拥有运行环境
   - 首次只需配置模型
   - 之后双击即可用
5. 桌面产品需要支持：
   - Windows
   - macOS
   - Linux
6. UI 风格与交互体验应接近 Codex 桌面版的“简洁工作台”模式，但不能 1:1 复制视觉细节或品牌表达。

### 1.2 冲突时的优先级

如果开发过程中出现冲突，优先级如下：

1. 本文档的产品目标
2. 本文档的架构边界
3. 本文档的用户体验要求
4. 本文档的 MVP 范围
5. Hermes 当前已有实现

### 1.3 不允许的误解

不要把本任务理解为以下任一方向：

- 直接把 Hermes 当前 Web UI 套进 Electron
- 把 Hermes CLI/TUI 原样嵌入桌面窗口
- 做一个面向技术人员的“运维控制台”
- 让最终用户继续通过 slash 命令作为主交互
- 让用户直接感知 Hermes 品牌、目录、更新、错误语义

---

## 2. 项目定位

### 2.1 产品定位

本产品是一个独立品牌的跨平台桌面 AI 工作台，提供以下主流程能力：

- 聊天会话
- 模型与供应商配置/切换
- 工具/技能开关
- 文件/图片附加
- 会话历史
- 基本状态页
- 在线更新
- 主题与语言设置

### 2.2 第一版的关键定义

第一版不是“零配置即可开始聊天”，而是：

- 零环境配置
- 一次模型配置
- 之后长期开箱即用

换句话说：

- 用户不需要安装 Python、Node、Git、WSL 或任何开发环境
- 用户第一次打开软件时，只需要完成模型配置
- 模型配置成功后，后续使用不再依赖命令行

### 2.3 用户画像

#### 主用户

- 普通桌面用户
- 不懂编程环境
- 不愿意使用命令行
- 能接受填写模型 API Key 或模型服务地址

#### 次用户

- 有一定技术背景
- 希望有会话历史、附件、工具开关、更新等能力
- 也更希望使用图形界面而不是 CLI

### 2.4 非目标

第一版不以以下方向为目标：

- Hermes 全量功能桌面化
- 复杂消息网关管理平台
- 插件开发工作台
- 研究训练控制台
- 面向专家用户的所有高级参数暴露
- 本地大模型离线分发
- 自带商业云模型

---

## 3. 当前上游项目审计结论

上游项目是 `NousResearch/hermes-agent`。

### 3.1 已确认的技术基础

当前 Hermes 仓库具备如下基础能力：

- Python 主后端
- CLI
- TUI
- Web server
- Web dashboard
- 模型供应商配置
- 会话、工具、技能等能力

### 3.2 当前 Hermes 可复用资产

应优先复用：

- 会话与消息相关能力
- 模型配置能力
- Provider 接入能力
- 工具与技能能力
- 配置读写逻辑
- 运行状态获取能力
- 部分文件/图片附加处理能力
- Hermes 现有 Web server 的某些后端思路

### 3.3 当前 Hermes 不适合作为最终产品直接暴露的部分

不适合直接暴露给最终用户：

- Hermes 品牌
- Hermes 原始 Web dashboard 风格
- CLI/TUI 的 slash 命令主交互
- YAML 原始配置编辑
- systemd/launchd/gateway 等内部概念
- 原始错误文案与内部字段
- `.hermes` 目录名

### 3.4 关于 Windows 支持的现实结论

必须明确：

- Hermes 当前并不是一个原生 Windows 官方支持产品
- Hermes 对 Windows 有一定兼容处理，但主支持方向是 Linux、macOS、WSL2
- 因此本桌面产品必须设计自己的适配层，而不能直接假设 Hermes 内部跨平台完全一致

这意味着：

- UI 可以共享
- 业务逻辑可以大比例共享
- 平台差异代码必须存在，并集中收口在适配层

---

## 4. 总体策略

### 4.1 正确策略

本项目必须采用：

**Hermes 核心复用 + 桌面产品层重写 + 桌面基础设施借用成熟生态**

### 4.2 错误策略

不要采用以下任一策略：

1. 完全从零重写内核
2. 直接魔改 Hermes 当前 Web UI 成最终产品
3. 把 Hermes CLI/TUI 直接嵌入桌面窗口
4. 照搬其他开源桌面产品 UI 并替换名字

### 4.3 最终原则

对新的 AI 开发者来说，应该始终记住：

> 产品层必须独立，Hermes 只能作为底层 runtime，不得成为最终用户感知的产品实体。

---

## 5. 架构分层

必须严格分为 4 层。

### 5.1 第 1 层: Upstream Hermes 层

职责：

- 存放 Hermes 上游代码
- 尽量少改
- 作为内核能力基础
- 定期从官方同步

要求：

- 不要在这里堆积桌面产品逻辑
- 不要让产品 UI 直接依赖这里的内部模块

### 5.2 第 2 层: Runtime 集成层

职责：

- 启动和管理 Hermes runtime
- 处理数据目录初始化
- 处理配置迁移
- 提供运行健康检查
- 管理 Hermes 版本与 runtime 包

### 5.3 第 3 层: Desktop Adapter 层

职责：

- 作为桌面产品和 Hermes 之间的稳定边界
- 对外提供稳定本地 API
- 对 Hermes 内部变动做兼容与映射
- 做品牌术语转换
- 吸收未来 Hermes 上游结构变化
- 管理 App 更新与 Runtime 更新状态

### 5.4 第 4 层: Desktop Product UI 层

职责：

- 提供所有最终用户界面
- 不感知 Hermes 内部结构
- 只调用 Adapter 提供的稳定接口
- 承担独立品牌表达

### 5.5 架构铁律

桌面 UI 不允许：

- 直接 import Hermes 内部 Python 模块
- 直接依赖 Hermes 原始 Web UI 页面结构
- 直接消费 Hermes 原始响应对象

---

## 6. 技术选型

### 6.1 桌面壳

首选：**Electron**

理由：

- 跨平台稳定
- 生态成熟
- 自动更新成熟
- 与 Python sidecar 协作更稳定
- 安装器生态完善
- 更适合“安装即用”的产品方案

### 6.2 前端

建议：

- React
- TypeScript
- 独立于 Hermes 现有 Web UI 的新产品前端工程

### 6.3 状态管理

建议：

- Zustand 或 Redux Toolkit
- React Query / TanStack Query 处理请求与缓存

### 6.4 后端集成方式

建议：

- Electron 主进程负责拉起本地 adapter/service
- adapter/service 负责拉起 Hermes runtime
- UI 通过本地 HTTP/WebSocket 与 adapter 交互

### 6.5 运行时分发

安装包必须自带：

- Electron 应用
- 前端静态资源
- Python runtime
- Hermes runtime
- Adapter/service
- 基础依赖

---

## 7. 推荐仓库结构

建议采用 monorepo，示例如下：

```text
product-root/
  apps/
    desktop/
      electron/
        main/
        preload/
      frontend/
        src/
        public/
  packages/
    shared/
      src/
        branding/
        constants/
        i18n/
        types/
    adapter/
      src/
        api/
        mapping/
        runtime/
        update/
        diagnostics/
    runtime-manager/
      src/
        bootstrap/
        hermes/
        migration/
        health/
  vendor/
    hermes-agent/
  scripts/
    build/
    release/
    sync-upstream/
  docs/
    product/
    engineering/
```

### 7.1 最小要求

即使不完全采用以上结构，也必须满足：

- UI 与 Hermes 内核分离
- Adapter 独立存在
- 品牌配置独立存在
- 更新机制独立存在
- 上游同步脚本独立存在

---

## 8. 品牌抽象规范

### 8.1 目标

未来产品必须可以完全去 Hermes 感知。因此从第一版开始，就必须建立品牌抽象层。

### 8.2 必须建立的品牌配置

建议定义统一品牌配置对象：

```ts
interface BrandConfig {
  productName: string
  productShortName: string
  vendorName: string
  runtimeDisplayName: string
  dataDirName: string
  cacheDirName: string
  logsDirName: string
  helpCenterName: string
  stableChannelName: string
  betaChannelName: string
}
```

### 8.3 初始实现要求

如果正式产品品牌尚未确定，开发时必须使用占位变量，不要把 `Hermes` 硬编码到各处。

例如：

- `PRODUCT_NAME`
- `PRODUCT_SHORT_NAME`
- `PRODUCT_VENDOR`
- `PRODUCT_DATA_DIR`

### 8.4 用户可见层禁止出现

以下内容默认禁止出现在最终用户界面：

- Hermes
- Hermes Agent
- Nous Research
- `.hermes`
- `hermes update`
- `gateway`
- `runtime=hermes`
- Hermes 原始 banner / logo / 标题

### 8.5 可以保留 Hermes 的位置

仅允许在以下位置保留 Hermes 相关归属：

- 第三方许可证页
- 法律信息页
- 开发文档
- 调试模式
- 内部日志

---

## 9. MVP 功能范围

### 9.1 第一版必须实现

#### 9.1.1 聊天主流程

必须支持：

- 新建聊天
- 发送消息
- 显示回复
- 流式输出
- 中止生成
- Markdown 渲染
- 会话标题显示

#### 9.1.2 会话能力

必须支持：

- 会话列表
- 会话搜索
- 切换会话
- 删除会话
- 重命名会话
- 最近会话排序

#### 9.1.3 模型配置

必须支持：

- 首次模型配置引导
- 选择模型服务商
- 输入 API Key
- 输入 Base URL（如需要）
- 输入模型名
- 测试连接
- 保存并设为默认

#### 9.1.4 工具/技能开关

必须支持：

- 展示工具列表
- 启用/禁用工具
- 展示技能列表
- 启用/禁用技能
- 简短描述说明

#### 9.1.5 文件/图片附加

必须支持：

- 选择文件上传
- 选择图片上传
- 拖拽上传
- 上传失败提示

建议支持：

- 剪贴板粘贴图片

#### 9.1.6 设置页

必须支持：

- 模型设置
- 语言设置
- 主题设置
- 自动更新开关
- 手动检查更新
- 打开数据目录
- 导出日志

#### 9.1.7 更新

必须支持：

- 自动更新开关
- 后台检查更新
- 后台自动下载
- 下载完成后提示“一键更新”
- 手动检查更新
- 手动下载更新

#### 9.1.8 状态页

必须支持：

- 当前应用版本
- 当前内核版本
- 当前模型信息
- 基本健康状态
- 当前更新状态

### 9.2 第一版允许隐藏到高级设置

以下功能不是第一版主流程，不应默认暴露：

- MCP 深度配置
- 消息网关接入
- cron 自动任务
- 插件开发入口
- 原始 YAML 配置编辑
- 开发者命令面板的复杂能力

### 9.3 第一版明确不做

不做：

- 内置商业模型
- 本地模型离线大包分发
- Hermes 全功能桌面化
- 面向开发者的完整调试控制台
- 大型自动化工作流系统

---

## 10. UI 总体设计规范

### 10.1 风格目标

UI 应该具有以下特征：

- 简洁
- 现代
- 主流程聚焦聊天
- 高级设置二级收纳
- 信息层级清晰
- 类似 Codex 桌面版的“工作台式”结构

### 10.2 不要做成什么

不要做成：

- 传统管理后台
- 仪表盘式运维面板
- 表单堆叠页面
- 终端套壳
- slash 命令主驱动产品

### 10.3 布局结构

建议整体采用：

- 左侧边栏：导航、会话、搜索
- 中央主区：聊天内容
- 顶部条：会话标题、模型状态、更新状态、设置入口
- 底部输入区：输入框、附件、发送按钮
- 右侧抽屉或弹层：模型设置、工具/技能、状态、更新

### 10.4 页面清单

必须具备：

1. 欢迎页 / 首启页
2. 模型配置向导页
3. 主聊天页
4. 会话列表
5. 工具/技能页
6. 设置页
7. 状态页
8. 更新页或更新弹层

---

## 11. 交互规范

### 11.1 交互总原则

- 用户通过图形界面完成主流程
- 命令不应成为主入口
- 高级功能必须收纳，不打断普通用户

### 11.2 输入框规范

必须支持：

- 多行输入
- Enter / Shift+Enter 明确区分
- 文件拖拽
- 图片附加
- 发送中切换为停止
- 高 DPI 下布局稳定

### 11.3 会话体验

必须支持：

- 快速切换
- 搜索
- 删除确认
- 重命名
- 空状态引导

### 11.4 工具和技能体验

应做成：

- 简单开关
- 搜索与分类
- 清晰描述
- 当前启用状态一目了然

### 11.5 错误提示风格

对用户提示必须：

- 简短
- 行为导向
- 不输出内部堆栈
- 不使用 Hermes 内部术语

例如：

- “模型连接失败，请检查 API Key 或网络”
- “聊天记录加载失败，请稍后重试”
- “后台服务暂时不可用，正在尝试恢复”

---

## 12. 响应式、自适应与缩放规范

### 12.1 总要求

必须支持：

- 1366x768 可用
- 1920x1080 最佳
- 2K/4K 正常显示
- Windows 125% / 150% / 175% 缩放
- macOS Retina
- Linux 不同 DPI

### 12.2 实现原则

- 不依赖固定像素布局
- 使用 CSS 变量和设计 token
- 字号、边距、边栏宽度可调
- 小屏时右侧面板折叠
- 大屏时支持抽屉/侧栏展开

### 12.3 字体要求

必须处理：

- 中文字体回退
- 中英混排
- 代码块等宽字体
- emoji/符号对齐

---

## 13. 首次启动流程

### 13.1 目标

第一次启动时，用户只需完成最少步骤即可进入产品主流程。

### 13.2 首启标准流程

1. 启动应用
2. 自动拉起本地 adapter 与 runtime
3. 进行基础健康检查
4. 若未配置模型，则进入模型配置向导
5. 测试连接成功后保存配置
6. 自动进入主聊天页

### 13.3 首启向导应包含的最少设置

主流程只强制要求：

- 选择模型服务商
- 输入 API Key
- 输入模型名或选择推荐模型
- 测试连接

可选轻量项：

- 语言
- 主题
- 自动更新开关

### 13.4 首启异常路径

必须存在图形化恢复路径，不允许只输出报错文本。

需要覆盖：

- 无网络
- API Key 错误
- 模型名错误
- 提供商超时
- 后端启动失败
- 本地配置目录损坏

---

## 14. 模型配置设计

### 14.1 第一版模型策略

第一版不做内置商业模型。

第一版只允许用户配置自己的模型服务。

### 14.2 推荐支持的模型来源

优先支持：

- OpenAI
- OpenRouter
- Anthropic
- OpenAI-compatible endpoint
- 本地模型 endpoint（后续可增强）

### 14.3 配置字段

最少字段：

- provider
- apiKey
- baseUrl（可选）
- modelName

高级字段隐藏或放高级设置：

- reasoning 级别
- timeout
- fallback
- advanced routing

### 14.4 连接测试

必须实现：

- 一键测试连接
- 成功/失败状态反馈
- 保存前验证

---

## 15. 数据目录与本地存储

### 15.1 原则

产品必须使用自己的用户数据目录命名，不应让普通用户看到 `.hermes` 作为主感知目录。

内部可以映射 Hermes 结构，但用户感知目录必须使用产品品牌。

### 15.2 建议存储内容

- 会话数据
- 模型配置
- 应用设置
- 工具/技能启停状态
- 缓存
- 日志
- 更新状态数据

### 15.3 迁移要求

后续必须支持：

- 从已有 Hermes 配置迁移
- 从旧版本桌面应用迁移

第一版至少要保留迁移接口设计位置。

---

## 16. Runtime 管理与进程托管

### 16.1 产品必须自带运行环境

安装后不依赖用户预装：

- Python
- Node
- Git
- WSL

### 16.2 运行时构成

安装包内必须包含：

- Electron app
- 前端静态资源
- Python runtime
- Hermes runtime
- Adapter/service
- 基础依赖

### 16.3 启动流程

应用启动时应当：

1. 初始化产品目录
2. 检查 runtime 完整性
3. 启动 adapter/service
4. adapter 启动 Hermes runtime
5. 进行健康检查
6. UI 连接 adapter

### 16.4 进程管理要求

必须支持：

- 后端自动拉起
- 后端异常退出自动恢复
- 正常关闭时平滑停止
- 更新前安全停机
- 日志记录

---

## 17. Adapter 稳定 API 规范

### 17.1 原则

桌面 UI 只能依赖 Adapter API。

UI 不得消费 Hermes 原始内部结构。

### 17.2 建议的 Adapter API 范围

#### App

- `getAppInfo()`
- `getHealthStatus()`

#### Session

- `listSessions()`
- `createSession()`
- `getSession(sessionId)`
- `renameSession(sessionId, title)`
- `deleteSession(sessionId)`
- `searchSessions(query)`

#### Chat

- `sendMessage(sessionId, payload)`
- `stopMessage(sessionId)`
- `attachFile(sessionId, fileMeta)`
- `attachImage(sessionId, imageMeta)`

#### Model

- `listProviders()`
- `getModelConfig()`
- `testModelConnection(config)`
- `saveModelConfig(config)`
- `switchModel(sessionId, config)`

#### Tools / Skills

- `listTools()`
- `toggleTool(toolId, enabled)`
- `listSkills()`
- `toggleSkill(skillId, enabled)`

#### Settings

- `getSettings()`
- `saveSettings()`

#### Updates

- `checkForUpdates()`
- `getUpdateState()`
- `downloadUpdate()`
- `applyUpdate()`

#### Diagnostics

- `exportLogs()`
- `openDataDirectory()`

### 17.3 数据映射规则

所有返回数据必须经过：

- 字段清洗
- 品牌转换
- 术语转换
- 向后兼容映射

---

## 18. 更新系统总设计

### 18.1 用户体验目标

更新体验参考 VS Code。

### 18.2 用户可见流程

#### 自动更新开启时

- 应用后台检查更新
- 检测到新版本后自动下载
- 下载完成后提示“点击更新”
- 用户点击“立即更新并重启”

#### 自动更新关闭时

- 用户手动点击“检查更新”
- 检测到更新后手动下载
- 下载完成后手动点击“立即更新并重启”

### 18.3 内部必须区分两种更新

虽然用户界面上是一个更新入口，但内部必须拆两层：

#### 1. App 更新

包含：

- Electron 主程序
- 前端 UI
- Adapter 层

#### 2. Runtime 更新

包含：

- Hermes runtime
- 运行时兼容逻辑
- 中文资源覆盖
- 已验证的集成版本

### 18.4 重要规则

用户不能直接更新到 Hermes 官方最新上游版本。

用户只能更新到：

> 由本产品发布、经过验证的 runtime 版本

### 18.5 更新设置区要求

设置页应提供：

- 自动更新开关
- 当前应用版本
- 当前内核版本
- 当前更新状态
- 检查更新
- 立即更新并重启
- 查看更新说明

### 18.6 更新失败恢复

必须支持：

- hash 校验
- 包完整性检查
- 原子替换
- 安装失败回滚
- 运行时不兼容回滚
- 更新后健康检查失败回滚

---

## 19. 上游 Hermes 同步策略

### 19.1 风险说明

如果桌面产品直接绑定 Hermes 内部实现，上游更新后很容易出现无法对接的问题。

因此必须从第一天开始设计解耦。

### 19.2 正确流转

必须采用：

1. 官方 Hermes upstream 更新
2. 本产品集成仓库同步 upstream
3. 跑 adapter 兼容测试
4. 跑产品回归测试
5. 通过后生成 runtime 包
6. 提供给最终用户的桌面更新系统

### 19.3 禁止做法

禁止：

- 用户端直接跟 Hermes upstream 同步
- 用户端直接 `git pull` 官方仓库
- 桌面 UI 直接依赖 Hermes 内部页面或内部字段

### 19.4 版本分层

必须分离版本：

- App Version
- Runtime Version
- Hermes Upstream Base Version
- Adapter API Version

示例：

- App: `1.0.3`
- Runtime: `1.0.3-r2`
- Hermes Base: `0.10.0+commit`
- Adapter API: `v1`

### 19.5 兼容测试最少覆盖

每次同步 upstream 后，至少测试：

- 首启流程
- 模型配置
- 发送消息
- 会话列表
- 模型切换
- 文件附加
- 图片附加
- 工具/技能开关
- 更新流程

---

## 20. 用户层去 Hermes 感知规范

### 20.1 目标

用户在以下层面不应感知 Hermes：

- 视觉
- 操作
- 术语
- 命令
- 系统信息
- 更新提示
- 错误提示

### 20.2 视觉层

必须替换：

- 应用名
- 图标
- 启动页
- 窗口标题
- 关于页
- 更新页标题
- 设置页标题
- 空状态页文案

### 20.3 操作层

主流程必须是图形交互，而不是命令交互。

不要让用户默认接触：

- `/help`
- `/model`
- `/skills`
- `/tools`

如果以后保留命令能力，应只存在于：

- 高级模式
- 开发者模式
- 命令面板

### 20.4 术语层

建议映射如下：

- session -> 聊天 / 会话
- toolsets -> 工具
- skills -> 技能 / 能力
- provider -> 模型服务商
- gateway -> 不对普通用户暴露
- cron -> 自动任务
- runtime -> 内核（如有必要）或完全隐藏

### 20.5 系统信息层

不能直接向用户暴露：

- `.hermes`
- `hermes-agent`
- `hermes_cli`
- `web_server.py`
- Hermes runtime

### 20.6 错误层

不能直接显示：

- `config.set failed`
- `session.list invalid response`
- `gateway restart failed`

必须转换为用户语言：

- 配置保存失败
- 聊天记录加载失败
- 后台服务启动失败，请稍后重试

---

## 21. 平台适配要求

### 21.1 总原则

目标是“一套主代码库，多平台打包”，而不是“完全无平台差异”。

### 21.2 平台差异应集中在适配层

差异主要包括：

- 路径
- 安装目录
- 数据目录
- 字体
- 剪贴板
- 文件选择
- 更新器
- 进程守护
- 某些 Hermes 底层能力

### 21.3 平台矩阵（第一版）

| 功能 | Windows | macOS | Linux |
|---|---|---|---|
| 安装与启动 | 必须 | 必须 | 必须 |
| 首次模型配置 | 必须 | 必须 | 必须 |
| 聊天主流程 | 必须 | 必须 | 必须 |
| 会话历史 | 必须 | 必须 | 必须 |
| 文件附加 | 必须 | 必须 | 必须 |
| 图片附加 | 必须 | 必须 | 必须 |
| 工具/技能开关 | 必须 | 必须 | 必须 |
| 自动更新 | 必须 | 必须 | 必须 |
| 高 DPI/Retina 适配 | 必须 | 必须 | 必须 |
| 高级 Hermes 全能力 | 后续 | 后续 | 后续 |

---

## 22. 安全与隐私要求

### 22.1 API Key 存储

第一版必须至少做到：

- 明确存储位置
- UI 显示时脱敏
- 日志中不得输出明文 key
- 导出诊断包时自动脱敏

后续建议支持：

- 系统凭据管理器
- 更安全的加密存储

### 22.2 更新安全

必须支持：

- HTTPS
- 更新源校验
- hash 校验
- 后续增加签名校验

### 22.3 工具安全边界

Hermes 具备工具能力，桌面版第一版需要收敛默认暴露面。

要求：

- 默认只开启安全核心能力
- 高风险能力必须放到高级设置
- 后续若暴露 shell 或更强能力，必须加权限确认机制

---

## 23. 错误恢复与诊断

### 23.1 必须具备图形化恢复能力

不能只记录错误，必须让用户可恢复。

至少支持：

- 后端崩溃自动重启
- 恢复上次会话
- 导出诊断包
- 更新失败恢复
- 模型配置失败重试

### 23.2 错误页要求

错误页必须提供：

- 问题说明
- 可执行动作
- 重试按钮
- 打开设置按钮
- 导出日志按钮

不能直接把技术堆栈甩给用户。

---

## 24. 打包与分发要求

### 24.1 第一版目标

纯净电脑上安装后即可运行。

### 24.2 打包产物

必须包括：

- 应用本体
- 前端资源
- Hermes runtime
- Python runtime
- Adapter/service
- 初始配置模板

### 24.3 平台分发形式

建议：

#### Windows

- `.exe` 安装器

#### macOS

- `.dmg` 或 `.pkg`

#### Linux

- `AppImage`

### 24.4 第一版允许暂缓的部分

可后补：

- 代码签名优化
- 安装包体积极致优化
- Linux 多发行版深度适配
- 应用商店分发

---

## 25. QA 与测试要求

### 25.1 必须建立的测试层级

#### 单元测试

- UI 关键状态逻辑
- Adapter 映射逻辑
- 更新状态机

#### 集成测试

- 首启流程
- 模型配置
- 聊天主流程
- 会话历史
- 文件/图片附加

#### 端到端测试

- 安装后启动
- 首次配置模型
- 成功进入聊天
- 自动更新流程

### 25.2 回归测试最少项

每次 runtime 或 UI 变更后必须验证：

- 安装与启动
- 模型配置
- 发送消息
- 中止生成
- 会话切换
- 工具/技能切换
- 文件附加
- 更新检测

---

## 26. 版本路线规划

本项目不是只有一个模糊的“后面慢慢做”的版本概念，而必须明确划分：

- 第一版
- 第二版
- 最终版

新的 AI 开发者必须严格按照版本边界实施，不得把后续版本需求提前塞进第一版，导致产品复杂化和延期。

### 26.1 第一版: 可安装可使用的独立桌面基础版

**版本目标**

第一版的唯一目标是：

> 在纯净电脑上安装完成后，用户双击打开软件，只需完成一次模型配置，就能开始稳定使用聊天主流程。

**第一版必须解决的问题**

- 安装后拥有运行环境
- 应用可以正常启动
- 首次模型配置清晰可用
- 聊天主流程可用
- 会话历史可用
- 文件/图片附加可用
- 工具/技能开关可用
- 设置页可用
- 自动更新和手动更新可用
- 用户界面不暴露 Hermes

**第一版必须交付的能力**

- 独立品牌应用名称、图标、标题栏
- 首启向导
- 模型服务商配置
- API Key / Base URL / 模型名配置
- 模型连接测试
- 主聊天页
- 会话列表与会话切换
- 会话搜索
- 会话删除与重命名
- 文件附加
- 图片附加
- 工具开关
- 技能开关
- 主题切换
- 语言切换
- 状态页
- 设置页
- 自动更新开关
- 手动检查更新
- 自动后台下载更新
- 下载完成后一键更新
- 更新失败恢复
- 后端崩溃后的基础恢复
- 日志导出

**第一版允许暂时不完美但必须可用的部分**

- 安装包签名和平台分发细节可以先弱化
- 安装包体积可以暂不极致优化
- Linux 多发行版兼容可以先优先保证主流环境
- 诊断与恢复可以先做基础版
- 数据迁移可以只预留接口，不强制完整实现

**第一版明确不做**

- 内置商业云模型
- 本地模型大包离线分发
- MCP 深度配置
- 复杂消息网关接入
- cron 自动任务主界面
- 插件开发入口
- 原始 YAML 编辑
- 面向普通用户的命令系统
- 全 Hermes 高级能力桌面化

**第一版完成标准**

满足以下条件才算第一版完成：

1. 纯净电脑安装成功
2. 不需要用户预装环境
3. 首次只需配置模型
4. 配置成功后直接可聊天
5. 更新功能可用
6. 主流程不依赖命令行
7. 用户界面不出现 Hermes 品牌

### 26.2 第二版: 稳定增强版

**版本目标**

第二版的目标是：

> 在第一版可用的基础上，把产品从“能用”提升到“可长期稳定使用”，并增强跨平台一致性、可恢复性和可维护性。

**第二版重点**

- 稳定性
- 数据迁移
- 包装完善
- 更强的恢复能力
- 更完整的跨平台体验
- 更新系统成熟化

**第二版建议新增能力**

- 导入已有 Hermes 配置与历史
- 更完整的数据目录管理
- 更完善的崩溃恢复
- 会话固定
- 会话内容搜索
- 剪贴板图片粘贴
- 更好的附件上传状态反馈
- 更完整的更新说明展示
- 更新通道（稳定版 / 测试版）
- 更新回滚增强
- 更完整的诊断包导出
- 更清晰的模型管理页
- 更好的工具/技能搜索与分组
- 高级设置入口
- 平台差异能力更明确的适配矩阵
- 更好的高 DPI / Retina / Linux 字体适配

**第二版应当补齐的工程能力**

- 完整的 CI/CD 构建链路
- 更完整的安装器策略
- 更可靠的 runtime 包版本管理
- 更严格的 adapter 契约测试
- 更细的错误码与错误映射体系
- 更清晰的 App 版本和 Runtime 版本显示
- 更完善的产品品牌抽象层

**第二版仍然不应默认开放的内容**

- 给普通用户的原始命令面板
- 复杂开发者控制台
- 高风险工具默认开启
- 完整自动化工作流系统
- 所有高级 Hermes 配置项原样暴露

**第二版完成标准**

满足以下条件才算第二版完成：

1. 第一版能力全部稳定
2. 更新和回滚更可靠
3. 会话与模型管理体验明显提升
4. 导入与迁移路径存在
5. 三端基础体验差距缩小
6. 诊断和恢复能力达到可运维水平

### 26.3 最终版: 成熟独立产品版

**版本目标**

最终版的目标是：

> 将本产品交付为一个成熟的独立品牌桌面 AI 产品，底层虽基于 Hermes 内核，但用户在产品体验、品牌感知、更新体系和功能组织上完全感知不到 Hermes。

**最终版必须达到的状态**

- 品牌完全独立
- 更新体系成熟
- 上游同步机制成熟
- 平台分发成熟
- 法律信息与开源归属合规
- 用户主流程稳定顺滑
- 高级能力通过产品化方式逐步开放

**最终版建议具备的增强能力**

- 完整的签名与可信更新分发
- 更成熟的差分更新
- 更完善的异常恢复与自愈
- 更成熟的导入导出和数据备份
- 更好的可访问性
- 更强的企业/团队部署能力（如后续需要）
- 可选的高级能力中心
- 可选的自动化/任务能力
- 可选的云模型内置方案（商业化后再引入）

**最终版允许作为后续商业化基础的方向**

可以为未来预留，但不要求立即上线：

- 内置可用云模型
- 账户体系
- 商业订阅
- 多设备同步
- 更高级的任务自动化

**最终版完成标准**

满足以下条件才算最终版完成：

1. 用户完全把它视为独立产品，而不是 Hermes 变体
2. App 与 Runtime 更新完全产品化
3. 上游 Hermes 更新风险被稳定收敛在适配层
4. Windows、macOS、Linux 都具备可发布质量
5. 法律、许可证、更新、恢复、品牌等都达到长期产品维护标准

### 26.4 版本边界铁律

新的 AI 开发者必须遵守以下规则：

1. 第一版优先“可安装可用”，不追求全功能。
2. 第二版优先“稳定性和恢复能力”，不追求商业化。
3. 最终版才处理完整包装、长期分发、商业化预留。
4. 不允许把最终版需求提前塞进第一版。
5. 任何新增功能都必须先标注属于第一版、第二版还是最终版。

---

## 27. 里程碑规划

### 阶段 0: 架构落地

产出：

- Monorepo 基础结构
- Electron 壳
- 前端骨架
- Adapter 轮廓
- Runtime manager 轮廓
- 品牌配置层

### 阶段 1: 可启动 MVP

产出：

- 应用可启动
- 运行时可启动
- 首启模型配置
- 主聊天页
- 会话列表

### 阶段 2: 可用产品 MVP

产出：

- 文件/图片附加
- 工具/技能开关
- 设置页
- 状态页
- 品牌层收口
- 用户层去 Hermes 感知

### 阶段 3: 更新与稳定性

产出：

- 自动更新
- 手动更新
- 回滚机制
- 崩溃恢复
- 诊断导出

### 阶段 4: 上游同步能力

产出：

- Hermes upstream 同步脚本
- 兼容测试
- 已验证 runtime 发布流程

---

## 28. 验收标准

### 27.1 安装与首启

必须满足：

- 在纯净电脑上可以安装
- 不要求预装 Python、Node、Git、WSL
- 首次只需配置模型
- 模型配置成功后可直接聊天

### 27.2 主功能

必须满足：

- 新建聊天
- 会话切换
- 消息发送
- 文件/图片附加
- 工具/技能开关
- 设置与状态页可用

### 27.3 UI

必须满足：

- 简洁
- 非管理后台
- 高缩放下不崩
- 中文自然
- 不暴露 Hermes 品牌

### 27.4 更新

必须满足：

- 自动更新开关有效
- 可后台下载更新
- 下载完成后可一键更新
- 手动更新路径有效
- 更新失败可恢复

### 28.5 架构

必须满足：

- UI 不直接依赖 Hermes 内部结构
- 上游同步风险收敛在 adapter/runtime 层

---

## 29. 开发禁令

新的 AI 开发者不得做以下事情：

1. 直接将 Hermes 当前 Web dashboard 当作最终产品 UI
2. 让用户主流程依赖 slash 命令
3. 让 UI 直接读取 Hermes 内部配置结构
4. 让用户机器直接追官方 Hermes upstream
5. 在用户层暴露 Hermes 品牌
6. 把产品做成技术运维后台
7. 不建立 adapter 就直接耦合 Hermes 内核

---

## 30. 必须优先完成的事项

新的 AI 开发者开始开发时，必须先完成以下基础设施，而不是先画页面：

1. 品牌抽象层
2. Adapter API 轮廓
3. Runtime manager 轮廓
4. App 更新与 Runtime 更新的双层更新设计
5. 数据目录与配置目录规则
6. 首启模型配置流程

只有这些完成后，再进入完整 UI 实现。

---

## 31. 推荐实施顺序

1. 建立独立桌面工程结构
2. 建立品牌层与术语层
3. 建立 adapter 轮廓
4. 跑通 Hermes runtime 启动
5. 实现首启模型配置
6. 实现聊天主界面
7. 实现会话列表与历史
8. 实现附件
9. 实现工具/技能页
10. 实现设置页与状态页
11. 实现自动更新与手动更新
12. 实现错误恢复
13. 建立 upstream 同步与验证机制

---

## 32. 给新的 AI 开发者的直接执行指令

如果你是新的 AI 开发者，请按以下方式执行：

1. 把本文件视为唯一产品真相来源。
2. 所有实现都必须满足“用户不感知 Hermes”这一总目标。
3. 先做架构分层，再做页面。
4. 先完成最小闭环：
   - 安装后启动
   - 首启配置模型
   - 聊天
   - 会话历史
   - 更新入口
5. 不要先做高级功能。
6. 不要让任何用户可见路径依赖命令行。
7. 不要让 App 更新与 Runtime 更新混成一团。
8. 不要把 Hermes 内部术语泄露到最终用户文案。

---

## 33. 一句话产品定义

> 这是一个独立品牌的跨平台桌面 AI 产品，Hermes 只是其底层运行时；用户安装后即拥有运行环境，首次只需配置模型，之后通过简洁桌面 UI 完成全部主流程，并通过无感下载加一键安装的方式完成在线更新。

---

## 34. 第一版最快落地方案

这一章是给“必须最快落地”的执行者看的。不要泛泛而谈，不要把第二版、最终版的愿望混进第一版。

### 34.1 第一版唯一成功标准

第一版是否成功，只看这一句话：

> 在一台纯净的 Windows / macOS / Linux 电脑上，用户下载安装包，安装完成后双击打开应用，只需完成一次模型配置，即可稳定聊天，并能收到后续在线更新。

如果某个工作不直接服务于这句话，就不应该进入第一版关键路径。

### 34.2 第一版的最快技术路径

最快可行路径必须遵守以下策略：

1. **不复刻 Hermes 全量产品面**
2. **不直接复用 Hermes 原 Web UI 作为最终 UI**
3. **复用 Hermes 的运行时与业务能力，不复用其用户界面**
4. **建立自己的桌面壳、Adapter、设置体系、品牌体系与更新体系**
5. **将“上游同步”和“用户界面中文化”从第一天起设计为解耦结构**

第一版正确路径是：

1. 用 `Electron` 做桌面壳
2. 用 `React + TypeScript + Vite` 做全新桌面前端
3. 用 `Node/TypeScript` 写本地 `desktop-adapter`
4. 用打包好的 `Python runtime + Hermes runtime` 做底层执行内核
5. Electron 主进程只负责窗口、生命周期、更新、系统集成
6. `desktop-adapter` 负责：
   - 拉起 Hermes
   - 健康检查
   - 错误转换
   - 配置读写
   - 会话 / 模型 / 工具 / 技能 API 聚合
   - 去 Hermes 感知
7. UI 只调用 `desktop-adapter` 暴露的稳定本地 API，不直接依赖 Hermes 内部结构

### 34.3 第一版不允许走的“看似快，实际更慢”的歪路

以下做法短期看快，长期一定返工：

- 把 Hermes Web Dashboard 直接塞进 Electron
- 直接在桌面里跑 Hermes CLI/TUI 然后套一个终端面板
- 让 UI 直接读取 Hermes 的原始配置文件
- 为了“全中文”而直接大面积改动 vendored upstream 代码
- 为了“支持 Windows”而要求用户自行安装 Python / WSL / Node
- 为了“减少工作量”先不上更新系统
- 为了“快速交付”先忽略签名、更新、恢复、日志、错误页

这些做法都会导致：

- 上游一更新就坏
- 汉化失效
- Windows 体验不可控
- 发布后无法维护
- 最终不得不重写

### 34.4 第一版范围冻结

第一版只做以下范围：

- 独立品牌桌面应用
- Windows / macOS / Linux 一套源码
- 首启向导
- 模型 / 供应商设置
- 连接测试
- 聊天会话主界面
- 会话历史
- 文件 / 图片附加
- 工具 / 技能开关
- 状态页
- 设置页
- 自动更新开关
- 手动检查更新
- 自动后台下载 + 一键安装更新
- 基础错误恢复
- 基础日志导出
- 全中文用户可见文案
- 用户层完全去 Hermes 感知

### 34.5 第一版明确延后到第二版及以后

以下内容必须延后，不能偷塞进第一版：

- 内置商业模型
- 账号系统
- 登录系统
- 多设备同步
- RAG / 知识库中心
- 插件市场
- 高级任务编排
- 面向普通用户的命令系统
- 完整 MCP 图形配置器
- 本地模型下载器与模型市场
- 团队协作能力
- 企业管理后台
- 高级权限体系
- 丰富可视化分析页
- 复杂主题系统

### 34.6 第一版技术裁剪原则

第一版的裁剪原则不是“能省就省”，而是“保住闭环，砍掉外围”。

必须保住的闭环：

1. 安装
2. 启动
3. 首次模型配置
4. 发起聊天
5. 会话保存与切换
6. 文件 / 图片附加
7. 更新
8. 错误恢复

可以裁掉复杂度但不能裁掉入口的部分：

- 工具/技能页可以先做简单列表，不必做复杂标签体系
- 状态页可以先做基础状态，不必做监控大盘
- 设置页可以先分 4 到 6 个基础分组，不做超细拆分
- 更新说明可以先做文本列表，不必做花哨发布页
- 诊断包可以先导出日志和版本信息，不必一步到位采集全量系统快照

### 34.7 第一版可降级策略

若时间或资源明显不足，按以下顺序降级：

第一优先级不能降级：

- 安装后可启动
- 首启模型配置
- 中文 UI
- 聊天主流程
- 会话历史
- 更新机制

第二优先级允许简化：

- 工具/技能页由复杂分组改为简单列表
- 状态页由多卡片改为单页状态摘要
- 日志导出由可选范围改为一键导出
- 主题由多主题改为 `浅色 / 深色 / 跟随系统`

第三优先级允许延后：

- 会话搜索
- 会话固定
- 更精细的诊断页
- 更多快捷键
- 更丰富的设置说明

### 34.8 第一版验收清单

新的 AI 开发者必须把以下清单当成发布门槛，而不是建议项。

安装层：

- Windows 安装包可以在没有 Python / Node / Git / WSL 的机器上安装
- macOS 安装包可以在没有开发环境的机器上安装
- Linux 安装包可以在主流发行版上启动

启动层：

- 应用双击后 10 秒内进入可交互状态
- 首次启动如果未配置模型，直接进入向导
- 已配置模型时，不再要求用户进入命令行

主流程：

- 可以创建新会话
- 可以发送消息
- 可以中断生成
- 可以查看历史会话
- 可以切换会话
- 可以附加文件
- 可以附加图片

设置层：

- 可以配置 API Key / Base URL / 模型名
- 可以测试连接
- 可以切换语言
- 可以切换主题
- 可以查看版本和运行状态

更新层：

- 自动更新开关有效
- 可手动检查更新
- 检测到更新可后台下载
- 下载完成后提示一键更新
- 更新失败不损坏原安装

品牌层：

- 主窗口
- 标题栏
- 设置文案
- 错误文案
- 更新文案
- 日志导出名称
- 用户目录名称

以上任何可见项都不得出现 `Hermes`

---

## 35. 详细工程实施方案

这一章不是概念说明，而是直接指导实现。

### 35.1 最终建议技术栈

桌面壳：

- `Electron`
- 版本策略：跟随当前稳定大版本，锁定到产品验证通过的具体版本，不追最新预览版

前端：

- `React`
- `TypeScript`
- `Vite`
- `Tailwind CSS`
- `Zustand`
- `TanStack Query`

桌面服务层：

- `Node.js`
- `TypeScript`
- 优先使用 `Electron Utility Process` 或独立子进程承载 `desktop-adapter`

底层运行时：

- `Python 3.11+`
- 打包后的 Hermes runtime
- 尽量使用固定依赖锁定后的产物，不在用户机现场解析依赖

构建与仓库：

- `pnpm workspaces`
- `GitHub Actions`
- `electron-builder`

测试：

- `Playwright`
- `Vitest`
- `pytest`

监控与错误采集：

- 第一版可先做本地日志导出
- 第二版接入 `Sentry` 或等效崩溃采集

### 35.2 为什么第一版选 Electron，不选 Tauri

这是关键决策，必须写死，避免新 AI 来回摇摆。

第一版优先 `Electron` 的原因：

1. 自动更新成熟
2. Windows / macOS / Linux 打包资料更成熟
3. 与 Python sidecar 协作更成熟
4. 社区里已有大量安装器、更新器、签名方案
5. 对“开箱即用的桌面产品”更友好

`Tauri` 不是不能做，而是不适合作为第一版最快落地方案。它适合后续在以下前提下再重新评估：

- 第一版已稳定
- 更新体系、签名体系、打包体系已经跑通
- 团队确实需要进一步压缩包体与内存
- 有精力重构底层通信和构建链路

第一版不得因“包体更小”的诱惑改用 Tauri。

### 35.3 推荐 Monorepo 具体结构

建议从第一天起使用如下结构，不要自由发挥：

```text
desktop-product/
  apps/
    desktop/
      electron/
        main/
        preload/
        assets/
      frontend/
        src/
        public/
  packages/
    adapter/
      src/
        api/
        config/
        diagnostics/
        errors/
        health/
        runtime/
        sessions/
        providers/
        updates/
        i18n/
    runtime-manager/
      src/
        bootstrap/
        paths/
        launcher/
        health/
        migration/
        bundling/
    shared/
      src/
        branding/
        contracts/
        constants/
        i18n/
        types/
        utils/
  vendor/
    hermes-agent/
  patches/
    upstream/
    translation/
  scripts/
    build/
    release/
    sync-upstream/
    verify/
  docs/
    architecture/
    product/
    release/
```

### 35.4 各模块责任边界

`apps/desktop/electron/main`

- 应用生命周期
- 窗口创建
- 系统托盘
- 原生菜单
- 自动更新集成
- 安全策略
- 调用 `desktop-adapter`
- 日志初始化
- 安全存储桥接

`apps/desktop/electron/preload`

- `contextBridge`
- 受控暴露 IPC
- 渲染进程与主进程的最小桥
- 不直接暴露危险系统能力

`apps/desktop/frontend`

- 所有最终用户可见 UI
- 术语层
- i18n
- 页面路由
- 会话交互
- 设置与状态

`packages/adapter`

- UI 的唯一业务后端
- 本地 API 聚合
- Hermes runtime 拉起与守护
- 错误映射
- 用户路径抽象
- 配置转换
- 状态聚合
- 品牌与术语抽象

`packages/runtime-manager`

- 运行时目录定位
- Python/Hermes 资源定位
- 启动参数生成
- 健康检查
- runtime 迁移与版本匹配

`vendor/hermes-agent`

- 上游镜像
- 尽量保持原样
- 不承担产品层品牌、i18n、UI 定制职责

### 35.5 启动流程必须怎么做

应用启动流程固定如下：

1. Electron 主进程启动
2. 初始化日志
3. 初始化安全存储
4. 读取本地产品配置
5. 计算数据目录与运行目录
6. 启动 `desktop-adapter`
7. `desktop-adapter` 检查 bundled runtime 是否完整
8. `desktop-adapter` 拉起 Hermes runtime
9. 进行健康检查
10. 主窗口加载 React UI
11. UI 请求 `desktop-adapter/bootstrap-state`
12. 如果未配置模型，进入首启向导；否则进入主工作台

### 35.6 首启状态机

首启向导只允许存在以下步骤：

1. 欢迎页
2. 选择模型供应商类型
3. 填写模型连接信息
4. 测试连接
5. 设置基础偏好
6. 完成并进入主界面

不允许在首启向导加入：

- 高级参数大全
- 插件市场
- MCP 配置
- 复杂权限矩阵
- 教学式漫长 onboarding

### 35.7 聊天消息流的正确实现

消息发送流程建议如下：

1. 用户在 UI 输入消息
2. UI 调用 `desktop-adapter` 的 `sendMessage`
3. `desktop-adapter` 将桌面产品会话结构映射为 Hermes runtime 所需结构
4. `desktop-adapter` 调用 Hermes 对应接口或本地 HTTP API
5. runtime 以流式事件返回增量
6. `desktop-adapter` 将 runtime 事件规范化为产品统一事件
7. UI 根据规范化事件更新消息气泡
8. 出现错误时，由 `desktop-adapter` 转换为用户可理解的中文错误

UI 不得直接处理：

- Hermes 原始异常栈
- Hermes 内部对象结构
- Hermes 原始 provider 术语

### 35.8 文件与图片附加的落地方式

第一版附件支持必须限定为：

- 文件选择器附加
- 拖拽附加
- 图片附加

建议技术流程：

1. UI 调起系统文件选择器或接收拖拽
2. 通过 `preload` 安全桥传递文件路径或临时文件句柄
3. `desktop-adapter` 负责校验：
   - 文件存在
   - 大小限制
   - 类型白名单
4. `desktop-adapter` 负责交给 Hermes runtime
5. UI 只显示产品化后的上传状态

### 35.9 工具/技能开关的最小实现

第一版不做复杂中心，只做够用。

UI 结构建议：

- 一个“能力”页
- 两个分组：工具、技能
- 每项只有：
  - 名称
  - 简短中文说明
  - 启用 / 禁用开关
  - 如必要则显示风险标记

不得第一版加入：

- 复杂工作流编排
- 市场式卡片大厅
- 自定义执行器面板
- 细粒度参数大表单

### 35.10 设置页必须怎么分组

设置页建议固定 6 组：

1. 模型
2. 对话
3. 能力
4. 外观
5. 更新
6. 关于与诊断

每组只放当前版本真正可用的设置项。禁止为了“以后可能会用”预留大量空设置。

### 35.11 中文化的正确做法

中文化要分成 4 层：

1. **产品 UI 文案层**
2. **Adapter 错误映射层**
3. **产品文档层**
4. **自动检测层**

实现要求：

- 所有最终用户可见文案必须来自统一 i18n key
- 不允许在组件里散落硬编码英文
- 所有 adapter 错误需要过一层 `error-code -> 中文文案`
- 所有状态文案、菜单、空态、表单说明、更新提示、恢复提示都必须中文
- Hermes 内部模型提示词、系统提示词、协议字段可以保留英文，只要用户看不到

### 35.12 README 与文档如何处理才不会影响上游同步

这件事必须说清楚，否则新 AI 会跑偏。

正确做法：

1. 产品根仓库的 `README`、发布说明、使用说明全部中文
2. `vendor/hermes-agent` 保持上游原状，不做大规模翻译改动
3. 需要暴露给用户的说明，重新写在产品仓库自己的中文文档中
4. 若确有必要对 vendored upstream 做少量补丁，必须通过补丁队列管理

错误做法：

- 直接把 upstream 所有 README / docs / 源文件全部翻译一遍
- 让产品仓库等同于“上游汉化版”

原因：

- 上游同步会极其痛苦
- 冲突量极大
- 汉化维护成本失控
- 新增英文文案难以自动追踪

### 35.13 Windows 为什么能做，而 upstream 为什么说不支持

必须给后续开发者讲明白：

- upstream 的“不支持 Windows”，本质上是指它不是按“原生 Windows 最终用户产品”路线设计的
- upstream 主要面向 `Linux / macOS / WSL2`
- 我们要做的是**桌面产品适配工程**

因此我们不是“证明 upstream 其实本来支持 Windows”，而是：

- 在桌面产品层补齐 Windows 运行时分发
- 通过 adapter 隔离平台差异
- 对 POSIX-only 能力建立 capability flag
- 对不能稳定工作的能力第一版默认隐藏或禁用

### 35.14 平台 capability flag 机制

第一版就要建立能力标志，不要等出 bug 再补。

建议 capability 例如：

- `supports_native_shell_tooling`
- `supports_pty_full`
- `supports_secure_storage`
- `supports_auto_update`
- `supports_drag_drop_images`
- `supports_global_shortcuts`

前端根据 capability 控制：

- 展示
- 启用
- 降级文案

这样即使某个平台存在局部限制，也不会把整个产品拖垮。

---

## 36. 更新、打包与发布的具体实现

### 36.1 更新系统的第一版正确策略

第一版的更新系统必须做到：

- 用户设置里有自动更新开关
- 可手动检查更新
- 检测到更新后可后台下载
- 下载完成后提示用户一键更新
- 更新失败不影响当前版本继续使用

第一版的工程实现建议：

- 使用 `electron-builder + electron-updater`
- 发布源先用 `generic provider`，底层可挂 GitHub Releases、S3、R2 或任意静态文件服务
- 第一版先把 App 更新跑通
- Runtime 仍随 App 版本一起发布
- 第二版再加强 App / Runtime 双层独立更新

### 36.2 为什么第一版不强行做 Runtime 热更新

虽然架构要预留双层更新，但第一版不建议直接做 Runtime 独立热更新，原因如下：

1. 复杂度会显著上升
2. Windows/macOS/Linux 三端回滚更复杂
3. 安装器、签名、回滚、校验逻辑会增加
4. 第一版最重要的是把“用户无脑安装并可用”跑通

因此：

- 第一版：`App + Runtime` 打包一起发
- 第二版：内部版本号拆分清晰
- 最终版：视维护收益决定是否做 Runtime 独立补丁包

### 36.3 版本号策略

必须拆成三类版本：

- `productVersion`
- `runtimeVersion`
- `upstreamHermesVersion`

在设置页和诊断包里都要体现这三者，但对普通用户默认只显示产品版本。

### 36.4 Windows 打包建议

第一版：

- `NSIS` 安装器
- `x64` 必做
- `arm64` 可放第二版

必须支持：

- 用户级安装
- 快捷方式创建
- 开始菜单入口
- 卸载入口
- 更新后保留用户数据

### 36.5 macOS 打包建议

第一版：

- `dmg`
- 建议直接做 `universal`，如果资源不足则先做 `arm64 + x64` 双产物

发布要求：

- 代码签名
- notarization
- 更新校验

### 36.6 Linux 打包建议

第一版建议：

- `AppImage`
- 至少保证 `x64`

第二版再考虑：

- `deb`
- `rpm`
- 更细分的发行版适配

### 36.7 发布流水线必须怎么做

CI/CD 流程建议固定如下：

1. `lint + typecheck`
2. 前端单测
3. adapter 单测
4. Python/runtime 单测
5. 端到端 smoke test
6. Windows / macOS / Linux 构建
7. 产物签名
8. 生成更新元数据
9. 上传发布产物
10. 生成 release notes
11. 触发 beta/stable 渠道发布

### 36.8 更新状态机

更新状态必须统一成以下枚举，前端与 adapter 共用：

- `idle`
- `checking`
- `available`
- `not_available`
- `downloading`
- `downloaded`
- `installing`
- `failed`

错误必须有机器码和中文文案，不能只传原始异常字符串。

### 36.9 更新失败恢复策略

必须有以下恢复规则：

- 下载失败：允许重试，不污染当前安装
- 校验失败：删除损坏缓存，保留当前版本
- 安装失败：保留旧版本可继续启动
- 首次启动新版本失败：允许快速回退到前一版

### 36.10 签名与可信分发要求

第一版可以弱化分发渠道，但不能忽略签名规划。

必须建立：

- Windows 代码签名证书预留
- macOS Apple Developer / notarization 流程
- 发布密钥托管方案
- 构建机 secrets 管理规范

---

## 37. 上游同步与汉化不失效的完整方案

这一章直接回答用户最关心的问题：上游更新以后，本产品如何跟上，而且中文化不失效。

### 37.1 总原则

核心原则只有一句：

> 不要把“汉化”做成对 upstream 源码的大面积直接修改，而要做成产品层覆盖、补丁层收口、检测层兜底。

### 37.2 正确的仓库关系

正确关系如下：

- 产品仓库是主仓库
- `vendor/hermes-agent` 是上游镜像依赖
- 用户界面、品牌、中文文案、更新系统、设置系统全部在产品仓库自己的层里实现
- 对 upstream 的改动压缩到最小补丁队列

### 37.3 Upstream 同步机制

建议使用以下任一方案，但必须固定，不要混用：

首选：

- `git subtree`

备选：

- `git submodule + vendor sync script`

对于大多数 Codex 执行场景，`git subtree` 更容易自动化，因为：

- 单仓库工作流更直接
- AI 修改和发布更顺手
- CI 中不容易漏拉 submodule

### 37.4 上游同步的标准流程

每次同步上游必须遵循：

1. 拉取 upstream 最新 tag 或指定 commit
2. 合并进 `vendor/hermes-agent`
3. 自动应用 `patches/upstream/*.patch`
4. 运行 adapter 契约测试
5. 运行 capability 回归测试
6. 扫描新增可见英文字符串
7. 若发现未覆盖翻译，则阻断发布
8. 构建 beta 版本验证
9. 验证通过后再进入 stable 渠道

### 37.5 什么样的改动允许进 upstream patch 队列

只允许以下类型：

- 补充必须的 runtime bridge
- 补充少量平台兼容修复
- 补充极少量对产品接入必要的稳定化补丁

不允许进 patch 队列的内容：

- 大规模中文翻译
- 品牌替换
- UI 重写
- 产品层术语修改
- 大面积重构

### 37.6 新英文如何发现

必须建立自动检测脚本，至少扫描以下位置：

- 产品前端
- adapter 错误映射之外的裸字符串
- patches 中新增可见文本
- 若仍暴露任何 upstream TUI / CLI / Web 片段，则扫描其可见文案

检测原则：

- 新增英文且可见给用户：CI 失败
- 新增英文但只在内部日志：允许，但应评估是否需要映射
- 模型系统提示词：默认忽略

### 37.7 新英文如何处理

发现新增英文后，标准处理顺序：

1. 判断它是否真的需要暴露给用户
2. 若不需要，收口到 adapter，改成内部码
3. 若需要，加入产品 i18n key
4. 若来自 upstream 且无法绕开，再做最小 patch

### 37.8 为什么这样做能保证“同步后汉化不失效”

因为最终用户看到的大部分内容都来自：

- 产品前端
- 产品设置页
- 产品错误页
- adapter 映射后的术语

而不是直接来自 upstream 原始界面。

因此：

- upstream 新增英文不会自动进入最终用户界面
- 即使 upstream 内部结构变化，风险也主要收敛在 adapter 和 patch 队列
- 汉化的维护面显著缩小

### 37.9 自动同步策略

产品上线后，建议建立两层机制：

第一层：

- 每周定时检测 upstream 新版本或指定分支更新

第二层：

- 仅在通过自动测试与人工确认后才进入产品 release train

也就是说：

- 可以自动同步代码
- 不能自动直接推给最终用户

必须经过验证后才能发布。

### 37.10 用户侧更新与 upstream 更新的关系

绝对不能让用户直接更新到官方 Hermes upstream。

用户只能更新到：

- 你们验证过的产品版本
- 你们打包好的 runtime 版本
- 你们签名和发布的更新源

---

## 38. 团队组织、角色分工、排期与预算

这一章是给真实团队与 AI 协同团队一起用的。

### 38.1 人员架构的三种方案

建议给出三档配置：

#### 方案 A：AI 驱动最小可落地团队

适合预算有限、强依赖 Codex 的情况。

人员：

- 1 名产品负责人 / 技术负责人
- 1 名 Electron/前端主程
- 1 名 Python/runtime 主程
- 1 名兼职 UI/UX
- 1 名兼职 QA/发布

特点：

- 依赖 Codex 参与大量编码与文档工作
- 人类负责关键决策、验收、发布与风险判断
- 成本最低
- 管理难度相对低

#### 方案 B：标准小团队

更适合追求第一版质量可控。

人员：

- 1 名产品经理或产品负责人
- 1 名技术负责人 / 架构负责人
- 2 名桌面前端/Electron 工程师
- 1 名 Python/runtime 工程师
- 1 名 QA/测试与发布工程师
- 1 名 UI/UX 设计师

特点：

- 第一版落地更稳
- 第二版衔接更顺
- 适合并行推进 UI、adapter、打包、测试

#### 方案 C：理想产品化团队

适合目标直接瞄准长期产品。

人员：

- 1 名产品负责人
- 1 名技术负责人
- 2 名桌面端工程师
- 2 名 runtime / 平台工程师
- 1 名 QA 自动化工程师
- 1 名发布 / DevOps 工程师
- 1 名 UI/UX 设计师
- 1 名技术文档/本地化支持

### 38.2 各角色职责划分

产品负责人：

- 需求边界
- 版本取舍
- 验收标准
- 发布决策

技术负责人：

- 架构裁决
- 上游同步策略
- 代码边界
- 风险把控

Electron/前端工程师：

- 桌面壳
- preload
- UI
- 设置页
- 状态页
- 更新交互

Python/runtime 工程师：

- Hermes 接入
- runtime manager
- adapter 对接
- Windows/macOS/Linux 差异问题

QA/发布工程师：

- 安装包验证
- 首启流程回归
- 更新回归
- 多平台 smoke test
- 发布清单

UI/UX 设计师：

- 信息架构
- 视觉规范
- 响应式与缩放
- 中文文案可读性协作

### 38.3 最适合第一版的分工建议

如果只能组一个最小高效团队，建议按下面分工：

- 技术负责人：控制架构、上游同步、更新策略、版本边界
- 工程师 A：负责 Electron 主进程、preload、更新、打包
- 工程师 B：负责 adapter、runtime manager、Hermes 接入
- 工程师 C：负责 React UI、会话页、设置页、i18n
- 兼职设计：负责主界面和设置页视觉规范
- QA/发布：负责构建验证、安装回归、更新回归

### 38.4 推荐排期

第一版推荐排期：**8 到 12 周**

周 1：

- 需求冻结
- 仓库骨架
- 品牌抽象
- 目录规划
- 技术选型定稿

周 2：

- Electron 基础壳
- adapter 骨架
- runtime manager 骨架
- 数据目录与配置目录规则

周 3：

- 跑通 Hermes runtime 启动
- 健康检查
- 首启向导骨架
- 模型配置保存

周 4：

- 聊天主页面
- 消息流
- 会话列表
- 会话切换

周 5：

- 文件/图片附加
- 工具/技能开关
- 状态页
- 设置页

周 6：

- 自动更新
- 手动更新
- 日志导出
- 错误恢复

周 7：

- Windows/macOS/Linux 打包
- Smoke test
- UI 收口
- 去 Hermes 感知检查

周 8：

- Beta 验证
- 修 bug
- 发布清单
- 首个可安装版

如果要做到更稳，则增加 2 到 4 周用于：

- 三端回归
- 更新回归
- 崩溃恢复
- 签名与 notarization

### 38.5 人力成本与预算估算

以下是**估算区间**，用于项目规划，不是市场刚性报价。默认按中国一线/新一线城市全职税前或等价外包成本粗估。

核心角色月成本估算：

- 产品/技术负责人：`25k - 45k RMB / 月`
- Electron/前端工程师：`25k - 45k RMB / 月`
- Python/runtime 工程师：`25k - 45k RMB / 月`
- QA/发布工程师：`15k - 30k RMB / 月`
- UI/UX 设计师：`15k - 35k RMB / 月`

第一版总预算粗估：

- 方案 A（AI 驱动最小团队，8-12 周）：`25 万 - 45 万 RMB`
- 方案 B（标准小团队，10-14 周）：`60 万 - 120 万 RMB`
- 方案 C（理想产品化团队，3-6 个月）：`120 万 - 250 万 RMB`

额外预算别漏：

- Windows 代码签名证书
- Apple Developer 账号
- 构建机/CI 费用
- 更新分发存储/CDN
- 域名与下载站
- 崩溃收集与监控服务

### 38.6 维护阶段的人力安排

产品上线后至少保留以下角色：

- 1 名技术负责人或高级维护工程师
- 1 名桌面端工程师
- 1 名 runtime / 平台工程师
- 1 名 QA/发布支持（可兼职）

否则会出现：

- 上游同步跟不上
- 更新机制失效
- Windows/macOS/Linux 三端 bug 无法及时回归
- 汉化与产品文案逐渐漂移

---

## 39. Codex 专用高效执行手册

这一章是给拿到本文档的 Codex 写的。目标不是“给建议”，而是直接告诉它该怎么高效干活。

### 39.1 Codex 的总任务定义

你不是在做一个“为 Hermes 补一个桌面 UI”的活。

你在做的是：

- 一个独立品牌的桌面产品
- Hermes 只是运行时
- 用户不应该感知 Hermes
- 产品必须可安装、可更新、可维护、可同步上游

### 39.2 Codex 的第一原则

拿到仓库后必须遵守：

1. 先读文档，再读代码
2. 先看仓库结构和现状，再做决定
3. 先建立分层，再写页面
4. 先做闭环，再做增强
5. 先保第一版，再谈最终版

### 39.3 Codex 的第一天工作顺序

严格按这个顺序：

1. 审核仓库结构
2. 建立/确认 monorepo 结构
3. 建立品牌层
4. 建立 shared contracts
5. 建立 adapter skeleton
6. 跑通 runtime manager skeleton
7. 跑通 Electron main + preload
8. 跑通 React frontend skeleton
9. 定义 bootstrap state 接口
10. 再开始首启向导与聊天页

### 39.4 Codex 不要脑补的事项

绝对不要自行脑补：

- 产品名称
- 品牌配色之外的大改视觉方向
- 第二版和最终版功能提前上线
- 复杂知识库系统
- 复杂插件生态
- 商业化账户系统
- 本地模型市场
- 企业协作后台

如果文档未明确要求，就默认不做。

### 39.5 Codex 的开发节奏

每个里程碑都要按以下顺序推进：

1. 探索现状
2. 写出最小实现路线
3. 搭骨架
4. 跑通主流程
5. 补测试
6. 做 UI 收口
7. 做错误与恢复
8. 最后做 polish

禁止一开始就沉迷：

- 视觉细节
- 动效
- 配色琢磨
- 大规模重构
- 架构洁癖

### 39.6 Codex 的多 AI / 子代理协同方案

本项目非常适合多代理并行，但必须有主控代理统一收口。

主控代理职责：

- 维护全局计划
- 控制版本边界
- 保持架构一致性
- 决定接口契约
- 整合子代理成果

推荐代理拆分如下：

代理 A（Explorer）：

- 审计 upstream Hermes 可复用接口
- 产出 API / 配置 / 运行时接入报告
- 不改代码

代理 B（Worker）：

- 负责 `apps/desktop/electron`
- 主进程、preload、窗口、更新、打包

代理 C（Worker）：

- 负责 `packages/adapter`
- 接口聚合、错误映射、健康检查、配置转换

代理 D（Worker）：

- 负责 `packages/runtime-manager`
- 运行时拉起、目录规则、平台路径、迁移

代理 E（Worker）：

- 负责 `apps/desktop/frontend`
- 主工作台、首启向导、设置页、状态页、i18n

代理 F（Worker）：

- 负责测试与发布脚本
- Playwright、构建脚本、发布流程

### 39.7 多代理协同铁律

必须遵守：

1. 主控代理不把关键架构裁决外包出去
2. 子代理必须有明确文件写入边界
3. 不要让两个子代理写同一片目录
4. 先并行探索，再并行编码，最后主控整合
5. 子代理完成后主控必须复核

### 39.8 最佳并行拆分顺序

第一轮并行：

- Explorer 审计 upstream
- Worker 搭 Electron 壳
- Worker 搭 frontend 骨架

第二轮并行：

- Worker 做 adapter skeleton
- Worker 做 runtime manager skeleton
- Worker 做 shared contracts

第三轮并行：

- Worker 做首启向导
- Worker 做聊天页
- Worker 做更新与打包

第四轮并行：

- Worker 做附件与工具/技能页
- Worker 做设置页和状态页
- Worker 做测试与发布流水线

### 39.9 Codex 的高效交付方式

每完成一层必须留下：

- 已实现内容
- 未实现内容
- 风险点
- 下一步

避免出现：

- 做了很多代码但不知道主流程有没有通
- 页面很多但 runtime 没启动
- 更新系统没做却开始研究最终版功能

### 39.10 Codex 的交付定义

一个阶段完成不等于“代码写了一半”，而是满足以下任一完整状态：

- 可以启动
- 可以配置模型
- 可以聊天
- 可以安装包运行
- 可以更新

只有完整用户闭环才算交付。

---

## 40. 问题处理手册

### 40.1 如果 Hermes 在 Windows 上有问题怎么办

处理顺序必须是：

1. 先确认是 Hermes 自身问题、打包问题，还是适配层问题
2. 如果是可隔离能力，就用 capability flag 隐藏或降级
3. 如果是必须能力，就做最小补丁收口到 patch 队列
4. 不要为了兼容一个问题而把用户主流程重新绑回命令行

### 40.2 如果 upstream 改动导致接口不兼容怎么办

处理顺序：

1. adapter 契约测试先报错
2. 在 adapter 层修映射
3. 如果 adapter 无法吸收，再改 minimal patch
4. 若属于重大不兼容，冻结升级，不推送给用户

### 40.3 如果出现新的英文暴露怎么办

处理顺序：

1. 确认英文是从哪里来的
2. 加入 i18n 或错误映射
3. 如果来自 vendored upstream 且不可绕过，则补 patch
4. 加入英文扫描黑名单/白名单规则，防止回归

### 40.4 如果更新失败怎么办

必须保证：

- 旧版本仍可继续运行
- 用户数据不丢
- 可重试下载
- 错误提示中文可理解

### 40.5 如果时间不够怎么办

正确做法：

- 简化外围功能
- 保主闭环
- 保更新
- 保中文化
- 保安装体验

错误做法：

- 删掉更新
- 删掉错误恢复
- 删掉附件
- 删掉日志导出

这些都是发布后会立刻变成维护灾难的部分。

---

## 41. 维护、迭代与长期路线

### 41.1 第一版上线后必须保留的维护动作

每周：

- 检查 upstream 新提交或新 tag
- 检查依赖安全更新
- 回归自动更新链路

每两周：

- 评估是否需要 beta 构建
- 清理高频崩溃与阻断性 bug

每月：

- 计划一次稳定版发布
- 校验汉化扫描结果
- 审核 capability 差异是否有机会补平

### 41.2 版本策略建议

建议至少保留两个渠道：

- `stable`
- `beta`

第一版不要再多搞：

- nightly
- insider
- dev preview

否则团队维护成本会被渠道管理吃掉。

### 41.3 第二版开发方向

第二版重点不是“更花哨”，而是：

- 更稳
- 更可恢复
- 更可迁移
- 更可维护
- 三端更一致

第二版新增重点应包括：

- 导入旧配置/历史
- 更完整诊断包
- 更可靠回滚
- 更清晰模型管理
- 更好的会话搜索
- 更强的附件反馈
- 更成熟的错误码体系

### 41.4 最终版愿景

最终版不是单纯桌面壳，而是：

- 品牌独立
- 分发成熟
- 同步上游成熟
- 多平台长期维护成熟
- 商业化接口预留成熟

商业化预留但不提前实现：

- 内置模型
- 账号系统
- 订阅体系
- 云同步
- 团队版

---

## 42. 外部参考资料、技术官网、竞品与借鉴边界

这一章的作用不是堆链接，而是告诉新 AI：

- 该看什么
- 为什么看
- 看完应该借鉴什么
- 哪些不能直接照抄

### 42.1 上游与原始材料

| 类别 | 链接 | 用途 |
|---|---|---|
| 上游仓库 | `https://github.com/NousResearch/hermes-agent` | 核心上游代码来源 |
| 上游文档站 | `https://hermes-agent.nousresearch.com/docs/` | 查询 Hermes 功能、CLI、配置、架构 |
| Quickstart | `https://hermes-agent.nousresearch.com/docs/getting-started/quickstart` | 理解安装与首启逻辑 |
| CLI Guide | `https://hermes-agent.nousresearch.com/docs/user-guide/cli` | 理解当前 CLI 心智模型 |
| Config Guide | `https://hermes-agent.nousresearch.com/docs/user-guide/configuration` | 理解配置面 |
| Architecture | `https://hermes-agent.nousresearch.com/docs/developer-guide/architecture` | 理解内部结构 |
| Contributing | `https://hermes-agent.nousresearch.com/docs/developer-guide/contributing` | 理解上游开发规范 |
| WSL 安装 | `https://learn.microsoft.com/en-us/windows/wsl/install` | 证明 upstream 当前 Windows 路线主要是 WSL2 |

### 42.2 桌面壳与前端核心技术官方文档

| 技术 | 链接 | 为什么需要 |
|---|---|---|
| Electron 官方文档 | `https://www.electronjs.org/docs/latest/` | 桌面壳主参考 |
| Electron Process Model | `https://www.electronjs.org/docs/latest/tutorial/process-model` | 规划主进程 / 渲染进程 / Utility Process |
| Electron IPC | `https://www.electronjs.org/docs/latest/tutorial/ipc` | 设计安全通信桥 |
| Electron Preload | `https://www.electronjs.org/docs/latest/tutorial/tutorial-preload` | 正确使用 preload/contextBridge |
| Electron Security | `https://www.electronjs.org/docs/latest/tutorial/security` | 做桌面安全基线 |
| Electron safeStorage | `https://www.electronjs.org/docs/latest/api/safe-storage` | 本地敏感信息存储 |
| React 官方 | `https://react.dev/` | 前端 UI 基础 |
| Vite 官方 | `https://vite.dev/guide/` | 前端构建与开发体验 |
| Tailwind CSS | `https://tailwindcss.com/` | 快速搭 UI 与响应式 |
| Tailwind 响应式 | `https://tailwindcss.com/docs/responsive-design` | 自适应与缩放策略 |
| Zustand | `https://zustand.docs.pmnd.rs/getting-started/introduction` | 轻量状态管理 |
| TanStack Query | `https://tanstack.com/query/latest` | 请求状态、缓存、重试 |
| Node.js 官方 | `https://nodejs.org/` | 主进程/adapter 运行时基础 |

### 42.3 打包、更新、签名、发布官方资料

| 技术/主题 | 链接 | 为什么需要 |
|---|---|---|
| electron-builder | `https://www.electron.build/` | 打包与发布主工具 |
| electron-builder config | `https://www.electron.build/configuration.html` | 构建配置 |
| electron-builder auto update | `https://www.electron.build/auto-update.html` | 自动更新实现 |
| Electron updates tutorial | `https://www.electronjs.org/docs/latest/tutorial/updates` | Electron 官方更新思路 |
| electron-builder Windows signing | `https://www.electron.build/code-signing-win.html` | Windows 签名 |
| electron-builder mac signing | `https://www.electron.build/code-signing-mac` | macOS 签名 |
| Apple notarization | `https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution` | macOS 公证要求 |
| Apple custom notarization | `https://developer.apple.com/documentation/security/customizing-the-notarization-workflow` | 自动化公证流水线 |
| GitHub Actions matrix | `https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs` | 多平台矩阵构建 |
| GitHub Actions artifacts | `https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts` | 构建产物与调试文件 |
| GitHub reusable workflows | `https://docs.github.com/actions/reference/workflows-and-actions/reusable-workflows` | 复用发布流水线 |

### 42.4 Python/runtime 与测试资料

| 技术 | 链接 | 用途 |
|---|---|---|
| Python 官方文档 | `https://docs.python.org/3/` | Hermes runtime 基础 |
| uv 官方文档 | `https://docs.astral.sh/uv/` | 依赖管理与构建准备 |
| Playwright 官方 | `https://playwright.dev/` | 桌面前端与 web 交互测试 |
| Playwright test docs | `https://playwright.dev/docs/writing-tests` | 端到端用例编写 |
| Sentry Electron Docs | `https://docs.sentry.io/platforms/javascript/guides/electron/` | 第二版崩溃采集可参考 |

### 42.5 模型供应商与兼容接口文档

| 服务 | 链接 | 用途 |
|---|---|---|
| OpenAI Platform | `https://platform.openai.com/docs/overview` | OpenAI 接入参考 |
| Anthropic Docs | `https://docs.anthropic.com/en/docs/welcome` | Claude 接入参考 |
| OpenRouter Quickstart | `https://openrouter.ai/docs/quickstart` | 多模型聚合参考 |
| Ollama API | `https://docs.ollama.com/api` | 本地/兼容接口参考 |
| Model Context Protocol | `https://modelcontextprotocol.io/` | MCP 规范参考 |

### 42.6 可选替代技术，仅用于评估，不作为第一版默认方案

| 技术 | 链接 | 备注 |
|---|---|---|
| Tauri | `https://tauri.app/start/` | 可做备选，不作为第一版主方案 |
| Tauri Updater | `https://v2.tauri.app/plugin/updater/` | 若后续评估替代 Electron 时参考 |

### 42.7 竞品与可借鉴对象

| 产品 | 链接 | 借鉴点 | 不要照抄的点 |
|---|---|---|---|
| ChatGPT Desktop | `https://openai.com/chatgpt/desktop/` | 极简入口、文件附加、桌面心智 | 闭源体验细节不要机械复制 |
| Cursor | `https://www.cursor.com/` | 跨平台下载、更新节奏、桌面产品成熟度 | 它是 IDE，不是聊天工作台 |
| Cursor Downloads | `https://cursor.com/downloads/` | 分发矩阵、下载入口组织 | 不要做成开发者 IDE |
| Jan | `https://www.jan.ai/` | 本地/云模型共存思路 | 不要把第一版做成模型市场 |
| Jan Docs | `https://docs.jan.ai/` | 桌面 AI 平台定位与功能组织 | 不要把第一版扩成全生态 |
| Cherry Studio | `https://github.com/CherryHQ/cherry-studio` | 多模型聚合、跨平台桌面客户端 | 容易面板过多、复杂度过高 |
| Cherry Studio Docs | `https://docs.cherry-ai.com/en-us/cherrystudio/download` | 分发与下载入口参考 | 不要堆满功能中心 |
| AnythingLLM | `https://anythingllm.com/` | 开箱即用、文档导向入口 | 第一版不要被知识库/RAG 吸走 |
| LibreChat | `https://www.librechat.ai/` | 多模型统一聊天入口 | 它偏 Web 平台，不是桌面优先 |
| Open WebUI | `https://github.com/open-webui/open-webui` | 开源多模型 UI 的功能广度对照 | 第一版不要学成“巨型 Web 控制台” |

### 42.8 竞品分析后的结论

应该借鉴的：

- ChatGPT Desktop 的简洁入口与极低使用门槛
- Cursor 的桌面产品化、跨平台分发、更新体验
- Jan 的本地/云模型并存思路
- Cherry Studio 的多模型聚合经验

不应该学习的：

- 过重的运维面板
- 功能堆叠导致的信息噪音
- 大量一次性看不懂的高级入口
- 把桌面产品做成 Web 面板套壳

### 42.9 新 AI 阅读顺序建议

如果你是新的 AI 开发者，外部材料按以下顺序读：

1. 本文档
2. 上游 Hermes Architecture / Config / CLI 文档
3. Electron Process Model / IPC / Security / Updates
4. electron-builder auto-update / signing 文档
5. ChatGPT Desktop / Cursor / Jan / Cherry Studio 竞品页
6. 模型供应商接入文档

不要一开始就陷进竞品截图或大量 UI 模仿。

---

## 43. 最终交接指令

如果你是新的 AI 开发者，看到这里后应该已经明确：

- 你要做什么
- 为什么这样做
- 第一版要做到哪里
- 后续版本怎么演进
- 哪些东西不能做
- 技术怎么选
- 代码应该怎么分层
- 上游怎么同步
- 汉化为什么不会因为上游更新而失效
- 团队如何拆分
- 预算如何估算
- 你自己如何高效执行

从现在开始，正确动作不是继续脑补，而是：

1. 审查实际仓库结构
2. 确认与本文档的差距
3. 列出第一版关键路径
4. 先做架构骨架
5. 再做可启动、可配置、可聊天、可更新的闭环

如果做不到这 5 步，就说明你偏题了。

---

## 44. 精确实施蓝图

这一章给出“不要猜”的具体落地蓝图。新的 AI 拿到这里后，应该能直接开始搭工程，而不是再自行发明接口和目录。

### 44.1 建议的初始文件级骨架

建议按以下文件起步，不要自由发挥命名：

```text
desktop-product/
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
  apps/
    desktop/
      electron/
        package.json
        electron-builder.yml
        main/
          index.ts
          app-lifecycle.ts
          window-manager.ts
          updater.ts
          ipc.ts
          secure-store.ts
          logging.ts
        preload/
          index.ts
          bridge.ts
      frontend/
        package.json
        index.html
        src/
          main.tsx
          app/
            App.tsx
            router.tsx
            providers.tsx
          features/
            onboarding/
            chat/
            sessions/
            attachments/
            capabilities/
            settings/
            status/
            updates/
          components/
          stores/
          queries/
          i18n/
          theme/
  packages/
    shared/
      src/
        branding/
          brand.ts
        contracts/
          bootstrap.ts
          sessions.ts
          messages.ts
          settings.ts
          updates.ts
          diagnostics.ts
          errors.ts
          capabilities.ts
        i18n/
          zh-CN.ts
        constants/
        types/
    adapter/
      src/
        index.ts
        server.ts
        bootstrap/
          get-bootstrap-state.ts
        config/
          settings-repository.ts
          secure-secrets.ts
        runtime/
          hermes-launcher.ts
          runtime-health.ts
          runtime-bridge.ts
          runtime-capabilities.ts
        api/
          routes/
            bootstrap.ts
            sessions.ts
            messages.ts
            attachments.ts
            settings.ts
            updates.ts
            diagnostics.ts
            health.ts
        mapping/
          error-mapper.ts
          provider-mapper.ts
          session-mapper.ts
          capability-mapper.ts
        updates/
          update-service.ts
        diagnostics/
          export-diagnostics.ts
    runtime-manager/
      src/
        paths.ts
        runtime-layout.ts
        python-locator.ts
        hermes-assets.ts
        migrations.ts
        versioning.ts
  vendor/
    hermes-agent/
  patches/
    upstream/
      0001-runtime-bridge.patch
      0002-windows-compat.patch
  scripts/
    build/
    release/
    sync-upstream/
      sync.ps1
      verify.ps1
      scan-user-facing-english.ps1
    verify/
      verify-installer.ps1
      verify-updater.ps1
  docs/
    architecture/
    release/
```

### 44.2 必须先定义的共享契约

先定义契约，再做实现。共享契约文件至少包括：

- `bootstrap.ts`
- `settings.ts`
- `sessions.ts`
- `messages.ts`
- `updates.ts`
- `diagnostics.ts`
- `errors.ts`
- `capabilities.ts`

如果没有这些共享契约就开始写 UI 和 adapter，后续一定返工。

### 44.3 `bootstrap-state` 契约

前端第一屏依赖的统一接口必须固定。建议 `GET /bootstrap-state` 返回以下结构：

```ts
type BootstrapState = {
  app: {
    productName: string
    productVersion: string
    channel: 'stable' | 'beta'
    locale: 'zh-CN'
    theme: 'light' | 'dark' | 'system'
  }
  runtime: {
    runtimeVersion: string
    upstreamHermesVersion: string
    status: 'starting' | 'ready' | 'degraded' | 'failed'
  }
  onboarding: {
    isCompleted: boolean
    missingFields: string[]
  }
  provider: {
    configured: boolean
    providerType: 'openai' | 'anthropic' | 'openai-compatible' | 'openrouter' | 'ollama' | 'custom'
    model: string | null
    baseUrl: string | null
  }
  capabilities: {
    supportsNativeShellTooling: boolean
    supportsPtyFull: boolean
    supportsSecureStorage: boolean
    supportsAutoUpdate: boolean
    supportsImagePaste: boolean
    supportsDragDropAttachments: boolean
  }
  updates: {
    autoUpdateEnabled: boolean
    state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'failed'
  }
}
```

前端启动后只读这一个对象来决定：

- 进入首启向导还是主工作台
- 是否展示某些 capability
- 是否显示更新状态
- 是否显示降级提示

### 44.4 设置相关 API 契约

第一版建议固定以下接口：

`GET /settings/provider`

- 返回当前供应商配置

`PUT /settings/provider`

- 保存配置
- 请求体字段固定为：
  - `providerType`
  - `apiKey`
  - `baseUrl`
  - `model`
  - `organization`
  - `extraHeaders`

`POST /settings/provider/test`

- 用于测试连接
- 返回：
  - `success`
  - `latencyMs`
  - `message`
  - `resolvedModel`

`GET /settings/app`

- 返回语言、主题、自动更新开关、诊断偏好等

`PUT /settings/app`

- 保存应用级设置

### 44.5 会话相关 API 契约

第一版建议固定：

`GET /sessions`

- 返回会话摘要列表
- 字段至少包含：
  - `id`
  - `title`
  - `lastMessagePreview`
  - `updatedAt`
  - `messageCount`
  - `pinned`

`POST /sessions`

- 创建新会话

`PATCH /sessions/:id`

- 重命名
- 固定/取消固定

`DELETE /sessions/:id`

- 删除会话

`GET /sessions/:id/messages`

- 拉取消息列表

### 44.6 消息发送与流式事件契约

第一版建议固定：

`POST /sessions/:id/messages`

请求体：

```ts
type SendMessageRequest = {
  text: string
  attachmentIds?: string[]
  enabledTools?: string[]
  enabledSkills?: string[]
}
```

响应不要等整个消息完成再返回，必须采用流式事件。建议统一事件类型：

- `message.started`
- `message.delta`
- `message.completed`
- `tool.started`
- `tool.completed`
- `skill.started`
- `skill.completed`
- `warning`
- `error`

事件 payload 必须是产品层规范化结构，不能把 Hermes 原始对象直接透传给 UI。

### 44.7 中止生成 API 契约

固定接口：

- `POST /sessions/:id/messages/:messageId/cancel`

返回：

- `success`
- `state: cancelled | already_completed | failed`

### 44.8 附件 API 契约

固定接口：

- `POST /attachments/prepare`
- `POST /attachments/commit`
- `DELETE /attachments/:id`

理由：

- `prepare` 用于校验文件与创建临时记录
- `commit` 用于真正绑定到消息或会话
- 这样 UI 能更稳定显示上传中、已就绪、失败三种状态

### 44.9 状态与诊断 API 契约

固定接口：

- `GET /health`
- `GET /status/runtime`
- `POST /diagnostics/export`

`GET /health` 最少返回：

- app 状态
- adapter 状态
- runtime 状态
- provider 配置状态
- update 子系统状态

### 44.10 更新 API 契约

固定接口：

- `GET /updates/state`
- `POST /updates/check`
- `POST /updates/download`
- `POST /updates/install`
- `POST /updates/toggle-auto`

注意：

- UI 不应直接使用 Electron updater 原始事件
- 所有更新事件必须经由 adapter 或 main process 中间层转换为统一状态

### 44.11 错误码体系

第一版就要建立错误码，不要用字符串拼接错误。

建议前缀：

- `APP_` 应用级错误
- `CFG_` 配置错误
- `RT_` runtime 错误
- `UPD_` 更新错误
- `NET_` 网络错误
- `ATT_` 附件错误

示例：

- `CFG_PROVIDER_MISSING_API_KEY`
- `RT_START_FAILED`
- `UPD_DOWNLOAD_FAILED`
- `ATT_FILE_TOO_LARGE`

每个错误码必须绑定：

- 用户中文文案
- 是否可重试
- 是否建议打开设置页
- 是否允许导出诊断

### 44.12 共享类型必须由 `shared/contracts` 唯一导出

以下类型禁止多处重复定义：

- `BootstrapState`
- `ProviderSettings`
- `SessionSummary`
- `MessageItem`
- `UpdateState`
- `HealthSnapshot`
- `CapabilityFlags`
- `AppError`

否则前后端漂移会非常快。

---

## 45. 数据目录、文件结构与本地存储规则

### 45.1 目录设计总原则

必须把以下目录彻底分开：

- 配置
- 缓存
- 日志
- 运行时
- 更新下载
- 诊断导出

不能混在一个目录里。

### 45.2 推荐目录规则

Windows：

- 配置：`%APPDATA%\\<Brand>`
- 数据：`%LOCALAPPDATA%\\<Brand>`
- 缓存：`%LOCALAPPDATA%\\<Brand>\\Cache`
- 日志：`%LOCALAPPDATA%\\<Brand>\\Logs`
- 更新缓存：`%LOCALAPPDATA%\\<Brand>\\Updates`

macOS：

- 配置：`~/Library/Application Support/<Brand>`
- 缓存：`~/Library/Caches/<Brand>`
- 日志：`~/Library/Logs/<Brand>`
- 更新缓存：`~/Library/Application Support/<Brand>/Updates`

Linux：

- 配置：`~/.config/<brand-slug>`
- 数据：`~/.local/share/<brand-slug>`
- 缓存：`~/.cache/<brand-slug>`
- 日志：`~/.local/state/<brand-slug>/logs`
- 更新缓存：`~/.local/share/<brand-slug>/updates`

### 45.3 目录下的固定文件命名

配置目录：

- `app-settings.json`
- `provider-profiles.json`
- `feature-flags.json`

数据目录：

- `sessions.sqlite`
- `attachments/`
- `exports/`

日志目录：

- `app.log`
- `adapter.log`
- `runtime.log`
- `update.log`

诊断目录：

- `diagnostics/<timestamp>.zip`

运行时目录：

- `runtime/<runtimeVersion>/python/`
- `runtime/<runtimeVersion>/hermes/`
- `runtime/<runtimeVersion>/manifest.json`

### 45.4 敏感信息存储规则

`API Key` 不得明文落在普通 JSON 配置里。

优先级：

1. 系统安全存储
   - Windows Credential Manager
   - macOS Keychain
   - Linux Secret Service/Keyring
2. 若目标平台不可用，再使用应用层加密存储
3. 明文回退只允许开发模式，禁止生产默认启用

### 45.5 会话数据存储建议

第一版建议使用 `SQLite` 保存：

- 会话摘要
- 消息记录
- 附件索引
- 搜索字段预留

理由：

- 单文件可迁移
- 跨平台稳定
- 后续会话搜索与索引容易扩展

### 45.6 迁移规则

每次升级涉及数据结构变化时必须：

1. 写 migration 版本号
2. 先备份再升级
3. 升级失败可回退
4. 迁移脚本可重复执行或具备幂等检查

### 45.7 诊断包内容规则

第一版诊断包最少包含：

- app version
- runtime version
- upstream hermes version
- 平台信息
- capability flags
- 近 3 份日志
- provider 配置摘要（脱敏）
- update 状态摘要

绝对不能包含：

- 明文 API Key
- 用户完整私密会话全文，除非用户明确勾选导出

---

## 46. UI 页面逐页规范

### 46.1 全局布局规范

默认桌面布局建议固定为三段式，但右侧只在需要时出现：

- 左侧：会话栏
- 中间：主对话区
- 右侧：上下文/状态/设置抽屉

具体要求：

- 左栏默认宽度 `280px`
- 右侧抽屉默认宽度 `320px`
- 中间内容区最小宽度不得低于 `560px`
- 当窗口过窄时，右栏自动收起成抽屉
- 移动式极窄窗口只保留左栏切换按钮和主内容区

### 46.2 首页 / 首启向导

必须包含：

- 产品欢迎标题
- 简短一句中文价值说明
- 供应商选择
- API Key 输入
- Base URL 输入
- 模型名输入
- 连接测试按钮
- 完成并进入按钮

必须避免：

- 大段营销文案
- 英文专业术语堆砌
- 用户看不懂的 provider 参数表

### 46.3 主聊天页

必须包含：

- 当前会话标题
- 消息列表
- 底部输入框
- 附件按钮
- 发送按钮
- 中止按钮
- 空会话欢迎态

欢迎态文案必须中文自然，不能出现：

- `/help`
- `/model`
- `/config`
- `slash command`

因为第一版用户主流程不应依赖命令系统。

### 46.4 会话栏

必须包含：

- 新建会话
- 会话列表
- 当前会话高亮
- 重命名
- 删除
- 搜索入口（若第一版时间不足可延后入口，但数据结构需预留）

### 46.5 能力页

能力页固定分为：

- 工具
- 技能

每项只展示：

- 中文名称
- 一句话说明
- 开关状态
- 风险标记（如果适用）

### 46.6 设置页

固定 6 个分组：

1. 模型
2. 对话
3. 能力
4. 外观
5. 更新
6. 关于与诊断

模型页必须包含：

- 供应商类型
- API Key
- Base URL
- 模型名
- 连接测试

更新页必须包含：

- 当前版本
- 更新通道
- 自动更新开关
- 手动检查更新
- 当前更新状态

关于与诊断页必须包含：

- 产品版本
- 运行时版本
- 诊断包导出
- 打开日志目录
- 许可证/开源说明入口

### 46.7 状态页

第一版状态页不要做成监控中心，只做产品状态摘要。

必须显示：

- 应用状态
- runtime 状态
- provider 状态
- 上次检查更新时间
- 当前 capability 状态

### 46.8 更新提示规范

更新提示固定三阶段：

1. 检查中
2. 下载中
3. 下载完成，提示立即更新

文案要像普通桌面产品，不像开发工具。

建议使用：

- `正在检查新版本`
- `正在后台下载更新`
- `新版本已准备好，重启后即可完成更新`

禁止使用：

- `pull latest runtime`
- `apply upstream patch`
- `sync vendor`

### 46.9 错误页与恢复页

错误页必须提供：

- 中文错误标题
- 简短说明
- 建议操作
- 重新尝试
- 打开设置
- 导出诊断

不要直接把 Python Traceback 塞给用户。

### 46.10 文案语气规则

所有中文文案必须：

- 简洁
- 指向明确
- 不摆技术术语
- 不使用半中半英

可以保留英文的只有：

- 模型名
- 品牌保留字段
- API / URL / Header 技术输入项

### 46.11 术语映射表

必须统一以下中文术语：

- Session -> 会话
- Conversation -> 对话
- Provider -> 模型服务商
- Model -> 模型
- Tool -> 工具
- Skill -> 技能
- Attachment -> 附件
- Update -> 更新
- Runtime -> 运行时
- Diagnostics -> 诊断包

禁止一个页面叫“会话”，另一个页面又叫“Conversation”或“聊天线程”。

---

## 47. QA、发布与运维 SOP

### 47.1 第一版阶段完成定义（Definition of Done）

阶段 0 完成定义：

- 工程骨架建立
- Electron 能启动
- 前端能启动
- adapter 能启动
- runtime manager 能加载配置

阶段 1 完成定义：

- 首启向导完成
- 模型设置可保存
- 连接测试可用
- runtime 可健康启动

阶段 2 完成定义：

- 聊天可用
- 会话可保存与切换
- 附件可用
- 工具/技能开关可用

阶段 3 完成定义：

- 设置页可用
- 状态页可用
- 错误恢复可用
- 日志导出可用

阶段 4 完成定义：

- 自动更新可用
- 手动更新可用
- 三端安装包可构建
- Smoke test 通过

### 47.2 发布前回归清单

每个平台都必须回归：

- 安装
- 首启
- 模型配置
- 连接测试
- 聊天发送
- 生成中止
- 新建会话
- 会话切换
- 文件附加
- 图片附加
- 工具开关
- 技能开关
- 设置保存
- 检查更新
- 下载更新
- 重启安装更新
- 导出诊断

### 47.3 Beta 到 Stable 的门槛

必须满足：

- 无阻断安装问题
- 无阻断启动问题
- 无高频崩溃
- 无用户可见英文泄漏
- 更新流程至少通过一次完整验证

### 47.4 热修复流程

出现严重线上问题时：

1. 先停止有问题的 stable 分发
2. 保留旧版本可下载
3. 在 hotfix 分支修复
4. 只修阻断问题，不夹带新功能
5. 先发 beta 验证，再恢复 stable

### 47.5 问题严重级别

`S0`

- 无法安装
- 无法启动
- 更新导致应用不可用
- 明文泄露敏感信息

`S1`

- 无法聊天
- 模型配置失效
- 高频崩溃
- 会话损坏

`S2`

- 个别页面异常
- 特定平台能力失效
- 非阻断 UI 错误

`S3`

- 文案问题
- 轻微样式问题
- 非主流程体验问题

### 47.6 响应时间建议

- `S0`: 当天处理，优先回滚
- `S1`: 24 小时内出修复方案
- `S2`: 纳入最近版本
- `S3`: 常规排期处理

---

## 48. Codex 防跑偏、防幻觉、防垃圾实现操作规程

### 48.1 先验证，再编码

Codex 在做任何关键实现前，必须先验证：

- upstream 是否已有能力
- 这个能力是否已暴露为 API
- 是否需要 adapter 补桥
- 是否真的属于第一版范围

不允许：

- 凭感觉假设 Hermes 某接口存在
- 凭印象造一个 provider 配置结构
- 凭经验硬写一套会话模型

### 48.2 不确定时的处理顺序

遇到不确定项时，必须按这个顺序处理：

1. 查本文档
2. 查代码仓库
3. 查上游官方文档
4. 查实际运行行为
5. 若仍不确定，再把它标记为显式待确认项

禁止跳过前 4 步直接脑补。

### 48.3 新增代码前的自检问题

每次新增文件或功能前，先问自己：

1. 这是第一版必须的吗
2. 这层代码应该放在 UI、adapter、runtime-manager、还是 vendor patch
3. 这会不会让 UI 直接耦合 upstream
4. 这会不会把 Hermes 术语暴露给用户
5. 这会不会增加未来 upstream 同步冲突

只要有一项答案不清晰，就先不要写。

### 48.4 Codex 的具体工具使用建议

如果你是 Codex，推荐使用以下策略：

- 先用快速搜索工具扫仓库结构和关键文件
- 并行读取无依赖的文件
- 先建立计划再开工
- 并行子代理只用于独立范围
- 手工编辑统一用补丁方式，避免无控制的大块覆盖

### 48.5 Codex 的多代理提示模板

主控代理给子代理的任务必须像下面这样明确：

模板 A：Explorer

> 你只负责审计 `vendor/hermes-agent` 中与会话、provider 配置、web server 接口相关的能力。不要改代码。输出可复用 API、缺失接口、Windows 风险点，并列出涉及文件路径。

模板 B：Worker - Electron

> 你负责 `apps/desktop/electron`。目标是完成主进程、窗口管理、preload、安全桥、自动更新集成。你不是唯一开发者，不要回退他人修改。只修改你的责任目录，并在结果中列出修改文件。

模板 C：Worker - Adapter

> 你负责 `packages/adapter`。目标是完成 bootstrap-state、settings、sessions、messages、updates 的本地 API 骨架和错误映射。你不是唯一开发者，不要碰前端目录。只改你的责任目录，并列出修改文件。

模板 D：Worker - Frontend

> 你负责 `apps/desktop/frontend`。目标是完成首启向导、聊天页、会话栏、设置页、状态页，并全部使用中文文案与 shared contracts。你不是唯一开发者，不要改 adapter。

### 48.6 Codex 的提交与整合规则

每轮整合时必须检查：

- 是否破坏 shared contracts
- 是否新增英文裸字符串
- 是否把平台差异写进了前端
- 是否把上游内部结构泄露到 UI
- 是否引入了第一版范围外功能

### 48.7 Codex 禁止事项

严禁：

- 直接把 upstream Web UI 当最终成品
- 直接嵌入终端/TUI 作为主聊天 UI
- 在没有验证前提下修改 vendor 大量文件
- 为了“快”跳过更新系统
- 为了“稳”把用户体验退回命令行
- 因为某平台难做就删掉该平台目标

### 48.8 Codex 的结果输出规范

每完成一个阶段，输出必须包含：

- 已完成
- 未完成
- 已知风险
- 下一步
- 是否可运行
- 是否可测试

如果你不能明确回答这 6 项，说明你还没有完成这个阶段。

---

## 49. 合规、许可证与品牌遮罩边界

### 49.1 去 Hermes 感知不等于抹掉开源归属

这个边界必须讲清楚。

允许做的：

- 不在主 UI、主流程、主品牌上出现 Hermes
- 不让用户在使用时感知这是 Hermes 套壳

不允许做的：

- 删除开源许可证
- 删除必要归属说明
- 删除第三方依赖许可信息

### 49.2 第一版必须保留的合规项

必须具备：

- `LICENSES` 或等效第三方许可清单
- `About/关于` 页中的开源说明入口
- 产品仓库内的许可证与依赖归属说明

### 49.3 关于页建议

关于页对普通用户默认简洁，但要有入口：

- 产品版本
- 运行时版本
- 开源许可
- 隐私说明
- 诊断导出

### 49.4 品牌遮罩边界

第一版可以遮罩：

- 标题栏名称
- 主 UI 术语
- 错误提示
- 菜单
- 用户目录名
- 更新提示

第一版不能遮罩到违法或不合规的程度：

- 许可证归属
- 第三方依赖清单
- 法律声明

---

## 50. 新 AI 的首轮执行模板

如果你是接手开发的 AI，读完本文档后的第一轮行动必须长这样：

### 50.1 第一步输出

先输出一份简洁但具体的差距审计：

1. 当前仓库已有内容
2. 与本文档目标的差距
3. 第一版关键路径
4. 风险最高的 3 个点
5. 你接下来 1 到 3 个动作

### 50.2 第二步动作

直接开始做以下事情，不要停留在空谈：

1. 建立/确认目录骨架
2. 建立 shared contracts
3. 建立 adapter skeleton
4. 建立 Electron 壳
5. 跑通 bootstrap-state

### 50.3 第三步验证

验证以下结果：

- 应用是否能启动
- 前端是否能看到 bootstrap-state
- provider 配置是否能保存
- runtime 是否能健康启动

### 50.4 第四步继续实现

按以下顺序，不要乱：

1. 首启向导
2. 聊天页
3. 会话栏
4. 附件
5. 设置页
6. 状态页
7. 更新
8. 打包
9. 测试

### 50.5 最终要求

你不需要用户再反复解释项目方向。

你已经在本文档中拿到了：

- 目标
- 范围
- 技术选型
- 架构边界
- 版本路线
- 团队分工
- 预算区间
- 维护策略
- 外部参考资料
- Codex 协同开发方式

从现在开始，你的职责是执行，不是继续发散。
