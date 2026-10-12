# 原生包装准备

当前项目依赖 Next.js 服务端能力：认证、Server Actions、Prisma 数据库、定时任务和 API 路由都需要 Node.js 运行时。因此不要把 .next 当作 Capacitor webDir，也不要把它当纯静态 App 打包。正确路径是先部署 Web 到真实 HTTPS 域名，再让原生壳加载这个线上服务。

## 环境变量

- `CAPACITOR_SERVER_URL`：承载当前 Web 版本的真实 HTTPS 域名，只填写协议与域名；不带登录路径、查询参数或凭证。设置了 `APP_PUBLIC_BASE_URL` 时，两者必须一致。示例域名、localhost 和 HTTP 地址会被同步命令拒绝。
- `CAPACITOR_APP_ID`：正式包名 / Bundle ID，默认候选为 `com.elevatelife.app`。第一次上架后不要轻易更改，不要使用 com.example、`com.example.*` 或临时占位包名。

配置会按 Next.js 的规则读取 `.env.local` 等环境文件，已设置的进程环境变量优先。没有设置 `CAPACITOR_SERVER_URL` 时，基础配置会加载 `mobile-web/index.html`，正式同步命令则会在改写 Android/iOS 配置前停止。本地联调使用下面独立的 `mobile:sync:local`。提示页只是本地 fallback，用来避免空白壳，不是完整账本应用。

## 本地多端同步

在运行 Web 的电脑上启动共享服务，再同步两端的本地配置：

```sh
npm run mobile:dev
# 另一个终端
npm run mobile:sync:local
npm run mobile:sync:local:check
```

| 端 | 默认连接地址 | 条件 |
| --- | --- | --- |
| 桌面、手机尺寸浏览器 | `http://localhost:3000` | 浏览器与 Web 在同一电脑 |
| Android 模拟器 | `http://10.0.2.2:3000` | 模拟器与 Web 在同一电脑 |
| iOS 模拟器 | `http://localhost:3000` | 模拟器与 Web 在同一台 Mac |

`mobile:dev` 在 `0.0.0.0:3000` 启动开发服务，并让登录跳转跟随当前设备访问的主机名，避免 Android 模拟器被跳转到它自己的 localhost。

真机或另一台电脑上的模拟器需要同一局域网可达的服务地址。在运行 `mobile:dev` 和同步时，都显式传入 `CAPACITOR_LOCAL_SERVER_URL=http://实际局域网IP:3000`。这个变量也支持省略 `http://`，但必须使用本地回环或私有局域网地址及 `3000` 端口；不要把 `0.0.0.0` 当作设备访问地址。iOS 首次连接局域网时可能请求权限，Debug 配置已提供用途说明。

本地命令分别执行 Capacitor copy，更新两端生成配置和本地提示页，然后逐端校验；当前没有新增原生依赖，因此不需要更新 CocoaPods/Gradle 依赖。两端加载同一 Web 服务，页面改动随该服务生效。命令不会修改 `.env.local` 或写死正式服务地址。Android 的 HTTP 例外仅在 Debug manifest 中启用；iOS Debug 使用 `Info.Debug.plist` 的本地网络与网页 HTTP 例外，Release 继续使用 `Info.plist`。正式 `mobile:sync` 始终重新采用 HTTPS 配置。

完成复制后需要在 Android Studio/Xcode 运行 Debug 构建，才能在设备里验收。Linux 上复制 iOS 配置不代表已经完成 macOS/Xcode 构建。使用开发服务联调，避免生产服务的 `upgrade-insecure-requests` 策略把局域网 HTTP 子资源升级成 HTTPS。

## 多端功能同步

桌面 Web、手机 Web/PWA、Android 和 iOS 复用同一个 Next.js 服务及账号数据。页面与业务功能更新后，先把同一版本部署到上面的真实 HTTPS 域名，再验证各端。`mobile:sync` 负责将服务地址、原生壳配置和本地提示页同步到 Android/iOS，不会部署当前本地 Web 代码；服务地址不变时，纯 Web 功能更新随服务部署生效。

首次接入或原生配置、依赖变化时，执行 `npm run mobile:sync`，再重新构建、安装 App。命令先验证服务地址，完成 Capacitor 同步后，逐端核对服务地址、包名、主题色和提示页；`npm run mobile:sync:check` 可以只核对而不修改文件。配置核对通过后，还需在设备上验证登录、记账、资产和导航，才能确认功能可用。

Android/iOS 的 `capacitor.config.json` 和复制后的提示页是被 Git 忽略的本地生成物。当前仓库不提供真实线上服务地址；本地同步使用本机或局域网服务，正式同步需要配置真实 HTTPS 服务。不要把 `app.example.com` 写入生成物作为可用服务。

## 命令

1. 检查移动包装基础：
   `npm run mobile:check`
2. 首次生成 Android 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:android`
3. 首次生成 iOS 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:ios`
4. 同步 Web 壳配置到原生工程：
   在环境文件中填写真实服务地址后，运行 `npm run mobile:sync`。已有原生工程使用 `com.elevatelife.app`；如需更改包名，还必须同步修改 Android/iOS 工程中的包名。
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
