# 多市场上架清单

按从易到难推进：先完成 Web/PWA 与 Google Play TWA，再做 Android 国内市场，最后做 iOS App Store。原因是当前项目是 Next.js Web 应用，Google Play 的 Trusted Web Activity 能复用现有 PWA；国内 Android 和 iOS 更容易遇到原生包装、备案、审核材料和平台账号限制。

## 0. 所有市场共用前置项

- 公网 HTTPS 域名：待确定。TWA、隐私政策、支持页和商店审核都需要公网 HTTPS。
- 本地上架预检：按 `docs/release/store-preflight.md` 运行 `npm run store:preflight`，确认仓库里的 PWA、合规页面、隐私、截图、审核账号、TWA、Android 和 iOS readiness 链路没有断。
- 商店提交材料包：按 `docs/release/store-submission-package.md` 设置真实域名、支持邮箱和审核账号后运行 `npm run store:submission`，生成 `store-submission/` 供 Google Play、Android 国内市场和 App Store Connect 填写。
- 生产环境校验：按 `docs/release/production-environment.md` 和 `docs/release/store-release.env.example` 配置真实 HTTPS 域名、支持邮箱、包名和 SHA-256 指纹；先运行 `npm run release:env:template:check`，打包/提审前运行 `npm run release:check`，部署后运行 `npm run release:smoke` 验证线上公开页面和 `/.well-known/assetlinks.json`。
- 隐私政策：`/privacy` 已提供公开页面；上架前需要绑定公网 HTTPS 域名。
- 用户协议：`/terms` 已提供公开页面；国内 Android 市场和审核材料中如要求服务条款，可使用真实 HTTPS URL。
- 首次启动确认：登录、注册和业务页面会先展示用户协议与隐私政策确认；同意前不进入核心功能，也不初始化非必要第三方 SDK。
- 支持页：`/support` 已提供公开页面；上架前需要填入真实支持邮箱。
- 账号与数据删除：`/account-deletion` 已提供公开页面，可作为 Google Play 和 App Store 的删除说明 URL。
- 测试账号：审核方需要能登录并看到测试数据；本地/预发可运行 `npm run review:seed` 准备 `demo/demo123`，示例资产、预算、负债、流水和资金账户会一起生成。
- 截图：按 `docs/release/app-store-metadata.md` 准备首页、资产、流水、预算和隐私政策截图；运行 `npm run screenshots:check` 验证截图工具链，设置测试账号后运行 `npm run screenshots:store` 导出到 `store-screenshots/`。
- 图标：PWA 与商店图标统一使用鸟 logo，避免继续使用旧的紫色金额符号。
- 数据合规：不要在审核包内预置真实家庭财务数据。
- 隐私申报：`docs/release/privacy-data-safety.md` 是 Google Play Data safety、App Store App Privacy 和 Android 国内市场隐私合规的填写底稿；运行 `npm run privacy:check` 验证。
- 审核账号：运行 `npm run review:check` 验证 seed、审核备注和截图账号配置一致。
- Android 签名：按 `docs/release/android-signing.md` 保存 release/upload keystore，运行 `npm run android:signing:check`，确认上传证书和 Play App Signing SHA-256 指纹进入 `ANDROID_SHA256_CERT_FINGERPRINTS`；生成 AAB 后运行 `npm run android:aab:signature:check` 校验 AAB 签名。
- 原生包装：`docs/release/native-wrapper.md` 记录 Capacitor 路径；运行 `npm run mobile:check` 验证基础配置。当前默认候选包名是 `com.elevatelife.app`，生成原生工程后运行 `npm run mobile:identity:check`，确保 Android/iOS 不再使用 `com.example.*`；生成 Capacitor Android release 产物后运行 `npm run android:artifact:check`。
- 移动权限审计：按 `docs/release/mobile-permissions.md` 运行 `npm run mobile:permissions:check`，确认 AndroidManifest.xml 和 Info.plist 未申请与家庭账本无关的敏感权限。
- iOS Archive 产物：按 `docs/release/ios-app-store.md` 在 macOS + Xcode 26 环境中生成 `.xcarchive`，再运行 `npm run ios:archive:check` 校验 Bundle ID、HTTPS 线上地址和归档结构。
- Google Play TWA：`docs/release/google-play-twa.md` 记录 Bubblewrap 路径；运行 `npm run twa:check` 验证 TWA 打包材料。

## 1. Google Play：PWA + Trusted Web Activity

适合第一阶段，因为现有 Web 应用能最大程度复用。

- PWA manifest：由 `src/app/manifest.ts` 生成。
- Service Worker：`public/sw.js` 仅缓存离线页和图标，不缓存 API 或财务页面。
- Bubblewrap：使用官方 Trusted Web Activity / Bubblewrap 路径生成 Android 工程；设置 `TWA_MANIFEST_URL` 后运行 `npm run twa:init`。
- Digital Asset Links：线上端点为 `https://<域名>/.well-known/assetlinks.json`。部署时设置 `ANDROID_PACKAGE_NAME` 和 `ANDROID_SHA256_CERT_FINGERPRINTS`；本地可运行 `npx tsx scripts/check-digital-asset-links-route.ts` 验证 JSON 结构。`docs/android/assetlinks.template.json` 保留为手工对照模板。
- target SDK：Google Play 当前要求新应用和更新 target Android 15，即 API level 35。
- Play Console 材料：应用名称、短描述、完整描述、图标、功能图、截图、隐私政策 URL、用户协议 URL、数据安全表单、内容分级、目标受众。
- AAB 输出：Bubblewrap build 后上传 `app-release-bundle.aab`。
- 验证：安装 AAB 内测版，确认 TWA 不显示地址栏、登录可用、主要页面可打开、离线只显示离线提示页。

## 2. Android 国内市场

国内市场通常不依赖 Google Play 服务，也不保证设备有 Chrome，因此比 Google Play TWA 更适合使用 Capacitor / 原生 WebView 包装。

- 推荐路径：使用 Capacitor，先确认 `CAPACITOR_SERVER_URL` 与包名，再生成 Android APK/AAB。
- Capacitor Android release 产物：按 `docs/release/android-native-artifact.md` 生成 `app-release.aab` 或 `app-release.apk`，再运行 `npm run android:artifact:check`，确认 `applicationId`、`namespace`、`server.url` 和安装包产物一致；AAB 上传前运行 `npm run android:aab:signature:check`，APK 上传前运行 `npm run android:apk:signature:check` 校验 APK 签名。
- 包名：建议使用类似 `com.<你的域名>.elevatelife` 的稳定包名，一经上架不要轻易改。
- 签名：生成并长期保存 release keystore，记录 SHA-256 指纹。
- APP 备案：面向中国大陆提供服务通常需要 APP 备案 / ICP 相关信息；不同市场也可能要求软著、公司主体、隐私合规承诺。
- 权限最小化：家庭账本不应申请通讯录、定位、短信、相机等无关权限；生成原生工程后运行 `npm run mobile:permissions:check`。
- 隐私弹窗：国内市场常要求首次启动前展示隐私政策和用户协议，并在同意前不初始化采集类 SDK；当前应用已在登录、注册和业务页面前做本机同意确认。
- 市场材料：应用图标、截图、介绍、隐私政策、用户协议、备案号、软著或资质文件按各市场后台填写。

## 3. iOS App Store

iOS 最难，因为需要 macOS、Xcode、Apple Developer Program、App Store Connect、审核账号和更严格的 WebView 审核。

- 构建环境：截至 2026-06，Apple 要求上传 App Store Connect 的 iOS/iPadOS 应用使用 Xcode 26 和 iOS 26 SDK 或更新版本。
- 包装路径：建议使用 Capacitor iOS；不要只提交一个没有原生价值的空 WebView。
- iOS Archive 产物：按 `docs/release/ios-app-store.md` 设置 `CAPACITOR_SERVER_URL`、`CAPACITOR_APP_ID` 和 `IOS_ARCHIVE_PATH`，运行 `npm run ios:archive:check`，确认 `PRODUCT_BUNDLE_IDENTIFIER`、`CFBundleIdentifier`、`server.url` 和 `.xcarchive` 一致。
- 原生价值：需要把家庭账本体验做成完整移动应用，例如启动体验、离线提示、系统外观适配、隐私说明、账号删除入口、稳定导航。
- App Privacy：在 App Store Connect 填写隐私营养标签，列出账号信息、财务数据、诊断数据等使用方式。
- 审核材料：测试账号、审核说明、隐私政策 URL、用户协议 URL、支持 URL、截图、年龄分级、权限说明、加密出口合规问卷。
- 验证：真机或模拟器登录、记账、预算、资产管理、网络断开、深浅色模式、删除/退出账号路径。

## 4. 暂时无法由代码单独完成的事项

- 购买或确认 Apple Developer Program / Google Play Console / 各安卓市场开发者账号。
- 确定公网域名、备案主体、隐私政策 URL、支持邮箱。
- 生成正式签名证书并妥善保存。
- 在 macOS + Xcode 26 环境中完成 iOS 构建、归档、上传。
- 在各市场后台填写真实主体和合规材料。

## 5. 下一步工程建议

1. 先部署 Web 到公网 HTTPS 域名。
2. 本地先运行 `npm run store:preflight`，修掉仓库准备项问题。
3. 按 `docs/release/production-environment.md` 设置真实域名、支持邮箱、包名和签名指纹，运行 `npm run release:check`。
4. 设置真实域名、支持邮箱和审核账号后运行 `npm run store:submission`，生成 `store-submission/` 提交材料包。
5. 部署后运行 `npm run release:smoke`，确认线上公开页面、manifest 和 `/.well-known/assetlinks.json` 可被商店审核访问。
6. 填好隐私政策和支持页。
7. 运行 `npm run privacy:check`，确认 Data safety / App Privacy / 国内安卓隐私合规底稿与公开隐私页一致。
8. 运行 `npm run review:check`，在目标环境运行 `npm run review:seed`，确认 `demo/demo123` 能看到示例资产、预算、负债、流水和资金账户。
9. 运行 `npm run screenshots:check`；设置审核测试账号后运行 `npm run screenshots:store` 生成 `store-screenshots/`，挑选各市场最终截图。
10. 确定包名和签名策略。
11. 运行 `npm run android:signing:check`，确认 Android keystore、alias 和 SHA-256 指纹一致。
12. 运行 `npm run mobile:check`，确认原生包装基础配置仍然可用。
13. 生成 Android/iOS 原生工程后运行 `npm run mobile:permissions:check`，确认权限最小化。
14. 设置 `ANDROID_PACKAGE_NAME` 和 `ANDROID_SHA256_CERT_FINGERPRINTS`，确认 `/.well-known/assetlinks.json` 返回正式包名和签名指纹。
15. 运行 `npm run twa:check` 后，用 Bubblewrap 生成 Google Play TWA AAB，再运行 `npm run twa:artifact:check` 校验 AAB 产物和 `twa-manifest.json`。
16. 用 Capacitor 生成 Android 国内市场包，再运行 `npm run android:artifact:check` 校验 Capacitor Android release 产物。
17. 对准备上传的 AAB 运行 `npm run android:aab:signature:check`，确认 AAB 签名证书与 `ANDROID_SHA256_CERT_FINGERPRINTS` 一致。
17. 最后在 macOS 上生成 iOS 工程和 Archive，运行 `npm run ios:archive:check` 后准备 App Store Connect 审核。
