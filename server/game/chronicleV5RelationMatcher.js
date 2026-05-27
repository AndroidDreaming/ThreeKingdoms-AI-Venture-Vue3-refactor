const HISTORICAL_ALIAS_MAP = {
  xun_yu: ['文若', '荀文若', '荀令君', '令君'],
  chen_deng: ['元龙', '陈元龙'],
  mi_zhu: ['子仲', '糜子仲', '糜别驾'],
  zang_ba: ['宣高', '臧宣高'],
  tai_shi_ci: ['子义', '太史子义', '太史将军'],
  hua_tuo: ['元化', '华元化', '华神医'],
  liu_bei: ['玄德', '刘玄德', '刘皇叔', '皇叔', '刘使君'],
  cao_cao: ['孟德', '曹孟德', '曹公', '曹丞相'],
  sun_quan: ['仲谋', '孙仲谋', '孙将军', '吴侯'],
  guan_yu: ['云长', '关云长', '关将军', '关君侯', '汉寿亭侯', '关公', '关二爷'],
  zhang_fei: ['翼德', '益德', '张翼德', '张益德', '张将军'],
  zhuge_liang: ['孔明', '诸葛孔明', '孔明先生', '卧龙先生'],
  zhao_yun: ['子龙', '赵子龙', '常山赵子龙', '赵将军'],
  zhou_yu: ['公瑾', '周公瑾', '周郎', '周都督'],
  sima_yi: ['仲达', '司马仲达'],
  lu_meng: ['子明', '吕子明', '吕将军'],
  lu_bu: ['奉先', '吕奉先', '吕将军', '飞将', '温侯']
};

const GENERIC_NON_HISTORICAL_TITLES = new Set([
  '幕僚',
  '商行掌柜',
  '部曲校尉',
  '游侠',
  '故家遗脉',
  '州府书吏',
  '营中偏将',
  '商会掌柜',
  '门阀子弟',
  '江湖客'
]);

function normalizeMatcherText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, '')
    .trim();
}

function pushAlias(bucket, value) {
  const alias = String(value || '').trim();
  if (!alias || alias.length < 2) return;
  if (!bucket.includes(alias)) bucket.push(alias);
}

function historicalAliasesOf(relation) {
  if (!relation || !relation.isHistorical) return [];
  return Array.isArray(HISTORICAL_ALIAS_MAP[relation.id]) ? HISTORICAL_ALIAS_MAP[relation.id].slice() : [];
}

function buildRelationAliases(relation) {
  if (!relation) return [];
  const aliases = [];
  const name = String(relation.name || '').trim();
  const title = String(relation.title || '').trim();

  pushAlias(aliases, name);
  pushAlias(aliases, `${name}${title}`);
  pushAlias(aliases, `${title}${name}`);

  historicalAliasesOf(relation).forEach((alias) => pushAlias(aliases, alias));

  if (relation.isHistorical) {
    pushAlias(aliases, title);
  } else if (title && !GENERIC_NON_HISTORICAL_TITLES.has(title) && title.length >= 4) {
    pushAlias(aliases, title);
  }

  return aliases
    .slice()
    .sort((a, b) => normalizeMatcherText(b).length - normalizeMatcherText(a).length);
}

function findRelationAliasHit(relation, corpus) {
  const haystack = normalizeMatcherText(corpus);
  if (!relation || !haystack) return null;

  const aliases = buildRelationAliases(relation);
  for (const alias of aliases) {
    const needle = normalizeMatcherText(alias);
    if (!needle || !haystack.includes(needle)) continue;
    return {
      alias,
      normalizedAlias: needle,
      weight: alias === relation.name ? 80 : relation.isHistorical ? 72 : 52
    };
  }

  return null;
}

module.exports = {
  buildRelationAliases,
  findRelationAliasHit,
  normalizeMatcherText
};
