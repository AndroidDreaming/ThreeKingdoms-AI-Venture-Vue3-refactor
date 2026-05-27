<template>
  <Layout
    title="汉末往昔之影"
    chapter-label="乱世卷册"
    :time-label="topBar.timeLabel"
    :turn-label="topBar.turnLabel"
    :system-items="topBar.systemItems"
    command-title="军令簿"
    command-subtitle="这一回只保留真正能落下去的动作，先审局，再出手。"
    :command-groups="commandGroups"
    :active-group-key="activeGroupKey"
    :narrative="narrative"
    :character="character"
    @group-toggle="handleGroupToggle"
    @action-select="handleActionSelect"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import Layout from './Layout.vue';

defineOptions({
  name: 'CrpgShowcase'
});

const activeGroupKey = ref('governance');

const topBar = {
  timeLabel: '建安元年秋九月',
  turnLabel: '第 7 回',
  systemItems: [
    { key: 'account', label: '账号存档', value: '测试管理员' },
    { key: 'trial', label: '试玩回合', value: '1 回' },
    { key: 'fund', label: '储金', value: '10029' },
    { key: 'month-card', label: '月卡状态', value: '有效中' },
    { key: 'logout', label: '退出登录' }
  ]
};

const commandGroups = ref([
  {
    key: 'governance',
    label: '经营',
    summary: '盘点家底、整顿商路、巡查地方。',
    count: '14 项',
    icon: svgSeal('算盘'),
    actions: [
      { key: 'inspect', label: '巡查地方', meta: '摸清城内风向与隐患。', badge: '可点', icon: svgSeal('营') },
      { key: 'inventory', label: '盘点货栈', meta: '整合资财与商路，稳住家底。', badge: '推荐', icon: svgSeal('筹') },
      { key: 'grain', label: '清查粮秣', meta: '先补短板，避免后续断粮。', icon: svgSeal('粮') }
    ]
  },
  {
    key: 'military',
    label: '军略',
    summary: '整军、募兵、试探边线。',
    count: '8 项',
    icon: swordIcon(),
    actions: [
      { key: 'drill', label: '整军操练', meta: '提升军心，适合战前回合。', badge: '稳妥', tone: 'support', icon: swordIcon() },
      { key: 'scout', label: '派人探哨', meta: '先摸清敌意，再决定是否压线。', icon: bannerIcon() }
    ]
  },
  {
    key: 'network',
    label: '人脉',
    summary: '拜访、结交、投石问路。',
    count: '6 项',
    icon: jadeIcon(),
    actions: [
      { key: 'visit', label: '拜访门路', meta: '补一条能转化为资源的人脉线。', badge: '可转化', icon: jadeIcon() },
      { key: 'favor', label: '送礼试探', meta: '探明态度，但要消耗资财。', tone: 'danger', icon: jadeIcon() }
    ]
  }
]);

const narrative = computed(() => ({
  chapterTitle: '建安元年秋九月',
  sceneTitle: '下邳新的一回',
  sceneSubtitle: '城中风向未定，但你已不再只是被动挨打的旁支宗亲。',
  sceneBadge: '可决断',
  summaryRibbon: [
    { key: 'line', label: '主线', value: '立足' },
    { key: 'suggest', label: '建议', value: '先筹谋，再压资源' },
    { key: 'state', label: '状态', value: '等待我落子' }
  ],
  cards: [
    {
      key: 'mainline',
      kicker: '主线走势',
      title: '立足',
      badge: '进度 90%',
      description: '你在下邳已经勉强立住脚跟，但任何一笔失误都会让宗亲余脉再次散掉。此回合最重要的不是冒进，而是把一条稳定的根基线补齐。',
      facts: [
        { label: '推进', value: '90%' },
        { label: '压力', value: '6' },
        { label: '隐患', value: '商路未稳' }
      ]
    },
    {
      key: 'moment',
      kicker: '此刻局势',
      title: '等待我落子',
      badge: '建议先筹谋',
      description: '下邳里外都在重新掂量你的斤两。眼下最怕的是动作太散，所以这一回合更适合优先处理经营与补给，再决定要不要切去军略或人脉线。',
      facts: [
        { label: '资财', value: '34' },
        { label: '军心', value: '4' },
        { label: '声望', value: '18' }
      ]
    }
  ],
  logs: [
    {
      key: 'entry-1',
      label: '正文',
      paragraphs: [
        '下邳里外都开始重新掂量你这个没落宗亲。你手里的钱不多，军心也谈不上稳，但至少这一回，旁人已经不再把你当成一个随手就能捏碎的名字。',
        '市井里的传闻比往日更快。商贾在看你能不能护住货路，旧识在看你会不会先去补家底，城里的游侠则在看你究竟是想立业，还是只想苟过这一冬。'
      ]
    }
  ]
}));

const character = computed(() => ({
  name: '刘衍',
  title: '没落宗亲',
  location: '下邳 · 未入流',
  tags: ['22岁', '男', '下邳', '没落宗亲', '未入流'],
  metrics: [
    { key: 'time', label: '时间', value: '秋九月', icon: clockIcon() },
    { key: 'funds', label: '资财', value: '34', icon: coinIcon() },
    { key: 'morale', label: '军心', value: '4', icon: bannerIcon() },
    { key: 'fame', label: '声望', value: '18', icon: sealIcon() }
  ],
  vitals: [
    { key: 'health', label: '寿元', value: '100 / 100', percent: 100, tone: 'danger' },
    { key: 'fatigue', label: '疲惫', value: '0', percent: 12, meta: '尚能连出数手。' },
    { key: 'spirit', label: '士气', value: '4', percent: 42, tone: 'support', meta: '+2 临时增益' }
  ]
}));

function handleGroupToggle(group) {
  activeGroupKey.value = activeGroupKey.value === group.key ? '' : group.key;
}

function handleActionSelect(action) {
  console.log('[CRPG action]', action.key, action.label);
}

function svgSeal(glyph) {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3"></rect>
      <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor">${glyph}</text>
    </svg>
  `;
}

function swordIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.8 3h4.2v4.2l-2.1-1.1-7 7-1.1-1.1 7-7z"></path>
      <path d="M8.4 11.7 6 14.1l3.9 3.9 2.4-2.4-.9-.9 1.1-1.1-1.6-1.6-1.1 1.1z"></path>
    </svg>
  `;
}

function jadeIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c4.4 0 8 3.6 8 8s-3.6 10-8 10S4 16.4 4 11s3.6-8 8-8Zm0 3.2A4.8 4.8 0 1 0 12 15.8 4.8 4.8 0 0 0 12 6.2Z"></path>
    </svg>
  `;
}

function clockIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm1 4h-2v6l4 2 .8-1.6-2.8-1.4z"></path>
    </svg>
  `;
}

function coinIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4c4.4 0 8 1.8 8 4s-3.6 4-8 4-8-1.8-8-4 3.6-4 8-4Zm-8 6v3c0 2.2 3.6 4 8 4s8-1.8 8-4v-3c-1.7 1.5-4.7 2.5-8 2.5S5.7 11.5 4 10Zm0 5v1c0 2.2 3.6 4 8 4s8-1.8 8-4v-1c-1.7 1.5-4.7 2.5-8 2.5S5.7 16.5 4 15Z"></path>
    </svg>
  `;
}

function bannerIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h2v18H6z"></path>
      <path d="M8 4h9l-2 3 2 3H8z"></path>
    </svg>
  `;
}

function sealIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 7v5c0 5.2 3.4 9.9 8 11 4.6-1.1 8-5.8 8-11V7l-8-5Zm0 4.1 4 2.4v3.4c0 3.4-1.9 6.6-4 7.6-2.1-1-4-4.2-4-7.6V8.5Z"></path>
    </svg>
  `;
}
</script>
