import './index.css';
import indexTemplate from './index.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { renderClassCard } from '../../components/class-card/class-card';
import { navigateTo } from '../../router';
import { setPageTitle } from '../../lib/pageTitle';

export const renderIndexPage = () => indexTemplate;

const EVENING_HOUR = 18;
const FEATURED_LOOKAHEAD_HOURS = 48;

const state = {
	featuredSession: null,
	featuredBookingId: null,
	isAuthenticated: false,
	userId: null
};

const buildClassDetailsLink = (slug) => `/class-details/${encodeURIComponent(String(slug || '').trim())}`;

const startOfDay = (date) => {
	const value = new Date(date);
	value.setHours(0, 0, 0, 0);
	return value;
};

const addDays = (date, days) => {
	const value = new Date(date);
	value.setDate(value.getDate() + days);
	return value;
};

const addHours = (date, hours) => {
	const value = new Date(date);
	value.setHours(value.getHours() + hours);
	return value;
};

const toDateKey = (date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const getAvailableSpots = (sessionRow) => {
	const capacity = Number(sessionRow?.capacity || 0);
	const enrolledCount = Number(sessionRow?.enrolled_count || 0);
	return Math.max(capacity - enrolledCount, 0);
};

const formatFeaturedTimeLabel = (timestamp) => {
	const date = new Date(timestamp);

	if (Number.isNaN(date.getTime())) {
		return 'Date TBC';
	}

	const now = new Date();
	const todayKey = toDateKey(now);
	const tomorrowKey = toDateKey(addDays(now, 1));
	const sessionKey = toDateKey(date);

	const dayLabel = sessionKey === todayKey ? 'Today' : sessionKey === tomorrowKey ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'short' });
	const timeLabel = date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});

	return `${dayLabel} • ${timeLabel}`;
};

const isSessionBookable = (sessionRow, now = new Date()) => {
	if (!sessionRow?.start_time) {
		return false;
	}

	const startTime = new Date(sessionRow.start_time);

	if (Number.isNaN(startTime.getTime())) {
		return false;
	}

	if (startTime.getTime() <= now.getTime()) {
		return false;
	}

	return getAvailableSpots(sessionRow) > 0;
};

const isEveningSession = (sessionRow) => {
	const startTime = new Date(sessionRow?.start_time);

	if (Number.isNaN(startTime.getTime())) {
		return false;
	}

	return startTime.getHours() >= EVENING_HOUR;
};

const renderFeaturedActivity = () => {
	const titleElement = document.querySelector('#featured-activity-title');
	const metaElement = document.querySelector('#featured-activity-meta');
	const trainerElement = document.querySelector('#featured-activity-trainer');
	const actionButton = document.querySelector('#featured-activity-btn');

	if (!titleElement || !metaElement || !trainerElement || !actionButton) {
		return;
	}

	const featuredSession = state.featuredSession;

	if (!featuredSession) {
		titleElement.textContent = 'No upcoming sessions yet';
		metaElement.textContent = 'Check back soon for the next available class.';
		trainerElement.textContent = 'Browse all classes to plan your next workout.';
		actionButton.textContent = 'Browse classes';
		actionButton.disabled = false;
		actionButton.className = 'btn btn-sm px-3 btn-primary';
		actionButton.setAttribute('data-action-type', 'browse');
		actionButton.setAttribute('data-schedule-id', '');
		return;
	}

	const workoutTitle = featuredSession?.workout_type?.title || 'Workout Session';
	const trainerName = String(featuredSession?.trainer_name || '').trim() || 'Trainer TBC';
	const availableSpots = getAvailableSpots(featuredSession);
	const isBooked = Boolean(state.featuredBookingId);

	titleElement.textContent = workoutTitle;
	metaElement.textContent = `${formatFeaturedTimeLabel(featuredSession.start_time)} • ${availableSpots} spots left`;
	trainerElement.textContent = `Coach • ${trainerName}`;

	actionButton.setAttribute('data-schedule-id', featuredSession.id || '');

	if (!state.isAuthenticated) {
		actionButton.textContent = 'Reserve now';
		actionButton.disabled = availableSpots <= 0;
		actionButton.className = availableSpots <= 0 ? 'btn btn-sm px-3 btn-outline-secondary' : 'btn btn-sm px-3 btn-primary';
		actionButton.setAttribute('data-action-type', availableSpots <= 0 ? 'full' : 'reserve');
		return;
	}

	if (isBooked) {
		actionButton.textContent = 'Cancel Booking';
		actionButton.disabled = false;
		actionButton.className = 'btn btn-sm px-3 btn-outline-danger btn-cancel-booking';
		actionButton.setAttribute('data-action-type', 'cancel');
		return;
	}

	if (availableSpots <= 0) {
		actionButton.textContent = 'Full';
		actionButton.disabled = true;
		actionButton.className = 'btn btn-sm px-3 btn-outline-secondary';
		actionButton.setAttribute('data-action-type', 'full');
		return;
	}

	actionButton.textContent = 'Reserve now';
	actionButton.disabled = false;
	actionButton.className = 'btn btn-sm px-3 btn-primary';
	actionButton.setAttribute('data-action-type', 'reserve');
};

const setFeaturedButtonLoading = (buttonElement, isLoading, label) => {
	if (!buttonElement) {
		return;
	}

	buttonElement.disabled = isLoading;

	if (isLoading) {
		buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Working...';
		return;
	}

	buttonElement.textContent = label;
};

const fetchScheduleRows = async ({ fromIso, toIso = null, limit = 200 }) => {
	const selectClause = 'id, start_time, trainer_name, capacity, enrolled_count, workout_type:workout_types(title, category)';

	let query = supabase.from('schedule').select(selectClause).gt('start_time', fromIso).order('start_time', { ascending: true }).limit(limit);

	if (toIso) {
		query = query.lte('start_time', toIso);
	}

	const { data, error } = await query;

	if (error) {
		throw error;
	}

	return Array.isArray(data) ? data : [];
};

const loadFeaturedSession = async () => {
	if (!isSupabaseConfigured || !supabase) {
		return null;
	}

	const now = new Date();
	const windowEnd = addHours(now, FEATURED_LOOKAHEAD_HOURS);
	const todayEvening = startOfDay(now);
	todayEvening.setHours(EVENING_HOUR, 0, 0, 0);

	const eveningSearchStart = now.getTime() >= todayEvening.getTime() ? addDays(startOfDay(now), 1) : startOfDay(now);
	const next48HoursRows = await fetchScheduleRows({
		fromIso: now.toISOString(),
		toIso: windowEnd.toISOString(),
		limit: 250
	});

	const eveningRows = next48HoursRows
		.filter((sessionRow) => isSessionBookable(sessionRow, now))
		.filter((sessionRow) => {
			const startTime = new Date(sessionRow.start_time);
			return startTime.getTime() >= eveningSearchStart.getTime() && isEveningSession(sessionRow);
		});

	if (eveningRows.length > 0) {
		return eveningRows[0];
	}

	const fallbackRows = await fetchScheduleRows({
		fromIso: now.toISOString(),
		limit: 400
	});

	return fallbackRows.find((sessionRow) => isSessionBookable(sessionRow, now)) || null;
};

const loadFeaturedBookingId = async (scheduleId, userId) => {
	if (!scheduleId || !userId) {
		return null;
	}

	const { data, error } = await supabase
		.from('bookings')
		.select('id')
		.eq('schedule_id', scheduleId)
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(1);

	if (error) {
		throw error;
	}

	return data?.[0]?.id || null;
};

const reserveFeaturedSession = async (scheduleId, userId) => {
	const { data, error } = await supabase
		.from('bookings')
		.insert({ schedule_id: scheduleId, user_id: userId })
		.select('id')
		.single();

	if (error) {
		if (/duplicate|unique/i.test(error.message || '')) {
			throw new Error('You already reserved this session.');
		}

		throw error;
	}

	return data?.id || null;
};

const cancelFeaturedBooking = async (bookingId, scheduleId, userId) => {
	let query = supabase.from('bookings').delete().eq('user_id', userId);

	query = bookingId ? query.eq('id', bookingId) : query.eq('schedule_id', scheduleId);

	const { error } = await query;

	if (error) {
		throw error;
	}
};

const bindFeaturedAction = () => {
	const actionButton = document.querySelector('#featured-activity-btn');

	if (!actionButton || actionButton.dataset.bound === 'true') {
		return;
	}

	actionButton.dataset.bound = 'true';
	actionButton.addEventListener('click', async () => {
		const actionType = actionButton.getAttribute('data-action-type');
		const scheduleId = actionButton.getAttribute('data-schedule-id') || '';

		if (actionType === 'browse') {
			navigateTo('/classes');
			return;
		}

		if (actionType === 'full') {
			return;
		}

		if (!state.isAuthenticated || !state.userId) {
			navigateTo('/login');
			return;
		}

		if (!scheduleId) {
			return;
		}

		setFeaturedButtonLoading(actionButton, true, actionButton.textContent);

		try {
			if (actionType === 'cancel') {
				await cancelFeaturedBooking(state.featuredBookingId, scheduleId, state.userId);
				state.featuredBookingId = null;

				if (state.featuredSession) {
					state.featuredSession.enrolled_count = Math.max(Number(state.featuredSession.enrolled_count || 0) - 1, 0);
				}
			} else {
				const bookingId = await reserveFeaturedSession(scheduleId, state.userId);
				state.featuredBookingId = bookingId;

				if (state.featuredSession) {
					state.featuredSession.enrolled_count = Number(state.featuredSession.enrolled_count || 0) + 1;
				}
			}

			renderFeaturedActivity();
		} catch (error) {
			console.error('Failed to update featured booking:', error);

			if (state.featuredSession?.id) {
				state.featuredBookingId = await loadFeaturedBookingId(state.featuredSession.id, state.userId);
			}

			renderFeaturedActivity();
		}
	});
};

const renderTopClasses = (classes) => {
	const topClassesGrid = document.querySelector('#top-classes-grid');
	const topClassesSection = topClassesGrid?.closest('.top-classes-section');

	if (!topClassesGrid) {
		return;
	}

	if (!Array.isArray(classes) || classes.length === 0) {
		topClassesGrid.innerHTML = '';

		if (topClassesSection) {
			topClassesSection.style.display = 'none';
		}

		return;
	}

	if (topClassesSection) {
		topClassesSection.style.display = '';
	}

	const cardsMarkup = classes
		.slice(0, 4)
		.map((workoutClass) => renderClassCard(workoutClass, { linkHref: buildClassDetailsLink(workoutClass.slug) }))
		.filter((cardMarkup) => typeof cardMarkup === 'string' && cardMarkup.trim().length > 0)
		.join('');

	if (!cardsMarkup) {
		topClassesGrid.innerHTML = '';

		if (topClassesSection) {
			topClassesSection.style.display = 'none';
		}

		return;
	}

	topClassesGrid.innerHTML = cardsMarkup;
};

const loadTopClasses = async () => {
	if (!isSupabaseConfigured || !supabase) {
		return [];
	}

	let result = await supabase
		.from('workout_types')
		.select('slug, title, description, duration_minutes, difficulty_level, category')
		.order('title', { ascending: true })
		.limit(4);

	if (result.error) {
		result = await supabase
			.from('workout_types')
			.select('slug, title, description, duration_minutes, difficulty_level')
			.order('title', { ascending: true })
			.limit(4);
	}

	const { data, error } = result;

	if (error || !Array.isArray(data) || data.length === 0) {
		return [];
	}

	return data;
};

export const initIndexPage = async () => {
	setPageTitle('Home');

	const getStartedButton = document.querySelector('#hero-get-started-btn');
	state.isAuthenticated = false;
	state.userId = null;
	state.featuredSession = null;
	state.featuredBookingId = null;

	if (isSupabaseConfigured && supabase) {
		const {
			data: { session }
		} = await supabase.auth.getSession();

		state.isAuthenticated = Boolean(session?.user);
		state.userId = session?.user?.id || null;
	}

	if (getStartedButton) {
		getStartedButton.style.display = state.isAuthenticated ? 'none' : '';
	}

	bindFeaturedAction();

	if (isSupabaseConfigured && supabase) {
		try {
			state.featuredSession = await loadFeaturedSession();

			if (state.featuredSession?.id && state.userId) {
				state.featuredBookingId = await loadFeaturedBookingId(state.featuredSession.id, state.userId);
			}
		} catch (error) {
			console.error('Unable to load featured activity:', error);
		}
	}

	renderFeaturedActivity();

	const topClasses = await loadTopClasses();
	renderTopClasses(topClasses);
};
