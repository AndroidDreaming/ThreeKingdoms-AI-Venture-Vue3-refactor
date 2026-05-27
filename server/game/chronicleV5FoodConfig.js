const FOOD_DEFINITIONS = [
  {
    id: 'sumi_fan',
    name: '粟米饭',
    category: '主食',
    rarity: 'common',
    regions: ['司隶与关中', '河北与幽州', '豫州与徐淮'],
    flavorText: '北方常见口粮，小米蒸出朴实饭香，行军途中也最稳当。',
    soulLine: '平平淡淡才是真。',
    tone: 'rustic',
    tags: ['rest', 'travel', 'warpath'],
    instantDelta: { fatigue: -4, morale: 1 },
    tempBuff: { domain: 'travel', score: 1, turns: 1, note: '这口饭落进肚里，赶路时不容易先散了气。' }
  },
  {
    id: 'mai_fan',
    name: '麦饭',
    category: '主食',
    rarity: 'common',
    regions: ['河北与幽州', '司隶与关中'],
    flavorText: '麦粒直接蒸煮，口感粗糙却最能顶饿，是边地常见的硬口粮。',
    soulLine: '有点干吧，来点喝的，谢谢。',
    tone: 'rustic',
    tags: ['rest', 'travel', 'military'],
    instantDelta: { fatigue: -3, morale: 2 },
    tempBuff: { domain: 'warpath', score: 1, turns: 1, note: '肚里有底，军务和硬扛时不容易先虚。' }
  },
  {
    id: 'shudou_zhou',
    name: '菽豆粥',
    category: '主食',
    rarity: 'common',
    regions: ['司隶与关中', '豫州与徐淮', '荆襄与荆南'],
    flavorText: '大豆熬粥，清淡得近乎寒酸，却最适合拿来养胃回气。',
    soulLine: '吃多了容易放屁。',
    tone: 'rustic',
    tags: ['rest', 'recover'],
    instantDelta: { health: 3, fatigue: -5 },
    tempBuff: { domain: 'rest', score: 1, turns: 1, note: '肠胃一暖，静养时更容易把气血收回来。' }
  },
  {
    id: 'diaohu_fan',
    name: '雕胡饭',
    category: '主食',
    rarity: 'rare',
    regions: ['江东与江夏', '荆襄与荆南'],
    flavorText: '野生茭白籽蒸成的饭，弹牙生香，不像常人口粮，更像一口旧时贵气。',
    soulLine: '一口下去可以嚼到珠珠诶！',
    tone: 'luxury',
    tags: ['rest', 'social', 'banquet'],
    instantDelta: { fatigue: -4, charm: 1 },
    tempBuff: { domain: 'social', score: 1, turns: 1, note: '这种讲究劲会让席间的人更愿意抬眼看你。' }
  },
  {
    id: 'zhuojiu',
    name: '浊酒',
    category: '饮品',
    rarity: 'common',
    regions: ['司隶与关中', '河北与幽州', '荆襄与荆南'],
    flavorText: '民间自酿之酒，粗烈不净，却最容易把冷场和闷气一起烧开。',
    soulLine: '报喝。',
    tone: 'comic',
    tags: ['banquet', 'social', 'warpath'],
    instantDelta: { morale: 4, fatigue: -1 },
    tempBuff: { domain: 'diplomacy', score: 1, turns: 1, note: '酒气一热，很多原本不肯出口的话会松半寸。' }
  },
  {
    id: 'laojiang',
    name: '酪浆',
    category: '饮品',
    rarity: 'uncommon',
    regions: ['凉州·关中平原', '司隶与关中'],
    flavorText: '发酵乳制成的酸饮，入口微酸，回味却绵长，喝下去人会慢慢松下来。',
    soulLine: '含有一百种益生菌。',
    tone: 'comic',
    tags: ['rest', 'recover'],
    instantDelta: { health: 2, fatigue: -4, morale: 1 },
    tempBuff: { domain: 'rest', score: 1, turns: 1, note: '这一口更像把身上的虚火先按了下去。' }
  },
  {
    id: 'cujiang',
    name: '酢浆',
    category: '饮品',
    rarity: 'uncommon',
    regions: ['荆襄与荆南', '江东与江夏'],
    flavorText: '古法酸梅汁，暑气最盛时喝下去，连脑子都像被风吹开了一道口。',
    soulLine: '有人说世间情动莫过于此。',
    tone: 'luxury',
    tags: ['travel', 'rest', 'social'],
    instantDelta: { fatigue: -5, morale: 1 },
    tempBuff: { domain: 'travel', score: 1, turns: 1, note: '暑路难行时，这口酸意能先把人提起来。' }
  },
  {
    id: 'pitong_jiu',
    name: '郫筒酒',
    category: '饮品',
    rarity: 'rare',
    regions: ['巴蜀'],
    flavorText: '蜀地竹筒酿酒，酒里自带一缕山气和竹香，入口绵却不轻。',
    soulLine: '熊猫酿的酒。',
    tone: 'comic',
    tags: ['banquet', 'diplomacy', 'romance'],
    instantDelta: { morale: 3, charm: 1 },
    tempBuff: { domain: 'romance', score: 1, turns: 1, note: '气氛一旦被托住，人与人之间就更容易越过那道生分。' }
  },
  {
    id: 'yangti_geng',
    name: '羊蹄羹',
    category: '荤菜',
    rarity: 'uncommon',
    regions: ['司隶与关中', '凉州·关中平原'],
    flavorText: '羊蹄与羊肉慢炖成胶汤，黏厚得几乎能把人的筋骨重新糊起来。',
    soulLine: '快吃吧！这是游戏制作人的肉！',
    tone: 'comic',
    tags: ['recover', 'rest', 'warpath'],
    instantDelta: { health: 6, fatigue: -4 },
    tempBuff: { domain: 'military', score: 1, turns: 1, note: '筋骨一旦暖回来，人就更扛得住硬活。' }
  },
  {
    id: 'luji',
    name: '露鸡',
    category: '荤菜',
    rarity: 'uncommon',
    regions: ['荆襄与荆南', '江东与江夏'],
    flavorText: '卤汁慢煨的整鸡，皮肉酥烂，香气最适合拿来压席面、稳人心。',
    soulLine: '卤制时长不足两年半。',
    tone: 'comic',
    tags: ['banquet', 'recover', 'social'],
    instantDelta: { health: 4, morale: 3 },
    tempBuff: { domain: 'social', score: 1, turns: 1, note: '一桌有肉，很多试探和客气都会先软下来。' }
  },
  {
    id: 'wuchang_yu',
    name: '武昌鱼',
    category: '荤菜',
    rarity: 'rare',
    regions: ['江东与江夏', '荆襄与荆南'],
    flavorText: '江鱼清蒸，鲜嫩得几乎不用牙齿，像一口把水路、乡味和旧地情分一并端上来。',
    soulLine: '宁饮建业水，不食武昌鱼。',
    tone: 'luxury',
    tags: ['banquet', 'diplomacy', 'social'],
    instantDelta: { morale: 2, influence: 1 },
    tempBuff: { domain: 'diplomacy', score: 1, turns: 1, note: '地方风味最容易把场面变成熟人之间的说话。' }
  },
  {
    id: 'junjun_zhengbing',
    name: '涿郡蒸饼',
    category: '地域特色',
    rarity: 'rare',
    regions: ['河北与幽州'],
    flavorText: '发酵面饼蒸定后极耐携带，不显眼，却最适合被揣进长路与军行里。',
    soulLine: '看似朴素却出奇耐饥。',
    tone: 'rustic',
    tags: ['travel', 'warpath', 'military'],
    instantDelta: { fatigue: -4, morale: 2 },
    tempBuff: { domain: 'travel', score: 2, turns: 1, note: '这是最能把长路走实的硬口粮。' }
  },
  {
    id: 'bawan_mantou',
    name: '八万个馒头',
    category: '趣味菜品',
    rarity: 'rare',
    regions: ['豫州与徐淮', '河北与幽州'],
    flavorText: '白面馒头堆叠成山，真有没有八万没人会数，但看见的人都会先觉得心里一宽。',
    soulLine: '不可能！绝对不可能！',
    tone: 'comic',
    tags: ['warpath', 'military', 'banquet'],
    instantDelta: { morale: 5, supplies: 2 },
    tempBuff: { domain: 'warpath', score: 1, turns: 1, note: '能把营里最直白的踏实感先补回来。' }
  }
];

const FOOD_BY_ID = FOOD_DEFINITIONS.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});

function getFoodDefinition(foodId) {
  return FOOD_BY_ID[String(foodId || '').trim()] || null;
}

function cloneFoodItem(foodId, count = 1) {
  const def = getFoodDefinition(foodId);
  if (!def) return null;
  return {
    id: `food:${def.id}`,
    foodId: def.id,
    name: def.name,
    itemType: 'food',
    category: def.category,
    count: Math.max(1, Number(count || 1))
  };
}

function ensureFoodInventoryItems(items) {
  return Array.isArray(items) ? items.filter((item) => item && String(item.itemType || '') === 'food') : [];
}

module.exports = {
  FOOD_DEFINITIONS,
  FOOD_BY_ID,
  getFoodDefinition,
  cloneFoodItem,
  ensureFoodInventoryItems
};
