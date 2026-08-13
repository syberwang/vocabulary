# 法语词卡

移动端优先的 A1-A2 法语背词 PWA。每天学习一整课，使用 FSRS 安排到期复习，并自动维护强化记忆本。

## 本地运行

```powershell
npm.cmd install
npm.cmd run data:import
npm.cmd run dev
```

未配置 Supabase 时应用运行在“本地演示”模式，学习进度保存在当前浏览器。复制 `.env.example` 为 `.env.local` 并填写 Supabase 环境变量后，将启用邀请制 Magic Link 和云同步。

## Supabase

1. 在 Supabase SQL Editor 按文件名顺序运行 `supabase/migrations/` 下的迁移（当前为 `0001_initial.sql`、`0002_content_provenance.sql`）。
2. 运行 `supabase/seed.sql` 导入 72 课和 1,436 条词汇。
3. 在 Auth URL Configuration 中加入生产域名的 `/auth/callback`。
4. 将第一个管理员的 `profiles.is_admin` 设置为 `true`，之后从 `/admin` 邀请用户。

所有用户学习表均启用 RLS；`SUPABASE_SECRET_KEY` 只能配置在 Vercel 服务端环境变量中。

## Codex 按课程本地生成（无需 API 余额）

```powershell
npm.cmd run content:codex:course -- a1-u1l1
npm.cmd run content:codex:all
npm.cmd run content:codex:merge
npm.cmd run data:seed
```

`content:codex:all` 会在 `data/content-courses/` 生成 72 个独立课程文件。生成过程只读取本地 `data/vocabulary.json`，不会把词表发送给第三方服务。人工讲义校订内容标记为 `manual / low`；其余本地草稿标记为 `codex / medium|high / needs_review`，可在管理员后台逐课复核并批准。

合并后的完整性结果写入 `data/content-validation-report.json`。只有 0 个校验问题时才应重新生成 Supabase 种子。

## OpenAI Batch（可选）

```powershell
npm.cmd run content:prepare
Copy-Item .env.content.example .env.content.local
# 在本机编辑 .env.content.local，填入 OPENAI_API_KEY；不要把密钥发到聊天中
npm.cmd run content:submit
npm.cmd run content:download
npm.cmd run content:merge
npm.cmd run data:seed
```

`content:prepare` 生成严格 JSON Schema 的 `/v1/responses` Batch 请求；`content:submit` 上传并创建 24 小时批处理；完成后用 `content:download` 下载结果，再由 `content:merge` 校验，最后用 `data:seed` 重建数据库种子。密钥只放在被 Git 忽略的 `.env.content.local`，Next.js 和 Vercel 生产配置不读取该文件。不要在合并后运行 `data:import`，否则会从只读原始 Excel 重新生成并覆盖待审核的 AI 内容。

合并脚本不会自动批准 AI 内容：低风险结果进入 `draft`，其他结果进入 `needs_review`，目标词缺失等问题写入审核清单。管理员需在 `/admin` 完成校订和审批。

## 验证与部署

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

将仓库连接 Vercel，配置 `.env.example` 中的生产变量后部署。PWA 必须通过 HTTPS 访问才能安装。
