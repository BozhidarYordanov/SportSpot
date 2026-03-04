import './class-details.css';
import classDetailsTemplate from './class-details.html?raw';
import { renderDifficultyBadge } from '../../components/difficulty-badge/difficulty-badge';
import { showToast } from '../../components/toast/toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { setPageTitle } from '../../lib/pageTitle';

const CLASS_DETAILS_NOTICE_KEY = 'classes_notice';

const bulletIconSvg = `
  <svg class="class-details-feature-icon" viewBox="0 0 20 20" focusable="false" aria-hidden="true">
    <circle cx="10" cy="10" r="10"></circle>
    <path d="M8.4 13.8a.9.9 0 0 1-.64-.26l-2-2a.9.9 0 1 1 1.28-1.28l1.34 1.35 4.53-4.54a.9.9 0 1 1 1.28 1.28l-5.16 5.17a.9.9 0 0 1-.63.28z"></path>
  </svg>
`;

let currentWorkout = null;
let upcomingSessions = [];
let bookedScheduleIds = new Set();

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
    minute: '2-digit',
    hour12: false
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

const renderSessions = (sessions, bookedIds = new Set()) => {
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
    const isBooked = bookedIds.has(session.id);

    timeElement.textContent = formatSessionDateTime(session.start_time);
    trainerElement.textContent = session.trainer_name || 'Trainer TBC';
    roomElement.textContent = session.room || 'Room TBC';
    spotsElement.textContent = `${availableSpots} spot${availableSpots === 1 ? '' : 's'} available`;

    reserveButton.setAttribute('data-schedule-id', session.id);
    reserveButton.setAttribute('data-booked', isBooked ? 'true' : 'false');

    if (isBooked) {
      reserveButton.classList.remove('btn-primary', 'btn-outline-secondary', 'is-loading', 'is-reserved');
      reserveButton.classList.add('btn-outline-danger', 'btn-cancel-booking');
      reserveButton.textContent = 'Cancel Booking';
    }

    if (!isBooked && availableSpots <= 0) {
      reserveButton.disabled = true;
      reserveButton.classList.add('btn-outline-secondary');
      reserveButton.classList.remove('btn-primary', 'btn-cancel-booking');
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

  const isBooked = buttonElement.getAttribute('data-booked') === 'true';

  if (isLoading) {
    buttonElement.innerHTML = isBooked
      ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cancelling...'
      : '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Reserving...';
    return;
  }

  buttonElement.textContent = isBooked ? 'Cancel Booking' : 'Reserve';
};

const setSessionBookedState = (buttonElement, isBooked) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = false;
  buttonElement.classList.remove('btn-primary', 'btn-outline-danger', 'btn-cancel-booking', 'is-loading', 'is-reserved');
  buttonElement.setAttribute('data-booked', isBooked ? 'true' : 'false');

  if (isBooked) {
    buttonElement.classList.add('btn-outline-danger', 'btn-cancel-booking');
    buttonElement.textContent = 'Cancel Booking';
    return;
  }

  buttonElement.classList.add('btn-primary');
  buttonElement.textContent = 'Reserve';
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

const cancelSchedule = async (scheduleId) => {
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

  const { error: cancelError } = await supabase
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('user_id', session.user.id);

  if (cancelError) {
    throw cancelError;
  }
};

const loadBookedScheduleIds = async (scheduleIds = []) => {
  const uniqueScheduleIds = [...new Set(scheduleIds.filter(Boolean))];

  if (uniqueScheduleIds.length === 0) {
    return new Set();
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('schedule_id')
    .eq('user_id', session.user.id)
    .in('schedule_id', uniqueScheduleIds);

  if (error) {
    throw error;
  }

  return new Set((Array.isArray(data) ? data : []).map((booking) => booking.schedule_id).filter(Boolean));
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
    const isBooked = reserveButton.getAttribute('data-booked') === 'true';

    if (!scheduleId || reserveButton.disabled) {
      return;
    }

    setFeedback('');
    setSessionButtonLoading(reserveButton, true);

    try {
      if (isBooked) {
        await cancelSchedule(scheduleId);
        bookedScheduleIds.delete(scheduleId);
        setSessionBookedState(reserveButton, false);
        showToast('Booking cancelled', 'success');
      } else {
        await reserveSchedule(scheduleId);
        bookedScheduleIds.add(scheduleId);
        setSessionBookedState(reserveButton, true);
        showToast('Spot reserved! See you there.', 'success');
        navigateTo('/dashboard');
      }
    } catch (error) {
      setSessionButtonLoading(reserveButton, false);
      showToast(error?.message || 'Unable to update booking right now. Please try again.', 'error');
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

  setPageTitle(workout.title || 'Class Details');

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
  const sessionsIds = sessions.map((session) => session.id);
  bookedScheduleIds = await loadBookedScheduleIds(sessionsIds);
  upcomingSessions = sessions;
  renderSessions(upcomingSessions, bookedScheduleIds);
};

export const initClassDetailsPage = async ({ params } = {}) => {
  setPageTitle('Class Details');

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
  bindSessionBookingActions();

  await loadWorkoutBySlug(slug);
};
