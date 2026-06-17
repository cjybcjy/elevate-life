# 上架本地预检

`npm run store:preflight` 是提审前的本地总闸门，用来把分散的 readiness 检查串起来。它适合在准备 Google Play TWA、Android 国内市场包和 iOS App Store 提交材料时反复运行。

## 命令

完整预检：

```bash
npm run store:preflight
```

快速预检，跳过生产构建：

```bash
STORE_PREFLIGHT_SKIP_BUILD=1 npm run store:preflight
```

只检查预检脚本和文档是否齐全：

```bash
npm run store:preflight:check
```

## 覆盖范围

这个命令会检查：

- PWA manifest、Service Worker、离线页和公开访问路径。
- 隐私政策、支持页、账号删除页。
- 首次进入登录、注册或业务页面前的用户协议与隐私政策确认。
- 商店隐私与数据安全底稿。
- AndroidManifest.xml / Info.plist 移动权限审计器。
- 审核测试账号和截图脚本。
- 发布环境校验器和部署 smoke test 校验器。
- 上架环境变量模板校验器。
- Digital Asset Links 路由。
- Android 签名校验器。
- Google Play TWA 配置和 TWA AAB 产物校验器。
- Capacitor Android 原生包产物校验器。
- iOS Archive 校验器。
- 默认情况下还会运行 `npm run build`。

## 不会替代的真实发布动作

`store:preflight` 不会替代以下真实产物和外部步骤：

- 配置真实 HTTPS 域名后运行 `npm run release:check`。
- 填写真实环境变量前运行 `npm run release:env:template:check`，按 `docs/release/store-release.env.example` 准备本机或 CI secret。
- 部署后运行 `npm run release:smoke`。
- 准备正式 Android keystore 后运行 `npm run android:signing:check`。
- Bubblewrap 生成 Google Play AAB 后运行 `npm run twa:artifact:check`。
- Capacitor 生成 Android release APK/AAB 后运行 `npm run android:artifact:check`。
- Xcode 生成 iOS Archive 后运行 `npm run ios:archive:check`。
- 在 Google Play Console、各 Android 市场后台和 App Store Connect 填写真实主体、资质、截图、隐私和审核材料。

换句话说，`store:preflight` 负责确认仓库里的上架准备链路没有断；真实上架仍然需要域名、账号、签名证书、构建产物和商店后台操作。
