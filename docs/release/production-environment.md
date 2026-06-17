# 生产发布环境校验

正式生成 Google Play TWA、Android 国内市场包或 iOS 包之前，先把发布环境从本地示例值切到真实值，并运行：

```bash
npm run release:env:template:check
npm run release:check
```

这个命令会拦截 `example.com`、localhost、非 HTTPS、包名不一致、TWA manifest URL 不一致、缺少 Android SHA-256 指纹等常见提审前错误。

可先参考 `docs/release/store-release.env.example` 整理本机或 CI 的真实环境变量。这个模板只用于交接变量名和填写顺序，不要把填好后的 secret 文件提交到仓库。

## 必填变量

- `APP_PUBLIC_BASE_URL`：真实 HTTPS 域名，只填 origin，例如 `https://app.your-domain.com`，不要带路径。
- `APP_SUPPORT_EMAIL`：真实支持邮箱，会用于商店后台、隐私政策和支持页。
- `CAPACITOR_SERVER_URL`：必须等于 `APP_PUBLIC_BASE_URL`，供 Capacitor Android/iOS 壳加载线上 Next.js 服务。
- `CAPACITOR_APP_ID`：稳定反向域名包名 / Bundle ID，例如 `com.company.elevatelife`。首次上架后不要轻易修改。
- `ANDROID_PACKAGE_NAME`：必须等于 `CAPACITOR_APP_ID`，用于 Google Play TWA、Digital Asset Links 和 Android 原生包。
- `ANDROID_SHA256_CERT_FINGERPRINTS`：release 上传证书 / Play App Signing 证书的 SHA-256 指纹，多个用英文逗号分隔。
- `TWA_MANIFEST_URL`：必须等于 `$APP_PUBLIC_BASE_URL/manifest.webmanifest`。
- `STORE_SCREENSHOT_BASE_URL`：正式截图时建议等于 `APP_PUBLIC_BASE_URL`，确保截图来自审核环境。

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

这个命令会实际访问 `APP_PUBLIC_BASE_URL` 下的 `/privacy`、`/support`、`/account-deletion`、`/manifest.webmanifest` 和 `/.well-known/assetlinks.json`，确认它们返回 200、不跳登录页，并且 manifest / Digital Asset Links 内容满足商店包装需要。

## 推荐顺序

1. 部署 Next.js 到真实 HTTPS 域名。
2. 运行 `npm run release:env:template:check`，确认上架环境模板和文档没有漏项。
3. 在部署环境设置上方变量。
4. 运行 `npm run release:check`。
5. 运行 `npm run release:smoke`，确认线上公开页面和 TWA 关联 JSON 可访问。
6. 运行 `npm run privacy:check`、`npm run review:check`、`npm run screenshots:check`、`npm run twa:check`、`npm run mobile:check`。
7. 在目标环境运行 `npm run review:seed` 准备审核账号。
8. 运行 `npm run screenshots:store` 生成商店截图。
9. 再执行 Bubblewrap / Capacitor 打包和商店后台提交流程。
