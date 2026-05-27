# CentOS VPS 部署文档

本项目可以直接使用 `scripts/` 下现有 Bash 脚本在 CentOS VPS 更新部署，不需要新增脚本。

- `scripts/deploy-production.sh`：安装依赖并构建前端。
- `scripts/deploy-production-prebuilt.sh`：使用已上传的 `dist/`，只安装运行时依赖。
- `scripts/start-production.sh`：读取环境变量并启动 `server/indexCampaignV5ServerManagedV2.js`。

## 运行结构

生产环境建议使用：

- Node.js 18+、npm 9+
- `systemd` 托管 Node 进程
- `nginx` 反代到 `127.0.0.1:8111`

后端进程会托管 `dist/` 和 `/api/*`。以下目录是运行数据，更新代码前建议备份：

```text
server/runtime/auth
server/runtime/sessions-v5
server/runtime/session-logs-v5
```

## 首次部署

```bash
sudo mkdir -p /opt/three-kingdoms /etc/three-kingdoms
cd /opt/three-kingdoms
```

把代码上传或 `git clone` 到 `/opt/three-kingdoms` 后，安装并构建：

```bash
chmod +x scripts/*.sh
./scripts/deploy-production.sh
```

创建环境变量文件：

```bash
sudo cp deploy/env/three-kingdoms.env.centos.example /etc/three-kingdoms/three-kingdoms.env
sudo vi /etc/three-kingdoms/three-kingdoms.env
```

至少确认：

```env
PORT=8111
TK_API_BASE_URL=https://your-provider.example/v1/chat/completions
TK_API_KEY=replace-with-your-real-key
TK_MODEL=replace-with-your-model
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_DISPLAY_NAME=Admin
```

## systemd

```bash
sudo cp deploy/systemd/three-kingdoms.service /etc/systemd/system/three-kingdoms.service
sudo systemctl daemon-reload
sudo systemctl enable --now three-kingdoms
sudo systemctl status three-kingdoms
```

## nginx

```bash
sudo cp deploy/nginx/three-kingdoms.conf /etc/nginx/conf.d/three-kingdoms.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 常规更新

适合 VPS 内存足够的机器：

```bash
cd /opt/three-kingdoms
git pull
./scripts/deploy-production.sh
sudo systemctl restart three-kingdoms
```

验证：

```bash
curl http://127.0.0.1:8111/api/config
curl -I http://127.0.0.1:8111/
curl -I http://127.0.0.1/
```

## 低内存 VPS 更新

如果 VPS 构建时容易 OOM，先在本地 Windows 打包预构建产物：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-prebuilt.ps1
```

上传打包产物并解压到 `/opt/three-kingdoms` 后执行：

```bash
cd /opt/three-kingdoms
chmod +x scripts/*.sh
./scripts/deploy-production-prebuilt.sh
sudo systemctl restart three-kingdoms
```

`deploy-production-prebuilt.sh` 会复用现有 `dist/`，不会在 VPS 上重新执行 Vite 构建。
