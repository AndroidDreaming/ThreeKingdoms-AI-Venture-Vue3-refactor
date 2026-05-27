# ThreeKingdoms AI Venture

一款以汉末三国为背景的 AI 叙事经营游戏。玩家从无名之人入局，在城池、门派、人脉、军旅、江湖和情感线之间做选择，通过固定规则与大模型叙事共同推进属于自己的乱世履历。

当前项目已经迁移到 `Vue 3 + Vite`，后端仍是 Node 单服务架构。生产环境下同一个 Node 服务同时提供前端页面、`/api/*` 接口和流式回合叙事。

## 游戏简介

游戏标题：`汉末往事之卷` / `汉末风云录`

核心体验：

- 从主角姓名、性别、出身和籍贯开始创建角色。
- 在三国地图上的城池间经营、行走、结识人物和触发线索。
- 通过每回合行动推进叙事，行动会改变钱粮、粮秣、兵力、士气、名望、影响、治理、商路、外交、谋略、武艺、门派情分等数值。
- 大模型负责生成沉浸式叙事、动态选项和人物互动；本地规则引擎负责数值、解锁条件、战斗、门派、旅行、存档与兜底。
- 匿名玩家可试玩，注册登录后可继续绑定存档；后台支持管理员发放回合包、月卡和调整访问权限。

## 玩法说明

### 开局流程

1. 创建主角姓名，或使用随机姓名。
2. 选择出身，例如汉室旁支、乡里武备、失路士子、商旅后人、乱世流民。
3. 选择籍贯城池，例如洛阳、长安、邺城、许昌、下邳、襄阳、建业、成都等。
4. 游戏进入正式回合，系统会按出身、籍贯、城市和时局生成初始人脉与可选行动。

### 回合行动

回合行动分为固定行动和 AI 动态行动。固定行动由配置文件控制，动态行动由大模型结合当前状态生成。

常见行动方向：

- 经营：清账理册、巡乡定纷、修渠清仓、争取城池代治。
- 商路：盘库点货、偏门货路、远线商队、采办军需。
- 人脉：递帖通门、入席会面、设宴结社。
- 情感：借灯夜会、试表心迹、共许风雨、相伴日常。
- 谋略：踏勘地势、翻地方旧案、史实人物线索、放风试口。
- 军旅：投军挂名、入幕进言、募兵、夜操、整肃军纪、随军助战。
- 江湖：混进武馆茶肆、挂帖邀战、顺名号追人。
- 武学：独练拆招、闭关破关、门中深修。
- 养成：茶楼听书、夜游城坊、抄书静坐、投店安睡、药汤调息。

### 数值系统

主要数值包括：

- 资源：`coins` 钱粮、`supplies` 粮秣、`troops` 兵力。
- 状态：`health` 身骨、`fatigue` 疲惫、`morale` 士气。
- 声望与控制：`renown` 名望、`influence` 影响、`governance` 治理、`commerce` 商路。
- 人物能力：`diplomacy` 外交、`strategy` 谋略、`charm` 魅力、`military` 军略。
- 武学与门派：`martialLevel` 武艺、`martialInsight` 武学领悟、`sectFavor` 门中情分、`sectPower` 门派势力。
- 线路名望：`battlefieldPrestige` 战场威名、`jianghuPrestige` 江湖威名。

这些数值会影响行动成功率、选项解锁、人物关系、战斗结果、门派成长、城池权柄和结局评价。

### 人物系统

人物分为三类：

- 史实人物：如荀彧、刘备、曹操、关羽、诸葛亮、周瑜、司马懿等。
- 随机 NPC：幕僚、商行掌柜、部曲校尉、游侠、故家遗脉等模板。
- 追加人物：从仓库根目录的 `追加人物.txt` 读取并自动解析。

人物拥有标签、势力、性格摘要、武学强度、谋略强度、出没城市、可见状态、信任、好感、忠诚、羁绊和恋爱阶段等数据。部分人物会先以风闻出现，需要通过旅行、探查或相关行动真正结识。

### 门派与武学

基础门派包括太白门、沧浪会、青囊馆、玄锋寨，门派会影响武学路线、策略路线、入门收益和独特技能。项目也支持在门派目录配置中追加更多门派。

武学成长有路线、瓶颈和突破：

- 武学路线：乱世野修、太白剑脉、沧浪刀阵、青囊养脉、玄锋骑枪。
- 谋略路线：乱世求生、朝局周旋、商路经营、军政统筹、暗线谋局。
- 武学瓶颈：筋骨关、淬锋关、化劲关、宗师关、通玄关。

### 食物与道具

食物在 `server/game/chronicleV5FoodConfig.js` 中配置。每种食物包含地区、稀有度、风味文本、即时数值变化和临时增益。开局会随机发放部分常见或非常见食物。

## 技术栈

- 前端：`Vue 3`、`Vue Router`、`Vite`
- 后端：Node.js 原生 HTTP 服务
- 样式：Vue 单文件组件与 Less
- 存档：本地 JSON 文件
- AI：兼容 OpenAI 风格 `/v1/chat/completions` 的模型接口
- 部署：Node 单服务、systemd + nginx，或 Docker Compose

关键入口：

- 前端主界面：`src/features/game-shell/GameShellPage.vue`
- 游戏页：`src/views/game/GamePageHanmoChronicleV2.vue`
- 后端入口：`server/indexCampaignV5ServerManagedV2.js`
- 运行配置读取：`server/config/runtimeConfig.js`
- V5 状态工厂：`server/game/chronicleV5StateFactory.js`
- V5 规则引擎：`server/game/chronicleV5RulesEngine.js`
- V5 导演与叙事：`server/game/chronicleV5Director.js`

## 本地开发

环境要求：

- Node.js `>= 18`
- npm `>= 9`

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run server
```

启动前端开发服务：

```bash
npm run dev
```

默认地址：

- 前端：`http://localhost:9527`
- 后端：`http://localhost:8111`
- Vite 已将 `/api` 代理到 `http://localhost:8111`

生产构建：

```bash
npm run build
```

生产启动：

```bash
npm run start
```

## 必要配置文件

仓库不会提交真实密钥和运行期数据。首次部署或本地接入真实模型时，需要自行创建配置。

### 方式一：使用环境变量

本地可以创建 `.env` 或直接在 shell 中设置环境变量；生产环境推荐使用 `/etc/three-kingdoms/three-kingdoms.env`。

可参考：

- `deploy/env/three-kingdoms.env.example`
- `deploy/env/three-kingdoms.env.centos.example`
- `deploy/docker/app.env.example`
- `deploy/docker/app.env.centos.example`

最小配置：

```env
NODE_ENV=production
PORT=8111

TK_PROVIDER_NAME=GLM
TK_API_BASE_URL=https://api.example.com/v1/chat/completions
TK_API_KEY=replace-with-your-api-key
TK_MODEL=glm-5-turbo
TK_ENDPOINT_STRATEGY=auto

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_DISPLAY_NAME=Admin
```

可选调优项：

```env
TK_TEMPERATURE=0.8
TK_CONNECT_TIMEOUT_MS=15000
TK_STREAM_IDLE_TIMEOUT_MS=20000
TK_MAX_STREAM_DURATION_MS=120000
TK_FIRST_CONTENT_TIMEOUT_MS=30000
TK_NONSTREAM_BODY_TIMEOUT_MS=90000
TK_UNIFIED_BUNDLE_TIMEOUT_MS=35000
TK_USE_UNIFIED_BUNDLE=false
TK_DYNAMIC_CHOICE_MODE=batch_first
```

### 方式二：使用模型配置文件

也可以创建 `server/config/provider.config.json`。该文件被 `.gitignore` 排除，不会上传到 GitHub。

单模型示例：

```json
{
  "providerName": "GLM",
  "apiBaseUrl": "https://api.example.com/v1/chat/completions",
  "apiKey": "replace-with-your-api-key",
  "model": "glm-5-turbo",
  "endpointStrategy": "auto",
  "temperature": 0.8
}
```

多模型候选示例：

```json
{
  "temperature": 0.8,
  "endpointStrategy": "auto",
  "providers": [
    {
      "providerName": "Primary",
      "apiBaseUrl": "https://api.example.com/v1/chat/completions",
      "apiKey": "replace-with-your-api-key",
      "model": "model-name"
    },
    {
      "providerName": "Backup",
      "apiBaseUrl": "https://backup.example.com/v1/chat/completions",
      "apiKey": "replace-with-your-backup-key",
      "model": "backup-model-name"
    }
  ]
}
```

环境变量优先级高于 `provider.config.json` 中的同名基础配置。真实启用模型时，`apiBaseUrl`、`apiKey`、`model` 都必须有效，且 `model` 不能是本地默认 fallback。

### 被忽略但运行需要的内容

以下内容不会提交，需要在部署环境自行创建或保留：

- `server/config/provider.config.json`：模型密钥配置。
- `deploy/docker/app.env`：Docker Compose 使用的环境变量文件。
- `deploy/env/three-kingdoms.env`：生产环境变量文件。
- `/etc/three-kingdoms/three-kingdoms.env`：systemd 生产运行配置。
- `server/runtime/auth/`：本地账号、令牌、权限数据。
- `server/runtime/sessions-v5/`：玩家存档。
- `server/runtime/session-logs-v5/`：回合日志。
- `dist/`：前端构建产物。

## 部署方式

### 普通 VPS 部署

推荐生产结构：

- Node.js 18+
- systemd 托管 Node 进程
- nginx 反向代理到 `127.0.0.1:8111`

首次部署：

```bash
sudo mkdir -p /opt/three-kingdoms /etc/three-kingdoms
cd /opt/three-kingdoms
git clone <your-repo-url> .
npm install
npm run build
sudo cp deploy/env/three-kingdoms.env.centos.example /etc/three-kingdoms/three-kingdoms.env
sudo vi /etc/three-kingdoms/three-kingdoms.env
```

安装 systemd 服务：

```bash
chmod +x scripts/*.sh
sudo cp deploy/systemd/three-kingdoms.service /etc/systemd/system/three-kingdoms.service
sudo systemctl daemon-reload
sudo systemctl enable --now three-kingdoms
sudo systemctl status three-kingdoms
```

安装 nginx 配置：

```bash
sudo cp deploy/nginx/three-kingdoms.conf /etc/nginx/conf.d/three-kingdoms.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

验证：

```bash
curl http://127.0.0.1:8111/api/config
curl -I http://127.0.0.1:8111/
curl -I http://127.0.0.1/
```

### 低内存 VPS 预构建部署

如果服务器内存不足，建议在本地构建并打包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-prebuilt.ps1
```

上传压缩包并解压到 `/opt/three-kingdoms` 后执行：

```bash
cd /opt/three-kingdoms
chmod +x scripts/*.sh
./scripts/deploy-production-prebuilt.sh
sudo systemctl restart three-kingdoms
```

### Docker Compose 部署

创建 Docker 环境变量文件：

```bash
cp deploy/docker/app.env.example deploy/docker/app.env
vi deploy/docker/app.env
```

启动：

```bash
docker compose up -d --build
```

默认映射：

- Node 应用容器：`127.0.0.1:8111`
- nginx 容器：`80`
- 运行数据卷：`tk_runtime`

## 常规更新

普通 VPS：

```bash
cd /opt/three-kingdoms
git pull
./scripts/deploy-production.sh
sudo systemctl restart three-kingdoms
```

预构建包更新：

```bash
cd /opt/three-kingdoms
./scripts/deploy-production-prebuilt.sh
sudo systemctl restart three-kingdoms
```

更新前建议备份运行数据：

```text
server/runtime/auth
server/runtime/sessions-v5
server/runtime/session-logs-v5
```

## 如何追加玩法

### 追加固定行动

固定行动配置在：

```text
server/config/chronicle.fixed-actions.config.js
```

在 `FIXED_ACTION_CONFIG` 中新增一项：

```js
{
  id: 'action:trade:new_route',
  text: '开辟新商路',
  actionText: 'action:trade:new_route',
  hint: '尝试把新的货路接进当前城池。',
  category: '经营',
  actionKind: 'trade',
  actionMode: 'new_route',
  direction: 'governance',
  group: 'personal',
  unlock: {
    stats: { commerce: 20, coins: 20 },
    skillsAnyOf: [
      { id: 'market_instinct', label: '市路嗅觉' }
    ]
  }
}
```

字段说明：

- `id`：选项唯一 ID，建议使用 `action:<kind>:<mode>`。
- `text`：按钮显示文字。
- `actionText`：提交给后端的动作文本。
- `hint`：前端提示。
- `category`：显示分类。
- `actionKind`：行为大类，必须能被规则系统识别。
- `actionMode`：行为子模式。
- `direction`：倾向分组，用于组织 UI 与叙事。
- `unlock`：解锁条件，可按数值、技能、门派、城市权柄、史实人物线索等控制。

### 配置行动结果

行动结果配置在：

```text
server/game/chronicleV5ActionConfig.js
```

如果新增了 `actionKind` 或 `actionMode`，需要在 `ACTION_OUTCOME_RULES` 中补充对应规则：

```js
trade: {
  modes: {
    new_route: {
      hook: '新路试盘',
      summaryTemplate: '我在{city}试着开一条新商路，这一回结果是“{tierText}”。',
      tierEffects: {
        great: { commerce: 5, coins: 24, supplies: 8, fatigue: 7, influence: 3 },
        good: { commerce: 3, coins: 14, supplies: 5, fatigue: 7, influence: 1 },
        mixed: { commerce: 1, coins: 6, fatigue: 8 },
        fail: { coins: -10, fatigue: 10, influence: -2 }
      }
    }
  }
}
```

`tierEffects` 分为：

- `great`：大成功。
- `good`：成功。
- `mixed`：一般结果。
- `fail`：失败。

数值为正表示增加，负数表示减少。`fatigue` 是疲惫，增加通常是负面；休息类行动可以配置为负数来降低疲惫。

### 追加城市、路线、出身、史实关系

基础内容配置在：

```text
server/game/chronicleV5ContentConfig.js
```

可追加：

- `BACKGROUNDS_CONTENT`：出身。
- `CITIES_CONTENT`：城池。
- `ORIGIN_CITY_IDS`：可选开局籍贯。
- `CITY_ROUTE_LINES`：城市路线。
- `HISTORICAL_RELATIONS`：史实人物关系种子。
- `RANDOM_NPC_TEMPLATES`：随机 NPC 模板。
- `BACKGROUND_RELATION_RULES`：不同出身优先遇到的人物。

追加城市时，至少要保证：

- `id` 唯一。
- `name` 可读。
- `region` 存在。
- `x`、`y` 用于地图位置。
- `tags`、`eventHooks` 能为 AI 提供叙事钩子。
- 如需旅行连通，需要在 `CITY_ROUTE_LINES` 中添加路线。

### 追加门派

门派目录主要在：

```text
server/game/chronicleV5SectDirectory.js
server/game/chronicleV5SectDirectoryJY.js
server/game/chronicleV5ProgressionConfig.js
```

追加门派时通常需要同时补充：

- 门派基础信息：`id`、`name`、`region`、`style`、`summary`、`trainingBonus`。
- 城市门派映射：某城可以加入或接触哪些门派。
- 门派规则：`SECT_RULES` 中的 `martialRouteId`、`strategyRouteId`、`joinDelta`、`uniqueSkill`。
- 如有特殊解锁，可以在固定行动的 `unlock.requiresSect` 或技能条件中引用。

### 追加武学路线和谋略路线

路线配置在：

```text
server/game/chronicleV5ProgressionConfig.js
```

可修改：

- `MARTIAL_PATHS`：武学路线。
- `MARTIAL_BOTTLENECKS`：武学瓶颈。
- `MARTIAL_FOCI`：武学志向。
- `STRATEGY_PATHS`：谋略路线。
- `BACKGROUND_RULES`：出身初始数值和路线。
- `SECT_RULES`：门派入门收益和路线绑定。

每条路线建议包含：

- `id`：稳定唯一标识。
- `name`：显示名。
- `description`：叙事说明。
- `preferredActions`：偏好的行动类型。
- `levelUpDelta`：升级时的额外成长。
- `unlocks`：指定等级解锁的技能。

## 如何追加人物

### 追加普通江湖人物

最简单方式是编辑根目录：

```text
追加人物.txt
```

格式要求：

```text
角色名 男生
性格：这里写角色性格、说话方式、行为倾向。
武学：这里写门派、武器、招式、强度和战斗风格。
```

或：

```text
角色名 女生
性格：这里写角色性格。
武学：这里写武学设定。
```

解析逻辑在：

```text
server/game/chronicleV5ExtraCharacterPool.js
```

系统会自动推断：

- 性别。
- 称号。
- 标签。
- 所属势力。
- 常驻城市。
- 武学评分。
- 谋略评分。
- 是否作为初始可见人物、风闻人物或隐藏人物出现。

### 指定追加人物出没城市

城市映射在：

```text
server/config/chronicle.extra-characters.config.js
```

在 `EXTRA_CHARACTER_CITY_MAP` 中追加：

```js
const EXTRA_CHARACTER_CITY_MAP = Object.freeze({
  新角色名: '长安'
});
```

也可以配置为多个城市：

```js
const EXTRA_CHARACTER_CITY_MAP = Object.freeze({
  新角色名: ['长安', '洛阳']
});
```

支持中文城名，也支持内部 `cityId`。中文城名到 `cityId` 的映射在同文件的 `CITY_NAME_TO_ID`。

### 追加史实人物

史实人物需要两处配置：

1. 在 `server/game/chronicleV5ContentConfig.js` 的 `HISTORICAL_RELATIONS` 中加入关系种子。
2. 在 `server/game/chronicleV5HistoricalPersonaLibrary.js` 的 `HISTORICAL_PERSONA_LIBRARY` 中加入人物人格、说话风格、行为风格、武学评分、谋略评分和提示重点。

关系种子示例：

```js
{
  id: 'new_hero',
  name: '新人物',
  title: '某地名士',
  factionId: 'court_remnant',
  summary: '简短人物摘要。',
  tags: ['strategy', 'diplomacy'],
  backgrounds: ['fallen_scholar']
}
```

人格库示例：

```js
new_hero: {
  name: '新人物',
  personaAnchor: '人物底色。',
  speechStyle: '说话方式。',
  conductStyle: '行为方式。',
  martialRating: 50,
  strategyRating: 88,
  signatureSkills: ['技能一', '技能二'],
  values: ['重视的事'],
  dislikes: ['厌恶的事'],
  promptFocus: 'AI 演绎时必须抓住的重点。'
}
```

## 如何配置数值

### 出身初始数值

位置：

```text
server/game/chronicleV5ProgressionConfig.js
```

修改 `BACKGROUND_RULES`：

```js
merchant_heir: {
  statDelta: { commerce: 12, diplomacy: 6, strategy: 4, coins: 42, supplies: 12, charm: 6, influence: 4 },
  martialRouteId: 'wild',
  strategyRouteId: 'mercantile'
}
```

### 门派入门数值

位置同上，修改 `SECT_RULES`：

```js
taibai: {
  martialRouteId: 'taibai_sword',
  strategyRouteId: 'courtcraft',
  joinDelta: { martialLevel: 4, strategy: 1, renown: 1, influence: 1 },
  uniqueSkill: { id: 'taibai_inheritance', name: '太白真传', type: '门派', level: '入门', effect: '剑脉成长更快。' }
}
```

### 行动收益数值

位置：

```text
server/game/chronicleV5ActionConfig.js
```

修改对应 `actionKind`、`actionMode` 的 `tierEffects`。

### 行动解锁数值

位置：

```text
server/config/chronicle.fixed-actions.config.js
```

修改固定行动的 `unlock`：

```js
unlock: {
  stats: { martialLevel: 24, jianghuPrestige: 16, renown: 10 },
  skillsAnyOf: [
    { id: 'taibai_edge', label: '太白破锋' }
  ]
}
```

### 食物数值

位置：

```text
server/game/chronicleV5FoodConfig.js
```

每个食物支持：

- `instantDelta`：立即改变数值。
- `tempBuff`：临时增益，包含领域、分值、持续回合和说明。
- `regions`：出现地区。
- `rarity`：稀有度。
- `tags`：适用玩法标签。

## 接口概览

常用接口：

- `GET /api/config`：读取公开配置、模型状态和付费模式。
- `POST /api/session`：创建新存档。
- `GET /api/session/:sessionId`：读取存档。
- `POST /api/session/:sessionId/turn/stream`：流式推进一回合。
- `POST /api/session/:sessionId/reset`：重开。
- `POST /api/session/:sessionId/rename`：改名。
- `POST /api/auth/register`：注册。
- `POST /api/auth/login`：登录。
- `GET /api/me`：当前用户。
- `GET /api/admin/users`：管理员查看用户。
- `POST /api/admin/access`：管理员调整访问权限。

## 目录说明

```text
src/                         前端源码
src/features/game-shell/      新版游戏外壳与 UI 组件
src/views/game/               核心游戏页面
src/api/                      前端 API 调用
server/                       后端源码
server/game/                  规则、状态、叙事、战斗、门派、人物系统
server/config/                运行配置与玩法配置
server/auth/                  本地账号和访问权限
server/runtime/               运行期账号、存档和日志
deploy/                       systemd、nginx、Docker 环境示例
scripts/                      生产启动、部署和预构建打包脚本
static/                       静态资源
docs/                         补充文档
```

## 注意事项

- 不要把真实 `TK_API_KEY`、`provider.config.json`、`app.env`、生产 `.env` 上传到 GitHub。
- 生产更新前备份 `server/runtime`，否则账号、权限和存档可能丢失。
- 新增行动时要同时考虑固定选项、意图识别、规则收益和叙事提示，否则可能出现按钮存在但结果兜底的情况。
- 新增人物时建议先用 `追加人物.txt` 验证效果，再决定是否沉淀为史实人物或专属配置。
- 如果模型不可用，游戏仍会使用本地规则和兜底叙事运行，但动态叙事质量会下降。
