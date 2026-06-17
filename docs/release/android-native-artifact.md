# Capacitor Android release 产物校验

国内 Android 市场建议使用 Capacitor Android 工程生成 APK/AAB。打包前必须先部署 Web 到真实 HTTPS 域名，并固定正式包名；打包后再校验产物是否真的指向线上服务。

## 前置环境

- `CAPACITOR_SERVER_URL`：线上 HTTPS 地址，例如 `https://app.example.com`。
- `CAPACITOR_APP_ID`：稳定包名，默认候选为 `com.elevatelife.app`；不要使用 `com.example.*`。
- `ANDROID_NATIVE_PROJECT_DIR`：可选，默认 `android`。

## 推荐流程

1. 检查原生包装基础配置：
   `npm run mobile:check`
2. 首次生成 Android 工程：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:add:android`
3. 同步正式线上地址和包名：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run mobile:sync`
4. 用 Android Studio 或 Gradle 生成 release 产物：
   - AAB：`android/app/build/outputs/bundle/release/app-release.aab`
   - APK：`android/app/build/outputs/apk/release/app-release.apk`
5. 校验 release 产物：
   `CAPACITOR_SERVER_URL=https://<你的域名> CAPACITOR_APP_ID=com.<你的域名>.elevatelife npm run android:artifact:check`
6. 校验 AAB 签名：
   `ANDROID_RELEASE_BUNDLE_PATH=android/app/build/outputs/bundle/release/app-release.aab npm run android:aab:signature:check`
7. 校验 APK 签名：
   `ANDROID_RELEASE_APK_PATH=android/app/build/outputs/apk/release/app-release.apk npm run android:apk:signature:check`

## 校验内容

`npm run android:artifact:check` 会检查：

- Android 工程存在 `app/build.gradle` 或 `app/build.gradle.kts`。
- `applicationId` 和 `namespace` 等于 `CAPACITOR_APP_ID`。
- `android/app/src/main/AndroidManifest.xml` 已生成。
- `android/app/src/main/assets/capacitor.config.json` 已生成。
- `capacitor.config.json` 中的 `appId` 等于 `CAPACITOR_APP_ID`。
- `capacitor.config.json` 中的 `server.url` 等于 `CAPACITOR_SERVER_URL`。
- `server.cleartext` 为 `false`，避免 release 包加载明文 HTTP。
- release APK 或 AAB 存在且非空。

如果只生成了 debug APK，或者 `server.url` 仍然是 `http://localhost:3000`，这个检查会失败。

`npm run android:aab:signature:check` 会用 `jar` 检查 `META-INF` 签名文件，用 `jarsigner` 确认 AAB 返回 `jar verified`，再用 `keytool -printcert -jarfile` 读取签名证书 SHA-256，并与 `ANDROID_SHA256_CERT_FINGERPRINTS` 比对。`jarsigner -strict` 对自签名 upload keystore 可能返回警告；这个脚本使用非 strict 验证来判断 AAB 是否真的完成 release 签名。

`npm run android:apk:signature:check` 会用 Android build-tools 里的 `apksigner verify --print-certs` 校验 `ANDROID_RELEASE_APK_PATH`，读取 APK 签名证书 SHA-256，并与 `ANDROID_SHA256_CERT_FINGERPRINTS` 比对。国内 Android 市场要求 APK 时，用它确认 `app-release.apk` 不是 debug 包或未签名包。

## 上架前人工确认

- 使用同一个 release keystore 签名，并按 `docs/release/android-signing.md` 记录 SHA-256 指纹。
- 在真机安装 release 包，确认登录、记账、资产、预算、隐私政策、支持页和删号说明都能打开。
- 确认没有申请通讯录、定位、短信、相机等与家庭账本无关的敏感权限。
- 如接入统计或第三方 SDK，首次启动同意隐私政策前不要初始化采集类 SDK。
