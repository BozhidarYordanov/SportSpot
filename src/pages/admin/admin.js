import './admin.css';
import adminTemplate from './admin.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';

const CATEGORY_OPTIONS = ['Cardio', 'Strength', 'Mind & Body', 'Combat', 'Other'];
const DEFAULT_CAPACITY = 20;

const state = {
  userId: null,
  workouts: [],
  sessions: [],
  activeTab: 'workouts',
  selectedWorkoutToDelete: null,
  selectedSessionToCancel: null,
  modals: {
    editWorkout: null,
    deleteWorkout: null,
    addSession: null,
    cancelSession: null
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

const formatPeakHourLabel = (hourNumber) => {
  const hour = Number(hourNumber);

  if (Number.isNaN(hour)) {
    return '—';
  }

  const from = new Date();
  from.setHours(hour, 0, 0, 0);

  const to = new Date(from);
  to.setHours(hour + 1, 0, 0, 0);

  const fromLabel = from.toLocaleTimeString(undefined, { hour: 'numeric' });
  const toLabel = to.toLocaleTimeString(undefined, { hour: 'numeric' });
  return `${fromLabel} - ${toLabel}`;
};

const getBootstrapModal = (modalId) => {
  const modalElement = document.querySelector(`#${modalId}`);

  if (!modalElement || !window.bootstrap?.Modal) {
    return null;
  }

  return window.bootstrap.Modal.getOrCreateInstance(modalElement);
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
      const description = String(workout.description_long || '').trim();
      const shortDescription = description.length > 120 ? `${description.slice(0, 117)}...` : description;

      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(workout.title || 'Untitled')}</td>
          <td><span class="admin-pill">${escapeHtml(workout.category || 'Other')}</span></td>
          <td>${escapeHtml(workout.difficulty_level || 2)}/3</td>
          <td class="text-secondary">${escapeHtml(shortDescription || '—')}</td>
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
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="cancel-session" data-id="${sessionRow.id}">Cancel Session</button>
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
    .select('id, title, description_long, category, difficulty_level')
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

const loadStats = async () => {
  const { startIso, endIso } = getLocalDayRange(new Date());
  const last30DaysDate = new Date();
  last30DaysDate.setDate(last30DaysDate.getDate() - 30);

  const [{ count: todayBookingsCount, error: todayBookingsError }, { count: memberGrowthCount, error: memberGrowthError }, { data: peakRows, error: peakError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id, schedule!inner(start_time)', { count: 'exact', head: true })
        .gte('schedule.start_time', startIso)
        .lt('schedule.start_time', endIso),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30DaysDate.toISOString()),
      supabase.from('bookings').select('schedule!inner(start_time)').limit(5000)
    ]);

  if (todayBookingsError) {
    throw todayBookingsError;
  }

  if (memberGrowthError) {
    throw memberGrowthError;
  }

  if (peakError) {
    throw peakError;
  }

  const bookingsElement = document.querySelector('#admin-stat-bookings');
  const growthElement = document.querySelector('#admin-stat-growth');
  const peakElement = document.querySelector('#admin-stat-peak');

  if (bookingsElement) {
    bookingsElement.textContent = String(todayBookingsCount || 0);
  }

  if (growthElement) {
    growthElement.textContent = String(memberGrowthCount || 0);
  }

  const hourMap = new Map();
  for (const row of peakRows || []) {
    const startTime = row?.schedule?.start_time;

    if (!startTime) {
      continue;
    }

    const date = new Date(startTime);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const hour = date.getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  }

  const peakHourEntry = [...hourMap.entries()].sort((left, right) => right[1] - left[1])[0];

  if (peakElement) {
    peakElement.textContent = peakHourEntry ? formatPeakHourLabel(peakHourEntry[0]) : 'No bookings yet';
  }
};

const openEditWorkoutModal = (workoutId) => {
  const workout = state.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return;
  }

  const idInput = document.querySelector('#admin-edit-workout-id');
  const titleInput = document.querySelector('#admin-edit-title');
  const descriptionInput = document.querySelector('#admin-edit-description');
  const categoryInput = document.querySelector('#admin-edit-category');
  const difficultyInput = document.querySelector('#admin-edit-difficulty');

  if (!idInput || !titleInput || !descriptionInput || !categoryInput || !difficultyInput) {
    return;
  }

  idInput.value = workout.id;
  titleInput.value = workout.title || '';
  descriptionInput.value = workout.description_long || '';
  categoryInput.value = CATEGORY_OPTIONS.includes(workout.category) ? workout.category : 'Other';
  difficultyInput.value = String(workout.difficulty_level || 2);
  setFeedback('#admin-edit-workout-feedback', '');
  state.modals.editWorkout?.show();
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

const openCancelSessionModal = (sessionId) => {
  const session = state.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return;
  }

  state.selectedSessionToCancel = session.id;
  const title = session?.workout_type?.title || 'Workout Session';
  const copyElement = document.querySelector('#admin-cancel-session-copy');

  if (copyElement) {
    copyElement.textContent = `Cancel "${title}" on ${formatDateTime(session.start_time)}?`;
  }

  state.modals.cancelSession?.show();
};

const bindTabSwitching = () => {
  document.querySelectorAll('[data-admin-tab]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const tabName = buttonElement.getAttribute('data-admin-tab');

      if (tabName) {
        switchTab(tabName);
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
      openEditWorkoutModal(id);
      return;
    }

    if (action === 'delete-workout') {
      openDeleteWorkoutModal(id);
      return;
    }

    if (action === 'cancel-session') {
      openCancelSessionModal(id);
    }
  });
};

const bindEditWorkoutForm = () => {
  const formElement = document.querySelector('#admin-edit-workout-form');

  formElement?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(formElement);
    const workoutId = String(formData.get('id') || document.querySelector('#admin-edit-workout-id')?.value || '').trim();
    const title = String(formData.get('title') || '').trim();
    const descriptionLong = String(formData.get('description_long') || '').trim();
    const category = String(formData.get('category') || 'Other');
    const difficultyLevel = Number(formData.get('difficulty_level') || 2);

    if (!workoutId || !title || !CATEGORY_OPTIONS.includes(category) || ![1, 2, 3].includes(difficultyLevel)) {
      setFeedback('#admin-edit-workout-feedback', 'Please fill all workout fields correctly.');
      return;
    }

    const saveButton = document.querySelector('#admin-save-workout-btn');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }

    setFeedback('#admin-edit-workout-feedback', '');

    try {
      const { error } = await supabase
        .from('workout_types')
        .update({
          title,
          description_long: descriptionLong || null,
          category,
          difficulty_level: difficultyLevel
        })
        .eq('id', workoutId);

      if (error) {
        throw error;
      }

      await loadWorkoutTypes();
      setFeedback('#admin-workouts-feedback', 'Workout updated successfully.', false);
      state.modals.editWorkout?.hide();
    } catch (error) {
      setFeedback('#admin-edit-workout-feedback', error?.message || 'Unable to save workout changes.');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
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
      await loadWorkoutTypes();
      setFeedback('#admin-workouts-feedback', 'Workout deleted successfully.', false);
    } catch (error) {
      setFeedback('#admin-workouts-feedback', error?.message || 'Unable to delete workout right now.');
    } finally {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Delete';
    }
  });
};

const bindAddSession = () => {
  const openButton = document.querySelector('#admin-add-session-btn');
  const formElement = document.querySelector('#admin-add-session-form');

  openButton?.addEventListener('click', () => {
    setFeedback('#admin-add-session-feedback', '');
    formElement?.reset();
    renderWorkoutTypeOptions();
    state.modals.addSession?.show();
  });

  formElement?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(formElement);
    const workoutTypeId = String(formData.get('workout_type_id') || '').trim();
    const sessionDate = String(formData.get('session_date') || '').trim();
    const sessionTime = String(formData.get('session_time') || '').trim();
    const trainerName = String(formData.get('trainer_name') || '').trim();
    const room = String(formData.get('room') || '').trim();
    const startDate = new Date(`${sessionDate}T${sessionTime}`);

    if (!workoutTypeId || !sessionDate || !sessionTime || !trainerName || !room || Number.isNaN(startDate.getTime())) {
      setFeedback('#admin-add-session-feedback', 'Please complete all session fields.');
      return;
    }

    const createButton = document.querySelector('#admin-create-session-btn');

    if (createButton) {
      createButton.disabled = true;
      createButton.textContent = 'Creating...';
    }

    setFeedback('#admin-add-session-feedback', '');

    try {
      const { error } = await supabase.from('schedule').insert({
        workout_type_id: workoutTypeId,
        start_time: startDate.toISOString(),
        trainer_name: trainerName,
        room,
        capacity: DEFAULT_CAPACITY
      });

      if (error) {
        throw error;
      }

      state.modals.addSession?.hide();
      await Promise.all([loadUpcomingSessions(), loadStats()]);
      setFeedback('#admin-sessions-feedback', 'Session added successfully.', false);
    } catch (error) {
      setFeedback('#admin-add-session-feedback', error?.message || 'Unable to create session right now.');
    } finally {
      if (createButton) {
        createButton.disabled = false;
        createButton.textContent = 'Create Session';
      }
    }
  });
};

const bindCancelSession = () => {
  const buttonElement = document.querySelector('#admin-confirm-cancel-session-btn');

  buttonElement?.addEventListener('click', async () => {
    if (!state.selectedSessionToCancel) {
      return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = 'Cancelling...';

    try {
      const { error } = await supabase.from('schedule').delete().eq('id', state.selectedSessionToCancel);

      if (error) {
        throw error;
      }

      state.selectedSessionToCancel = null;
      state.modals.cancelSession?.hide();
      await Promise.all([loadUpcomingSessions(), loadStats()]);
      setFeedback('#admin-sessions-feedback', 'Session cancelled successfully.', false);
    } catch (error) {
      setFeedback('#admin-sessions-feedback', error?.message || 'Unable to cancel session right now.');
    } finally {
      buttonElement.disabled = false;
      buttonElement.textContent = 'Cancel Session';
    }
  });
};

const initModals = () => {
  state.modals.editWorkout = getBootstrapModal('admin-edit-workout-modal');
  state.modals.deleteWorkout = getBootstrapModal('admin-delete-workout-modal');
  state.modals.addSession = getBootstrapModal('admin-add-session-modal');
  state.modals.cancelSession = getBootstrapModal('admin-cancel-session-modal');
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

  initModals();
  bindTabSwitching();
  bindTableActions();
  bindEditWorkoutForm();
  bindDeleteWorkout();
  bindAddSession();
  bindCancelSession();
  switchTab(state.activeTab);

  try {
    setFeedback('#admin-feedback', '');
    await Promise.all([loadStats(), loadWorkoutTypes(), loadUpcomingSessions()]);
  } catch (error) {
    setFeedback('#admin-feedback', error?.message || 'Unable to load admin data right now.');
  }
};