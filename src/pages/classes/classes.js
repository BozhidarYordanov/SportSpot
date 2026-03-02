import './classes.css';
import classesTemplate from './classes.html?raw';
import { createClassCard } from '../../components/class-card/class-card';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const FILTER_TRANSITION_MS = 160;
const CLASS_DETAILS_NOTICE_KEY = 'classes_notice';
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const state = {
  workouts: [],
  searchTerm: '',
  selectedDifficulties: new Set(),
  selectedCategories: new Set()
};

let filterRenderTimeoutId = null;

export const renderClassesPage = () => classesTemplate;

const setFeedback = (message = '', isError = true) => {
  const feedbackElement = document.querySelector('#classes-feedback');

  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.classList.toggle('d-none', !message);
  feedbackElement.classList.toggle('text-danger', Boolean(message) && isError);
  feedbackElement.classList.toggle('text-success', Boolean(message) && !isError);
};

const setResultsMeta = (count, total) => {
  const resultsMetaElement = document.querySelector('#classes-results-meta');

  if (!resultsMetaElement) {
    return;
  }

  const classLabel = count === 1 ? 'class' : 'classes';
  resultsMetaElement.textContent = `${count} ${classLabel} shown${total ? ` • ${total} total` : ''}`;
};

const normalizeDifficulty = (value) => {
  const normalized = Number(value);

  if (![1, 2, 3].includes(normalized)) {
    return 2;
  }

  return normalized;
};

const filterWorkouts = (workouts) => {
  return workouts.filter((workout) => {
    const title = String(workout?.title || '').toLowerCase();
    const matchesSearch = title.includes(state.searchTerm);
    const category = String(workout?.category || '').trim().toLowerCase();
    const matchesCategory = state.selectedCategories.size === 0 || state.selectedCategories.has(category);

    if (!matchesSearch || !matchesCategory) {
      return false;
    }

    if (state.selectedDifficulties.size === 0) {
      return true;
    }

    const difficultyLevel = normalizeDifficulty(workout?.difficulty_level);
    return state.selectedDifficulties.has(difficultyLevel);
  });
};

const buildClassDetailsLink = (slug) => {
  const encodedSlug = encodeURIComponent(String(slug || '').trim());
  return `/class-details/${encodedSlug}`;
};

const renderCards = (workouts) => {
  const gridElement = document.querySelector('#classes-grid');
  const emptyStateElement = document.querySelector('#classes-empty');

  if (!gridElement || !emptyStateElement) {
    return;
  }

  gridElement.classList.add('is-filtering');

  if (filterRenderTimeoutId) {
    window.clearTimeout(filterRenderTimeoutId);
  }

  filterRenderTimeoutId = window.setTimeout(() => {
    const cardsMarkup = workouts
      .map((workout) =>
        createClassCard(
          {
            title: workout.title,
            category: workout.category,
            description: workout.description || `${Number(workout.duration_minutes) || 45} min session`,
            duration_minutes: workout.duration_minutes,
            difficulty_level: workout.difficulty_level
          },
          {
            columnClass: 'col-12 col-md-6 col-lg-4 col-xxl-3',
            linkHref: buildClassDetailsLink(workout.slug)
          }
        )
      )
      .join('');

    gridElement.innerHTML = cardsMarkup;
    gridElement.classList.remove('is-filtering');
    gridElement.classList.remove('is-entering');
    window.requestAnimationFrame(() => {
      gridElement.classList.add('is-entering');
    });

    const hasResults = workouts.length > 0;
    emptyStateElement.classList.toggle('d-none', hasResults);
    gridElement.classList.toggle('d-none', !hasResults);

    filterRenderTimeoutId = null;
  }, FILTER_TRANSITION_MS);
};

const applyFilters = () => {
  const filteredWorkouts = filterWorkouts(state.workouts);
  renderCards(filteredWorkouts);
  setResultsMeta(filteredWorkouts.length, state.workouts.length);
  updateFilterTriggerIndicators();
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

  const mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQueryList.addEventListener('change', updateAccordionMode);
  updateAccordionMode();
};

const resetFilters = () => {
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

  applyFilters();
};

const bindFilterEvents = () => {
  const searchInput = document.querySelector('#classes-search');
  const difficultyInputs = document.querySelectorAll('[data-difficulty-filter]');
  const categoryInputs = document.querySelectorAll('[data-category-filter]');
  const resetButton = document.querySelector('#classes-reset-btn');

  searchInput?.addEventListener('input', (event) => {
    const value = String(event.target.value || '').trim().toLowerCase();
    state.searchTerm = value;
    applyFilters();
  });

  difficultyInputs.forEach((inputElement) => {
    inputElement.addEventListener('change', () => {
      const difficulty = normalizeDifficulty(inputElement.value);

      if (inputElement.checked) {
        state.selectedDifficulties.add(difficulty);
      } else {
        state.selectedDifficulties.delete(difficulty);
      }

      applyFilters();
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

      applyFilters();
    });
  });

  resetButton?.addEventListener('click', resetFilters);
};

const consumeClassesNotice = () => {
  const message = window.sessionStorage.getItem(CLASS_DETAILS_NOTICE_KEY);

  if (!message) {
    return;
  }

  window.sessionStorage.removeItem(CLASS_DETAILS_NOTICE_KEY);
  setFeedback(message, true);
};

const loadWorkouts = async () => {
  if (!isSupabaseConfigured || !supabase) {
    setFeedback(
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
    );
    setResultsMeta(0, 0);
    return;
  }

  setFeedback('');

  const { data, error } = await supabase
    .from('workout_types')
    .select('id, slug, title, description, duration_minutes, difficulty_level, category')
    .order('title', { ascending: true });

  if (error) {
    setFeedback(error.message || 'Unable to load classes right now. Please try again.');
    state.workouts = [];
    applyFilters();
    return;
  }

  state.workouts = Array.isArray(data) ? data : [];
  applyFilters();
};

export const initClassesPage = async () => {
  bindAccordionEvents();
  bindFilterEvents();
  await loadWorkouts();
  consumeClassesNotice();
};
