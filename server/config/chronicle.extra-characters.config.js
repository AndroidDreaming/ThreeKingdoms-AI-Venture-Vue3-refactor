const { CITIES_CONTENT } = require('../game/chronicleV5ContentConfig');

const VALID_CITY_IDS = new Set(
  (Array.isArray(CITIES_CONTENT) ? CITIES_CONTENT : [])
    .map((city) => String(city && city.id || '').trim())
    .filter(Boolean)
);

const CITY_NAME_TO_ID = Object.freeze({
  洛阳: 'luoyang',
  长安: 'changan',
  邺城: 'yecheng',
  许昌: 'xuchang',
  下邳: 'xiapi',
  襄阳: 'xiangyang',
  江陵: 'jiangling',
  建业: 'jianye',
  成都: 'chengdu',
  平原: 'pingyuan',
  北平: 'beiping',
  寿春: 'shouchun',
  彭城: 'pengcheng',
  小沛: 'xiaopei',
  广陵: 'guangling',
  宛城: 'wan',
  新野: 'xinye',
  长沙: 'changsha',
  武陵: 'wuling',
  合肥: 'hefei',
  吴郡: 'wu',
  会稽: 'kuaiji',
  柴桑: 'chaisang',
  汉中: 'hanzhong'
});

// 支持直接写 cityId，也支持写中文城名，后续调优只需要维护这个映射表。
const EXTRA_CHARACTER_CITY_MAP = Object.freeze({
  林谖: '成都',
  楚归尘: '长安',
  曲离歌: '长安',
  南宫衲: '许昌',
  风速狗: '长安',
  石小八: '襄阳',
  久违冬: '成都',
  影子疯貂: '江陵',
  英俊: '长安',
  闫血茗: '江陵',
  小柴胡: '邺城',
  知眠眠: '建业',
  不老实: '洛阳',
  鬼剑纯: '建业',
  洛之幻翎: '长安',
  小爱: '襄阳',
  玄武: '许昌',
  影子唯渐: '襄阳',
  花无烟: '成都',
  阿白: '邺城',
  观祺: '建业',
  舟之远: '邺城',
  司辰: '许昌',
  汤乾: '建业',
  良夜: '江陵',
  琉璃: '建业',
  晓元: '江陵',
  焱酒: '邺城',
  青秀秀: '许昌',
  砚池: '襄阳',
  孤云万丈: '洛阳'
});

function normalizeConfiguredCityIds(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const bag = [];

  values.forEach((value) => {
    const source = String(value || '').trim();
    if (!source) return;
    const cityId = CITY_NAME_TO_ID[source] || source;
    if (!VALID_CITY_IDS.has(cityId)) return;
    if (!bag.includes(cityId)) bag.push(cityId);
  });

  return bag;
}

function resolveExtraCharacterHomeCities(name) {
  const key = String(name || '').trim();
  if (!key) return [];
  return normalizeConfiguredCityIds(EXTRA_CHARACTER_CITY_MAP[key]);
}

module.exports = {
  EXTRA_CHARACTER_CITY_MAP,
  resolveExtraCharacterHomeCities
};
