# Android 签名与 SHA-256 指纹

Google Play TWA、Android 国内市场包和 `/.well-known/assetlinks.json` 都依赖稳定包名和签名证书。生成正式包之前先运行：

```bash
npm run android:signing:check
```

这个命令会用 `keytool` 读取 `TWA_SIGNING_KEY_PATH` / `TWA_SIGNING_KEY_ALIAS` 对应 keystore 的 SHA-256 指纹，并确认它出现在 `ANDROID_SHA256_CERT_FINGERPRINTS` 中。

生成 `app-release.aab` 之后，再运行：

```bash
ANDROID_RELEASE_BUNDLE_PATH=android/app/build/outputs/bundle/release/app-release.aab npm run android:aab:signature:check
```

这个命令会用 `jarsigner` 和 `keytool -printcert -jarfile` 确认 AAB 已签名，并且签名证书 SHA-256 与 `ANDROID_SHA256_CERT_FINGERPRINTS` 一致。

如果目标 Android 市场要求 APK，也运行：

```bash
ANDROID_RELEASE_APK_PATH=android/app/build/outputs/apk/release/app-release.apk npm run android:apk:signature:check
```

这个命令会用 `apksigner` 确认 `app-release.apk` 的 APK 签名，并读取签名证书 SHA-256。

## 环境变量

- `TWA_SIGNING_KEY_PATH`：release/upload keystore 的本机安全路径。不要提交 keystore。
- `TWA_SIGNING_KEY_ALIAS`：release key alias。
- `ANDROID_KEYSTORE_STORE_PASSWORD`：keystore store password，仅放在本机或 CI secret。
- `ANDROID_KEYSTORE_KEY_PASSWORD`：key password，仅放在本机或 CI secret；如果与 store password 相同也不要提交。
- `ANDROID_SHA256_CERT_FINGERPRINTS`：用于 `/.well-known/assetlinks.json` 的 SHA-256 指纹列表，多个用英文逗号分隔。

## 指纹来源

1. 上传 keystore 指纹：本地 `keytool -list -v -keystore <path> -alias <alias>` 可查看。
2. Play App Signing 指纹：Google Play Console 创建应用并启用 Play App Signing 后，在 App Integrity / 应用完整性页面查看。
3. 国内 Android 市场：通常使用你本地 release keystore 签出的 APK/AAB，按对应市场后台要求记录 SHA-256。

Google Play TWA 推荐把上传证书和 Play App Signing 证书的 SHA-256 都加入 `ANDROID_SHA256_CERT_FINGERPRINTS`，避免内测、商店签名和本地验证阶段不一致。部署后用 `npm run release:smoke` 确认 `/.well-known/assetlinks.json` 已经返回这些指纹。

## 安全约定

- keystore、`.jks`、`.aab`、`.apk` 和 Bubblewrap 输出目录不提交到仓库。
- 不在文档、issue、截图或聊天中粘贴 keystore 密码。
- 第一次上架后，不要随意更换 `CAPACITOR_APP_ID` / `ANDROID_PACKAGE_NAME` 或 release keystore。
