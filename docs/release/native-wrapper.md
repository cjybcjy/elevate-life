# 原生包装准备

当前项目依赖 Next.js 服务端能力：认证、Server Actions、Prisma 数据库、定时任务和 API 路由都需要 Node.js 运行时。因此不要把 .next 当作 Capacitor webDir，也不要把它当纯静态 App 打包。正确路径是先部署 Web 到真实 HTTPS 域名，再让原生壳加载这个线上服务。

## 环境变量

- `CAPACITOR_SERVER_URL`：真实 HTTPS 域名，例如 `https://app.example.com`。Google Play TWA、Android 国内市场和 iOS 审核都需要这个域名可访问。
- `CAPACITOR_APP_ID`：正式包名 / Bundle ID，默认候选为 `com.elevatelife.app`。第一次上架后不要轻易更改，不要使用 com.example、`com.example.*` 或临时占位包名。

没有设置 `CAPACITOR_SERVER_URL` 时，Capacitor 会加载 `mobile-web/index.html`。这个页面只是本地 fallback，用来避免空白壳，不是完整账本应用。

## 命令

1. 检查移动包装基础：
   `npm run mobile:check`
2. 首次生成 Android 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:android`
3. 首次生成 iOS 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:ios`
4. 同步 Web 壳配置到原生工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:sync`
5. 校验 Android/iOS 原生工程包名一致性：
   `npm run mobile:identity:check`
6. 打开 Android Studio：
   `npm run mobile:open:android`
7. 打开 Xcode：
   `npm run mobile:open:ios`
8. 生成原生工程后审计 Android/iOS 权限：
   `npm run mobile:permissions:check`
9. 生成 Android release 包后校验产物：
   `npm run android:artifact:check`
10. 生成 iOS Archive 后校验产物：
   `npm run ios:archive:check`

## Android 国内市场

Android 国内市场通常不能假设设备有 Google Play 或 Chrome，因此建议使用 Capacitor Android 工程出 APK/AAB。上架前还需要：

- 确认包名、应用签名和 SHA-256 指纹。
- 按 `docs/release/android-native-artifact.md` 生成并校验 release APK/AAB，确认包名、HTTPS 线上地址和产物文件一致。
- 按 `docs/release/mobile-permissions.md` 运行 `npm run mobile:permissions:check`，确认未申请与家庭账本无关的敏感权限。
- 准备 APP 备案、隐私政策、用户协议、支持邮箱和测试账号。
- 权限保持最小化，不申请通讯录、定位、短信、相机等与家庭账本无关的权限。
- 首次启动前如接入统计或第三方 SDK，需要先展示隐私政策并获得同意。

## iOS App Store

iOS App Store 可以使用 Capacitor iOS 工程继续推进，但审核重点会更严。这个应用不能表现为一个没有移动体验价值的空 WebView；至少要保证：

- 登录、记账、资产、预算、删号、离线提示和深浅色模式在移动尺寸可用。
- App Store Connect 填写 App Privacy，明确账号信息、家庭财务数据和诊断数据的用途。
- 按 Apple 当前要求使用 Xcode 26 / iOS 26 SDK 或更新版本构建上传。
- 按 `docs/release/ios-app-store.md` 生成并校验 iOS Archive，确认 Bundle ID、HTTPS 线上地址和归档产物一致。
- 按 `docs/release/mobile-permissions.md` 审计 `Info.plist`，避免出现未申报的相机、定位、通讯录、照片、麦克风、跟踪等 usage description key。
- 提供审核测试账号、隐私政策 URL、支持 URL、账号删除 URL、截图和审核备注。

## Google Play

Google Play 第一阶段仍推荐 Trusted Web Activity / Bubblewrap，因为它最贴合现有 PWA。Capacitor Android 则作为国内 Android 市场和后续原生增强路径。两条路径都依赖同一个真实 HTTPS 域名与隐私合规页面。
