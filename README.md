# 法语词卡

移动端优先的 A1–A2 法语背词 PWA。每天学习一整课，使用 FSRS 安排到期复习，并自动维护强化记忆本。

生产架构为自托管 Next.js + 普通 PostgreSQL。应用只供一个人使用，通过固定账号、密码哈希和 HttpOnly 会话 Cookie 登录，不依赖 Supabase 或 Vercel。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```env
DATABASE_URL=postgresql://french_cards:数据库密码@127.0.0.1:5432/french_cards
DATABASE_POOL_SIZE=10
DATABASE_SSL=disable
APP_USERNAME=owner
APP_PASSWORD_HASH=scrypt:生成的盐:生成的哈希
SESSION_SECRET=至少32位的随机字符串
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

`DATABASE_URL`、`APP_PASSWORD_HASH` 和 `SESSION_SECRET` 只能保存在服务器环境变量中，不能提交到 Git。

在 PowerShell 中安全生成登录密码哈希：

```powershell
$secure = Read-Host "输入登录密码（至少12位）" -AsSecureString
$plain = [Net.NetworkCredential]::new('', $secure).Password
$plain | npm.cmd run auth:hash
Remove-Variable plain
```

把输出的整行 `scrypt:...` 填入 `APP_PASSWORD_HASH`。会话密钥可以这样生成：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## PostgreSQL 初始化

在 PostgreSQL 管理账号下创建独立用户和数据库：

```sql
create role french_cards login password '请替换为强数据库密码';
create database french_cards owner french_cards encoding 'UTF8';
```

填写 `.env.local` 后执行：

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

迁移记录保存在 `schema_migrations`。已经执行的迁移如果后来被修改，迁移工具会拒绝继续，避免生产数据库静默漂移。`db:seed` 可以重复执行，不会清除学习记录。

## 内容生产与审核

按课程使用 Codex 在本地生成内容：

```powershell
npm.cmd run content:codex:course -- a1-u1l1
npm.cmd run content:codex:all
npm.cmd run content:codex:merge
npm.cmd run data:seed
```

人工完成 A1/A2 审核后，使用以下命令固化批准状态并重建 PostgreSQL 种子：

```powershell
npm.cmd run content:approve:all
npm.cmd run content:codex:merge
npm.cmd run data:seed
```

审核清单和每条内容的 SHA-256 哈希保存在 `data/content-approval-manifest.json`。例句、翻译或用法变化后必须重新审核。

原始 Excel 和 PDF 始终作为只读来源。不要在审核内容合并后运行 `data:import`，否则会从原始 Excel 重新生成词表。

## 数据同步与安全边界

- 浏览器按操作提交学习记录，不会用完整客户端状态覆盖数据库。
- 每日课程分配和答题通过 PostgreSQL 函数在单个事务中完成。
- 答题使用幂等 UUID、卡片状态锁和冲突重试。
- 网络失败的操作保留在浏览器同步队列，联网后可重试。
- 明确离线时不能提交正式学习评分。
- Service Worker 只缓存离线页、PWA 图标和版本化静态资源；登录、管理页面、用户 HTML 和 API 不进入公共缓存。
- 登录接口有基础频率限制；生产环境还应在 Nginx 对 `/api/auth/login` 配置限速。

### 登录防暴力破解

- PostgreSQL 按来源 IP 记录失败：15 分钟内第 5 次失败后锁定 15 分钟。
- 同时对唯一账号做全局保护：30 分钟内第 12 次失败后锁定 30 分钟，可阻挡分布式换 IP 尝试。
- 限流键是使用 `SESSION_SECRET` 计算的 HMAC，数据库不保存原始 IP 或用户名。
- 限流状态保存在 `auth_login_limits`，应用重启后仍然有效；30 天未更新的记录会自动清理。
- 生产会话 Cookie 使用 `__Host-` 前缀、`Secure`、`HttpOnly` 和 `SameSite=Lax`，有效期为 7 天。
- 会话同时绑定当前密码哈希；修改 `APP_PASSWORD_HASH` 后，旧设备上的会话会自动失效。
- Nginx 示例位于 `deploy/nginx-french-cards.conf.example`，还会在进入 Node.js 前限制登录接口为每个 IP 每分钟 5 个请求。

确认攻击已经停止后，如需紧急解除所有登录锁定，可在数据库管理终端执行：

```sql
delete from auth_login_limits;
```

应用必须只监听 `127.0.0.1`，由 Nginx 写入可信的 `X-Real-IP`。如果直接把 Node.js 的 3000 端口暴露到公网，攻击者可能伪造转发头并削弱 IP 限流。

## 自有服务器部署

服务器建议使用 Linux、Node.js LTS、PostgreSQL 和 Nginx。应用只监听 `127.0.0.1:3000`，由 Nginx 通过 HTTPS 反向代理。

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run test
npm run typecheck
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

生产环境的 `NEXT_PUBLIC_APP_URL` 应改成 `https://你的域名`。PWA 安装和 Service Worker 需要 HTTPS。数据库应只监听本机或内网，不要把 PostgreSQL 5432 端口直接暴露到公网。

正式更新前备份数据库：

```bash
pg_dump --format=custom --file=french_cards_$(date +%F).dump french_cards
```

随后依次执行迁移、测试、构建和应用重启。

## 本地验证

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```
