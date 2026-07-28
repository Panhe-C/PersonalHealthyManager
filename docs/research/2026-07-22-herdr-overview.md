# Herdr：在终端里管理一群 AI 编程代理

> 核对日期：2026-07-22。本文将 **Herdr** 理解为 [`herdr.dev`](https://herdr.dev/) / [`ogulcancelik/herdr`](https://github.com/ogulcancelik/herdr) 这一开源项目；它目前是名称最吻合、资料最完整且仍活跃更新的产品。网络上另有一个同名的 [`herdr.org`](https://herdr.org/) 企业代理编排候补页，以及一个定位为待办/远程团队工具的 [`herdr.io`](https://herdr.io/products)，三者没有可核实的隶属关系。如果提问指的是后两者，本文结论不适用。

## 一句话定位

Herdr 是一个“理解 AI 编程代理状态的终端复用器”：它把 Codex、Claude Code、OpenCode、Kimi Code CLI 等代理放进持久的真实终端窗格中，让用户在一个终端里并行查看、切换、等待和继续多个代理。它更像是 **面向 AI 代理的 tmux/Zellij**，不是新的大模型，也不是替你决定开发任务的自主 Agent。[官网](https://herdr.dev/) · [官方 README](https://github.com/ogulcancelik/herdr)

## 它解决什么问题

同时运行多个 CLI 编程代理时，常见困难不是“怎么再开一个终端”，而是：哪个代理仍在工作、哪个在等授权、哪个已完成，以及关闭电脑或 SSH 断开后如何继续。Herdr 的做法是把终端运行进程放在后台 server 中，再由一个或多个终端 client 连接；client 退出后，server、窗格和代理仍继续运行。[概念说明](https://herdr.dev/docs/concepts/) · [持久化与远程访问](https://herdr.dev/docs/persistence-remote/)

它不把代理界面重新包装成聊天 UI。每个代理仍运行在自己的 PTY/终端中，原有 shell、日志、确认提示和键盘操作都保留；Herdr 只在外层提供工作区、标签页、分屏、状态侧栏和控制接口。[官网](https://herdr.dev/) · [代理说明](https://herdr.dev/docs/agents/)

## 核心功能与机制

### 1. 持久化的终端工作区

- 用 workspace、tab 和 pane 组织多个项目、shell、服务与代理；支持鼠标点击、拖动分屏，也提供类似 tmux 的 `Ctrl+B` 前缀键。[快速开始](https://herdr.dev/docs/quick-start/) · [概念说明](https://herdr.dev/docs/concepts/)
- 默认采用后台 server + 前台 client。退出终端或用 `Ctrl+B Q` detach 后，窗格继续运行；再次执行 `herdr` 即可重新连接。[持久化与远程访问](https://herdr.dev/docs/persistence-remote/)
- 可在远端机器上运行，再通过普通 SSH 或 `herdr --remote` 连接；这让代码、凭据和代理进程留在服务器上，同时本地终端只负责显示与输入。[远程访问文档](https://herdr.dev/docs/persistence-remote/)

### 2. 代理识别与状态聚合

Herdr 会识别窗格里的常见编程代理，并将状态汇总为 `working`、`blocked`、`done`、`idle` 或 `unknown`；侧栏再把 pane 状态向 tab 和 workspace 聚合，帮助用户直接跳到需要处理的代理。[概念说明](https://herdr.dev/docs/concepts/) · [代理说明](https://herdr.dev/docs/agents/)

状态来源有两类：

1. 部分代理通过 Herdr 安装的 hook/plugin 直接上报生命周期或原生会话标识；
2. 其他代理通过“screen manifest”匹配终端底部可见 UI，推断其正在工作、等待批准或已经空闲。

官方特别说明，Codex、Claude Code、Copilot CLI 等集成主要提供原生会话标识，状态仍依赖屏幕规则，因为现有 hook 不能覆盖全部交互转移。[代理说明](https://herdr.dev/docs/agents/) · [集成说明](https://herdr.dev/docs/integrations/)

### 3. 会话恢复

普通 detach 不会停止进程。完整停止 server 后再次启动时，Herdr 能恢复工作区布局、终端历史，并在安装相应集成的情况下，通过各代理官方支持的 session id 恢复 Codex、Claude Code、OpenCode 等会话；恢复深度取决于具体代理与集成版本。[持久化与远程访问](https://herdr.dev/docs/persistence-remote/) · [集成说明](https://herdr.dev/docs/integrations/)

### 4. 面向人和自动化的控制面

除交互式 TUI 外，Herdr 还有 CLI 和本地 socket API，可列出、读取、聚焦、启动、发送输入或等待某个代理状态，也能创建工作区、窗格和 Git worktree。它适合被脚本或上层代理驱动，但控制对象仍是真实终端进程。[CLI 参考](https://herdr.dev/docs/cli-reference/) · [Socket API](https://herdr.dev/docs/socket-api/)

### 5. 集成和插件

- 官方集成可给 Codex、Claude Code、Pi、OpenCode、Kimi、Copilot CLI、Devin CLI 等补充状态上报或会话恢复能力；安装集成会修改对应工具的 hook/plugin 配置，例如 Codex 的 `hooks.json` 与 `config.toml`。[集成说明](https://herdr.dev/docs/integrations/)
- Herdr 插件是带 manifest 的本地可执行程序，可添加 action、event hook 和终端 pane；可以从 GitHub 仓库安装，也可链接本地目录。[CLI 插件说明](https://herdr.dev/docs/cli-reference/#plugins) · [Socket API 的插件说明](https://herdr.dev/docs/socket-api/#plugin-apis)

## 适合谁

Herdr 比较适合：

- 已经在终端里使用两种或更多 CLI 编程代理，并经常忘记哪个窗口在等自己的人；
- 同时维护多个仓库、分支或 worktree，希望让代理、测试和开发服务器持续运行的开发者；
- 在服务器、Mac mini、云主机上运行代理，并希望从笔记本甚至手机 SSH 重新接入的人；
- 想用脚本/API 读取代理输出、等待状态并进行轻量自动化的高级用户。

这些适用判断来自其持久终端、SSH、代理状态聚合和 API 能力，是对官方功能的归纳。[官网](https://herdr.dev/) · [工作方式](https://herdr.dev/docs/how-to-work/) · [CLI 参考](https://herdr.dev/docs/cli-reference/)

不太适合：只偶尔开一个 Agent 的用户、偏好完整桌面 IDE/可视化代码审查的人，以及期待工具自动拆任务、决定代理分工并保证合并正确的人。Herdr 提供运行与控制基础设施，但并不自动替代任务规划、代码审查和 Git 冲突处理；这是根据官方产品边界作出的判断。[官网对比](https://herdr.dev/) · [官方文档](https://herdr.dev/docs/)

## 当前可用性

- 官方稳定版支持 Linux 和 macOS；Windows 原生版仍是 preview-only beta，且 Windows 上的 `herdr --remote` 尚不包含在该 beta 中。[安装文档](https://herdr.dev/docs/install/) · [远程访问文档](https://herdr.dev/docs/persistence-remote/)
- 可通过官方安装脚本、Homebrew、mise、Nix 或 GitHub Releases 安装；项目使用 Rust，并可从源码构建。[安装文档](https://herdr.dev/docs/install/) · [GitHub README](https://github.com/ogulcancelik/herdr)
- 2026-07-22 核对官方发布清单时，稳定版本为 `0.7.5`、client/server protocol 为 `17`；仍处在 `0.x` 快速演进阶段。[官方 latest.json](https://herdr.dev/latest.json)
- 官网声明无需 Herdr 账号、不是托管控制台、没有 telemetry；但默认仍会联网检查版本和代理检测规则更新，这两项可以分别关闭。[官网](https://herdr.dev/) · [配置参考](https://herdr.dev/docs/config-reference/)
- 源码采用 AGPL-3.0-or-later，同时提供商业授权；不能满足 AGPL 条件的组织需另行评估商业许可。[GitHub README 的 License 部分](https://github.com/ogulcancelik/herdr#license)

## 限制与需要谨慎之处

### 状态不是绝对可靠

基于屏幕规则识别的代理可能出现误判。官方明确说明：对未匹配到的新型确认提示，已知代理可能先显示为 `idle` 而不是 `blocked`；不受支持的代理虽然仍可正常运行，但可能没有丰富状态。这意味着侧栏适合做导航和提醒，不应被当作任务已经成功完成的证明。[代理说明](https://herdr.dev/docs/agents/)

### “持久化”不等于所有上下文都无损恢复

detach 时进程保持运行，与完整 server 停止后的恢复是两回事。后者可能只是恢复布局/历史，能否恢复原生 Agent 会话取决于代理是否有可用 session id、是否安装当前版本的集成，以及代理自身的恢复能力。[持久化与远程访问](https://herdr.dev/docs/persistence-remote/) · [集成说明](https://herdr.dev/docs/integrations/)

### 集成会修改其他工具的配置

例如 Codex 集成会写入 hook 脚本、更新 `hooks.json`，并在 `config.toml` 中打开 hooks 功能；卸载时保留其中一部分配置。安装前应备份或审查变更，尤其是已经有自定义 hooks 的环境。[集成说明](https://herdr.dev/docs/integrations/#codex)

### 社区插件等同于运行第三方代码

插件本质是本地可执行命令，安装过程还可运行 manifest 声明的构建命令。官方插件市场只是自动索引带 `herdr-plugin` GitHub topic 的公开仓库，并非审核目录；安装前应检查仓库所有者、源码、manifest、构建脚本和所需权限，不应盲目使用 `--yes`。[CLI 插件说明](https://herdr.dev/docs/cli-reference/#plugins) · [Marketplace 说明](https://herdr.dev/docs/preview/marketplace/)

### 安装与更新仍需供应链常识

官网的一行安装方式是 `curl ... | sh`。它方便，但会直接执行联网下载的脚本；更谨慎的做法是先阅读脚本，或使用 Homebrew/Nix/手工下载并核对发布来源。官方也区分 stable 与 preview 通道，preview 可能回归；生产环境宜固定稳定版本。[安装文档](https://herdr.dev/docs/install/)

### 默认存在有限的联网行为

“无 telemetry”不等于完全离线：默认配置会访问 `herdr.dev` 检查新版本及远程 agent-detection manifests；远程连接也可能按需下载匹配版本的二进制。高度敏感或隔离环境需要关闭 `update.version_check`、`update.manifest_check`，并提前审查安装与远端 bootstrap 流程。[配置参考](https://herdr.dev/docs/config-reference/) · [远程访问文档](https://herdr.dev/docs/persistence-remote/)

## 简短结论

Herdr 的价值不在于“再造一个编码 Agent”，而在于补齐多 Agent 工作时的终端基础设施：持久运行、统一观察、快速切换、SSH 重连以及可脚本化控制。对已经大量使用 Codex/Claude Code 等 CLI 的人，它可以显著减少窗口管理和人工轮询；对只运行单个 Agent 的人，收益可能不足以抵消新增的一层终端、配置和状态推断复杂度。

建议把它理解为 **agent-aware tmux**，并将“Agent 状态”“会话恢复”“第三方插件”分别按提示信息、兼容能力和可执行代码来审慎评估。

## 主要一手来源

- [Herdr 官网](https://herdr.dev/)
- [官方文档首页](https://herdr.dev/docs/)
- [快速开始](https://herdr.dev/docs/quick-start/)
- [Agents：支持范围、状态机制和误判边界](https://herdr.dev/docs/agents/)
- [Integrations：各代理 hook/plugin 的具体行为](https://herdr.dev/docs/integrations/)
- [Persistence and remote access](https://herdr.dev/docs/persistence-remote/)
- [安装和平台支持](https://herdr.dev/docs/install/)
- [配置参考](https://herdr.dev/docs/config-reference/)
- [CLI 参考](https://herdr.dev/docs/cli-reference/)
- [Socket API](https://herdr.dev/docs/socket-api/)
- [官方 GitHub 仓库](https://github.com/ogulcancelik/herdr)
- [官方版本清单](https://herdr.dev/latest.json)
