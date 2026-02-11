# Job Assistant Code Test Spec（仿 Jobpin 核心路径）

## 1. 项目目标
实现一个聚焦「登录后后台体验」的求职助手应用。首页不追求高保真视觉，还原核心产品路径即可：

`注册/登录 -> onboarding -> 上传简历并解析 -> Dashboard 查看 -> Stripe 订阅`

## 2. 技术栈要求
- 框架：`Next.js 14 (App Router) + TypeScript`
- 认证：`Clerk`
- 数据库：`Supabase (Postgres)`
- 支付：`Stripe Subscriptions (Test mode)`
- 部署：`Vercel`（推荐）

## 3. 功能范围（必须实现）

### 3.1 登录 / 注册（Clerk）
- 使用 Clerk 官方集成完成认证。
- 支持：邮箱登录注册、Google 登录。
- 受保护路由：`/dashboard`（未登录自动跳转到登录页）。
- 使用 Clerk 默认邮箱验证流程即可，不要求自定义验证码系统。

### 3.2 Onboarding（统一为 3 步）
首次登录进入后台时展示 3 步引导，并持久化步骤状态：
- Step 1：完善 Profile（姓名、目标岗位、年限、城市等）
- Step 2：上传简历
- Step 3：查看解析结果与 Dashboard 关键区域

要求：
- 刷新页面后步骤状态仍保留（DB 或 localStorage，推荐 DB）。
- 完成关键动作后自动推进步骤（如上传成功后进入 Step 3）。

### 3.3 简历上传与结构化解析
- 支持 PDF 上传（可扩展 doc/docx）。
- 上传后解析并展示结构化结果，至少包含：
  - 基本信息：姓名、邮箱、电话
  - 技能列表：标签形式
  - 工作经历：公司、职位、时间范围（至少识别 1 段）
- 页面必须有完整状态反馈：`loading / success / parse_failed / empty`
- 支持重新上传并覆盖结果。

解析方案二选一：
- A：文本提取 + 正则/规则解析
- B：第三方 Parser 或 LLM API

### 3.4 Dashboard（登录后）
至少包含以下模块：
- 欢迎区：用户信息（从 Clerk）
- Onboarding 进度区：显示当前步骤，可点击跳转
- 简历区：展示结构化解析结果 + 重新上传
- 订阅区：显示当前计划和状态（Free/Active/Canceled）

### 3.5 Stripe 订阅（Test mode）
- 使用 Stripe Checkout 订阅月付计划（测试卡即可）。
- 支付后通过 webhook 同步订阅状态到本地 DB。
- DB 至少记录：
  - `clerk_user_id`
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `plan`
  - `status`（active/trialing/past_due/canceled）
- Dashboard 根据订阅状态动态显示内容。
- 可选加分：接入 Stripe Customer Portal（管理订阅）。

## 4. 非功能要求

### 4.1 异常状态必须覆盖
- 未登录访问受保护页面：跳转登录
- 上传失败：格式/大小/网络错误提示
- 解析失败：可重试，不崩溃
- 订阅 webhook 失败：有日志，可重放
- 空数据：明确 Empty State，而非白屏

### 4.2 安全与配置
- 密钥全部使用 `.env` 管理
- 前端不暴露服务端密钥
- 文件上传做类型和大小校验
- API 返回统一错误结构，避免泄漏堆栈给用户

### 4.3 可观测性
- 统一 logger（区分 `info/warn/error`）
- 关键事件建议埋点：注册成功、上传成功、订阅成功

## 5. 建议数据模型（最小）
- `profiles`：`id`, `clerk_user_id`, `name`, `target_role`, `years_exp`, `city`, `created_at`
- `onboarding_states`：`id`, `clerk_user_id`, `current_step`, `is_completed`, `updated_at`
- `resumes`：`id`, `clerk_user_id`, `file_url`, `raw_text`, `parsed_json`, `created_at`
- `subscriptions`：`id`, `clerk_user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`

## 6. 验收路径（Happy Path）
1. 新用户注册并登录
2. 进入 Dashboard，看到 Step 1 引导
3. 完成 Profile，步骤推进到 Step 2
4. 上传简历并解析成功，步骤推进到 Step 3
5. 在 Dashboard 查看结构化简历数据
6. 点击订阅，跳转 Stripe Checkout（Test 卡支付）
7. 支付成功后返回，Dashboard 显示 Active 订阅

## 7. 必交材料
- 源码
- `README.md`（运行方式、env、架构说明）
- `PROMPTS.md`（你如何拆分并使用 AI 的关键过程）
- 演示证据（截图/录屏）

## 8. PROMPTS.md 记录要求（Vibe Coding）
至少记录以下 5 类提示词与迭代：
1. 架构规划（目录、数据流、schema）
2. Clerk 集成（middleware、路由保护）
3. 简历上传与解析（含失败重试）
4. Stripe 订阅（Checkout + webhook）
5. Dashboard 交互优化（状态与引导）

每条建议记录：
- 你的 prompt
- AI 输出摘要
- 你做了什么修正
- 为什么修正

## 9. 评分维度建议（可直接用于评审）

### A. 功能完成度（40%）
- 认证闭环（10%）：注册/登录/路由保护可用
- Onboarding（10%）：3 步流程可推进、可恢复
- 简历解析（10%）：上传、解析、展示、重传完整
- 支付闭环（10%）：Stripe Test 支付 + 状态回写成功

### B. 产品与 UX（20%）
- 信息架构（10%）：用户能清楚知道下一步做什么
- 状态体验（10%）：loading/empty/error/success 都清晰

### C. 工程与代码质量（20%）
- 架构清晰（8%）：组件边界、服务层、类型定义明确
- 健壮性（8%）：错误处理、兜底、重试机制
- 安全配置（4%）：env 使用正确、敏感信息不泄漏

### D. Vibe Coding 使用质量（10%）
- 是否分模块多轮迭代，而非一次性大 prompt
- 是否体现 AI 参与设计、重构、测试

### E. 反思与取舍（10%）
- 是否清楚说明关键技术取舍（解析方案、状态存储、支付实现）
- 是否说明已知限制与下一步优化

## 10. 评分证据清单（建议作为提交附件）
- 认证流程录屏（未登录访问 `/dashboard` 被拦截）
- Onboarding 步骤推进与刷新恢复录屏
- 简历上传成功 + 失败场景截图
- Stripe Checkout 测试支付截图
- Stripe webhook 事件日志截图
- Dashboard 订阅状态变化前后截图

## 11. 明确扣分项
- 流程口径不一致（例如步骤数前后冲突）
- 只有前端页面，无真实订阅状态回写
- 只展示“成功态”，没有异常态
- `PROMPTS.md` 仅贴对话，没有迭代说明
- 密钥硬编码在仓库中
