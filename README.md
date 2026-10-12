#提升生活品质的小应用建设

##前后端分离的家庭记账 app

## 本机后台运行

本机通过 systemd 服务常驻运行，访问地址为 http://localhost:3000，已配置开机启动与退出后自动恢复。

日常启动、重启和查看状态分别使用 `systemctl --user start elevate-life`、`systemctl --user restart elevate-life` 和 `systemctl --user status elevate-life`。3000 端口由该服务管理。

安装、日志和更新流程见 [后台服务说明](docs/operations/local-service.md)。
