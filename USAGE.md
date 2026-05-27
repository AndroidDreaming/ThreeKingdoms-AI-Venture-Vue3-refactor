# 使用文档

## 1. 目录

当前改造目录：

- `E:\Project\workspace\others\ThreeKingdoms-AI-Venture-Vue-refactor`

## 2. 运行要求

- Node.js `>= 18`
- npm `>= 9`

## 3. 安装依赖

进入改造目录后执行：

```bash
npm install
```

## 4. Key 和模型怎么配置

现在已经改成“后端统一配置，前端不可修改”。

配置文件在：

- `server/config/provider.config.json`

默认内容如下：

```json
{
  "providerName": "Local Fallback",
  "apiBaseUrl": "",
  "apiKey": "",
  "model": "local-fallback",
  "temperature": 0.8
}
```

### 4.1 如果先用本地回退模式

保持默认即可，不需要 Key。

### 4.2 如果要接外部大模型

把 `server/config/provider.config.json` 改成类似这样：

```json
{
  "providerName": "OpenAI Compatible",
  "apiBaseUrl": "https://api.openai.com/v1",
  "apiKey": "你的真实Key",
  "model": "gpt-4o-mini",
  "temperature": 0.8
}
```

也可以填兼容 OpenAI 接口格式的其他供应商地址和模型名。

修改后必须重启后端。

## 5. 开发启动方式

开发模式需要两个终端。

终端 1：启动后端

```bash
npm run server
```

终端 2：启动前端

```bash
npm run dev
```

启动后访问：

- 前端页面：`http://localhost:9527`
- 后端接口：`http://localhost:8111`

## 6. 生产构建和运行

先打包前端：

```bash
npm run build
```

再启动后端：

```bash
npm start
```

然后直接访问：

- `http://localhost:8111`

后端会同时提供页面静态资源和 `/api/*` 接口。

## 7. 现在的配置方式有什么变化

这次已经改成：

1. 玩家前端页面不再出现 API URL、API Key、模型选择输入框。
2. Key 只保存在服务端的 `server/config/provider.config.json`。
3. 前端只能看到只读的“当前后台模型配置”信息，不能修改。
4. 如果要换 Key、换模型、换供应商，只能由后台改配置文件并重启服务。

## 8. 常见操作

### 8.1 重开一局

页面右上角点“重新开局”。

### 8.2 改模型

编辑：

- `server/config/provider.config.json`

然后重启：

```bash
npm run server
```

或者生产环境下：

```bash
npm start
```

### 8.3 不想用外部模型，只想本地回退

把配置文件里这几个值留空即可：

- `apiBaseUrl`
- `apiKey`

并把 `model` 保持为：

- `local-fallback`
