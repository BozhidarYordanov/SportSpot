import './class-card.css';
import classCardTemplate from './class-card.html?raw';
import { renderDifficultyBadge } from '../difficulty-badge/difficulty-badge';

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

const inferCategory = (workoutTitle) => {
  const normalizedTitle = String(workoutTitle || '').toLowerCase();

  const mappedCategory = categoryMappings.find(({ keywords }) =>
    keywords.some((keyword) => normalizedTitle.includes(keyword))
  );

  return mappedCategory?.category || 'Workout';
};

const renderActionMarkup = (actionConfig = null) => {
  if (!actionConfig || typeof actionConfig !== 'object') {
    return '';
  }

  const {
    label = 'Reserve',
    variant = 'primary',
    action = 'reserve',
    bookingId = '',
    scheduleId = ''
  } = actionConfig;

  return `
    <div class="class-card-action">
      <button
        type="button"
        class="btn btn-${escapeHtml(variant)}"
        data-card-action="${escapeHtml(action)}"
        data-booking-id="${escapeHtml(bookingId)}"
        data-schedule-id="${escapeHtml(scheduleId)}"
      >
        ${escapeHtml(label)}
      </button>
    </div>
  `;
};

const renderLinkBounds = (linkHref = '', hasAction = false) => {
  if (!linkHref || hasAction) {
    return { linkStart: '', linkEnd: '' };
  }

  return {
    linkStart: `<a class="class-card-link" href="${escapeHtml(linkHref)}" aria-label="Open class details">`,
    linkEnd: '</a>'
  };
};

export const renderClassCard = (workoutClass, options = {}) => {
  const columnClass = options.columnClass || 'col-md-6 col-xl-3';
  const category = escapeHtml(workoutClass.category || inferCategory(workoutClass.title));
  const title = escapeHtml(workoutClass.title);
  const metaText = escapeHtml(workoutClass.description || `${Number(workoutClass.duration_minutes) || 45} min`);
  const actionMarkup = renderActionMarkup(options.action);
  const { linkStart, linkEnd } = renderLinkBounds(options.linkHref, Boolean(options.action));

  return classCardTemplate
    .replace('{{columnClass}}', escapeHtml(columnClass))
    .replace('{{linkStart}}', linkStart)
    .replace('{{linkEnd}}', linkEnd)
    .replace('{{category}}', category)
    .replace('{{title}}', title)
    .replace('{{meta}}', metaText)
    .replace('{{difficultyBadge}}', renderDifficultyBadge(workoutClass.difficulty_level))
    .replace('{{action}}', actionMarkup);
};

export const createClassCard = renderClassCard;
