const fs = require('fs');
const path = require('path');
const { resolveExtraCharacterHomeCities } = require('../config/chronicle.extra-characters.config');
const { relationVisibilityState, withRelationVisibility } = require('./chronicleV5RelationVisibility');

const PERSONALITY_PREFIX = '性格：';
const MARTIAL_PREFIX = '武学：';
const MALE_LABELS = ['男', '男生', '男性'];
const FEMALE_LABELS = ['女', '女生', '女性'];

const BACKGROUND_TAG_PREFERENCES = {
  imperial_kin: ['diplomacy', 'social', 'strategy', 'romance'],
  local_gentry: ['govern', 'social', 'martial', 'strategy'],
  fallen_scholar: ['strategy', 'investigate', 'rest', 'govern'],
  merchant_heir: ['trade', 'social', 'romance', 'strategy'],
  refugee: ['martial', 'travel', 'jianghu', 'social']
};

const ACTION_TAG_PREFERENCES = {
  social: ['social', 'romance', 'jianghu'],
  diplomacy: ['social', 'strategy', 'trade'],
  investigate: ['investigate', 'intrigue', 'strategy', 'jianghu'],
  intrigue: ['intrigue', 'investigate', 'strategy'],
  martial: ['martial', 'jianghu'],
  spar: ['martial', 'jianghu', 'social'],
  jianghu: ['jianghu', 'martial', 'social'],
  military: [],
  warpath: [],
  battle: [],
  sect: [],
  joinsect: [],
  trade: ['trade', 'strategy', 'social'],
  govern: ['govern', 'strategy', 'social'],
  travel: ['social', 'jianghu', 'strategy'],
  rest: ['social', 'strategy', 'jianghu']
};

const TITLE_RULES = [
  { keywords: ['医术', '医师', '银针', '万花'], title: '游医' },
  { keywords: ['密探', '暗器', '影子', '探险'], title: '暗行者' },
  { keywords: ['护法', '圣女', '魔教', '红衣教'], title: '江湖异人' },
  { keywords: ['剑', '纯阳', '藏剑', '七秀', '蓬莱'], title: '剑客' },
  { keywords: ['刀', '霸刀', '刀宗'], title: '刀客' },
  { keywords: ['枪', '天策'], title: '枪手' },
  { keywords: ['丐帮'], title: '江湖客' }
];

const CITY_KEYWORD_MAP = [
  { keywords: ['万花', '唐门', '五毒'], cities: ['chengdu'] },
  { keywords: ['少林', '纯阳', '天策', '明教'], cities: ['changan', 'luoyang'] },
  { keywords: ['长歌', '丐帮'], cities: ['xiangyang', 'jiangling'] },
  { keywords: ['藏剑', '七秀', '蓬莱'], cities: ['jianye'] },
  { keywords: ['魔教', '红衣教'], cities: ['yecheng', 'xuchang'] },
  { keywords: ['医术', '医师', '银针'], cities: ['xuchang', 'xiangyang'] }
];

const TAG_RULES = [
  { keywords: ['计划', '睿智', '智慧', '决策', '分析', '算卦'], tags: ['strategy', 'investigate'] },
  { keywords: ['医术', '医师', '银针', '汤出'], tags: ['rest', 'govern'] },
  { keywords: ['机关', '暗器', '密探', '探险', '罗盘'], tags: ['investigate', 'intrigue'] },
  { keywords: ['剑', '刀', '枪', '掌', '拳', '内力', '武功', '武学'], tags: ['martial'] },
  { keywords: ['帮会', '首领', '护法', '弟子', '江湖'], tags: ['jianghu', 'social'] },
  { keywords: ['财务', '管家', '商', '筹粮'], tags: ['trade', 'govern'] },
  { keywords: ['爱情', '御姐', '可爱', '温婉', '知心', '魅惑', '恋爱脑'], tags: ['romance', 'social'] },
  { keywords: ['领导', '天策', '降龙', '部曲'], tags: ['strategy', 'social', 'martial'] },
  { keywords: ['影子', '诡谲', '手段', '挑衅', '嘲讽'], tags: ['shadow', 'intrigue'] }
];

function projectRoot() {
  return path.join(__dirname, '..', '..');
}

function findCharacterPoolFile() {
  const root = projectRoot();
  const files = fs.readdirSync(root).filter((name) => /\.txt$/i.test(name));
  for (const name of files) {
    const fullPath = path.join(root, name);
    try {
      const text = fs.readFileSync(fullPath, 'utf8');
      if (text.includes(PERSONALITY_PREFIX) && text.includes(MARTIAL_PREFIX)) return fullPath;
    } catch (error) {
      // ignore and continue scanning
    }
  }
  return '';
}

function cleanNarrativeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([。，、；：！？）])/g, '$1')
    .replace(/^[\u3002\uff0c\u3001\uff1b\uff1a]+/g, '')
    .replace(/\s*([,.;!?])/g, '$1')
    .trim();
}

function genderInfo(key) {
  if (key === 'female') return { gender: 'female', genderLabel: '女' };
  return { gender: 'male', genderLabel: '男' };
}

function parseExplicitGender(line) {
  const source = cleanNarrativeText(line);
  const bracketMatch = source.match(/^(.*?)[(（](男生|女生|男性|女性|男|女)[)）]$/);
  if (bracketMatch) {
    const label = bracketMatch[2];
    return {
      label,
      name: cleanNarrativeText(bracketMatch[1]),
      ...(FEMALE_LABELS.includes(label) ? genderInfo('female') : genderInfo('male'))
    };
  }
  const spacedMatch = source.match(/^(.*?)\s+(男生|女生|男性|女性|男|女)$/);
  if (spacedMatch) {
    const label = spacedMatch[2];
    return {
      label,
      name: cleanNarrativeText(spacedMatch[1]),
      ...(FEMALE_LABELS.includes(label) ? genderInfo('female') : genderInfo('male'))
    };
  }
  return null;
}

function inferGenderFromText(nameLine, personality, martial) {
  const corpus = `${nameLine} ${personality} ${martial}`;
  const femaleSignals = ['女生', '女性', '女弟子', '女护法', '女门徒', '女剑客', '圣女', '侠女', '姑娘', '女'];
  const maleSignals = ['男生', '男性', '男弟子', '男门徒', '大叔', '高僧', '和尚', '公子', '男'];
  if (femaleSignals.some((token) => corpus.includes(token))) return genderInfo('female');
  if (maleSignals.some((token) => corpus.includes(token))) return genderInfo('male');
  return genderInfo('male');
}

function parseNameLine(line, personality = '', martial = '') {
  const source = cleanNarrativeText(line);
  const explicit = parseExplicitGender(source);
  if (explicit) {
    return {
      name: explicit.name || cleanNarrativeText(source.slice(0, -explicit.label.length).trim()),
      gender: explicit.gender,
      genderLabel: explicit.genderLabel
    };
  }
  const inferred = inferGenderFromText(source, personality, martial);
  return {
    name: source,
    gender: inferred.gender,
    genderLabel: inferred.genderLabel
  };
}

function parseCharacterEntries(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  let index = 0;

  while (index < lines.length) {
    const maybeName = lines[index];
    const nextLine = lines[index + 1] || '';
    if (!nextLine.startsWith(PERSONALITY_PREFIX)) {
      index += 1;
      continue;
    }

    index += 1;
    const personalityParts = [nextLine.slice(PERSONALITY_PREFIX.length)];
    index += 1;
    while (index < lines.length && !lines[index].startsWith(MARTIAL_PREFIX)) {
      personalityParts.push(lines[index]);
      index += 1;
    }
    if (index >= lines.length) break;

    const martialParts = [lines[index].slice(MARTIAL_PREFIX.length)];
    index += 1;
    while (index < lines.length) {
      const current = lines[index];
      const next = lines[index + 1] || '';
      if (next.startsWith(PERSONALITY_PREFIX)) break;
      martialParts.push(current);
      index += 1;
    }

    const personality = cleanNarrativeText(personalityParts.join(' '));
    const martial = cleanNarrativeText(martialParts.join(' '));
    const parsedName = parseNameLine(maybeName, personality, martial);

    entries.push({
      name: parsedName.name,
      gender: parsedName.gender,
      genderLabel: parsedName.genderLabel,
      personality,
      martial
    });
  }

  return entries.filter((item) => item.name && item.personality && item.martial);
}

function appendTags(target, tags) {
  for (const tag of tags) {
    if (!target.includes(tag)) target.push(tag);
  }
}

function inferTags(personality, martial) {
  const corpus = `${personality} ${martial}`;
  const tags = ['jianghu'];
  TAG_RULES.forEach((rule) => {
    if (rule.keywords.some((keyword) => corpus.includes(keyword))) {
      appendTags(tags, rule.tags);
    }
  });
  if (!tags.length) appendTags(tags, ['social', 'martial']);
  return tags;
}

function inferFactionId(tags) {
  if (tags.includes('trade')) return 'river_merchants';
  if (tags.some((tag) => ['strategy', 'govern', 'diplomacy'].includes(tag))) return 'court_remnant';
  if (tags.some((tag) => ['shadow', 'jianghu', 'intrigue'].includes(tag))) return 'northern_clans';
  return 'jingzhou_gentry';
}

function inferCities(personality, martial, factionId) {
  const corpus = `${personality} ${martial}`;
  const bag = [];
  CITY_KEYWORD_MAP.forEach((rule) => {
    if (rule.keywords.some((keyword) => corpus.includes(keyword))) {
      rule.cities.forEach((cityId) => {
        if (!bag.includes(cityId)) bag.push(cityId);
      });
    }
  });
  if (bag.length) return bag;
  if (factionId === 'frontier_army') return ['yecheng', 'changan'];
  if (factionId === 'river_merchants') return ['jiangling', 'jianye'];
  if (factionId === 'court_remnant') return ['xuchang', 'luoyang'];
  if (factionId === 'northern_clans') return ['yecheng', 'xiangyang'];
  return ['xiangyang', 'jiangling'];
}

function inferTitle(personality, martial) {
  const corpus = `${personality} ${martial}`;
  for (const rule of TITLE_RULES) {
    if (rule.keywords.some((keyword) => corpus.includes(keyword))) return rule.title;
  }
  return '江湖人';
}

function inferMartialRating(martial) {
  if (martial.includes('超品') || martial.includes('横压一世')) return 96;
  if (martial.includes('一品巅峰') || martial.includes('绝顶高手')) return 92;
  if (martial.includes('天下第一')) return 91;
  if (martial.includes('一品高手')) return 90;
  if (martial.includes('四品巅峰')) return 66;
  if (martial.includes('很一般')) return 34;
  if (martial.includes('出类拔萃') || martial.includes('高深') || martial.includes('极高')) return 82;
  if (martial.includes('高强') || martial.includes('精通')) return 74;
  return 62;
}

function inferStrategyRating(personality, martial) {
  const corpus = `${personality} ${martial}`;
  if (corpus.includes('计划') || corpus.includes('智慧') || corpus.includes('决策') || corpus.includes('分析')) return 90;
  if (corpus.includes('管家') || corpus.includes('财务') || corpus.includes('算卦') || corpus.includes('机关')) return 80;
  if (corpus.includes('探险') || corpus.includes('密探') || corpus.includes('诡谲')) return 70;
  return 59;
}

function buildSummary(personality, martial) {
  return `${personality} ${martial}`.trim();
}

function loadExtraCharacterPool() {
  const target = findCharacterPoolFile();
  if (!target) return [];
  const text = fs.readFileSync(target, 'utf8');
  const parsed = parseCharacterEntries(text);
  return parsed.map((item, index) => {
    const tags = inferTags(item.personality, item.martial);
    const factionId = inferFactionId(tags);
    const configuredHomeCities = resolveExtraCharacterHomeCities(item.name);
    return {
      id: `extra_${index + 1}`,
      name: item.name,
      gender: item.gender || 'male',
      genderLabel: item.genderLabel || '男',
      title: inferTitle(item.personality, item.martial),
      summary: buildSummary(item.personality, item.martial),
      personality: item.personality,
      martialProfile: item.martial,
      factionId,
      tags,
      storyDomain: 'jianghu',
      promptFocus: `此人是追加人物，性别${item.genderLabel || '男'}，属于江湖人物线。演绎时必须严格沿用其既有性格、武学与性别设定；若无主角主动介入，不会自行卷入军旅、战阵或朝堂动向。`,
      homeCities: configuredHomeCities.length
        ? configuredHomeCities
        : inferCities(item.personality, item.martial, factionId),
      martialRating: inferMartialRating(item.martial),
      strategyRating: inferStrategyRating(item.personality, item.martial)
    };
  });
}

function scoreForBackground(seed, backgroundId, cityId = '') {
  const tags = Array.isArray(seed && seed.tags) ? seed.tags : [];
  const wanted = BACKGROUND_TAG_PREFERENCES[backgroundId] || [];
  const cityBonus = cityId && Array.isArray(seed && seed.homeCities) && seed.homeCities.includes(cityId) ? 4 : 0;
  return tags.reduce((total, tag) => total + (wanted.includes(tag) ? 3 : 0), 0) + cityBonus + Math.random();
}

function scoreForActionSeed(seed, actionKind, cityId = '') {
  const kind = String(actionKind || '').trim();
  const tags = Array.isArray(seed && seed.tags) ? seed.tags : [];
  const wanted = ACTION_TAG_PREFERENCES[kind] || [];
  let score = 0;

  if (cityId && Array.isArray(seed && seed.homeCities) && seed.homeCities.includes(cityId)) score += 4;
  score += tags.reduce((total, tag) => total + (wanted.includes(tag) ? 3 : 0), 0);

  const martialRating = Number(seed && seed.martialRating || 0);
  const strategyRating = Number(seed && seed.strategyRating || 0);

  if (['jianghu', 'spar', 'martial'].includes(kind)) score += Math.round(martialRating / 18);
  if (['military', 'warpath', 'battle'].includes(kind)) score += Math.round((martialRating + strategyRating) / 28);
  if (['diplomacy', 'social', 'trade', 'govern', 'investigate', 'intrigue'].includes(kind)) score += Math.round(strategyRating / 20);
  if (['sect', 'joinsect'].includes(kind)) score += Math.round((martialRating + strategyRating) / 32);

  return score + Math.random();
}

function buildExtraCharacterSeeds(backgroundId, cityId = '') {
  const pool = loadExtraCharacterPool();
  if (!pool.length) return [];
  const starter = pool
    .slice()
    .sort((a, b) => scoreForBackground(b, backgroundId, cityId) - scoreForBackground(a, backgroundId, cityId))[0];
  const starterId = starter ? starter.id : '';

return pool.map((item) => ({
  ...item,
  isHistorical: false,
  isExtraCharacter: true,
  visibilityState: item.id === starterId ? 'met' : 'hidden',
  discovered: item.id === starterId,
  trust: item.id === starterId ? 4 : 0,
  affection: 0,
  loyalty: item.id === starterId ? 1 : 0,
  rivalry: 0,
  bondKey: '',
  bondLabel: '未定',
  bondSummary: '',
  favorScore: 0,
  romanceStage: '未启'
}));
}

function unlockExtraCharactersForTravel(relationships, cityId, count = 1) {
  const list = Array.isArray(relationships) ? relationships.slice() : [];
  const hidden = list.filter((item) => item && item.isExtraCharacter && relationVisibilityState(item, 'hidden') === 'hidden');
  if (!hidden.length) return { relationships: list, unlocked: [] };

  const localFirst = hidden
    .filter((item) => Array.isArray(item.homeCities) && item.homeCities.includes(cityId))
    .sort((a, b) => Math.random() - 0.5);
  const fallback = hidden
    .filter((item) => !localFirst.find((picked) => picked.id === item.id))
    .sort((a, b) => Math.random() - 0.5);
  const unlocked = localFirst.concat(fallback).slice(0, Math.max(1, count));
  const unlockedIds = new Set(unlocked.map((item) => item.id));

  const next = list.map((item) => {
    if (!item || !unlockedIds.has(item.id)) return item;
    return Object.assign({}, withRelationVisibility(item, 'rumor'), {
      trust: Math.max(3, Number(item.trust || 0)),
      loyalty: Math.max(1, Number(item.loyalty || 0)),
      status: '我在这座新城里第一次听见了这个人的名字，眼下还只是风闻，却已经能顺着线索去摸他真正的来路。',
      intimacyTag: '未识'
    });
  });

  return {
    relationships: next,
    unlocked: unlocked.map((item) => Object.assign({}, item, { revealState: 'rumor' }))
  };
}

function unlockExtraCharactersForAction(relationships, cityId, actionKind = '', count = 1, targetId = '') {
  const list = Array.isArray(relationships) ? relationships.slice() : [];
  const explicitTargetId = String(targetId || '').trim();
  const candidates = list.filter((item) => {
    if (!item || !item.isExtraCharacter) return false;
    if (explicitTargetId) return item.id === explicitTargetId && relationVisibilityState(item, 'hidden') !== 'met';
    const visibilityState = relationVisibilityState(item, 'hidden');
    return visibilityState === 'rumor' || visibilityState === 'scene';
  });
  if (!candidates.length) return { relationships: list, unlocked: [] };

  const unlocked = candidates
    .slice()
    .sort((a, b) => {
      const aScene = relationVisibilityState(a, 'hidden') === 'scene' ? 1 : 0;
      const bScene = relationVisibilityState(b, 'hidden') === 'scene' ? 1 : 0;
      return (bScene - aScene) || (scoreForActionSeed(b, actionKind, cityId) - scoreForActionSeed(a, actionKind, cityId));
    })
    .slice(0, Math.max(1, count));
  const unlockedIds = new Set(unlocked.map((item) => item.id));

  const next = list.map((item) => {
    if (!item || !unlockedIds.has(item.id)) return item;
    return Object.assign({}, withRelationVisibility(item, 'met'), {
      trust: Math.max(3, Number(item.trust || 0)),
      loyalty: Math.max(1, Number(item.loyalty || 0)),
      status: '这一回落子之后，我终于不只是听说这个名字，而是真的有机会把这个人拉进自己的局里。',
      intimacyTag: '初识'
    });
  });

  return {
    relationships: next,
    unlocked: unlocked.map((item) => Object.assign({}, item, { revealState: 'met' }))
  };
}
module.exports = {
  buildExtraCharacterSeeds,
  unlockExtraCharactersForTravel,
  unlockExtraCharactersForAction
};

