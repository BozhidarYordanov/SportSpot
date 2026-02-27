import './classes.css';
import classesTemplate from './classes.html?raw';
import { createClassCard } from '../../components/class-card/class-card';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const FILTER_TRANSITION_MS = 160;
const CLASS_DETAILS_NOTICE_KEY = 'classes_notice';

const state = {
  workouts: [],
  searchTerm: '',
  selectedDifficulties: new Set()
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

    if (!matchesSearch) {
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
};

const resetFilters = () => {
  const searchInput = document.querySelector('#classes-search');
  const difficultyInputs = document.querySelectorAll('[data-difficulty-filter]');

  state.searchTerm = '';
  state.selectedDifficulties.clear();

  if (searchInput) {
    searchInput.value = '';
  }

  difficultyInputs.forEach((inputElement) => {
    inputElement.checked = false;
  });

  applyFilters();
};

const bindFilterEvents = () => {
  const searchInput = document.querySelector('#classes-search');
  const difficultyInputs = document.querySelectorAll('[data-difficulty-filter]');
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
    .select('id, slug, title, description, duration_minutes, difficulty_level')
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
  bindFilterEvents();
  await loadWorkouts();
  consumeClassesNotice();
};
