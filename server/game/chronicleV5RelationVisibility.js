const VISIBILITY_ORDER = {
  hidden: 0,
  rumor: 1,
  scene: 2,
  met: 3
};

function normalizeRelationVisibilityState(value, fallback = 'hidden') {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VISIBILITY_ORDER, normalized)
    ? normalized
    : fallback;
}

function relationVisibilityState(relation, fallback = 'hidden') {
  if (!relation || typeof relation !== 'object') return fallback;
  if (relation.visibilityState) {
    return normalizeRelationVisibilityState(relation.visibilityState, fallback);
  }
  if (relation.discovered === false) return 'hidden';
  if (relation.discovered === true) return 'met';
  return fallback;
}

function compareRelationVisibility(a, b) {
  return Number(VISIBILITY_ORDER[normalizeRelationVisibilityState(a, 'hidden')] || 0)
    - Number(VISIBILITY_ORDER[normalizeRelationVisibilityState(b, 'hidden')] || 0);
}

function atLeastVisibility(relation, state) {
  return compareRelationVisibility(relationVisibilityState(relation, 'hidden'), state) >= 0;
}

function isRelationKnown(relation) {
  return atLeastVisibility(relation, 'rumor');
}

function isRelationSceneVisible(relation) {
  return atLeastVisibility(relation, 'scene');
}

function isRelationMet(relation) {
  return atLeastVisibility(relation, 'met');
}

function withRelationVisibility(relation, state) {
  const normalized = normalizeRelationVisibilityState(state, 'hidden');
  return Object.assign({}, relation || {}, {
    visibilityState: normalized,
    discovered: normalized === 'met'
  });
}

module.exports = {
  VISIBILITY_ORDER,
  normalizeRelationVisibilityState,
  relationVisibilityState,
  compareRelationVisibility,
  atLeastVisibility,
  isRelationKnown,
  isRelationSceneVisible,
  isRelationMet,
  withRelationVisibility
};
