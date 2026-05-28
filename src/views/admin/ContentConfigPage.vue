<template>
  <main class="content-admin-page">
    <section class="content-admin-shell">
      <header class="content-admin-head">
        <div>
          <div class="content-admin-kicker">Admin Content Center</div>
          <h1>内容配置中心</h1>
          <p>当前阶段提供只读总览、草稿校验与发布骨架；在线新增/编辑会在此基础上继续接入。</p>
        </div>
        <a class="content-admin-back" href="#/">返回游戏</a>
      </header>

      <section v-if="loading" class="content-admin-panel">
        正在读取账号与配置状态...
      </section>

      <section v-else-if="authError" class="content-admin-panel content-admin-panel--warning">
        <strong>需要登录</strong>
        <span>{{ authError }}</span>
      </section>

      <section v-else-if="!isAdmin" class="content-admin-panel content-admin-panel--warning">
        <strong>无权限</strong>
        <span>当前账号不是 admin，不能访问内容配置中心。</span>
      </section>

      <template v-else>
        <section class="content-admin-dashboard">
          <article class="content-admin-panel">
            <span>配置版本</span>
            <strong>{{ manifest.version || 'builtin' }}</strong>
            <small>{{ manifest.publishedAt || '尚未发布后台快照，当前使用内置配置。' }}</small>
          </article>
          <article class="content-admin-panel">
            <span>实体规模</span>
            <strong>{{ totalCount }}</strong>
            <small>人物、门派、路线、武学、玩法与选项模板总数。</small>
          </article>
          <article class="content-admin-panel">
            <span>草稿校验</span>
            <strong>{{ validation ? (validation.ok ? '通过' : '存在问题') : '未校验' }}</strong>
            <small>{{ validationSummary }}</small>
          </article>
        </section>

        <section class="content-admin-actions">
          <button type="button" @click="runValidate" :disabled="actionLoading">校验草稿</button>
          <button type="button" @click="publishDraft" :disabled="actionLoading || (validation && !validation.ok)">发布草稿</button>
          <button type="button" @click="loadAll" :disabled="actionLoading">刷新</button>
        </section>

        <section class="content-admin-workbench">
          <nav class="content-admin-tabs" aria-label="内容类型">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeType === tab.key }"
              @click="activeType = tab.key"
            >
              <span>{{ tab.label }}</span>
              <small>{{ countOf(tab.key) }}</small>
            </button>
          </nav>

          <section class="content-admin-list">
            <header>
              <div>
                <div class="content-admin-kicker">{{ activeTab.label }}</div>
                <h2>{{ activeTab.description }}</h2>
              </div>
              <div class="content-admin-list-tools">
                <input v-model.trim="keyword" type="search" placeholder="搜索 id / 名称 / 标签">
                <button type="button" @click="startCreate">新增</button>
              </div>
            </header>

            <div v-if="filteredItems.length" class="content-admin-items">
              <article
                v-for="item in filteredItems"
                :key="item.id"
                class="content-admin-item"
                :class="{ active: selectedId === item.id }"
                @click="startEdit(item)"
              >
                <strong>{{ item.name || item.label || item.text || item.id }}</strong>
                <span>{{ item.id }}</span>
                <p>{{ item.summary || item.description || item.hint || item.title || '暂无摘要。' }}</p>
              </article>
            </div>
            <div v-else class="content-admin-empty">当前类型没有可展示内容。</div>
          </section>

          <aside class="content-admin-editor">
            <header>
              <div>
                <div class="content-admin-kicker">{{ editorMode === 'create' ? '新增配置' : '编辑配置' }}</div>
                <h2>{{ activeTab.label }}</h2>
              </div>
              <button v-if="selectedId" type="button" @click="duplicateCurrent">复制</button>
            </header>

            <section class="content-admin-guidance">
              <strong>{{ activeGuide.title }}</strong>
              <p>{{ activeGuide.description }}</p>
              <div class="content-admin-badges">
                <span v-for="badge in activeGuide.badges" :key="badge">{{ badge }}</span>
              </div>
            </section>

            <section class="content-admin-form-grid">
              <label
                v-for="field in activeFields"
                :key="field.path"
                :class="{ wide: field.type === 'textarea' || field.type === 'object' || field.type === 'arrayText' }"
              >
                <span>{{ field.label }}</span>
                <input
                  v-if="field.type === 'text'"
                  :value="valueForField(field)"
                  type="text"
                  :disabled="field.path === 'id' && editorMode === 'edit'"
                  :placeholder="field.placeholder || ''"
                  @input="updateEntityField(field, $event.target.value)"
                >
                <input
                  v-else-if="field.type === 'number'"
                  :value="valueForField(field)"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step || 1"
                  :placeholder="field.placeholder || ''"
                  @input="updateEntityField(field, $event.target.value)"
                >
                <select
                  v-else-if="field.type === 'select'"
                  :value="valueForField(field)"
                  @change="updateEntityField(field, $event.target.value)"
                >
                  <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <textarea
                  v-else-if="field.type === 'textarea'"
                  :value="valueForField(field)"
                  rows="4"
                  :placeholder="field.placeholder || ''"
                  @input="updateEntityField(field, $event.target.value)"
                ></textarea>
                <textarea
                  v-else-if="field.type === 'arrayText'"
                  :value="arrayTextForField(field)"
                  rows="2"
                  :placeholder="field.placeholder || '用英文逗号分隔'"
                  @input="updateEntityField(field, $event.target.value)"
                ></textarea>
                <textarea
                  v-else-if="field.type === 'object'"
                  :value="objectTextForField(field)"
                  rows="5"
                  spellcheck="false"
                  :placeholder="field.placeholder || '{}'"
                  @input="updateEntityField(field, $event.target.value)"
                ></textarea>
                <small v-if="field.help">{{ field.help }}</small>
              </label>
            </section>

            <section class="content-admin-preview">
              <div>
                <span>配置预览</span>
                <strong>{{ previewTitle }}</strong>
              </div>
              <p>{{ previewSummary }}</p>
            </section>

            <details class="content-admin-json">
              <summary>高级 JSON 编辑</summary>
              <textarea v-model="form.jsonText" rows="12" spellcheck="false" @blur="applyJsonToEntity"></textarea>
              <small>用于补充暂未做成表单的深层字段；离开输入框后会同步到上方可视化表单。</small>
            </details>

            <div v-if="editorError" class="content-admin-error">{{ editorError }}</div>

            <div class="content-admin-editor-actions">
              <button type="button" @click="saveCurrent" :disabled="actionLoading">保存草稿</button>
              <button type="button" @click="resetEditor" :disabled="actionLoading">重置</button>
              <button v-if="selectedId" type="button" class="danger" @click="deleteCurrent" :disabled="actionLoading">删除</button>
            </div>
          </aside>
        </section>
      </template>
    </section>
  </main>
</template>

<script>
import authApi from '@/api/authApi';
import contentAdminApi from '@/api/contentAdminApi';

const TABS = [
  { key: 'characters', label: '人物', description: '人物与关系线配置' },
  { key: 'sects', label: '门派', description: '门派、山门与收徒配置' },
  { key: 'routes', label: '路线', description: '城市路线与通行代价' },
  { key: 'martialSkills', label: '武学', description: '武学条目与效果配置' },
  { key: 'actions', label: '玩法', description: '固定行动与玩法入口' },
  { key: 'optionTemplates', label: '选项模板', description: '动态选项模板' }
];

const GUIDES = {
  characters: {
    title: '人物模板',
    description: '先写清“是谁、从哪里来、擅长什么、会给剧情带来什么阻力或机会”。',
    badges: ['身份', '地点', '能力', '叙事提示']
  },
  sects: {
    title: '门派模板',
    description: '门派要能落到山门地域、规矩、修习风格和入门门槛，避免只剩抽象名号。',
    badges: ['地域', '风格', '收徒', '训练收益']
  },
  routes: {
    title: '路线模板',
    description: '路线配置决定城市之间怎么走、风险多高、消耗多少，适合先做短链路再扩展。',
    badges: ['起点', '终点', '风险', '成本']
  },
  martialSkills: {
    title: '武学模板',
    description: '武学需要有门派/流派归属、层级、效果和一句能进入剧情的手感描述。',
    badges: ['流派', '层级', '效果', '叙事质感']
  },
  actions: {
    title: '玩法入口模板',
    description: '玩法动作要写成玩家能直接点击的动词短句，并明确分类、模式、解锁条件和结算方向。',
    badges: ['按钮文案', '玩法分类', '解锁', '效果']
  },
  optionTemplates: {
    title: '动态选项模板',
    description: '选项模板用于给 AI 生成下一步时定调，重点是条件、载荷和提示语，不要写成固定剧情。',
    badges: ['标签', '条件', '载荷', '提示']
  }
};

const FIELD_SETS = {
  characters: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'char_xun_you', help: '发布后作为引用键，不建议改名。' },
    { path: 'name', label: '姓名', type: 'text', placeholder: '荀攸' },
    { path: 'title', label: '身份/称号', type: 'text', placeholder: '颍川谋士' },
    { path: 'gender', label: '性别', type: 'select', options: [{ value: '', label: '未指定' }, { value: 'male', label: '男' }, { value: 'female', label: '女' }, { value: 'unknown', label: '未知' }] },
    { path: 'homeCityIds', label: '关联城市', type: 'arrayText', placeholder: 'xuchang, changan' },
    { path: 'tags', label: '标签', type: 'arrayText', placeholder: 'strategy, noble, rumor' },
    { path: 'martialRating', label: '武力倾向', type: 'number', min: 0, max: 100 },
    { path: 'strategyRating', label: '谋略倾向', type: 'number', min: 0, max: 100 },
    { path: 'summary', label: '人物摘要', type: 'textarea', placeholder: '写出他会怎样改变局面。' },
    { path: 'promptHints', label: '剧情提示', type: 'arrayText', placeholder: '说话克制, 不主动投效, 先试探再表态' }
  ],
  sects: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'sect_qingfeng' },
    { path: 'name', label: '门派名', type: 'text' },
    { path: 'region', label: '地域', type: 'text', placeholder: '关中' },
    { path: 'style', label: '武学风格', type: 'text', placeholder: '轻身、短刃、暗探' },
    { path: 'cityIds', label: '关联城市', type: 'arrayText', placeholder: 'changan, hongnong' },
    { path: 'tags', label: '标签', type: 'arrayText' },
    { path: 'summary', label: '门派摘要', type: 'textarea' },
    { path: 'trainingBonus', label: '训练收益 JSON', type: 'object', placeholder: '{"martial":2}' },
    { path: 'joinRequirements', label: '入门条件 JSON', type: 'object', placeholder: '{"reputation":10}' }
  ],
  routes: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'route_changan_luoyang' },
    { path: 'from', label: '起点城市 ID', type: 'text', placeholder: 'changan' },
    { path: 'to', label: '终点城市 ID', type: 'text', placeholder: 'luoyang' },
    { path: 'label', label: '显示名称', type: 'text', placeholder: '长安至洛阳驿路' },
    { path: 'type', label: '路线类型', type: 'select', options: [{ value: 'land', label: '陆路' }, { value: 'river', label: '水路' }, { value: 'mountain', label: '山道' }, { value: 'secret', label: '暗线' }] },
    { path: 'weight', label: '权重', type: 'number', min: 1 },
    { path: 'risk', label: '风险', type: 'number', min: 0, max: 10 },
    { path: 'cost', label: '通行成本 JSON', type: 'object', placeholder: '{"coins":10,"supplies":3}' },
    { path: 'summary', label: '路线说明', type: 'textarea' }
  ],
  martialSkills: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'skill_duanjian' },
    { path: 'name', label: '武学名', type: 'text' },
    { path: 'school', label: '流派/门派', type: 'text' },
    { path: 'tier', label: '层级', type: 'number', min: 1, max: 10 },
    { path: 'tags', label: '标签', type: 'arrayText' },
    { path: 'summary', label: '武学摘要', type: 'textarea' },
    { path: 'effects', label: '效果 JSON', type: 'object', placeholder: '[{"stat":"martial","value":1}]' }
  ],
  actions: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'act_visit_office' },
    { path: 'text', label: '按钮文案', type: 'text', placeholder: '入署问案' },
    { path: 'category', label: '分类', type: 'text', placeholder: 'investigate' },
    { path: 'actionKind', label: '行动 kind', type: 'text', placeholder: 'investigate' },
    { path: 'actionMode', label: '行动 mode', type: 'text', placeholder: 'probe_office' },
    { path: 'group', label: '分组', type: 'text', placeholder: 'city' },
    { path: 'direction', label: '叙事方向', type: 'text', placeholder: '官署文书与差役盘问' },
    { path: 'tags', label: '标签', type: 'arrayText' },
    { path: 'hint', label: '玩家提示', type: 'textarea' },
    { path: 'unlock', label: '解锁条件 JSON', type: 'object', placeholder: '{"reputation":5}' },
    { path: 'effects', label: '效果 JSON', type: 'object', placeholder: '[{"stat":"coins","value":-5}]' }
  ],
  optionTemplates: [
    { path: 'id', label: '唯一 ID', type: 'text', placeholder: 'tpl_moral_debt' },
    { path: 'label', label: '模板名', type: 'text' },
    { path: 'slot', label: '槽位', type: 'select', options: [{ value: '', label: '自动' }, { value: 'normal', label: '正常推进' }, { value: 'moral', label: '代价选择' }, { value: 'wild', label: '奇手' }] },
    { path: 'tags', label: '标签', type: 'arrayText' },
    { path: 'summary', label: '模板说明', type: 'textarea' },
    { path: 'conditions', label: '触发条件 JSON', type: 'object', placeholder: '{"minTension":2}' },
    { path: 'payload', label: '载荷 JSON', type: 'object', placeholder: '{"tone":"low_key"}' }
  ]
};

export default {
  name: 'ContentConfigPage',
  data() {
    return {
      loading: true,
      actionLoading: false,
      authError: '',
      currentUser: null,
      manifest: {},
      validation: null,
      activeType: 'characters',
      editorMode: 'create',
      selectedId: '',
      keyword: '',
      editorError: '',
      form: this.createEmptyForm('characters'),
      itemsByType: TABS.reduce((bag, tab) => Object.assign(bag, { [tab.key]: [] }), {})
    };
  },
  computed: {
    tabs() {
      return TABS;
    },
    isAdmin() {
      return !!(this.currentUser && this.currentUser.isAdmin === true);
    },
    activeTab() {
      return this.tabs.find((tab) => tab.key === this.activeType) || this.tabs[0];
    },
    activeItems() {
      return this.itemsByType[this.activeType] || [];
    },
    filteredItems() {
      const keyword = String(this.keyword || '').toLowerCase();
      if (!keyword) return this.activeItems.slice(0, 80);
      return this.activeItems.filter((item) => JSON.stringify(item).toLowerCase().includes(keyword)).slice(0, 80);
    },
    totalCount() {
      return Object.values(this.manifest.entityCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    },
    validationSummary() {
      if (!this.validation) return '发布前应先运行一次校验。';
      const issues = Array.isArray(this.validation.issues) ? this.validation.issues : [];
      return issues.length ? `${issues.length} 条问题需要处理。` : '草稿可以发布。';
    },
    activeGuide() {
      return GUIDES[this.activeType] || GUIDES.characters;
    },
    activeFields() {
      return FIELD_SETS[this.activeType] || FIELD_SETS.characters;
    },
    previewTitle() {
      const entity = this.form.entity || {};
      return entity.name || entity.label || entity.text || entity.id || '尚未命名';
    },
    previewSummary() {
      const entity = this.form.entity || {};
      return entity.summary || entity.description || entity.hint || entity.direction || '补充摘要后，列表和剧情引用会更容易判断用途。';
    }
  },
  async mounted() {
    await this.loadAll();
  },
  methods: {
    createEmptyForm(type) {
      const template = this.defaultEntityForType ? this.defaultEntityForType(type) : { id: '' };
      return {
        id: template.id || '',
        title: template.name || template.label || template.text || '',
        tags: Array.isArray(template.tags) ? template.tags.join(',') : '',
        summary: template.summary || template.description || template.hint || '',
        entity: JSON.parse(JSON.stringify(template)),
        jsonText: JSON.stringify(template, null, 2)
      };
    },
    defaultEntityForType(type) {
      const base = { id: '', disabled: false };
      if (type === 'characters') return Object.assign(base, { name: '', title: '', summary: '', tags: [], homeCityIds: [], martialRating: 0, strategyRating: 0 });
      if (type === 'sects') return Object.assign(base, { name: '', region: '', style: '', summary: '', cityIds: [], trainingBonus: {} });
      if (type === 'routes') return Object.assign(base, { from: '', to: '', type: 'land', weight: 1, label: '', risk: 1, cost: { coins: 0, supplies: 0 } });
      if (type === 'martialSkills') return Object.assign(base, { name: '', school: '', tier: 1, summary: '', effects: [] });
      if (type === 'actions') return Object.assign(base, { text: '', hint: '', category: '', actionKind: '', actionMode: '', direction: '', group: '', unlock: {}, effects: [] });
      return Object.assign(base, { label: '', summary: '', conditions: {}, payload: {} });
    },
    countOf(type) {
      return (this.itemsByType[type] || []).length;
    },
    async loadAll() {
      this.loading = true;
      this.authError = '';
      try {
        const authPayload = await authApi.getMe();
        this.currentUser = authPayload.user;
        if (!this.isAdmin) return;
        const manifestPayload = await contentAdminApi.getManifest();
        this.manifest = manifestPayload.manifest || {};
        const results = await Promise.all(this.tabs.map((tab) => contentAdminApi.list(tab.key)));
        const next = {};
        results.forEach((payload) => {
          next[payload.type] = Array.isArray(payload.items) ? payload.items : [];
        });
        this.itemsByType = Object.assign({}, this.itemsByType, next);
        if (!this.selectedId) this.resetEditor();
      } catch (error) {
        this.authError = error.message || '无法读取账号状态。';
      } finally {
        this.loading = false;
      }
    },
    async runValidate() {
      this.actionLoading = true;
      try {
        const payload = await contentAdminApi.validate();
        this.validation = payload.validation || null;
      } finally {
        this.actionLoading = false;
      }
    },
    async publishDraft() {
      this.actionLoading = true;
      try {
        const payload = await contentAdminApi.publish();
        this.manifest = payload.manifest || this.manifest;
        this.validation = payload.validation || this.validation;
        await this.loadAll();
      } finally {
        this.actionLoading = false;
      }
    },
    startCreate() {
      this.editorMode = 'create';
      this.selectedId = '';
      this.editorError = '';
      this.form = this.createEmptyForm(this.activeType);
    },
    startEdit(item) {
      const source = item || {};
      this.editorMode = 'edit';
      this.selectedId = source.id || '';
      this.editorError = '';
      this.form = {
        id: source.id || '',
        title: source.name || source.label || source.text || '',
        tags: Array.isArray(source.tags) ? source.tags.join(',') : '',
        summary: source.summary || source.description || source.hint || '',
        entity: JSON.parse(JSON.stringify(source)),
        jsonText: JSON.stringify(source, null, 2)
      };
    },
    resetEditor() {
      if (this.selectedId) {
        const item = this.activeItems.find((entry) => entry.id === this.selectedId);
        if (item) {
          this.startEdit(item);
          return;
        }
      }
      this.startCreate();
    },
    duplicateCurrent() {
      const id = this.form.id ? `${this.form.id}_copy` : '';
      this.editorMode = 'create';
      this.selectedId = '';
      this.form.id = id;
      try {
        const payload = JSON.parse(this.form.jsonText || '{}');
        payload.id = id;
        this.form.entity = payload;
        this.form.jsonText = JSON.stringify(payload, null, 2);
      } catch (error) {
        this.editorError = '当前 JSON 无法解析，不能复制。';
      }
    },
    valueForField(field) {
      const value = this.readPath(this.form.entity, field.path);
      return value === undefined || value === null ? '' : value;
    },
    arrayTextForField(field) {
      const value = this.readPath(this.form.entity, field.path);
      return Array.isArray(value) ? value.join(', ') : String(value || '');
    },
    objectTextForField(field) {
      const value = this.readPath(this.form.entity, field.path);
      if (value === undefined || value === null || value === '') return '';
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value || '');
      }
    },
    readPath(source, path) {
      return String(path || '').split('.').reduce((value, key) => {
        if (!value || typeof value !== 'object') return undefined;
        return value[key];
      }, source || {});
    },
    writePath(target, path, value) {
      const keys = String(path || '').split('.').filter(Boolean);
      if (!keys.length) return;
      let cursor = target;
      keys.slice(0, -1).forEach((key) => {
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
      });
      cursor[keys[keys.length - 1]] = value;
    },
    updateEntityField(field, rawValue) {
      const next = JSON.parse(JSON.stringify(this.form.entity || {}));
      let value = rawValue;
      if (field.type === 'number') value = rawValue === '' ? 0 : Number(rawValue);
      if (field.type === 'arrayText') {
        value = String(rawValue || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (field.type === 'object') {
        try {
          value = rawValue ? JSON.parse(rawValue) : {};
          this.editorError = '';
        } catch (error) {
          this.editorError = `${field.label} JSON 格式错误：${error.message}`;
          return;
        }
      }
      this.writePath(next, field.path, value);
      this.form.entity = next;
      this.form.id = next.id || '';
      this.form.title = next.name || next.label || next.text || '';
      this.form.tags = Array.isArray(next.tags) ? next.tags.join(',') : '';
      this.form.summary = next.summary || next.description || next.hint || '';
      this.form.jsonText = JSON.stringify(next, null, 2);
    },
    applyJsonToEntity() {
      try {
        const payload = this.form.jsonText ? JSON.parse(this.form.jsonText) : {};
        this.form.entity = payload;
        this.form.id = payload.id || '';
        this.form.title = payload.name || payload.label || payload.text || '';
        this.form.tags = Array.isArray(payload.tags) ? payload.tags.join(',') : '';
        this.form.summary = payload.summary || payload.description || payload.hint || '';
        this.editorError = '';
      } catch (error) {
        this.editorError = `JSON 格式错误：${error.message}`;
      }
    },
    buildPayloadFromForm() {
      let payload = JSON.parse(JSON.stringify(this.form.entity || {}));
      try {
        payload = this.form.jsonText ? Object.assign(payload, JSON.parse(this.form.jsonText)) : payload;
      } catch (error) {
        throw new Error(`JSON 格式错误：${error.message}`);
      }

      payload.id = this.form.id || payload.id;
      const title = this.form.title;
      if (title) {
        if (this.activeType === 'actions') payload.text = title;
        else if (this.activeType === 'optionTemplates') payload.label = title;
        else payload.name = title;
      }
      if (this.form.summary) {
        if (this.activeType === 'actions') payload.hint = this.form.summary;
        else payload.summary = this.form.summary;
      }
      const tags = String(this.form.tags || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (tags.length) payload.tags = tags;
      return payload;
    },
    async saveCurrent() {
      this.actionLoading = true;
      this.editorError = '';
      try {
        const payload = this.buildPayloadFromForm();
        const response = this.editorMode === 'edit'
          ? await contentAdminApi.update(this.activeType, this.selectedId || payload.id, payload)
          : await contentAdminApi.create(this.activeType, payload);
        this.validation = response.validation || this.validation;
        await this.loadAll();
        const savedId = response.item && response.item.id ? response.item.id : payload.id;
        const saved = (this.itemsByType[this.activeType] || []).find((item) => item.id === savedId);
        if (saved) this.startEdit(saved);
      } catch (error) {
        this.editorError = error.message || '保存失败。';
      } finally {
        this.actionLoading = false;
      }
    },
    async deleteCurrent() {
      if (!this.selectedId) return;
      this.actionLoading = true;
      this.editorError = '';
      try {
        const response = await contentAdminApi.remove(this.activeType, this.selectedId);
        this.validation = response.validation || this.validation;
        this.selectedId = '';
        await this.loadAll();
        this.startCreate();
      } catch (error) {
        this.editorError = error.message || '删除失败。';
      } finally {
        this.actionLoading = false;
      }
    }
  },
  watch: {
    activeType() {
      this.keyword = '';
      this.startCreate();
    }
  }
};
</script>

<style scoped>
.content-admin-page {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at 18% 0%, rgba(184, 153, 71, 0.14), transparent 32%),
    linear-gradient(180deg, #100d0c, #070606);
  color: #ead8bd;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.content-admin-shell {
  max-width: 1280px;
  margin: 0 auto;
}

.content-admin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.content-admin-head h1,
.content-admin-list h2 {
  margin: 4px 0 6px;
  font-weight: 700;
}

.content-admin-head p,
.content-admin-panel small,
.content-admin-panel span,
.content-admin-item p,
.content-admin-item span {
  color: rgba(234, 216, 189, 0.68);
  line-height: 1.7;
}

.content-admin-kicker {
  color: #b89947;
  font-size: 12px;
  letter-spacing: 0.18em;
}

.content-admin-back,
.content-admin-actions button,
.content-admin-tabs button {
  border: 1px solid rgba(184, 153, 71, 0.22);
  background: rgba(255, 244, 227, 0.045);
  color: #ead8bd;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}

.content-admin-back {
  padding: 10px 14px;
}

.content-admin-dashboard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.content-admin-panel,
.content-admin-list,
.content-admin-tabs {
  border: 1px solid rgba(184, 153, 71, 0.16);
  background:
    repeating-radial-gradient(circle at 18% 24%, rgba(255, 247, 229, 0.02) 0 1px, transparent 1px 5px),
    rgba(22, 18, 16, 0.88);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
}

.content-admin-panel {
  display: grid;
  gap: 6px;
  padding: 18px;
}

.content-admin-panel strong {
  color: #f0dfbf;
  font-size: 24px;
}

.content-admin-panel--warning {
  border-color: rgba(140, 38, 38, 0.44);
}

.content-admin-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.content-admin-actions button {
  min-height: 40px;
  padding: 0 14px;
}

.content-admin-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.content-admin-workbench {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 390px;
  gap: 14px;
}

.content-admin-tabs {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 8px;
}

.content-admin-tabs button {
  display: flex;
  justify-content: space-between;
  min-height: 44px;
  padding: 9px 10px;
  text-align: left;
}

.content-admin-tabs button.active {
  border-color: rgba(184, 153, 71, 0.48);
  background: rgba(184, 153, 71, 0.12);
}

.content-admin-list {
  min-width: 0;
  padding: 18px;
}

.content-admin-list header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.content-admin-list-tools {
  display: flex;
  gap: 8px;
}

.content-admin-list input,
.content-admin-editor input,
.content-admin-editor textarea,
.content-admin-editor select {
  min-width: 260px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(184, 153, 71, 0.2);
  background: rgba(8, 7, 7, 0.72);
  color: #ead8bd;
  font: inherit;
}

.content-admin-list-tools button,
.content-admin-editor button {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(184, 153, 71, 0.22);
  background: rgba(255, 244, 227, 0.045);
  color: #ead8bd;
  cursor: pointer;
  font: inherit;
}

.content-admin-items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.content-admin-item {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(184, 153, 71, 0.12);
  background: rgba(255, 244, 227, 0.035);
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.content-admin-item:hover,
.content-admin-item.active {
  border-color: rgba(184, 153, 71, 0.42);
  background: rgba(184, 153, 71, 0.08);
}

.content-admin-item:active {
  transform: translateY(1px);
}

.content-admin-item strong,
.content-admin-item span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-admin-item p {
  display: -webkit-box;
  margin: 8px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.content-admin-empty {
  padding: 34px;
  color: rgba(234, 216, 189, 0.58);
  text-align: center;
}

.content-admin-editor {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(184, 153, 71, 0.16);
  background:
    repeating-radial-gradient(circle at 18% 24%, rgba(255, 247, 229, 0.02) 0 1px, transparent 1px 5px),
    rgba(22, 18, 16, 0.9);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
}

.content-admin-editor header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.content-admin-editor h2 {
  margin: 4px 0 0;
}

.content-admin-guidance,
.content-admin-preview,
.content-admin-json {
  border: 1px solid rgba(184, 153, 71, 0.14);
  background: rgba(255, 244, 227, 0.035);
}

.content-admin-guidance {
  display: grid;
  gap: 8px;
  padding: 12px;
}

.content-admin-guidance strong,
.content-admin-preview strong {
  color: #f0dfbf;
}

.content-admin-guidance p,
.content-admin-preview p,
.content-admin-json small,
.content-admin-form-grid small {
  margin: 0;
  color: rgba(234, 216, 189, 0.62);
  line-height: 1.65;
}

.content-admin-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.content-admin-badges span {
  padding: 3px 7px;
  border: 1px solid rgba(184, 153, 71, 0.18);
  background: rgba(184, 153, 71, 0.08);
  color: rgba(234, 216, 189, 0.78);
  font-size: 12px;
}

.content-admin-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.content-admin-form-grid label,
.content-admin-editor label {
  display: grid;
  gap: 6px;
}

.content-admin-form-grid label.wide {
  grid-column: 1 / -1;
}

.content-admin-form-grid label span,
.content-admin-editor label span,
.content-admin-preview span {
  color: rgba(234, 216, 189, 0.68);
  font-size: 12px;
}

.content-admin-editor input,
.content-admin-editor select {
  width: 100%;
  min-width: 0;
}

.content-admin-editor textarea {
  width: 100%;
  min-width: 0;
  padding-top: 10px;
  line-height: 1.55;
  resize: vertical;
}

.content-admin-preview {
  display: grid;
  gap: 8px;
  padding: 12px;
}

.content-admin-preview div {
  display: grid;
  gap: 3px;
}

.content-admin-json {
  padding: 0 12px 12px;
}

.content-admin-json summary {
  min-height: 42px;
  padding-top: 11px;
  color: #caa85b;
  cursor: pointer;
}

.content-admin-json textarea {
  margin-top: 8px;
  font-family: "Fira Code", Consolas, monospace;
  font-size: 12px;
}

.content-admin-error {
  padding: 10px 12px;
  border: 1px solid rgba(140, 38, 38, 0.44);
  background: rgba(140, 38, 38, 0.14);
  color: #f2b3a8;
  line-height: 1.6;
}

.content-admin-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.content-admin-editor-actions .danger {
  border-color: rgba(140, 38, 38, 0.48);
  color: #f2b3a8;
}

@media (max-width: 860px) {
  .content-admin-page {
    padding: 16px;
  }

  .content-admin-head,
  .content-admin-list header {
    flex-direction: column;
  }

  .content-admin-dashboard,
  .content-admin-workbench,
  .content-admin-items,
  .content-admin-form-grid {
    grid-template-columns: 1fr;
  }

  .content-admin-list input {
    width: 100%;
    min-width: 0;
  }
}
</style>
