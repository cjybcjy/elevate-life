# 商店提交材料包

`npm run store:submission` 会把商店后台常用的复制材料生成到本地 `store-submission/` 目录，方便填写 Google Play、Android 国内市场和 App Store Connect。脚本会拒绝占位公开域名和占位支持邮箱，避免把示例材料误用于正式提审。

## 命令

```bash
npm run store:submission
```

生成前必须先设置真实环境变量：

```bash
APP_PUBLIC_BASE_URL=https://<你的域名> \
APP_SUPPORT_EMAIL=support@<你的域名> \
REVIEW_ACCOUNT_USERNAME=demo \
REVIEW_ACCOUNT_PASSWORD=demo123 \
npm run store:submission
```

可用 `STORE_SUBMISSION_OUTPUT_DIR` 修改输出目录。默认输出目录是 `store-submission/`，已经加入 `.gitignore`，不要提交到仓库。

如果 `APP_PUBLIC_BASE_URL` 仍是 `example.com`、localhost、非 HTTPS 或带路径，或者 `APP_SUPPORT_EMAIL` 仍是示例邮箱，脚本会停止并提示需要先替换为真实发布资料。

## 输出文件

- `metadata.json`：应用名称、简介、关键词、公开 URL、审核账号和目标市场。
- `market-copy.md`：应用名称、一句话简介、完整描述、关键词和支持邮箱。
- `review-notes.md`：审核账号、审核路径、公开合规 URL 和测试数据说明。
- `public-urls.md`：隐私政策、用户协议、支持页、账号删除、manifest 和 Digital Asset Links URL。
- `privacy-data-safety-summary.md`：Data safety / App Privacy / 国内安卓隐私合规摘要。

## 使用方式

1. 运行 `npm run store:preflight`，确认仓库准备项和生产构建都通过。
2. 设置真实 HTTPS 域名、支持邮箱和审核账号；不要使用占位域名或占位邮箱。
3. 运行 `npm run store:submission`。
4. 打开 `store-submission/`，把对应内容复制到商店后台。
5. 正式提交前逐项复核开发者主体、隐私联系人、SDK/服务、权限、截图、资质和审核账号是否与线上真实环境一致。

这份材料包不会替代真实商店后台提交，也不会生成 AAB、APK 或 iOS Archive。它只是减少人工填表遗漏。
