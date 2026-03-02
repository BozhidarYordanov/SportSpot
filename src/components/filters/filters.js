import './filters.css';
import filtersTemplate from './filters.html?raw';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const defaultDifficultyOptions = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' }
];

const defaultCategoryOptions = [
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Strength', label: 'Strength' },
  { value: 'Mind & Body', label: 'Mind & Body' },
  { value: 'Combat', label: 'Combat' }
];

const state = {
  searchTerm: '',
  selectedDifficulties: new Set(),
  selectedCategories: new Set()
};

let onChangeCallback = () => {};
let mediaQueryList = null;
let handleMediaChange = null;

const normalizeDifficulty = (value) => {
  const normalized = Number(value);

  if (![1, 2, 3].includes(normalized)) {
    return 2;
  }

  return normalized;
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const createOptionChip = (option, dataAttribute) => {
  const value = escapeHtml(option.value);
  const label = escapeHtml(option.label ?? option.value);

  return `<label class="classes-chip"><input type="checkbox" value="${value}" ${dataAttribute} /><span>${label}</span></label>`;
};

const updateFilterTriggerIndicators = () => {
  const difficultyCountElement = document.querySelector('[data-filter-count="difficulty"]');
  const categoryCountElement = document.querySelector('[data-filter-count="category"]');
  const difficultyTrigger = document.querySelector('[data-filter-trigger="difficulty"]');
  const categoryTrigger = document.querySelector('[data-filter-trigger="category"]');

  const difficultyCount = state.selectedDifficulties.size;
  const categoryCount = state.selectedCategories.size;

  if (difficultyCountElement) {
    difficultyCountElement.textContent = String(difficultyCount);
    difficultyCountElement.classList.toggle('d-none', difficultyCount === 0);
  }

  if (categoryCountElement) {
    categoryCountElement.textContent = String(categoryCount);
    categoryCountElement.classList.toggle('d-none', categoryCount === 0);
  }

  difficultyTrigger?.classList.toggle('is-active', difficultyCount > 0);
  categoryTrigger?.classList.toggle('is-active', categoryCount > 0);
};

const updateAccordionMode = () => {
  const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  const accordionItems = document.querySelectorAll('[data-filter-accordion]');
  const triggers = document.querySelectorAll('[data-filter-trigger]');

  accordionItems.forEach((itemElement) => {
    itemElement.classList.toggle('is-open', isDesktop);
  });

  triggers.forEach((triggerElement) => {
    triggerElement.setAttribute('aria-expanded', isDesktop ? 'true' : 'false');
  });
};

const notifyFiltersChanged = () => {
  updateFilterTriggerIndicators();
  onChangeCallback(getFiltersState());
};

const bindAccordionEvents = () => {
  const triggers = document.querySelectorAll('[data-filter-trigger]');

  triggers.forEach((triggerElement) => {
    triggerElement.addEventListener('click', () => {
      if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
        return;
      }

      const filterName = triggerElement.getAttribute('data-filter-trigger');
      const accordionItem = document.querySelector(`[data-filter-accordion="${filterName}"]`);

      if (!accordionItem) {
        return;
      }

      const isOpen = accordionItem.classList.toggle('is-open');
      triggerElement.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY);
  handleMediaChange = () => updateAccordionMode();
  mediaQueryList.addEventListener('change', handleMediaChange);
  updateAccordionMode();
};

const bindInputEvents = () => {
  const searchInput = document.querySelector('#classes-search');
  const difficultyInputs = document.querySelectorAll('[data-difficulty-filter]');
  const categoryInputs = document.querySelectorAll('[data-category-filter]');

  searchInput?.addEventListener('input', (event) => {
    state.searchTerm = String(event.target.value || '').trim().toLowerCase();
    notifyFiltersChanged();
  });

  difficultyInputs.forEach((inputElement) => {
    inputElement.addEventListener('change', () => {
      const difficulty = normalizeDifficulty(inputElement.value);

      if (inputElement.checked) {
        state.selectedDifficulties.add(difficulty);
      } else {
        state.selectedDifficulties.delete(difficulty);
      }

      notifyFiltersChanged();
    });
  });

  categoryInputs.forEach((inputElement) => {
    inputElement.addEventListener('change', () => {
      const normalizedCategory = String(inputElement.value || '').trim().toLowerCase();

      if (inputElement.checked) {
        state.selectedCategories.add(normalizedCategory);
      } else {
        state.selectedCategories.delete(normalizedCategory);
      }

      notifyFiltersChanged();
    });
  });
};

export const renderFilters = (options = {}) => {
  const difficultyOptions = Array.isArray(options.difficulties) && options.difficulties.length > 0 ? options.difficulties : defaultDifficultyOptions;
  const categoryOptions = Array.isArray(options.categories) && options.categories.length > 0 ? options.categories : defaultCategoryOptions;

  const difficultyOptionsMarkup = difficultyOptions.map((option) => createOptionChip(option, 'data-difficulty-filter')).join('');
  const categoryOptionsMarkup = categoryOptions.map((option) => createOptionChip(option, 'data-category-filter')).join('');

  return filtersTemplate
    .replace('{{difficultyOptions}}', difficultyOptionsMarkup)
    .replace('{{categoryOptions}}', categoryOptionsMarkup);
};

export const getFiltersState = () => ({
  searchTerm: state.searchTerm,
  selectedDifficulties: new Set(state.selectedDifficulties),
  selectedCategories: new Set(state.selectedCategories)
});

export const resetFilters = (options = {}) => {
  const searchInput = document.querySelector('#classes-search');
  const difficultyInputs = document.querySelectorAll('[data-difficulty-filter]');
  const categoryInputs = document.querySelectorAll('[data-category-filter]');

  state.searchTerm = '';
  state.selectedDifficulties.clear();
  state.selectedCategories.clear();

  if (searchInput) {
    searchInput.value = '';
  }

  difficultyInputs.forEach((inputElement) => {
    inputElement.checked = false;
  });

  categoryInputs.forEach((inputElement) => {
    inputElement.checked = false;
  });

  if (options.notify !== false) {
    notifyFiltersChanged();
  } else {
    updateFilterTriggerIndicators();
  }
};

export const initFilters = ({ onChange } = {}) => {
  onChangeCallback = typeof onChange === 'function' ? onChange : () => {};
  bindAccordionEvents();
  bindInputEvents();
  updateFilterTriggerIndicators();
};

export const destroyFilters = () => {
  onChangeCallback = () => {};

  if (mediaQueryList && handleMediaChange) {
    mediaQueryList.removeEventListener('change', handleMediaChange);
  }

  mediaQueryList = null;
  handleMediaChange = null;
};
