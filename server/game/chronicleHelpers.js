function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function uniqBy(list, keyGetter) {
  const seen = new Set();
  return list.filter((item) => {
    const key = keyGetter(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeItems(currentItems, incomingItems) {
  const merged = new Map();
  ensureArray(currentItems).forEach((item) => {
    merged.set(item.name, { name: item.name, count: item.count || 1 });
  });
  ensureArray(incomingItems).forEach((item) => {
    const found = merged.get(item.name);
    if (found) {
      found.count += item.count || 1;
    } else {
      merged.set(item.name, { name: item.name, count: item.count || 1 });
    }
  });
  return Array.from(merged.values());
}

function upsertRelationship(relationships, relationship) {
  const list = ensureArray(relationships).slice();
  const index = list.findIndex((item) => item.name === relationship.name);
  if (index === -1) {
    list.push(relationship);
    return list;
  }
  list[index] = Object.assign({}, list[index], relationship);
  return list;
}

function monthToSeason(month) {
  if (month <= 3) return '春';
  if (month <= 6) return '夏';
  if (month <= 9) return '秋';
  return '冬';
}

function advanceMonth(year, month, delta) {
  let nextYear = year;
  let nextMonth = month + delta;
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth, season: monthToSeason(nextMonth) };
}

function getEraInfo(year) {
  const eras = [
    { start: 184, end: 189, title: '中平' },
    { start: 190, end: 193, title: '初平' },
    { start: 194, end: 195, title: '兴平' },
    { start: 196, end: 220, title: '建安' },
    { start: 220, end: 220, title: '延康' },
    { start: 221, end: 226, title: '黄初' }
  ];
  const era = eras.find((item) => year >= item.start && year <= item.end);
  if (!era) return { title: String(year), yearNo: 1 };
  return { title: era.title, yearNo: year - era.start + 1 };
}

function formatMonthName(month) {
  const names = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  return names[Math.max(0, Math.min(names.length - 1, month - 1))];
}

function formatDateLabel(year, month, season) {
  const era = getEraInfo(year);
  return `${era.title}${era.yearNo}年 ${season}${formatMonthName(month)}`;
}

module.exports = {
  clamp,
  pickRandom,
  createId,
  uniqBy,
  ensureArray,
  mergeItems,
  upsertRelationship,
  monthToSeason,
  advanceMonth,
  getEraInfo,
  formatMonthName,
  formatDateLabel
};
