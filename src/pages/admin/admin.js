import './admin.css';
import adminTemplate from './admin.html?raw';
import { Modal } from 'bootstrap';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../../components/toast/toast';

const CATEGORY_OPTIONS = ['Cardio', 'Strength', 'Mind & Body', 'Combat', 'Other'];
const DEFAULT_CAPACITY = 20;

const state = {
  userId: null,
  workouts: [],
  sessions: [],
  todayBookings: [],
  recentRegistrations: [],
  activeTab: 'bookings',
  selectedWorkoutToDelete: null,
  selectedSessionToDelete: null,
  selectedBookingToCancel: null,
  modals: {
    workout: null,
    deleteWorkout: null,
    session: null,
    deleteSession: null,
    cancelBooking: null
  }
};

export const renderAdminPage = () => adminTemplate;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const setFeedback = (selector, message = '', isError = true) => {
  const element = document.querySelector(selector);

  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle('d-none', !message);
  element.classList.toggle('text-danger', Boolean(message) && isError);
  element.classList.toggle('text-success', Boolean(message) && !isError);
};

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toLocalDateTimeValue = (isoDateTime) => {
  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getLocalDayRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const formatDateTime = (value) => {
  const date = new Date(value);

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

const formatTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getCurrentUserRole = async (userId) => {
  try {
    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .order('role', { ascending: true })
      .limit(1)
      .single();

    if (roleError) {
      throw roleError;
    }

    return String(roleRow?.role || 'user').toLowerCase();
  } catch (error) {
    if (error?.code === 'PGRST116') {
      return 'user';
    }

    return 'user';
  }
};

const switchTab = (tabName) => {
  state.activeTab = tabName;

  document.querySelectorAll('[data-admin-tab]').forEach((buttonElement) => {
    const isActive = buttonElement.getAttribute('data-admin-tab') === tabName;
    buttonElement.classList.toggle('active', isActive);
    buttonElement.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('[data-admin-panel]').forEach((panelElement) => {
    const isActive = panelElement.getAttribute('data-admin-panel') === tabName;
    panelElement.classList.toggle('d-none', !isActive);
  });
};

const renderWorkoutRows = () => {
  const bodyElement = document.querySelector('#admin-workouts-body');
  const emptyElement = document.querySelector('#admin-workouts-empty');

  if (!bodyElement || !emptyElement) {
    return;
  }

  if (state.workouts.length === 0) {
    bodyElement.innerHTML = '';
    emptyElement.classList.remove('d-none');
    return;
  }

  emptyElement.classList.add('d-none');

  bodyElement.innerHTML = state.workouts
    .map((workout) => {
      const description = String(workout.description || '').trim();
      const shortDescription = description.length > 120 ? `${description.slice(0, 117)}...` : description;

      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(workout.title || 'Untitled')}</td>
          <td><span class="admin-pill">${escapeHtml(workout.category || 'Other')}</span></td>
          <td>${escapeHtml(workout.difficulty_level || 2)}/3</td>
          <td class="text-secondary"><span class="admin-description-clamp">${escapeHtml(shortDescription || '—')}</span></td>
          <td class="text-end">
            <div class="admin-actions justify-content-end">
              <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit-workout" data-id="${workout.id}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-workout" data-id="${workout.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
};

const renderScheduleRows = () => {
  const bodyElement = document.querySelector('#admin-sessions-body');
  const emptyElement = document.querySelector('#admin-sessions-empty');

  if (!bodyElement || !emptyElement) {
    return;
  }

  if (state.sessions.length === 0) {
    bodyElement.innerHTML = '';
    emptyElement.classList.remove('d-none');
    return;
  }

  emptyElement.classList.add('d-none');

  bodyElement.innerHTML = state.sessions
    .map((sessionRow) => {
      const title = sessionRow?.workout_type?.title || 'Workout Session';
      const room = sessionRow.room || 'Room TBC';
      const trainer = sessionRow.trainer_name || 'Trainer TBC';

      return `
        <tr>
          <td>${escapeHtml(formatDateTime(sessionRow.start_time))}</td>
          <td class="fw-semibold">${escapeHtml(title)}</td>
          <td>${escapeHtml(trainer)}</td>
          <td>${escapeHtml(room)}</td>
          <td>${Number(sessionRow.enrolled_count || 0)}/${Number(sessionRow.capacity || 0)}</td>
          <td class="text-end">
            <div class="admin-actions justify-content-end">
              <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit-session" data-id="${sessionRow.id}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-session" data-id="${sessionRow.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
};

const renderWorkoutTypeOptions = () => {
  const selectElement = document.querySelector('#admin-session-workout-type');

  if (!selectElement) {
    return;
  }

  if (state.workouts.length === 0) {
    selectElement.innerHTML = '<option value="">No workout types available</option>';
    return;
  }

  selectElement.innerHTML = state.workouts
    .map((workout) => `<option value="${workout.id}">${escapeHtml(workout.title)}</option>`)
    .join('');
};

const loadWorkoutTypes = async () => {
  const { data, error } = await supabase
    .from('workout_types')
    .select('id, title, slug, duration_minutes, description, description_long, suitable_for, what_to_bring, category, difficulty_level')
    .order('title', { ascending: true });

  if (error) {
    throw error;
  }

  state.workouts = Array.isArray(data) ? data : [];
  renderWorkoutRows();
  renderWorkoutTypeOptions();
};

const loadUpcomingSessions = async () => {
  const { data, error } = await supabase
    .from('schedule')
    .select('id, workout_type_id, start_time, trainer_name, room, capacity, enrolled_count, workout_type:workout_types(title)')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  state.sessions = Array.isArray(data) ? data : [];
  renderScheduleRows();
};

const renderTodayBookingRows = () => {
  const bodyElement = document.querySelector('#admin-bookings-body');
  const emptyElement = document.querySelector('#admin-bookings-empty');
  const totalElement = document.querySelector('#admin-bookings-total');

  if (!bodyElement || !emptyElement || !totalElement) {
    return;
  }

  totalElement.textContent = `Total Bookings Today: ${state.todayBookings.length}`;

  if (state.todayBookings.length === 0) {
    bodyElement.innerHTML = '';
    emptyElement.classList.remove('d-none');
    return;
  }

  emptyElement.classList.add('d-none');

  bodyElement.innerHTML = state.todayBookings
    .map((booking) => {
      const userName =
        booking?.profile?.full_name?.trim() || booking?.guest_name?.trim() || booking?.profile?.email?.trim() || booking?.guest_email?.trim() || 'Guest';

      const workoutTitle = booking?.schedule?.workout_type?.title || 'Workout Session';
      const status = booking?.status || 'upcoming';
      const statusLabel = status === 'past' ? 'Completed' : 'Upcoming';
      const statusClass = status === 'past' ? 'admin-status-past' : 'admin-status-upcoming';
      const canCancel = status !== 'past';
      const actionCell = canCancel
        ? `<button type="button" class="btn btn-sm btn-outline-danger admin-cancel-booking-btn" data-action="cancel-booking" data-id="${booking.id}">Cancel</button>`
        : '<span class="text-secondary">—</span>';

      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(userName)}</td>
          <td>${escapeHtml(workoutTitle)}</td>
          <td>${escapeHtml(formatTime(booking?.schedule?.start_time))}</td>
          <td><span class="admin-status-pill ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td class="text-end">${actionCell}</td>
        </tr>
      `;
    })
    .join('');
};

const openCancelBookingModal = (bookingId) => {
  const booking = state.todayBookings.find((item) => item.id === bookingId);

  if (!booking || booking.status === 'past') {
    return;
  }

  state.selectedBookingToCancel = booking.id;
  const userName =
    booking?.profile?.full_name?.trim() || booking?.guest_name?.trim() || booking?.profile?.email?.trim() || booking?.guest_email?.trim() || 'Guest';
  const workoutTitle = booking?.schedule?.workout_type?.title || 'Workout Session';
  const bookingTime = formatTime(booking?.schedule?.start_time);
  const copyElement = document.querySelector('#admin-cancel-booking-copy');

  if (copyElement) {
    copyElement.textContent = `Cancel ${userName}'s booking for ${workoutTitle} at ${bookingTime}? This will free one spot in the schedule.`;
  }

  state.modals.cancelBooking?.show();
};

const renderRegistrationData = (counts) => {
  const registrations24Element = document.querySelector('#admin-registrations-24h');
  const registrations7Element = document.querySelector('#admin-registrations-7d');
  const registrations30Element = document.querySelector('#admin-registrations-30d');
  const registrationsTotalElement = document.querySelector('#admin-registrations-total');
  const bodyElement = document.querySelector('#admin-registrations-body');
  const emptyElement = document.querySelector('#admin-registrations-empty');

  if (registrations24Element) {
    registrations24Element.textContent = String(counts.last24Hours || 0);
  }

  if (registrations7Element) {
    registrations7Element.textContent = String(counts.last7Days || 0);
  }

  if (registrations30Element) {
    registrations30Element.textContent = String(counts.last30Days || 0);
  }

  if (registrationsTotalElement) {
    registrationsTotalElement.textContent = String(counts.lifetimeTotal || 0);
  }

  if (!bodyElement || !emptyElement) {
    return;
  }

  if (state.recentRegistrations.length === 0) {
    bodyElement.innerHTML = '';
    emptyElement.classList.remove('d-none');
    return;
  }

  emptyElement.classList.add('d-none');

  bodyElement.innerHTML = state.recentRegistrations
    .map((profileRow) => {
      const name = profileRow.full_name?.trim() || 'Unnamed User';
      const email = profileRow.email?.trim() || '—';

      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(name)}</td>
          <td>${escapeHtml(email)}</td>
          <td>${escapeHtml(formatDate(profileRow.created_at))}</td>
        </tr>
      `;
    })
    .join('');
};

const loadTodayBookings = async () => {
  const { startIso, endIso } = getLocalDayRange(new Date());

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, user_id, guest_name, guest_email, created_at, schedule!inner(start_time, workout_type:workout_types(title)), profile:profiles!bookings_user_id_fkey(full_name, email)'
    )
    .gte('schedule.start_time', startIso)
    .lt('schedule.start_time', endIso)
    .order('start_time', { ascending: true, referencedTable: 'schedule' });

  if (error) {
    throw error;
  }

  const now = Date.now();
  state.todayBookings = (Array.isArray(data) ? data : []).map((row) => {
    const scheduleStart = row?.schedule?.start_time;
    const startTimestamp = scheduleStart ? new Date(scheduleStart).getTime() : Number.NaN;

    return {
      ...row,
      status: Number.isNaN(startTimestamp) ? 'upcoming' : startTimestamp < now ? 'past' : 'upcoming'
    };
  });

  renderTodayBookingRows();
};

const loadRegistrationMetrics = async () => {
  const now = new Date();
  const last24HoursDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7DaysDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30DaysDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [last24Response, last7Response, last30Response, lifetimeResponse, recentResponse] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last24HoursDate.toISOString()),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last7DaysDate.toISOString()),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30DaysDate.toISOString()),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  if (last24Response.error) {
    throw last24Response.error;
  }

  if (last7Response.error) {
    throw last7Response.error;
  }

  if (last30Response.error) {
    throw last30Response.error;
  }

  if (lifetimeResponse.error) {
    throw lifetimeResponse.error;
  }

  if (recentResponse.error) {
    throw recentResponse.error;
  }

  state.recentRegistrations = Array.isArray(recentResponse.data) ? recentResponse.data : [];

  renderRegistrationData({
    last24Hours: last24Response.count || 0,
    last7Days: last7Response.count || 0,
    last30Days: last30Response.count || 0,
    lifetimeTotal: lifetimeResponse.count || 0
  });
};

const openWorkoutModal = (mode, workoutId = null) => {
  const formElement = document.querySelector('#admin-edit-workout-form');
  const modeInput = document.querySelector('#admin-workout-form-mode');
  const idInput = document.querySelector('#admin-edit-workout-id');
  const titleInput = document.querySelector('#admin-edit-title');
  const slugInput = document.querySelector('#admin-edit-slug');
  const durationInput = document.querySelector('#admin-edit-duration');
  const shortDescriptionInput = document.querySelector('#admin-edit-short-description');
  const descriptionInput = document.querySelector('#admin-edit-description');
  const suitableForInput = document.querySelector('#admin-edit-suitable-for');
  const whatToBringInput = document.querySelector('#admin-edit-what-to-bring');
  const categoryInput = document.querySelector('#admin-edit-category');
  const difficultyInput = document.querySelector('#admin-edit-difficulty');
  const modalTitleElement = document.querySelector('#admin-edit-workout-label');
  const submitButtonElement = document.querySelector('#admin-save-workout-btn');

  if (
    !formElement ||
    !modeInput ||
    !idInput ||
    !titleInput ||
    !slugInput ||
    !durationInput ||
    !shortDescriptionInput ||
    !descriptionInput ||
    !suitableForInput ||
    !whatToBringInput ||
    !categoryInput ||
    !difficultyInput
  ) {
    return;
  }

  formElement.reset();
  modeInput.value = mode;
  setFeedback('#admin-edit-workout-feedback', '');

  if (mode === 'edit') {
    const workout = state.workouts.find((item) => item.id === workoutId);

    if (!workout) {
      return;
    }

    idInput.value = workout.id;
    titleInput.value = workout.title || '';
    slugInput.value = workout.slug || '';
    durationInput.value = String(workout.duration_minutes || 45);
    shortDescriptionInput.value = workout.description || '';
    descriptionInput.value = workout.description_long || '';
    suitableForInput.value = workout.suitable_for || '';
    whatToBringInput.value = workout.what_to_bring || '';
    categoryInput.value = CATEGORY_OPTIONS.includes(workout.category) ? workout.category : 'Other';
    difficultyInput.value = String(workout.difficulty_level || 2);

    if (modalTitleElement) {
      modalTitleElement.textContent = 'Edit Workout';
    }

    if (submitButtonElement) {
      submitButtonElement.textContent = 'Save Changes';
    }
  } else {
    idInput.value = '';
    slugInput.value = '';
    durationInput.value = '45';
    shortDescriptionInput.value = '';
    suitableForInput.value = '';
    whatToBringInput.value = '';
    categoryInput.value = 'Other';
    difficultyInput.value = '2';

    if (modalTitleElement) {
      modalTitleElement.textContent = 'Add New Workout';
    }

    if (submitButtonElement) {
      submitButtonElement.textContent = 'Create Workout';
    }
  }

  state.modals.workout?.show();
};

const openDeleteWorkoutModal = (workoutId) => {
  const workout = state.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return;
  }

  state.selectedWorkoutToDelete = workout.id;
  const copyElement = document.querySelector('#admin-delete-workout-copy');

  if (copyElement) {
    copyElement.textContent = `Delete "${workout.title}"? This action cannot be undone.`;
  }

  state.modals.deleteWorkout?.show();
};

const openSessionModal = (mode, sessionId = null) => {
  const formElement = document.querySelector('#admin-session-form');
  const modeInput = document.querySelector('#admin-session-form-mode');
  const idInput = document.querySelector('#admin-session-id');
  const workoutTypeInput = document.querySelector('#admin-session-workout-type');
  const startTimeInput = document.querySelector('#admin-session-start-time');
  const trainerInput = document.querySelector('#admin-session-trainer');
  const roomInput = document.querySelector('#admin-session-room');
  const capacityInput = document.querySelector('#admin-session-capacity');
  const titleElement = document.querySelector('#admin-session-label');
  const submitButtonElement = document.querySelector('#admin-save-session-btn');

  if (!formElement || !modeInput || !idInput || !workoutTypeInput || !startTimeInput || !trainerInput || !roomInput || !capacityInput) {
    return;
  }

  renderWorkoutTypeOptions();
  formElement.reset();
  modeInput.value = mode;
  setFeedback('#admin-session-feedback', '');

  if (mode === 'edit') {
    const session = state.sessions.find((item) => item.id === sessionId);

    if (!session) {
      return;
    }

    idInput.value = session.id;
    workoutTypeInput.value = session.workout_type_id || '';
    startTimeInput.value = toLocalDateTimeValue(session.start_time);
    trainerInput.value = session.trainer_name || '';
    roomInput.value = session.room || '';
    capacityInput.value = String(session.capacity || DEFAULT_CAPACITY);

    if (titleElement) {
      titleElement.textContent = 'Edit Session';
    }

    if (submitButtonElement) {
      submitButtonElement.textContent = 'Save Changes';
    }
  } else {
    idInput.value = '';
    capacityInput.value = String(DEFAULT_CAPACITY);

    if (titleElement) {
      titleElement.textContent = 'Add New Session';
    }

    if (submitButtonElement) {
      submitButtonElement.textContent = 'Create Session';
    }
  }

  state.modals.session?.show();
};

const openDeleteSessionModal = (sessionId) => {
  const session = state.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return;
  }

  state.selectedSessionToDelete = session.id;
  const title = session?.workout_type?.title || 'Workout Session';
  const copyElement = document.querySelector('#admin-delete-session-copy');

  if (copyElement) {
    copyElement.textContent = `Delete "${title}" on ${formatDateTime(session.start_time)}?`;
  }

  state.modals.deleteSession?.show();
};

const bindTabSwitching = () => {
  document.querySelectorAll('[data-admin-tab]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const tabName = buttonElement.getAttribute('data-admin-tab');

      if (tabName) {
        switchTab(tabName);

        if (tabName === 'bookings') {
          loadTodayBookings().catch((error) => {
            const errorMessage = error?.message || 'Unable to refresh today\'s bookings.';
            setFeedback('#admin-feedback', errorMessage);
            showToast(errorMessage, 'error');
          });
        }

        if (tabName === 'registrations') {
          loadRegistrationMetrics().catch((error) => {
            const errorMessage = error?.message || 'Unable to refresh registration metrics.';
            setFeedback('#admin-feedback', errorMessage);
            showToast(errorMessage, 'error');
          });
        }
      }
    });
  });
};

const bindTableActions = () => {
  const pageElement = document.querySelector('.admin-page');

  if (!pageElement) {
    return;
  }

  pageElement.addEventListener('click', (event) => {
    const buttonElement = event.target.closest('[data-action]');

    if (!buttonElement) {
      return;
    }

    const action = buttonElement.getAttribute('data-action');
    const id = buttonElement.getAttribute('data-id');

    if (!action || !id) {
      return;
    }

    if (action === 'edit-workout') {
      openWorkoutModal('edit', id);
      return;
    }

    if (action === 'delete-workout') {
      openDeleteWorkoutModal(id);
      return;
    }

    if (action === 'edit-session') {
      openSessionModal('edit', id);
      return;
    }

    if (action === 'delete-session') {
      openDeleteSessionModal(id);
      return;
    }

    if (action === 'cancel-booking') {
      openCancelBookingModal(id);
    }
  });
};

const bindCreateButtons = () => {
  const addWorkoutButton = document.querySelector('#admin-add-workout-btn');
  const addSessionButton = document.querySelector('#admin-add-session-btn');

  addWorkoutButton?.addEventListener('click', () => {
    openWorkoutModal('create');
  });

  addSessionButton?.addEventListener('click', () => {
    openSessionModal('create');
  });
};

const bindWorkoutForm = () => {
  const formElement = document.querySelector('#admin-edit-workout-form');

  formElement?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(formElement);
    const mode = String(formData.get('mode') || 'edit');
    const workoutId = String(formData.get('id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const slug = normalizeSlug(formData.get('slug'));
    const durationMinutes = Number(formData.get('duration_minutes') || 0);
    const shortDescription = String(formData.get('description') || '').trim();
    const descriptionLong = String(formData.get('description_long') || '').trim();
    const suitableFor = String(formData.get('suitable_for') || '').trim();
    const whatToBring = String(formData.get('what_to_bring') || '').trim();
    const category = String(formData.get('category') || 'Other').trim();
    const difficultyLevel = Number(formData.get('difficulty_level') || 2);

    if (
      !title ||
      !slug ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      !CATEGORY_OPTIONS.includes(category) ||
      ![1, 2, 3].includes(difficultyLevel)
    ) {
      setFeedback('#admin-edit-workout-feedback', 'Please fill all workout fields correctly, including slug and duration.');
      return;
    }

    if (mode === 'edit' && !workoutId) {
      setFeedback('#admin-edit-workout-feedback', 'Workout id is missing. Please reopen the modal.');
      return;
    }

    const saveButton = document.querySelector('#admin-save-workout-btn');

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = mode === 'create' ? 'Creating...' : 'Saving...';
    }

    setFeedback('#admin-edit-workout-feedback', '');

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('workout_types').insert({
          title,
          slug,
          duration_minutes: durationMinutes,
          description: shortDescription || `${title} class`,
          description_long: descriptionLong || null,
          suitable_for: suitableFor || null,
          what_to_bring: whatToBring || null,
          category,
          difficulty_level: difficultyLevel
        });

        if (error) {
          throw error;
        }

        showToast('New workout category created', 'success');
        setFeedback('#admin-workouts-feedback', 'New workout category created', false);
      } else {
        const { error } = await supabase
          .from('workout_types')
          .update({
            title,
            slug,
            duration_minutes: durationMinutes,
            description: shortDescription || `${title} class`,
            description_long: descriptionLong || null,
            suitable_for: suitableFor || null,
            what_to_bring: whatToBring || null,
            category,
            difficulty_level: difficultyLevel
          })
          .eq('id', workoutId);

        if (error) {
          throw error;
        }

        showToast('Workout details updated', 'success');
        setFeedback('#admin-workouts-feedback', 'Workout details updated', false);
      }

      await loadWorkoutTypes();
      state.modals.workout?.hide();
    } catch (error) {
      if (/duplicate key|unique|slug/i.test(error?.message || '')) {
        const errorMessage = 'This slug is already in use. Please choose a different one.';
        setFeedback('#admin-edit-workout-feedback', errorMessage);
        showToast(errorMessage, 'error');
      } else {
        const errorMessage = error?.message || 'Unable to save workout changes.';
        setFeedback('#admin-edit-workout-feedback', errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = mode === 'create' ? 'Create Workout' : 'Save Changes';
      }
    }
  });
};

const bindDeleteWorkout = () => {
  const buttonElement = document.querySelector('#admin-confirm-delete-workout-btn');

  buttonElement?.addEventListener('click', async () => {
    if (!state.selectedWorkoutToDelete) {
      return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = 'Deleting...';

    try {
      const { error } = await supabase.from('workout_types').delete().eq('id', state.selectedWorkoutToDelete);

      if (error) {
        throw error;
      }

      state.selectedWorkoutToDelete = null;
      state.modals.deleteWorkout?.hide();
      await Promise.all([loadWorkoutTypes(), loadTodayBookings()]);
      setFeedback('#admin-workouts-feedback', 'Workout type removed', false);
      showToast('Workout type removed', 'success');
    } catch (error) {
      const errorMessage = error?.message || 'Unable to delete workout right now.';
      setFeedback('#admin-workouts-feedback', errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Delete';
    }
  });
};

const bindSessionForm = () => {
  const formElement = document.querySelector('#admin-session-form');

  formElement?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(formElement);
    const mode = String(formData.get('mode') || 'create');
    const sessionId = String(formData.get('id') || '').trim();
    const workoutTypeId = String(formData.get('workout_type_id') || '').trim();
    const startTime = String(formData.get('start_time') || '').trim();
    const trainerName = String(formData.get('trainer_name') || '').trim();
    const room = String(formData.get('room') || '').trim();
    const capacity = Number(formData.get('capacity') || DEFAULT_CAPACITY);
    const startDate = new Date(startTime);

    if (!workoutTypeId || !startTime || Number.isNaN(startDate.getTime()) || !trainerName || !room || !Number.isInteger(capacity) || capacity < 1) {
      setFeedback('#admin-session-feedback', 'Please complete all session fields correctly.');
      return;
    }

    if (mode === 'edit' && !sessionId) {
      setFeedback('#admin-session-feedback', 'Session id is missing. Please reopen the modal.');
      return;
    }

    const saveButton = document.querySelector('#admin-save-session-btn');

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = mode === 'create' ? 'Creating...' : 'Saving...';
    }

    setFeedback('#admin-session-feedback', '');

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('schedule').insert({
          workout_type_id: workoutTypeId,
          start_time: startDate.toISOString(),
          trainer_name: trainerName,
          room,
          capacity
        });

        if (error) {
          throw error;
        }

        setFeedback('#admin-sessions-feedback', 'Session added to calendar', false);
        showToast('Session added to calendar', 'success');
      } else {
        const { error } = await supabase
          .from('schedule')
          .update({
            workout_type_id: workoutTypeId,
            start_time: startDate.toISOString(),
            trainer_name: trainerName,
            room,
            capacity
          })
          .eq('id', sessionId);

        if (error) {
          throw error;
        }

        setFeedback('#admin-sessions-feedback', 'Schedule updated', false);
        showToast('Schedule updated', 'success');
      }

      state.modals.session?.hide();
      await Promise.all([loadUpcomingSessions(), loadTodayBookings()]);
    } catch (error) {
      const errorMessage = error?.message || 'Unable to save session right now.';
      setFeedback('#admin-session-feedback', errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = mode === 'create' ? 'Create Session' : 'Save Changes';
      }
    }
  });
};

const bindDeleteSession = () => {
  const buttonElement = document.querySelector('#admin-confirm-delete-session-btn');

  buttonElement?.addEventListener('click', async () => {
    if (!state.selectedSessionToDelete) {
      return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = 'Deleting...';

    try {
      const { error } = await supabase.from('schedule').delete().eq('id', state.selectedSessionToDelete);

      if (error) {
        throw error;
      }

      state.selectedSessionToDelete = null;
      state.modals.deleteSession?.hide();
      await Promise.all([loadUpcomingSessions(), loadTodayBookings()]);
      setFeedback('#admin-sessions-feedback', 'Session cancelled', false);
      showToast('Session cancelled', 'success');
    } catch (error) {
      const errorMessage = error?.message || 'Unable to delete session right now.';
      setFeedback('#admin-sessions-feedback', errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Delete Session';
    }
  });
};

const bindCancelBooking = () => {
  const buttonElement = document.querySelector('#admin-confirm-cancel-booking-btn');

  buttonElement?.addEventListener('click', async () => {
    if (!state.selectedBookingToCancel) {
      return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = 'Canceling...';

    try {
      const { error } = await supabase.from('bookings').delete().eq('id', state.selectedBookingToCancel);

      if (error) {
        throw error;
      }

      state.selectedBookingToCancel = null;
      state.modals.cancelBooking?.hide();
      await Promise.all([loadTodayBookings(), loadUpcomingSessions()]);
      showToast('User reservation removed and spot freed', 'success');
      setFeedback('#admin-feedback', '', false);
    } catch (error) {
      const errorMessage = error?.message || 'Unable to cancel booking right now.';
      setFeedback('#admin-feedback', errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Cancel Booking';
    }
  });
};

const initModalsAndToast = () => {
  const workoutModalElement = document.querySelector('#admin-edit-workout-modal');
  const deleteWorkoutModalElement = document.querySelector('#admin-delete-workout-modal');
  const sessionModalElement = document.querySelector('#admin-session-modal');
  const deleteSessionModalElement = document.querySelector('#admin-delete-session-modal');
  const cancelBookingModalElement = document.querySelector('#admin-cancel-booking-modal');

  state.modals.workout = workoutModalElement ? Modal.getOrCreateInstance(workoutModalElement) : null;
  state.modals.deleteWorkout = deleteWorkoutModalElement ? Modal.getOrCreateInstance(deleteWorkoutModalElement) : null;
  state.modals.session = sessionModalElement ? Modal.getOrCreateInstance(sessionModalElement) : null;
  state.modals.deleteSession = deleteSessionModalElement ? Modal.getOrCreateInstance(deleteSessionModalElement) : null;
  state.modals.cancelBooking = cancelBookingModalElement ? Modal.getOrCreateInstance(cancelBookingModalElement) : null;
};

export const initAdminPage = async () => {
  if (!isSupabaseConfigured || !supabase) {
    setFeedback(
      '#admin-feedback',
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
    );
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    navigateTo('/login');
    return;
  }

  state.userId = session.user.id;

  const userRole = await getCurrentUserRole(state.userId);

  if (userRole !== 'admin') {
    navigateTo('/dashboard');
    return;
  }

  initModalsAndToast();
  bindTabSwitching();
  bindTableActions();
  bindCreateButtons();
  bindWorkoutForm();
  bindDeleteWorkout();
  bindSessionForm();
  bindDeleteSession();
  bindCancelBooking();
  switchTab(state.activeTab);

  try {
    setFeedback('#admin-feedback', '');
    await Promise.all([loadTodayBookings(), loadRegistrationMetrics(), loadWorkoutTypes(), loadUpcomingSessions()]);
  } catch (error) {
    const errorMessage = error?.message || 'Unable to load admin data right now.';
    setFeedback('#admin-feedback', errorMessage);
    showToast(errorMessage, 'error');
  }
};
