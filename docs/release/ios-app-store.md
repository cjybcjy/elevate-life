# iOS App Store 发布准备

iOS 是最后推进的市场，因为它依赖 macOS、Xcode、Apple Developer Program、证书、App Store Connect 和更严格的 WebView 审核。当前项目可以先用 Capacitor iOS 路径准备，但不要把它包装成一个没有移动体验价值的空 WebView。

## 构建要求

- Apple Developer Program：需要可提交 App Store 的开发者账号。
- Xcode / SDK：Apple 官方要求自 2026-04-28 起，上传到 App Store Connect 的 App 必须使用 Xcode 26 或更新版本，并使用 iOS 26 / iPadOS 26 SDK 或更新版本。
- 线上服务：`CAPACITOR_SERVER_URL` 必须是真实 HTTPS 域名，不要使用 `localhost`、局域网 IP 或 HTTP。
- Bundle ID：`CAPACITOR_APP_ID` 必须是稳定反向域名 Bundle ID，默认候选为 `com.elevatelife.app`。首次上架后不要轻易修改，不要使用 `com.example.*`。

官方要求参考：[Apple Developer Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)。

## 环境变量

- `CAPACITOR_SERVER_URL`：线上 HTTPS 地址，例如 `https://app.example.com`。
- `CAPACITOR_APP_ID`：Bundle ID，例如 `com.elevatelife.app`。
- `IOS_NATIVE_PROJECT_DIR`：可选，默认 `ios`。
- `IOS_ARCHIVE_PATH`：Xcode 导出的 `.xcarchive` 路径，例如 `ios/build/ElevateLife.xcarchive`。
- `IOS_ARCHIVE_APP_NAME`：归档内的 `.app` 名称，Capacitor 默认通常是 `App.app`。

## 推荐流程

1. 检查移动包装基础：
   `npm run mobile:check`
2. 首次生成 iOS 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:ios`
3. 同步正式线上地址和 Bundle ID：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:sync`
4. 打开 Xcode：
   `npm run mobile:open:ios`
5. 在 Xcode 中设置 Team、Signing、版本号、构建号和 App 图标。
6. 使用 Product > Archive 生成 `.xcarchive`。
7. 归档后校验：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife IOS_ARCHIVE_PATH=/path/to/App.xcarchive npm run ios:archive:check`

## 校验内容

`npm run ios:archive:check` 会检查：

- `ios/App/App.xcodeproj/project.pbxproj` 存在。
- `PRODUCT_BUNDLE_IDENTIFIER` 等于 `CAPACITOR_APP_ID`。
- `ios/App/App/Info.plist` 存在，且没有为 App Store release 放开 `NSAllowsArbitraryLoads=true`。
- `ios/App/App/capacitor.config.json` 已由 `npm run mobile:sync` 生成。
- `capacitor.config.json` 中的 `appId` 等于 `CAPACITOR_APP_ID`。
- `capacitor.config.json` 中的 `server.url` 等于 `CAPACITOR_SERVER_URL`。
- `server.cleartext` 为 `false`。
- `IOS_ARCHIVE_PATH` 指向的 `.xcarchive` 存在。
- 归档内 `Products/Applications/<App>.app/Info.plist` 的 `CFBundleIdentifier` 等于 `CAPACITOR_APP_ID`。

如果归档还没有生成，或者 iOS 工程仍然指向 `http://localhost:3000`，这个检查会失败。

## App Store Connect 材料

- App 名称、短描述、关键词、分类、年龄分级。
- 隐私政策 URL：`https://<你的域名>/privacy`。
- 支持 URL：`https://<你的域名>/support`。
- 账号删除说明 URL：`https://<你的域名>/account-deletion`。
- App Privacy：按 `docs/release/privacy-data-safety.md` 填写账号信息、财务信息、用户内容、应用活动和诊断数据。
- 审核测试账号：按 `docs/release/app-store-metadata.md` 使用 `demo/demo123` 或正式环境自定义审核账号。
- 截图：按 `npm run screenshots:store` 生成基础截图，再用 Xcode Simulator 或真机补充 App Store 要求尺寸。

## 人工确认

- 真机或模拟器测试登录、首页安全状态、资产、流水、预算、隐私政策、支持页、账号删除说明和退出登录。
- 断网时应看到明确的离线提示，不要白屏。
- 深浅色模式、移动端导航、表单输入和键盘遮挡都要可用。
- 不要申请与家庭账本无关的敏感权限。
- 不要在审核包内预置真实家庭财务数据。
