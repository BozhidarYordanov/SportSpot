import './schedule.css';
import scheduleTemplate from './schedule.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { renderDifficultyBadge } from '../../components/difficulty-badge/difficulty-badge';

const DAYS_VISIBLE = 12;
const WEEK_SHIFT_DAYS = 7;

const state = {
  selectedDate: startOfDay(new Date()),
  rangeOffsetDays: 0,
  userId: null,
  sessions: [],
  bookedScheduleIds: new Set(),
  activeSessionRequestId: 0
};

export const renderSchedulePage = () => scheduleTemplate;

function startOfDay(date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayCard(date) {
  return {
    dayShort: date.toLocaleDateString(undefined, { weekday: 'short' }),
    date: date.toLocaleDateString(undefined, { day: '2-digit' }),
    monthShort: date.toLocaleDateString(undefined, { month: 'short' })
  };
}

function formatSelectedDateLabel(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Time TBC';
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function setFeedback(message = '', isError = true) {
  const feedbackElement = document.querySelector('#schedule-feedback');

  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.classList.toggle('d-none', !message);
  feedbackElement.classList.toggle('text-danger', Boolean(message) && isError);
  feedbackElement.classList.toggle('text-success', Boolean(message) && !isError);
}

function getDateRange() {
  const start = addDays(startOfDay(new Date()), state.rangeOffsetDays);
  return Array.from({ length: DAYS_VISIBLE }, (_, index) => addDays(start, index));
}

function setRangeLabel(days) {
  const labelElement = document.querySelector('#schedule-range-label');

  if (!labelElement || !Array.isArray(days) || days.length === 0) {
    return;
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const firstLabel = firstDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lastLabel = lastDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  labelElement.textContent = `${firstLabel} - ${lastLabel}`;
}

function renderDayHeader() {
  const stripElement = document.querySelector('#schedule-day-strip');

  if (!stripElement) {
    return;
  }

  const days = getDateRange();
  const selectedKey = toDateKey(state.selectedDate);

  setRangeLabel(days);

  stripElement.innerHTML = days
    .map((date) => {
      const card = formatDayCard(date);
      const dateKey = toDateKey(date);
      const isSelected = dateKey === selectedKey;

      return `
        <button
          type="button"
          class="schedule-day-card${isSelected ? ' is-selected' : ''}"
          data-day-key="${dateKey}"
          role="option"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >
          <span class="schedule-day-dow">${card.dayShort}</span>
          <span class="schedule-day-date">${card.date}</span>
          <span class="schedule-day-month">${card.monthShort}</span>
        </button>
      `;
    })
    .join('');
}

function getAvailableSpots(sessionRow) {
  const capacity = Number(sessionRow?.capacity || 0);
  const enrolledCount = Number(sessionRow?.enrolled_count || 0);
  return Math.max(capacity - enrolledCount, 0);
}

function renderSessionCards() {
  const listElement = document.querySelector('#schedule-sessions-list');
  const emptyElement = document.querySelector('#schedule-sessions-empty');
  const selectedDateLabelElement = document.querySelector('#schedule-selected-date-label');
  const countElement = document.querySelector('#schedule-session-count');
  const template = document.querySelector('#schedule-session-template');

  if (!listElement || !emptyElement || !template) {
    return;
  }

  if (selectedDateLabelElement) {
    selectedDateLabelElement.textContent = `Sessions • ${formatSelectedDateLabel(state.selectedDate)}`;
  }

  if (countElement) {
    const sessionLabel = `${state.sessions.length} ${state.sessions.length === 1 ? 'session' : 'sessions'}`;
    countElement.textContent = sessionLabel;
  }

  if (state.sessions.length === 0) {
    listElement.innerHTML = '';
    listElement.classList.add('d-none');
    emptyElement.classList.remove('d-none');
    return;
  }

  listElement.classList.remove('d-none');
  emptyElement.classList.add('d-none');

  const fragment = document.createDocumentFragment();

  for (const sessionRow of state.sessions) {
    const clone = template.content.cloneNode(true);
    const timeElement = clone.querySelector('[data-session-time]');
    const titleElement = clone.querySelector('[data-session-title]');
    const trainerElement = clone.querySelector('[data-session-trainer]');
    const roomElement = clone.querySelector('[data-session-room]');
    const difficultyElement = clone.querySelector('[data-session-difficulty]');
    const spotsElement = clone.querySelector('[data-session-spots]');
    const statusElement = clone.querySelector('[data-session-status]');
    const actionButton = clone.querySelector('[data-session-action]');

    const availableSpots = getAvailableSpots(sessionRow);
    const isBooked = state.bookedScheduleIds.has(sessionRow.id);
    const workoutTitle = sessionRow?.workout_type?.title || 'Workout Session';

    timeElement.textContent = formatTime(sessionRow.start_time);
    titleElement.textContent = workoutTitle;
    trainerElement.textContent = sessionRow.trainer_name || 'Trainer TBC';
    roomElement.textContent = sessionRow.room || 'Room TBC';

    if (difficultyElement) {
      difficultyElement.innerHTML = renderDifficultyBadge(sessionRow?.workout_type?.difficulty_level, { fallbackLevel: 2 });
    }

    spotsElement.textContent = `${availableSpots} spot${availableSpots === 1 ? '' : 's'} available`;
    actionButton.setAttribute('data-schedule-id', sessionRow.id);

    if (isBooked) {
      statusElement.classList.remove('d-none');
      actionButton.textContent = 'Cancel Booking';
      actionButton.className = 'btn btn-outline-danger btn-cancel-booking';
      actionButton.setAttribute('data-action-type', 'cancel');
    } else if (availableSpots <= 0) {
      actionButton.textContent = 'Full';
      actionButton.className = 'btn btn-outline-secondary';
      actionButton.disabled = true;
      actionButton.setAttribute('data-action-type', 'full');
    } else {
      actionButton.textContent = 'Reserve';
      actionButton.className = 'btn btn-primary';
      actionButton.setAttribute('data-action-type', 'reserve');
    }

    fragment.append(clone);
  }

  listElement.innerHTML = '';
  listElement.append(fragment);
}

function setSessionsLoading(isLoading) {
  const listElement = document.querySelector('#schedule-sessions-list');

  if (!listElement) {
    return;
  }

  listElement.classList.toggle('is-updating', isLoading);
}

async function loadCurrentUser() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  state.userId = session?.user?.id || null;
}

async function fetchSessionsForSelectedDate() {
  const dayStart = startOfDay(state.selectedDate);
  const dayEnd = addDays(dayStart, 1);
  const now = new Date();
  const isToday = toDateKey(dayStart) === toDateKey(startOfDay(now));
  const lowerBound = isToday ? now.toISOString() : dayStart.toISOString();

  const { data, error } = await supabase
    .from('schedule')
    .select('id, start_time, trainer_name, room, capacity, enrolled_count, workout_type:workout_types(title, difficulty_level)')
    .gte('start_time', lowerBound)
    .lt('start_time', dayEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function fetchBookedScheduleIds(scheduleIds) {
  if (!state.userId || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return new Set();
  }

  const uniqueScheduleIds = [...new Set(scheduleIds.filter(Boolean))];

  if (uniqueScheduleIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('schedule_id')
    .eq('user_id', state.userId)
    .in('schedule_id', uniqueScheduleIds);

  if (error) {
    throw error;
  }

  return new Set((data || []).map((row) => row.schedule_id));
}

async function refreshSessions({ animate = true } = {}) {
  const requestId = state.activeSessionRequestId + 1;
  state.activeSessionRequestId = requestId;

  if (animate) {
    setSessionsLoading(true);
  }

  const sessions = await fetchSessionsForSelectedDate();
  const bookedScheduleIds = await fetchBookedScheduleIds(sessions.map((row) => row.id));

  if (requestId !== state.activeSessionRequestId) {
    return;
  }

  state.sessions = sessions;
  state.bookedScheduleIds = bookedScheduleIds;
  renderSessionCards();

  if (animate) {
    window.setTimeout(() => {
      if (requestId === state.activeSessionRequestId) {
        setSessionsLoading(false);
      }
    }, 130);
  }
}

async function loadUpcomingReservations() {
  const upcomingListElement = document.querySelector('#schedule-upcoming-list');
  const upcomingEmptyElement = document.querySelector('#schedule-upcoming-empty');
  const countElement = document.querySelector('#schedule-upcoming-count');
  const template = document.querySelector('#schedule-upcoming-item-template');

  if (!upcomingListElement || !upcomingEmptyElement || !template || !countElement) {
    return;
  }

  if (!state.userId) {
    upcomingListElement.innerHTML = '';
    upcomingEmptyElement.textContent = 'Login to see your upcoming reservations.';
    upcomingEmptyElement.classList.remove('d-none');
    countElement.textContent = '0';
    return;
  }

  const now = new Date();
  const nextSevenDays = addDays(now, 7);

  const { data: bookingRows, error: bookingError } = await supabase
    .from('view_bookings_status')
    .select('id, schedule_id, start_time')
    .eq('user_id', state.userId)
    .gte('start_time', now.toISOString())
    .lt('start_time', nextSevenDays.toISOString())
    .order('start_time', { ascending: true });

  if (bookingError) {
    throw bookingError;
  }

  const upcomingBookings = Array.isArray(bookingRows) ? bookingRows : [];

  if (upcomingBookings.length === 0) {
    upcomingListElement.innerHTML = '';
    upcomingEmptyElement.textContent = 'No upcoming reservations in the next 7 days.';
    upcomingEmptyElement.classList.remove('d-none');
    countElement.textContent = '0';
    return;
  }

  const scheduleIds = [...new Set(upcomingBookings.map((row) => row.schedule_id).filter(Boolean))];

  const { data: scheduleRows, error: scheduleError } = await supabase
    .from('schedule')
    .select('id, trainer_name, room, workout_type:workout_types(title, difficulty_level)')
    .in('id', scheduleIds);

  if (scheduleError) {
    throw scheduleError;
  }

  const scheduleById = new Map(
    (scheduleRows || []).map((row) => [
      row.id,
      {
        trainerName: row.trainer_name,
        room: row.room,
        title: row?.workout_type?.title || 'Workout Session',
        difficultyLevel: row?.workout_type?.difficulty_level
      }
    ])
  );

  const fragment = document.createDocumentFragment();

  for (const bookingRow of upcomingBookings) {
    const detail = scheduleById.get(bookingRow.schedule_id) || {};
    const clone = template.content.cloneNode(true);
    const timeElement = clone.querySelector('[data-upcoming-time]');
    const titleElement = clone.querySelector('[data-upcoming-title]');
    const difficultyElement = clone.querySelector('[data-upcoming-difficulty]');
    const metaElement = clone.querySelector('[data-upcoming-meta]');

    const sessionDate = new Date(bookingRow.start_time);

    timeElement.textContent = sessionDate.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    titleElement.textContent = detail.title || 'Workout Session';

    if (difficultyElement) {
      difficultyElement.innerHTML = renderDifficultyBadge(detail.difficultyLevel, { fallbackLevel: 2 });
    }

    metaElement.textContent = `${detail.trainerName || 'Trainer TBC'} • ${detail.room || 'Room TBC'}`;

    fragment.append(clone);
  }

  upcomingListElement.innerHTML = '';
  upcomingListElement.append(fragment);
  upcomingEmptyElement.classList.add('d-none');
  countElement.textContent = String(upcomingBookings.length);
}

async function reserveSession(scheduleId) {
  const { data: scheduleRow, error: scheduleLookupError } = await supabase
    .from('schedule')
    .select('id, capacity, enrolled_count')
    .eq('id', scheduleId)
    .maybeSingle();

  if (scheduleLookupError) {
    throw scheduleLookupError;
  }

  if (!scheduleRow?.id) {
    throw new Error('This session is no longer available. Please choose another time slot.');
  }

  const availableSpots = Math.max(Number(scheduleRow.capacity || 0) - Number(scheduleRow.enrolled_count || 0), 0);

  if (availableSpots <= 0) {
    throw new Error('This session just became full. Please choose another one.');
  }

  const { error } = await supabase.from('bookings').insert({ schedule_id: scheduleId, user_id: state.userId });

  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      throw new Error('You are already booked for this session.');
    }

    if (/fully booked|full/i.test(error.message || '')) {
      throw new Error('This session just became full.');
    }

    if (/schedule\s+.+\s+not found|not found/i.test(error.message || '')) {
      throw new Error('This session is no longer available. Please choose another time slot.');
    }

    throw error;
  }
}

async function cancelSession(scheduleId) {
  const { error } = await supabase.from('bookings').delete().eq('schedule_id', scheduleId).eq('user_id', state.userId);

  if (error) {
    throw error;
  }
}

function bindCalendarEvents() {
  const dayStripElement = document.querySelector('#schedule-day-strip');
  const previousWeekButton = document.querySelector('#schedule-prev-week');
  const nextWeekButton = document.querySelector('#schedule-next-week');

  dayStripElement?.addEventListener('click', async (event) => {
    const dayCard = event.target.closest('[data-day-key]');

    if (!dayCard) {
      return;
    }

    const dayKey = dayCard.getAttribute('data-day-key');

    if (!dayKey) {
      return;
    }

    const [year, month, day] = dayKey.split('-').map(Number);
    state.selectedDate = startOfDay(new Date(year, month - 1, day));
    renderDayHeader();
    setFeedback('');

    try {
      await refreshSessions({ animate: true });
    } catch (error) {
      setFeedback(error?.message || 'Unable to refresh sessions for this date.');
      setSessionsLoading(false);
    }
  });

  previousWeekButton?.addEventListener('click', async () => {
    state.rangeOffsetDays = Math.max(0, state.rangeOffsetDays - WEEK_SHIFT_DAYS);
    const currentRange = getDateRange();

    if (!currentRange.some((date) => toDateKey(date) === toDateKey(state.selectedDate))) {
      state.selectedDate = currentRange[0];

      try {
        await refreshSessions({ animate: true });
      } catch (error) {
        setFeedback(error?.message || 'Unable to refresh sessions for this week.');
        setSessionsLoading(false);
      }
    }

    renderDayHeader();
  });

  nextWeekButton?.addEventListener('click', async () => {
    state.rangeOffsetDays += WEEK_SHIFT_DAYS;
    const currentRange = getDateRange();

    if (!currentRange.some((date) => toDateKey(date) === toDateKey(state.selectedDate))) {
      state.selectedDate = currentRange[0];

      try {
        await refreshSessions({ animate: true });
      } catch (error) {
        setFeedback(error?.message || 'Unable to refresh sessions for this week.');
        setSessionsLoading(false);
      }
    }

    renderDayHeader();
  });
}

function bindSessionActions() {
  const sessionsListElement = document.querySelector('#schedule-sessions-list');

  sessionsListElement?.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-session-action]');

    if (!actionButton || actionButton.disabled) {
      return;
    }

    if (!state.userId) {
      navigateTo('/login');
      return;
    }

    const scheduleId = actionButton.getAttribute('data-schedule-id');
    const actionType = actionButton.getAttribute('data-action-type');

    if (!scheduleId || !actionType || actionType === 'full') {
      return;
    }

    const isCancel = actionType === 'cancel';
    actionButton.disabled = true;
    actionButton.innerHTML = isCancel
      ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cancelling...'
      : '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Reserving...';

    setFeedback('');

    try {
      if (isCancel) {
        await cancelSession(scheduleId);
        setFeedback('Booking cancelled.', false);
      } else {
        await reserveSession(scheduleId);
        setFeedback('Session reserved.', false);
      }

      await Promise.all([refreshSessions({ animate: false }), loadUpcomingReservations()]);
    } catch (error) {
      setFeedback(error?.message || 'Unable to update booking right now. Please try again.');

      if (/no longer available|not found|choose another time slot/i.test(error?.message || '')) {
        await Promise.all([refreshSessions({ animate: false }), loadUpcomingReservations()]);
      }
    } finally {
      actionButton.disabled = false;
    }
  });
}

export const initSchedulePage = async () => {
  if (!isSupabaseConfigured || !supabase) {
    setFeedback(
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
    );
    return;
  }

  setFeedback('');
  renderDayHeader();
  bindCalendarEvents();
  bindSessionActions();

  try {
    await loadCurrentUser();
    await Promise.all([refreshSessions({ animate: false }), loadUpcomingReservations()]);
  } catch (error) {
    setFeedback(error?.message || 'Unable to load schedule right now. Please try again.');
    setSessionsLoading(false);
  }
};
