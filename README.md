# ThreeKingdoms AI Venture

沉浸式三国经营叙事游戏，当前前端已经切换为 `Vue 3 + Vite`，后端与接口保持原有 Node 单服务架构。

## 当前架构

- 前端：`Vue 3 + Vite`
- 主界面入口：`src/features/game-shell/GameShellPage.vue`
- 核心游戏页：`src/views/game/GamePageHanmoChronicleV2.vue`
- 后端入口：`server/indexCampaignV5ServerManagedV2.js`
- 生产静态目录：`dist/`
- 生产端口：默认 `8111`

当前生产拓扑不变：

- `vite build` 产出 `dist/`
- `node server/indexCampaignV5ServerManagedV2.js` 同时提供：
  - 前端页面
  - `/api/*`
  - 流式回合接口

## 本地开发

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run start
```

启动前端开发服务器：

```bash
npm run dev
```

默认：

- 前端开发地址：`http://localhost:9527`
- 后端服务地址：`http://localhost:8111`

Vite 已代理 `/api` 到 `8111`。

## 生产构建

```bash
npm run build
```

## 部署

当前仓库只保留一套推荐部署路径：

- [部署文档](docs/deployment.md)

如果 VPS 内存较低，使用预构建包上传部署即可。

## 打包

本地构建并生成可上传压缩包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-prebuilt.ps1
```

## 当前改造方向

- 前端已完成 `Vue 3 + Vite` 迁移
- 后端与接口路径保持不变
- UI 方向采用“轻 UI + 自研游戏组件”
- 后续继续推进：
  - 进一步组件化 `GamePageHanmoChronicleV2.vue`
  - 收敛样式令牌与布局系统
  - 深化主界面的沉浸式视觉和交互反馈
