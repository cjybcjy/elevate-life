# 生产发布环境校验

正式生成 Google Play TWA、Android 国内市场包或 iOS 包之前，先把发布环境从本地示例值切到真实值，并运行：

```bash
npm run release:env:next
npm run release:env:draft
npm run release:env:template:check
npm run release:check
```

这个命令会拦截 `example.com`、localhost、非 HTTPS、包名不一致、TWA manifest URL 不一致、缺少 Android SHA-256 指纹等常见提审前错误。

可先运行 `npm run release:env:next` 查看当前缺失项、私有 env 目标位置和后续命令；再运行 `npm run release:env:draft` 生成一份私有 release env 草稿。如果本地已有签名 AAB，它会尝试带出 `ANDROID_SHA256_CERT_FINGERPRINTS`。再参考 `docs/release/store-release.env.example` 整理本机或 CI 的真实环境变量。草稿和模板只用于交接变量名和填写顺序，不要把填好后的 secret 文件提交到仓库。

## 必填变量

- `APP_PUBLIC_BASE_URL`：真实 HTTPS 域名，只填 origin，例如 `https://app.your-domain.com`，不要带路径。
- `AUTH_URL`：必须与 `APP_PUBLIC_BASE_URL` 使用同一个 HTTPS origin，供 Auth.js 固定可信主机。
- `APP_SUPPORT_EMAIL`：真实支持邮箱，会用于商店后台、隐私政策和支持页。
- `CAPACITOR_SERVER_URL`：必须等于 `APP_PUBLIC_BASE_URL`，供 Capacitor Android/iOS 壳加载线上 Next.js 服务。
- `CAPACITOR_APP_ID`：稳定反向域名包名 / Bundle ID，例如 `com.company.elevatelife`。首次上架后不要轻易修改。
- `ANDROID_PACKAGE_NAME`：必须等于 `CAPACITOR_APP_ID`，用于 Google Play TWA、Digital Asset Links 和 Android 原生包。
- `ANDROID_SHA256_CERT_FINGERPRINTS`：release 上传证书 / Play App Signing 证书的 SHA-256 指纹，多个用英文逗号分隔。
- `TWA_MANIFEST_URL`：必须等于 `$APP_PUBLIC_BASE_URL/manifest.webmanifest`。
- `STORE_SCREENSHOT_BASE_URL`：正式截图时建议等于 `APP_PUBLIC_BASE_URL`，确保截图来自审核环境。

## Web 安全基线

网页/PWA 分发不经过应用商城审核，因此首发建议保持私有或邀请注册，不要直接开放自由注册。应用在未配置 `REGISTRATION_MODE` 时会默认关闭注册；需要邀请注册时显式设置：

```bash
REGISTRATION_MODE=invite
REGISTRATION_INVITE_CODE=<至少 16 位的随机值>
```

只有在验证码、邮件验证、账号风控、滥用告警和边缘限流都已接入后，才考虑设置 `REGISTRATION_MODE=open`。

生产环境还必须设置两个相互独立的长随机密钥：

```bash
AUTH_SECRET=<至少 32 字节的随机值>
CRON_SECRET=<至少 32 字符的随机值>
AUTH_URL=https://app.your-domain.com
```

可分别用 `openssl rand -base64 48` 生成。Auth.js 同时兼容 `.env.example` 中的 `NEXTAUTH_SECRET`，但新部署优先使用 `AUTH_SECRET`。不要把真实密钥提交进 Git，也不要把 cron URL 连同 Bearer 密钥写入前端代码或公开日志。

AI 代理接口只允许内置服务商的 HTTPS 域名。若确实需要兼容其他 OpenAI-compatible 服务，在服务端显式增加精确主机名，例如：

```bash
AI_ALLOWED_ENDPOINT_HOSTS=llm.example.com,api.vendor.example
```

不要加入 localhost、内网 IP、通配符域名或用户可控制的代理域名。

部署新版本前先应用数据库迁移，限流依赖 `SecurityRateLimit` 表：

```bash
npx prisma migrate deploy
```

应用层限流是第二道防线。公网入口仍应放在可信反向代理/CDN 后，由代理覆盖而不是透传客户端伪造的 IP 头，并在边缘为登录、注册、AI 与 cron 路径设置请求频率和请求体大小限制。数据库应启用自动备份，应用和依赖更新应先在预发布环境完成测试。

## 必须可匿名访问的 URL

发布环境需要确认这些地址返回 200，并且不跳登录页：

- `/privacy`
- `/support`
- `/account-deletion`
- `/manifest.webmanifest`
- `/.well-known/assetlinks.json`

部署完成后，再运行 public URL smoke：

```bash
npm run release:smoke
```

这个命令会实际访问 `APP_PUBLIC_BASE_URL` 下的 `/privacy`、`/support`、`/account-deletion`、`/manifest.webmanifest` 和 `/.well-known/assetlinks.json`，确认它们返回 200、不跳登录页，公开合规页已渲染 `APP_SUPPORT_EMAIL`，并且 manifest / Digital Asset Links 内容满足商店包装需要。

## 推荐顺序

1. 部署 Next.js 到真实 HTTPS 域名。
2. 运行 `npm run release:env:next`，确认当前缺失项和私有 env 填写位置。
3. 运行 `npm run release:env:draft`，复制草稿到私有环境文件或 CI secret manager，并替换真实域名、邮箱和 secret。
4. 运行 `npm run release:env:template:check`，确认上架环境模板和文档没有漏项。
5. 在部署环境设置上方变量。
6. 运行 `npm run release:check`。
7. 运行 `npm run release:smoke`，确认线上公开页面包含 `APP_SUPPORT_EMAIL`，并且 TWA 关联 JSON 可访问。
8. 运行 `npm run privacy:check`、`npm run review:check`、`npm run screenshots:check`、`npm run twa:check`、`npm run mobile:check`。
9. 在目标环境运行 `npm run review:seed` 准备审核账号。
10. 运行 `npm run screenshots:store` 生成商店截图。
11. 再执行 Bubblewrap / Capacitor 打包和商店后台提交流程。
