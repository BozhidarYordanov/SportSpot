import './class-details.css';
import classDetailsTemplate from './class-details.html?raw';
import { renderDifficultyBadge } from '../../components/difficulty-badge/difficulty-badge';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';

const CLASS_DETAILS_NOTICE_KEY = 'classes_notice';
const SUCCESS_REDIRECT_DELAY_MS = 1200;
const CONFETTI_DURATION_MS = 900;

const bulletIconSvg = `
  <svg class="class-details-feature-icon" viewBox="0 0 20 20" focusable="false" aria-hidden="true">
    <circle cx="10" cy="10" r="10"></circle>
    <path d="M8.4 13.8a.9.9 0 0 1-.64-.26l-2-2a.9.9 0 1 1 1.28-1.28l1.34 1.35 4.53-4.54a.9.9 0 1 1 1.28 1.28l-5.16 5.17a.9.9 0 0 1-.63.28z"></path>
  </svg>
`;

let currentWorkout = null;
let upcomingSessions = [];

export const renderClassDetailsPage = () => classDetailsTemplate;

const setFeedback = (message = '', isError = true) => {
  const feedbackElement = document.querySelector('#class-details-feedback');

  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.classList.toggle('d-none', !message);
  feedbackElement.classList.toggle('text-danger', Boolean(message) && isError);
  feedbackElement.classList.toggle('text-success', Boolean(message) && !isError);
};

const redirectClassNotFound = () => {
  window.sessionStorage.setItem(CLASS_DETAILS_NOTICE_KEY, 'Class not found.');
  navigateTo('/classes', true);
};

const normalizeSlug = (slugValue) => String(slugValue || '').trim().toLowerCase();

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const normalizeListItems = (textValue, fallbackText) => {
  const normalizedText = String(textValue || '').trim();

  if (!normalizedText) {
    return [fallbackText];
  }

  const splitItems = normalizedText
    .split(/\r?\n|;|•|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return splitItems.length > 0 ? splitItems : [normalizedText];
};

const formatSessionDateTime = (timestamp) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Date TBC';
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getAvailableSpots = (session) => {
  const capacity = Number(session?.capacity || 0);
  const enrolledCount = Number(session?.enrolled_count || 0);
  return Math.max(capacity - enrolledCount, 0);
};

const setSessionsEmptyState = (showEmpty) => {
  const listElement = document.querySelector('#class-details-sessions-list');
  const emptyElement = document.querySelector('#class-details-sessions-empty');

  if (!listElement || !emptyElement) {
    return;
  }

  listElement.classList.toggle('d-none', showEmpty);
  emptyElement.classList.toggle('d-none', !showEmpty);
};

const renderSessions = (sessions) => {
  const listElement = document.querySelector('#class-details-sessions-list');
  const template = document.querySelector('#class-details-session-template');

  if (!listElement || !template) {
    return;
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    listElement.innerHTML = '';
    setSessionsEmptyState(true);
    return;
  }

  setSessionsEmptyState(false);

  const fragment = document.createDocumentFragment();

  sessions.forEach((session) => {
    const clone = template.content.cloneNode(true);
    const cardElement = clone.querySelector('.class-details-session-card');
    const timeElement = clone.querySelector('[data-session-time]');
    const trainerElement = clone.querySelector('[data-session-trainer]');
    const roomElement = clone.querySelector('[data-session-room]');
    const spotsElement = clone.querySelector('[data-session-spots]');
    const reserveButton = clone.querySelector('[data-session-reserve]');
    const availableSpots = getAvailableSpots(session);

    timeElement.textContent = formatSessionDateTime(session.start_time);
    trainerElement.textContent = session.trainer_name || 'Trainer TBC';
    roomElement.textContent = session.room || 'Room TBC';
    spotsElement.textContent = `${availableSpots} spot${availableSpots === 1 ? '' : 's'} available`;

    reserveButton.setAttribute('data-schedule-id', session.id);

    if (availableSpots <= 0) {
      reserveButton.disabled = true;
      reserveButton.classList.add('btn-outline-secondary');
      reserveButton.classList.remove('btn-primary');
      reserveButton.textContent = 'Full';
    }

    if (cardElement) {
      cardElement.setAttribute('data-session-id', session.id);
    }

    fragment.append(clone);
  });

  listElement.innerHTML = '';
  listElement.append(fragment);
};

const setSessionButtonLoading = (buttonElement, isLoading) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = isLoading;
  buttonElement.classList.toggle('is-loading', isLoading);

  if (isLoading) {
    buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Reserving...';
    return;
  }

  if (!buttonElement.classList.contains('is-reserved')) {
    buttonElement.textContent = 'Reserve';
  }
};

const markSessionReserved = (buttonElement) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = true;
  buttonElement.classList.remove('btn-primary', 'is-loading');
  buttonElement.classList.add('btn-success', 'is-reserved');
  buttonElement.textContent = 'Reserved';
};

const runConfetti = () => {
  const confettiElement = document.querySelector('#class-details-confetti');

  if (!confettiElement) {
    return;
  }

  const palette = ['#0d6efd', '#20c997', '#ffc107', '#6610f2'];
  const piecesMarkup = Array.from({ length: 26 }, (_, index) => {
    const left = Math.round((index / 25) * 100);
    const drift = `${Math.round((Math.random() - 0.5) * 220)}px`;
    const rotate = `${Math.round(180 + Math.random() * 360)}deg`;
    const delay = `${Math.round(Math.random() * 140)}ms`;
    const color = palette[index % palette.length];

    return `<span class="class-details-confetti-piece" style="left:${left}%;background:${color};--confetti-drift:${drift};--confetti-rotate:${rotate};animation-delay:${delay};"></span>`;
  }).join('');

  confettiElement.innerHTML = piecesMarkup;
  confettiElement.classList.remove('d-none');
  confettiElement.classList.add('is-active');

  window.setTimeout(() => {
    confettiElement.classList.remove('is-active');
    confettiElement.classList.add('d-none');
    confettiElement.innerHTML = '';
  }, CONFETTI_DURATION_MS);
};

const renderFeatureList = (elementId, textValue, fallbackText) => {
  const listElement = document.querySelector(elementId);

  if (!listElement) {
    return;
  }

  const items = normalizeListItems(textValue, fallbackText);

  listElement.innerHTML = items.map((item) => `<li>${bulletIconSvg}<span>${escapeHtml(item)}</span></li>`).join('');
};

const renderHeroBackground = (workout) => {
  const heroElement = document.querySelector('.class-details-hero');

  if (!heroElement) {
    return;
  }

  const imageUrl = String(workout?.image_url || '').trim();

  if (!imageUrl) {
    heroElement.classList.remove('has-image');
    heroElement.style.removeProperty('background-image');
    return;
  }

  const safeImageUrl = imageUrl.replaceAll('"', '\\"');
  heroElement.style.backgroundImage = `url("${safeImageUrl}")`;
  heroElement.classList.add('has-image');
};

const setReserveLoading = (isLoading) => {
  const reserveButton = document.querySelector('#class-details-reserve-btn');
  const labelElement = reserveButton?.querySelector('.class-details-reserve-label');

  if (!reserveButton || !labelElement) {
    return;
  }

  reserveButton.disabled = isLoading;
  reserveButton.classList.toggle('class-details-reserve-loading', isLoading);

  if (isLoading) {
    labelElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Reserving...';
    return;
  }

  labelElement.textContent = 'Reserve This Class';
};

const showSuccessAndRedirect = () => {
  runConfetti();

  const overlayElement = document.querySelector('#class-details-success-overlay');

  if (!overlayElement) {
    navigateTo('/dashboard');
    return;
  }

  overlayElement.classList.remove('d-none');

  window.setTimeout(() => {
    navigateTo('/dashboard');
  }, SUCCESS_REDIRECT_DELAY_MS);
};

const reserveSchedule = async (scheduleId) => {
  if (!currentWorkout?.id || !scheduleId) {
    setFeedback('Class data is not ready yet. Please refresh and try again.');
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    navigateTo('/login');
    return;
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .insert({ schedule_id: scheduleId, user_id: session.user.id });

  if (bookingError) {
    if (/duplicate|unique/i.test(bookingError.message || '')) {
      throw new Error('You already reserved this class slot.');
    }

    throw bookingError;
  }
};

const loadUpcomingSessions = async (workoutTypeId) => {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('schedule')
    .select('id, start_time, trainer_name, room, capacity, enrolled_count')
    .eq('workout_type_id', workoutTypeId)
    .gte('start_time', nowIso)
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
};

const bindSessionBookingActions = () => {
  const sessionListElement = document.querySelector('#class-details-sessions-list');

  if (!sessionListElement) {
    return;
  }

  sessionListElement.addEventListener('click', async (event) => {
    const reserveButton = event.target.closest('[data-session-reserve]');

    if (!reserveButton) {
      return;
    }

    const scheduleId = reserveButton.getAttribute('data-schedule-id');

    if (!scheduleId || reserveButton.disabled) {
      return;
    }

    setFeedback('');
    setSessionButtonLoading(reserveButton, true);

    try {
      await reserveSchedule(scheduleId);
      markSessionReserved(reserveButton);
      showSuccessAndRedirect();
    } catch (error) {
      setSessionButtonLoading(reserveButton, false);
      setFeedback(error?.message || 'Unable to reserve this class right now. Please try again.');
    }
  });
};

const renderClassDetails = (workout) => {
  const titleElement = document.querySelector('#class-details-title');
  const subtitleElement = document.querySelector('#class-details-subtitle');
  const descriptionLongElement = document.querySelector('#class-details-description-long');
  const durationElement = document.querySelector('#class-details-duration');
  const difficultyBadgeElement = document.querySelector('#class-details-difficulty-badge');
  const contentElement = document.querySelector('#class-details-content');

  if (titleElement) {
    titleElement.textContent = workout.title || 'Workout';
  }

  if (subtitleElement) {
    subtitleElement.textContent = workout.description || 'Train with confidence in this guided class.';
  }

  renderHeroBackground(workout);

  if (descriptionLongElement) {
    descriptionLongElement.textContent =
      workout.description_long || workout.description || 'Detailed class information will be available soon.';
  }

  renderFeatureList('#class-details-suitable-for', workout.suitable_for, 'Anyone ready to train at their own pace.');
  renderFeatureList(
    '#class-details-what-to-bring',
    workout.what_to_bring,
    'Comfortable sportswear, water bottle, and a positive mindset.'
  );

  if (durationElement) {
    durationElement.textContent = `${Number(workout.duration_minutes) || 45} min`;
  }

  if (difficultyBadgeElement) {
    difficultyBadgeElement.innerHTML = renderDifficultyBadge(workout.difficulty_level, { fallbackLevel: 2 });
  }

  currentWorkout = workout;
  contentElement?.classList.remove('d-none');
};

const loadWorkoutBySlug = async (slug) => {
  const { data, error } = await supabase.from('workout_types').select('*').eq('slug', slug).single();

  if (error || !data) {
    redirectClassNotFound();
    return;
  }

  renderClassDetails(data);

  const sessions = await loadUpcomingSessions(data.id);
  upcomingSessions = sessions;
  renderSessions(upcomingSessions);
};

export const initClassDetailsPage = async ({ params } = {}) => {
  const slug = normalizeSlug(params?.slug);

  if (!slug) {
    redirectClassNotFound();
    return;
  }

  if (!isSupabaseConfigured || !supabase) {
    setFeedback(
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
    );
    return;
  }

  setFeedback('');
  setReserveLoading(false);
  bindSessionBookingActions();

  await loadWorkoutBySlug(slug);
};
