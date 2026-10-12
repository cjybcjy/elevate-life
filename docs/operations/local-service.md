# 本机后台服务

Elevate Life 使用用户级 systemd 服务常驻运行，访问地址为 `http://localhost:3000`。服务绑定 `127.0.0.1:3000`，进程退出后等待 5 秒自动重启；主动停止服务后不会自动拉起。启用用户 linger 后，服务可在退出终端后继续运行，并在主机启动时启动。

## 安装

服务模板位于 `deploy/systemd/elevate-life.service`，针对本机目录 `~/workspace/elevate-life` 和 Node.js 路径 `~/.local/bin/node`。迁移到其他机器或目录时，先调整模板中的路径。服务要求已有成功生成的 `.next/BUILD_ID`；首次安装前运行 `npm run build`。

在项目目录执行：

```sh
mkdir -p ~/.config/systemd/user
cp deploy/systemd/elevate-life.service ~/.config/systemd/user/elevate-life.service
loginctl enable-linger kyrie
systemctl --user daemon-reload
systemctl --user enable --now elevate-life
```

服务从项目目录读取 Next.js 环境配置文件。配置文件与数据库凭证应保留在本机，不要写入服务模板或提交到仓库。

## 查看与管理

```sh
# 状态和开机启动配置
systemctl --user status elevate-life --no-pager
systemctl --user is-enabled elevate-life
loginctl show-user kyrie -p Linger

# 重启、主动停止、再次启动
systemctl --user restart elevate-life
systemctl --user stop elevate-life
systemctl --user start elevate-life

# 最近日志、持续查看日志
journalctl --user -u elevate-life -n 100 --no-pager
journalctl --user -u elevate-life -f

# 监听端口与页面响应
ss -ltnp 'sport = :3000'
curl --noproxy localhost,127.0.0.1 -sS -L -o /dev/null \
  -w 'HTTP %{http_code} | %{url_effective}\n' \
  --max-time 10 http://localhost:3000/management/assets
```

未登录时，页面检查应跟随跳转到登录页并返回 HTTP 200。不要同时手工运行另一个占用 3000 端口的 Web 服务。

## 更新应用

在项目目录停止服务后构建，构建成功再启动，避免运行中的服务读取正在替换的 `.next` 文件：

```sh
systemctl --user stop elevate-life
npm run build
# 确认构建成功后执行
systemctl --user start elevate-life
```

构建失败时先解决构建问题，保持服务停止。更新服务模板后，需要重新复制模板、执行 `systemctl --user daemon-reload`，再重启服务。更新完成后重新检查服务状态、监听端口和页面响应。

## 数据库

本机应用连接已有 Docker 容器 `postgres`，实际镜像为 `local-postgres:15`。数据库文件保存在持久卷 `postgres_data`，挂载到容器的 `/var/lib/postgresql/data`。

现有容器的自动恢复策略通过以下命令设置，无需重建容器：

```sh
docker update --restart unless-stopped postgres
docker inspect postgres --format '{{.HostConfig.RestartPolicy.Name}}'
systemctl is-enabled docker
systemctl is-active docker
```

Docker 自身必须已启用开机启动；`unless-stopped` 会在 Docker 启动或容器意外退出后恢复容器，但手工停止的容器需要用 `docker start postgres` 恢复。持久卷独立于 Web 服务，停止或更新 Web 不会删除账本数据。

仓库的 `docker-compose.yml` 也设置了 `restart: unless-stopped`，供新部署使用；其中声明的是 `postgres:16-alpine`，与本机现有数据库版本不同。不要用 Compose 重建来替代本机容器，也不要删除 `postgres_data` 卷。数据库升级和迁移应另行准备备份与验证流程。

## 访问范围与验证边界

此服务供本机 `localhost:3000` 访问。需要其他设备或公网访问时，应另行配置访问入口和匹配的认证地址；生产 HTTPS 部署要求见 `docs/release/production-environment.md`。

开机启动和自动恢复可通过上述配置与运行状态检查确认。整机重启后的实际恢复结果，需要在安排主机重启后再次验证；本说明不代表已执行整机重启测试。
