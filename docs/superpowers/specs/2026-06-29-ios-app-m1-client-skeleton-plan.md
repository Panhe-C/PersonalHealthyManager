# iOS App · M1 客户端骨架 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M1 阶段，依赖 M0 完成）

## 这份清单的范围

M1 目标：**搭出能登录、能用 Bearer 拉到真实数据的 Expo/RN 客户端骨架**。不实现具体业务页面（今日/计划等留给 M2），只把"地基"打牢：工程脚手架、导航、鉴权流、API client、类型契约接入、设计系统底座。

**前置依赖（M0 必须先就位）**：

- T1 Bearer：`/api/auth/login` 返回 token、`/api/auth/refresh` 可用、`withUser` 接受 `Authorization: Bearer`。
- T3 契约：P0 端点在 `/api/v1` 下有 zod schema 可复用。

**仓库形态决策（执行前先定，见开放问题）**：客户端是放进现有 repo 的 `apps/mobile`（monorepo，便于共享 zod）还是独立 repo。本清单默认 **monorepo + 共享 contracts 包**。

执行顺序：T1 脚手架 → T2 共享契约 → T3 API client → T4 鉴权流 → T5 导航 → T6 设计底座 → T7 联调。

---

## T1 Expo 工程脚手架

### 步骤

1. **目录形态**（默认 monorepo）：
   - 现有项目根引入 workspace（npm workspaces）：`apps/mobile`（Expo App）、`packages/contracts`（共享 zod，T2 建）。
   - 现有 Next.js 代码归位（保持在根或迁 `apps/web`，二选一——为降低对现有 Web 的扰动，默认**保持现有结构不动，仅新增 `apps/mobile` 与 `packages/contracts`**）。
   - **回归验收**：引入 workspaces 会改变 `node_modules` 提升策略，可能影响 Next.js 构建。改造后必须跑 `npm run build` + `npm test` 确认 Web 无回归，再继续 T2。
2. **建 Expo App**：`apps/mobile` 用 Expo（managed）+ TypeScript 模板，`expo-router`（文件路由，心智接近 Next App Router）。
3. **核心依赖**：
   - `expo-router`（导航）
   - `@tanstack/react-query`（数据层）
   - `expo-secure-store`（Keychain 存 token）
   - `zod`（与后端共享）
   - 可选：`nativewind`（Tailwind 风格样式，复用 Web 设计 token 心智）
4. **基础配置**：`app.json`（bundleIdentifier、应用名、图标占位）、TypeScript path alias、ESLint/Prettier 对齐现有规范。
5. **环境变量**：用 `expo-constants` + `app.config.ts` 注入 `API_BASE_URL`（dev/staging/prod 三套，对应 M0 §3）。

### 验收（T1）

- `npx expo start` 能在 iOS 模拟器/真机起一个空白首页。
- TS、lint 通过。

---

## T2 共享契约包 `packages/contracts`

### 步骤

1. 新建 `packages/contracts`，把 M0-T3 定义的 zod schema（auth/profile/goals/plan/training/agent 等的 request/response）放这里，作为 web 与 mobile 的单一事实源。
2. **默认方案：后端也从该包 import**，把 `src/domain/validation.ts` 里的 zod schema 迁到 `packages/contracts`，后端改 import 路径。这样契约是真正的单一事实源，避免「mobile 用包、后端用自己那份」导致的两份漂移（运行时校验语义会悄悄分叉，类型测试防不住）。
   - 若 monorepo 改造成本或 Web 扰动过大，退路是「先只让 mobile 依赖包，后端暂时各自维护」——但这是退路而非默认，需在执行时显式确认并补强类型+运行时双重测试防漂移。
3. 导出推导类型：`export type LoginResponse = z.infer<typeof loginResponseSchema>` 等。

### 验收（T2）

- `apps/mobile` 能 `import { loginResponseSchema } from "@hbm/contracts"` 并通过类型检查。

---

## T3 API Client（注入 Bearer + 自动刷新）

### 步骤

1. 封装 `apps/mobile/src/api/client.ts`：基于 `fetch`，统一拼 `API_BASE_URL` + `/api/v1`。
2. **请求拦截**：自动注入 `Authorization: Bearer <accessToken>`（从内存 + SecureStore 读）。
3. **响应拦截**：
   - 401 → 用 refreshToken 调 `/api/auth/refresh` 换新 access → 重放原请求；刷新失败 → 清 token + 跳登录。
   - 防并发刷新风暴：刷新中的请求挂起，单飞（single-flight）一次刷新后统一重放。
4. **响应校验**：用对应 `responseSchema.parse` 校验，失败抛结构化错误。
5. **错误模型**：统一映射后端 `{ error, code }` 为客户端 `ApiError`。
6. 与 TanStack Query 集成：`queryFn`/`mutationFn` 走该 client。

### 验收（T3）

- 调任意受保护端点：access 有效→直接成功；access 过期→自动刷新后成功；refresh 失效→跳登录。
- 单元测试覆盖 401 自动刷新 + 单飞逻辑（mock fetch）。

---

## T4 鉴权流与会话状态

### 步骤

1. **token 存储**：`apps/mobile/src/auth/tokenStore.ts` 封装 SecureStore 读写（accessToken/refreshToken/过期时间）。
2. **会话 context/hook**：`useAuth()` 暴露 `user / signIn / signOut / status(loading|authed|guest)`。
3. **登录页**：邮箱 + 密码 → 调 `/api/auth/login` → 存 token → 进主 Tab。复刻现有 Web 登录的字段与错误提示文案。
4. **登出**：调 `/api/auth/logout`（带 token）+ 清 SecureStore + 回登录页。
5. **启动恢复**：冷启动读 SecureStore，有有效 token 直接进主界面，否则登录页。
6. **路由守卫**：expo-router 用 `(auth)` 与 `(app)` 两个 group，根据 `status` 重定向。

### 验收（T4）

- 全新安装 → 登录 → 杀进程重开 → 仍是登录态（token 持久化生效）。
- 登出后回到登录页，旧 token 不再可用。

---

## T5 导航骨架（底部 Tab）

### 步骤

1. expo-router 文件结构：`app/(app)/(tabs)/` 下建 5 个占位 Tab —— `today`、`plan`、`insights`、`coach`、`settings`（对应 spec §5 导航）。
2. 每个 Tab 一个占位屏：标题 + 一个"已连接后端"的真实数据探针（如今日 Tab 拉一次 profile/plan 概要，证明端到端通）。
3. Tab Bar 图标（用现有 lucide 的 RN 版 `lucide-react-native`，与 Web 图标体系一致）。

### 验收（T5）

- 5 个 Tab 可切换，至少一个 Tab 展示从后端真实拉取的数据（非 mock）。

---

## T6 设计系统底座

### 步骤

1. **Design Token**：从 Web 的 `app/globals.css` 提取颜色/间距/圆角/字号，落成 `apps/mobile/src/theme/tokens.ts`（或 nativewind config），保证与 Web 视觉一致。
2. **基础组件**：`Button` / `Card` / `Text` / `Screen`(含 safe-area) / `Spinner` / `ErrorState` 一套最小集，供 M2 复用。
3. **safe-area**：用 `react-native-safe-area-context` 处理刘海/底部 home indicator。
4. **加载/错误/空态**：统一三态组件，接 TanStack Query 的 `isLoading/error/empty`。

### 验收（T6）

- 占位屏使用统一组件渲染，明暗/安全区表现正常。

---

## T7 端到端联调

### 步骤

1. 真机/模拟器指向本地 M0 后端（`API_BASE_URL` 切 dev），跑通：登录 → Tab 拉数据 → token 过期自动刷新 → 登出。
2. 切 staging（若已部署）复跑一遍。
3. 记录已知差异/缺口（哪些端点 M0 还没补齐），回填到 M0-T3 的缺口清单。

### 验收（T7）

- 在真机上完成「登录→看到真实数据→刷新→登出」完整闭环。

---

## M1 总验收

- Expo App 可在 iOS 真机运行，登录后用 Bearer 访问 `/api/v1`，token 自动刷新，会话持久化。
- 5 Tab 导航骨架 + 设计底座就绪，至少一处展示真实后端数据。
- 共享 contracts 包被客户端复用，类型贯通。
- 交付物可直接进入 M2（往各 Tab 填业务页面）。

## 开放问题（执行前需定）

1. **仓库形态**：monorepo（`apps/mobile` + `packages/contracts`，共享类型最顺）vs 独立 repo（隔离干净但类型靠发包/复制）。默认 monorepo。
2. **样式方案**：nativewind（复用 Tailwind 心智）vs RN StyleSheet + token。默认 nativewind，团队若不熟 Tailwind 则用后者。
3. **后端契约是否立即改为依赖共享包**：默认**立即统一**（后端也从 packages/contracts import），这是 monorepo 的最大价值；若改造成本过大再退到「仅 mobile 依赖 + 强测试防漂移」。
4. **Apple Developer 账号 / bundleId**：真机调试与后续 TestFlight 需要，建议 M1 期间就把账号与 bundleId 定下来。
