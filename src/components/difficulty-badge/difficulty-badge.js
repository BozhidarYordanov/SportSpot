import './difficulty-badge.css';
import difficultyBadgeTemplate from './difficulty-badge.html?raw';

const difficultyMetaByLevel = {
  1: { label: 'Easy', toneClass: 'difficulty-badge--easy' },
  2: { label: 'Intermediate', toneClass: 'difficulty-badge--intermediate' },
  3: { label: 'Advanced', toneClass: 'difficulty-badge--advanced' }
};

const clampDifficultyLevel = (value, fallbackLevel = 1) => {
  const normalizedFallback = Math.min(3, Math.max(1, Number(fallbackLevel) || 1));
  return Math.min(3, Math.max(1, Number(value) || normalizedFallback));
};

export const getDifficultyMeta = (level, fallbackLevel = 2) => {
  const normalizedLevel = clampDifficultyLevel(level, fallbackLevel);
  return {
    level: normalizedLevel,
    ...(difficultyMetaByLevel[normalizedLevel] ?? difficultyMetaByLevel[2])
  };
};

export const renderDifficultyBadge = (difficultyLevel, options = {}) => {
  const meta = getDifficultyMeta(difficultyLevel, options.fallbackLevel ?? 1);

  const barsMarkup = Array.from({ length: 3 }, (_, index) => {
    const isActive = index < meta.level;
    return `<span class="difficulty-indicator-bar${isActive ? ' is-active' : ''}"></span>`;
  }).join('');

  return difficultyBadgeTemplate
    .replace('{{toneClass}}', meta.toneClass)
    .replaceAll('{{label}}', meta.label)
    .replace('{{bars}}', barsMarkup);
};