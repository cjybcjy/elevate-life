# 移动权限审计

家庭账本的核心功能不需要通讯录、定位、相机、麦克风、短信、电话或媒体库权限。Google Play、Android 国内市场和 App Store 审核时，应尽量保持原生包权限最小化。

## 命令

生成 Capacitor Android / iOS 工程并同步配置后运行：

```bash
npm run mobile:permissions:check
```

默认检查：

- `android/app/src/main/AndroidManifest.xml`
- `ios/App/App/Info.plist`

可用环境变量调整路径：

- `ANDROID_NATIVE_PROJECT_DIR`：默认 `android`。
- `IOS_NATIVE_PROJECT_DIR`：默认 `ios`。

## 默认允许

Android 默认只允许：

- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`

iOS 默认不允许任何敏感 usage description key。只要 `Info.plist` 出现相机、定位、通讯录、照片、麦克风、跟踪等说明键，校验就会失败。

## 敏感能力

除非功能和隐私政策都已经明确支持，否则不要申请：

- 通讯录：Android `READ_CONTACTS` / iOS `NSContactsUsageDescription`
- 定位：Android `ACCESS_FINE_LOCATION` / iOS `NSLocationWhenInUseUsageDescription`
- 相机：Android `CAMERA` / iOS `NSCameraUsageDescription`
- 麦克风：Android `RECORD_AUDIO` / iOS `NSMicrophoneUsageDescription`
- 短信：Android `READ_SMS`、`SEND_SMS`
- 电话：Android `CALL_PHONE`、`READ_PHONE_STATE`
- 媒体库：Android `READ_MEDIA_IMAGES` 等 / iOS `NSPhotoLibraryUsageDescription`
- 通知：Android `POST_NOTIFICATIONS`
- 跨 App 跟踪：iOS `NSUserTrackingUsageDescription`

## 显式放行

如果后续真的加入扫码票据、家庭邀请、推送提醒等能力，必须先更新隐私政策、用户协议、商店隐私申报和首次同意流程，再通过 env allowlist 显式放行：

```bash
MOBILE_ALLOWED_ANDROID_PERMISSIONS=android.permission.CAMERA \
MOBILE_ALLOWED_IOS_USAGE_KEYS=NSCameraUsageDescription \
npm run mobile:permissions:check
```

不要为了让审核通过而盲目放行权限；先确认功能、文案、权限弹窗和隐私申报一致。
