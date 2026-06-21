# Google Play TWA 发布步骤

Google Play 第一阶段使用 Trusted Web Activity / Bubblewrap。官方 Bubblewrap 流程会读取线上 Web Manifest，生成普通 Android 工程；构建后会输出 signed APK 和 `app-release-bundle.aab`，其中 AAB 用于上传 Play Console。

## 前置条件

- 真实 HTTPS 域名已经部署并可访问。
- `https://<域名>/manifest.webmanifest` 返回当前 PWA manifest。
- `https://<域名>/.well-known/assetlinks.json` 返回正式包名和 SHA-256 指纹。
- Play Console 已创建应用，并确认 target API level 35 或更新要求。
- 已准备上传签名 keystore。不要把 keystore、密码或 Play service account JSON 提交进仓库。
- 本机或 CI 已准备 JDK 和 Android command line tools。Bubblewrap 首次运行时可能会启动环境向导，询问是否自动安装 JDK / Android 构建工具；按官方建议可让它安装，或使用团队已有的 JDK 17 与 Android SDK。

## 环境变量

- `TWA_MANIFEST_URL`：线上 manifest URL，例如 `https://app.example.com/manifest.webmanifest`。
- `TWA_OUTPUT_DIR`：Bubblewrap 工程输出目录，默认建议 `android-twa`。
- `TWA_SIGNING_KEY_PATH`：上传签名 keystore 的安全路径。
- `TWA_SIGNING_KEY_ALIAS`：keystore alias。
- `ANDROID_PACKAGE_NAME`：与 Play Console 包名一致。
- `ANDROID_SHA256_CERT_FINGERPRINTS`：Play App Signing 证书和本地上传证书的 SHA-256 指纹，多个用英文逗号分隔。
- Android 签名校验：按 `docs/release/android-signing.md` 设置 keystore 变量后运行 `npm run android:signing:check`。

## 命令

1. 验证仓库内 TWA 准备项：
   `npm run twa:check`
2. 验证 Android 上传签名和 SHA-256 指纹：
   `npm run android:signing:check`
3. 首次运行 Bubblewrap 时完成环境向导，确认 JDK 和 Android command line tools 可用。
4. 初始化 Bubblewrap 工程：
   `TWA_MANIFEST_URL=https://<域名>/manifest.webmanifest TWA_OUTPUT_DIR=android-twa npm run twa:init`
5. 如 manifest 或 `docs/android/twa-manifest.template.json` 对应字段变化，同步工程：
   `TWA_MANIFEST_URL=https://<域名>/manifest.webmanifest TWA_OUTPUT_DIR=android-twa npm run twa:update`
6. 构建 Play Store AAB：
   `TWA_MANIFEST_URL=https://<域名>/manifest.webmanifest TWA_OUTPUT_DIR=android-twa npm run twa:build`
7. 查看 Bubblewrap 产物下一步：
   `TWA_OUTPUT_DIR=android-twa npm run twa:artifact:next`
8. 校验 Bubblewrap 构建产物：
   `TWA_OUTPUT_DIR=android-twa npm run twa:artifact:check`
9. 校验准备上传的 AAB 签名：
   `ANDROID_RELEASE_BUNDLE_PATH=android-twa/app-release-bundle.aab npm run android:aab:signature:check`

## `twa-manifest.json` 对照

`docs/android/twa-manifest.template.json` 是手工审核模板。正式 `twa-manifest.json` 通常由 `bubblewrap init --manifest` 生成；生成后重点核对：

- `packageId` 等于 `ANDROID_PACKAGE_NAME`。
- `host` 等于线上域名，不包含协议。
- `webManifestUrl` 指向 `/manifest.webmanifest`。
- `startUrl` 为 `/`。
- `display` 为 `standalone`。
- `iconUrl` 和 `maskableIconUrl` 指向 512 图标。
- `signingKey.path` 和 `signingKey.alias` 指向上传签名，不提交 keystore。
- `fingerprints` 与 `/.well-known/assetlinks.json` 中的 SHA-256 指纹一致。
- 构建后先运行 `npm run twa:artifact:next`，确认 Bubblewrap 产物路径和后续 AAB 签名命令。
- 构建后运行 `npm run twa:artifact:check`，确认 `twa-manifest.json`、包名、签名 key、指纹和 `app-release-bundle.aab` 一致。
- 上传 Play Console 前运行 `npm run android:aab:signature:check`，确认 `app-release-bundle.aab` 已签名且签名证书 SHA-256 在 `ANDROID_SHA256_CERT_FINGERPRINTS` 中。

## 验证

- 上传内部测试后安装 AAB。
- 打开应用确认没有浏览器地址栏；如果出现地址栏，优先检查 Digital Asset Links、包名和签名指纹。
- 登录 demo/审核账号，打开首页、资产、流水、预算和删号/隐私页面。
- 断网时应显示离线页或明确的网络失败状态，不能白屏。

## Play Console 材料

- AAB：`android-twa/app-release-bundle.aab` 或 Bubblewrap 输出目录中的 `app-release-bundle.aab`。
- 图标和截图：使用 `docs/release/app-store-metadata.md` 的截图脚本建议。
- 隐私政策 URL：`https://<域名>/privacy`。
- 支持 URL：`https://<域名>/support`。
- 账号删除 URL：`https://<域名>/account-deletion`。
- 数据安全表单：说明账号信息、家庭财务数据和诊断数据用途。
