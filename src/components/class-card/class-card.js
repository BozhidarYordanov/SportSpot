import './class-card.css';
import classCardTemplate from './class-card.html?raw';

const difficultyMetaByLevel = {
  1: { label: 'Easy', toneClass: 'difficulty-badge--easy' },
  2: { label: 'Intermediate', toneClass: 'difficulty-badge--intermediate' },
  3: { label: 'Advanced', toneClass: 'difficulty-badge--advanced' }
};

const categoryMappings = [
  { keywords: ['yoga', 'pilates', 'mobility'], category: 'Mind & Body' },
  { keywords: ['boxing', 'strength', 'functional'], category: 'Strength' },
  { keywords: ['hiit', 'spinning', 'cardio', 'endurance'], category: 'Cardio' },
  { keywords: ['core'], category: 'Core' }
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getDifficultyMeta = (level) => {
  const normalizedLevel = Number(level);
  return difficultyMetaByLevel[normalizedLevel] ?? difficultyMetaByLevel[2];
};

const inferCategory = (workoutTitle) => {
  const normalizedTitle = String(workoutTitle || '').toLowerCase();

  const mappedCategory = categoryMappings.find(({ keywords }) =>
    keywords.some((keyword) => normalizedTitle.includes(keyword))
  );

  return mappedCategory?.category || 'Workout';
};

const renderDifficultyBadge = (difficultyLevel) => {
  const normalizedLevel = Math.min(3, Math.max(1, Number(difficultyLevel) || 1));
  const difficultyMeta = getDifficultyMeta(normalizedLevel);

  const barsMarkup = Array.from({ length: 3 }, (_, index) => {
    const isActive = index < normalizedLevel;
    return `<span class="difficulty-indicator-bar${isActive ? ' is-active' : ''}"></span>`;
  }).join('');

  return `
    <span class="difficulty-badge ${difficultyMeta.toneClass}" aria-label="Difficulty ${difficultyMeta.label}">
      <span class="difficulty-indicator" aria-hidden="true">${barsMarkup}</span>
      <span class="difficulty-label">${difficultyMeta.label}</span>
    </span>
  `;
};

export const renderClassCard = (workoutClass) => {
  const category = escapeHtml(workoutClass.category || inferCategory(workoutClass.title));
  const title = escapeHtml(workoutClass.title);
  const metaText = escapeHtml(workoutClass.description || `${Number(workoutClass.duration_minutes) || 45} min`);

  return classCardTemplate
    .replace('{{category}}', category)
    .replace('{{title}}', title)
    .replace('{{meta}}', metaText)
    .replace('{{difficultyBadge}}', renderDifficultyBadge(workoutClass.difficulty_level));
};
