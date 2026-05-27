const { BACKGROUNDS, CITIES, SECTS } = require('./chronicleV5StateFactory');

const INTENT_KEYWORDS = {
  govern: ['内政', '安民', '治民', '修渠', '赈济', '屯田', '整顿', '理政', '抚民'],
  trade: ['经商', '筹粮', '筹钱', '买卖', '商路', '运粮', '贸易', '贩货', '置办'],
  diplomacy: ['游说', '结盟', '拜访', '交涉', '谈判', '说服', '求见', '出使', '斡旋'],
  social: ['探望', '结交', '走访', '请客', '拜会', '拉拢', '送礼', '往来', '示好'],
  romance: ['相会', '约见', '示好', '倾心', '定情', '传情', '暧昧', '私会', '表白', '攻略', '试探心意', '陪伴', '同行', '吃醋', '争宠'],
  martial: ['习武', '练武', '演武', '修习', '武艺', '刀法', '剑法', '枪法', '拳脚', '内功'],
  spar: ['切磋', '喂招', '过招', '拆招', '比招'],
  military: ['练兵', '整军', '募兵', '校场', '军务', '操练', '点兵', '募勇'],
  battle: ['出兵', '征伐', '攻城', '夜袭', '伏击', '交锋', '试锋', '征战', '厮杀'],
  investigate: ['查探', '调查', '打听', '风声', '细作', '暗线', '侦查', '刺探'],
  intrigue: ['设局', '离间', '反间', '收买', '密谋', '谣言', '策反', '布局'],
  rest: ['休整', '静养', '疗伤', '歇息', '休息', '养身', '养伤'],
  sect: ['门派', '师门', '山门', '武馆', '同门'],
  travel: ['前往', '启程', '赶赴', '去往', '动身', '转往', '北上', '南下', '东行', '西进', '赶往', '赴']
};

const ACTION_MODES = new Set([
  'visit',
  'alliance',
  'approach',
  'promise',
  'bond',
  'daily',
  'companion',
  'jealousy',
  'counsel',
  'join',
  'assist',
  'logistics',
  'mentor',
  'retinue_talk',
  'retinue_counsel',
  'retinue_companion',
  // Specialized fixed/dynamic actions encoded via `action:<kind>:<mode>`.
  'recruit_probe',
  'recruit',
  'drill',
  'discipline',
  'camp',
  'arms',
  'outpost',
  'audit',
  'patrol',
  'granary',
  'stewardship',
  'stabilize',
  'warehouse',
  'blackmarket',
  'caravan',
  'market_town',
  'banquet',
  'notables',
  'envoy',
  'terrain',
  'archive',
  'historical_lead',
  'salon',
  'rumor',
  'counterspy',
  'solo',
  'closedoor',
  'garrison',
  'teahouse',
  'stroll',
  'study',
  'inn',
  'medicate',
  'eat',
  'lodge',
  'challenge',
  'trace',
  'cipher',
  'inner_drill',
  'inner_network',
  'appoint_steward',
  'appoint_quartermaster',
  'appoint_counselor',
  'appoint_spymaster',
  'appoint_scout',
  'appoint_escort',
  'appoint_drillmaster',
  'appoint_vanguard',
  'team_logistics',
  'team_trade',
  'team_probe',
  'team_layout',
  'team_roam',
  'team_muster',
  'team_parley',
  'team_sect_affairs',
  'team_recover',
  'team_martial'
]);

const JOIN_SECT_PATTERN = /(加入|投靠|拜入|入门|拜访|求师|拜师)/;
const TRAVEL_PATTERN = /(去|赴|赶赴|前往|动身|启程|赶往|北上|南下|东行|西进)/;

INTENT_KEYWORDS.warpath = ['军旅', '从军', '投军', '统兵', '军锋', '陷阵', '战阵', '入伍'];
INTENT_KEYWORDS.jianghu = ['江湖', '武林', '问剑', '比武', '擂台', '群雄', '行侠', '争雄'];

function classifyDynamicIntent(text) {
  const match = /^dynamic:([^:]+):(.*)$/.exec(text);
  if (!match) return null;

  const encodedKind = match[1] || 'unknown';
  const payload = match[2] || '';
  let decoded = payload;
  try {
    decoded = decodeURIComponent(payload);
  } catch (error) {
    decoded = payload;
  }

  const derived = classifyIntent(decoded);
  return {
    raw: decoded,
    kind: encodedKind && encodedKind !== 'unknown' ? encodedKind : derived.kind,
    target: derived.target || '',
    targetName: derived.targetName || '',
    encoded: text,
    source: 'dynamic'
  };
}

function classifyIntent(actionText) {
  const text = String(actionText || '').trim();
  if (!text) {
    return { raw: '', kind: 'unknown', target: '', targetName: '' };
  }

  if (text.startsWith('dynamic:')) {
    return classifyDynamicIntent(text);
  }

  if (text.startsWith('background:')) {
    const target = text.split(':')[1] || '';
    const background = BACKGROUNDS.find((item) => item.id === target);
    return { raw: text, kind: 'background', target, targetName: background ? background.label : '' };
  }

  if (text.startsWith('origin:')) {
    const target = text.split(':')[1] || '';
    const city = CITIES.find((item) => item.id === target);
    return { raw: text, kind: 'origin', target, targetName: city ? city.name : '' };
  }

  if (text.startsWith('travel:')) {
    const target = text.split(':')[1] || '';
    const city = CITIES.find((item) => item.id === target);
    return { raw: text, kind: 'travel', target, targetName: city ? city.name : '' };
  }

  if (text.startsWith('joinsect:')) {
    const target = text.split(':')[1] || '';
    const sect = SECTS.find((item) => item.id === target);
    return { raw: text, kind: 'joinsect', target, targetName: sect ? sect.name : '' };
  }

  if (text.startsWith('battlecmd:')) {
    const target = text.split(':')[1] || '';
    return { raw: text, kind: 'battlecmd', target, targetName: '' };
  }

  if (text.startsWith('action:')) {
    const parts = text.split(':');
    const kind = parts[1] || 'unknown';
    let target = '';
    let mode = '';
    if (parts.length >= 4) {
      target = parts[2] || '';
      mode = parts[3] || '';
    } else if (parts.length >= 3) {
      if (ACTION_MODES.has(parts[2] || '')) mode = parts[2] || '';
      else target = parts[2] || '';
    }
    return { raw: text, kind, target, targetName: '', mode };
  }

  const matchedBackground = BACKGROUNDS.find((item) => text.includes(item.label));
  if (matchedBackground) {
    return { raw: text, kind: 'background', target: matchedBackground.id, targetName: matchedBackground.label };
  }

  const matchedSect = SECTS.find((item) => text.includes(item.name));
  if (matchedSect) {
    if (JOIN_SECT_PATTERN.test(text)) {
      return { raw: text, kind: 'joinsect', target: matchedSect.id, targetName: matchedSect.name };
    }
    return { raw: text, kind: 'sect', target: matchedSect.id, targetName: matchedSect.name };
  }

  const found = Object.keys(INTENT_KEYWORDS).find((kind) => {
    return INTENT_KEYWORDS[kind].some((word) => text.includes(word));
  });

  if (found && found !== 'travel') {
    return { raw: text, kind: found, target: '', targetName: '' };
  }

  const matchedCity = CITIES.find((item) => text.includes(item.name));
  if (matchedCity) {
    if (found === 'travel' || INTENT_KEYWORDS.travel.some((word) => text.includes(word)) || TRAVEL_PATTERN.test(text)) {
      return { raw: text, kind: 'travel', target: matchedCity.id, targetName: matchedCity.name };
    }
    return { raw: text, kind: 'origin', target: matchedCity.id, targetName: matchedCity.name };
  }

  if (found) {
    return { raw: text, kind: found, target: '', targetName: '' };
  }

  return { raw: text, kind: 'unknown', target: '', targetName: '' };
}

module.exports = {
  classifyIntent
};
