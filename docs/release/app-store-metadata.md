# Elevate Life Store Metadata Draft

## 基础信息

- 应用名称：Elevate Life 家庭账本
- 一句话简介：10 秒看懂家庭财务是否安全，知道下一步该处理什么。
- 类别建议：财务 / 效率
- 年龄分级：不含用户生成公开内容、不含成人内容，按各市场问卷填写。
- 支持邮箱：待填写
- 隐私政策 URL：`https://<你的域名>/privacy`
- 用户协议 URL：`https://<你的域名>/terms`
- 官网 / 支持 URL：`https://<你的域名>/support`
- 账号与数据删除 URL：`https://<你的域名>/account-deletion`

## 关键词

家庭账本、家庭财务、预算管理、资产管理、流水、现金流、记账、财务安全、资金账户、负债管理

## 简介草稿

Elevate Life 家庭账本面向家庭财务管理场景，帮助用户集中查看资产、负债、预算、流水和现金流安全状态。首页优先回答“我家现在安不安全，接下来该做哪件事”，并支持按资金账户追踪银行卡、现金、投资账户等资金流动。

## 审核备注

- 测试账号：`demo`
- 测试密码：`demo123`
- 审核路径：首页查看家庭财务状态；进入资产管理查看资金账户；进入流水管理新增/编辑支出并选择来源资金账户；进入预算管理记录预算支出。
- 数据说明：应用存储家庭财务数据，提交审核时请使用测试数据，不要填真实银行卡号或个人敏感材料。

上架前先在目标环境运行 `npm run review:seed`，确认 `demo/demo123` 可登录，并包含示例资产、预算、负债、流水和资金账户数据。正式生产环境如果不想使用默认账号名和密码，可设置 `REVIEW_ACCOUNT_USERNAME` / `REVIEW_ACCOUNT_PASSWORD` 后重新 seed，并同步更新商店审核备注。

## 截图规格

- Google Play：至少准备手机截图，建议 1080 x 1920 或 1440 x 2560；补充 7 英寸和 10 英寸平板截图会更稳。
- Android 国内市场：通常需要应用图标、启动图、手机截图、应用介绍图；各市场尺寸不同，按提交后台生成最终导出。
- iOS App Store：至少准备 iPhone 截图；如支持 iPad，需要 iPad 截图。建议用当前 Xcode 模拟器导出 6.9 英寸、6.5 英寸和 iPad Pro 尺寸截图。

## 截图脚本建议

生成截图前，先让 Web 应用在目标地址运行。当前项目网页统一使用 3000 端口，本地预览可使用：

```bash
STORE_SCREENSHOT_BASE_URL=http://localhost:3000 \
STORE_SCREENSHOT_USERNAME=demo \
STORE_SCREENSHOT_PASSWORD=demo123 \
npm run screenshots:store
```

默认输出到 `store-screenshots/`，该目录不提交到仓库。可用 `STORE_SCREENSHOT_OUTPUT_DIR` 改到其他目录。首次运行如果 Playwright 提示缺少浏览器，请先执行 `npx playwright install chromium`。

截图脚本会在浏览器上下文中写入当前版本的用户协议/隐私政策同意记录，避免审核截图被首次确认弹窗遮挡。输出图片按目标设备首屏尺寸生成，不导出整页长图。

脚本会按 Google Play phone、Android domestic phone 和 App Store 6.9 inch 三组手机尺寸生成：

1. `home-family-safety`：首页家庭安全状态与下一步行动。
2. `assets-account-view`：资产管理与资金账户视图。
3. `ledger-source-account`：流水来源资金账户。
4. `budget-expense-source`：预算支出来源资金账户。
5. `privacy-public-page`：公开隐私政策页面。

提交前从 `store-screenshots/` 挑选每个市场需要的最终图片；如商店后台要求不同尺寸，以后台导出规格为准。
