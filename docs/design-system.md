# 主界面重构设计说明

## 目标

以“沉浸式 RPG 经营游戏”而不是后台面板的方式重做 Web 主界面，并保证：

- 后端逻辑不动
- 接口路径不动
- 玩法闭环不动
- PC 与手机都能顺畅操作

## 当前实现原则

### 1. 信息分层

- `title-zone`：卷首、身份、主线、当前工作区信号
- `turn-overview`：当前回合最核心的四项状态
- `story-zone`：正文卷轴 + 简报式情报抽屉
- `operation-zone`：行动战术台
- `intel-zone`：深层情报与状态档案

### 2. 视觉语言

- 统一深棕、铜金、灰青的乱世材质色系
- 统一使用 SVG icon，而不是 emoji 或第三方重 UI 组件
- 统一圆角、描边、玻璃感与压纹层级

### 3. 交互原则

- 默认首屏必须可操作，不能出现空白操作区
- 可点击动作优先，禁用项后置
- 手机端优先展示“当前最值得点的一手”
- 长信息默认收起，细节通过展开、抽屉、分层显示

### 4. 组件策略

采用“轻 UI + 自研游戏组件”：

- 通用基础件：
  - `UiButton`
  - `UiModal`
  - `UiSelect`
  - `UiTextarea`
  - `UiToastStack`
- 游戏壳：
  - `GameShellPage`
- 核心主界面仍由 `GamePageHanmoChronicleV2.vue` 承接，后续继续拆分

## 后续拆分建议

下一阶段建议按下面顺序继续拆分：

1. `TitleZone`
2. `TurnOverview`
3. `StoryBriefing`
4. `StoryScroll`
5. `DynamicChoicesDeck`
6. `FixedActionDeck`
7. `IntelHub`

## 已清理的冗余

- 旧 Vue 2 / webpack 入口
- 历史页面分支
- 旧 `Element UI` 主链依赖
- 多套过时部署方案文档

## 保留策略

当前仍保留：

- Node 后端单服务架构
- 预构建部署方式
- `server/runtime/` 持久化目录

这样可以让前端持续重构而不影响现有线上部署。
