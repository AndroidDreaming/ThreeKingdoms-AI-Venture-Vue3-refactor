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

function formatDateLabel(year, month, season) {
  return `${year}年${season}·${month}月`;
}

function toCountedItems(items) {
  return ensureArray(items).map((item) => ({
    name: item.name,
    count: item.count || 1
  }));
}

function mergeItems(currentItems, incomingItems) {
  const map = new Map();
  toCountedItems(currentItems).forEach((item) => {
    map.set(item.name, { name: item.name, count: item.count });
  });
  toCountedItems(incomingItems).forEach((item) => {
    const found = map.get(item.name);
    if (found) {
      found.count += item.count;
      return;
    }
    map.set(item.name, { name: item.name, count: item.count });
  });
  return Array.from(map.values());
}

function upsertRelationship(relationships, relationship) {
  const next = ensureArray(relationships).slice();
  const index = next.findIndex((item) => item.name === relationship.name);
  if (index === -1) {
    next.push(relationship);
    return next;
  }
  next[index] = Object.assign({}, next[index], relationship);
  return next;
}

module.exports = {
  clamp,
  pickRandom,
  createId,
  uniqBy,
  ensureArray,
  monthToSeason,
  advanceMonth,
  formatDateLabel,
  toCountedItems,
  mergeItems,
  upsertRelationship
};
