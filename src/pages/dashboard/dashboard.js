import './dashboard.css';
import dashboardTemplate from './dashboard.html?raw';
import { createClassCard } from '../../components/class-card/class-card';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';

export const renderDashboardPage = () => dashboardTemplate;

const formatSessionDateTime = (timestamp) => {
	if (!timestamp) {
		return 'Date TBC';
	}

	const date = new Date(timestamp);

	if (Number.isNaN(date.getTime())) {
		return 'Date TBC';
	}

	const dateText = date.toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});

	const timeText = date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});

	return `${dateText} • ${timeText}`;
};

const setDashboardFeedback = (message, isError = true) => {
	const feedbackElement = document.querySelector('#dashboard-feedback');

	if (!feedbackElement) {
		return;
	}

	feedbackElement.textContent = message;
	feedbackElement.classList.toggle('text-danger', isError);
	feedbackElement.classList.toggle('text-success', !isError);
	feedbackElement.classList.toggle('d-none', !message);
};

const isInCurrentMonth = (timestamp) => {
	if (!timestamp) {
		return false;
	}

	const date = new Date(timestamp);
	const now = new Date();

	if (Number.isNaN(date.getTime())) {
		return false;
	}

	return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const escapeHtml = (value) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const getTrainingBreakdown = (pastBookings = []) => {
	if (!Array.isArray(pastBookings) || pastBookings.length === 0) {
		return [];
	}

	const categoryCountMap = new Map();

	for (const booking of pastBookings) {
		const categoryTitle = booking?.title?.trim() || 'Workout';
		categoryCountMap.set(categoryTitle, (categoryCountMap.get(categoryTitle) || 0) + 1);
	}

	const sortedBreakdown = [...categoryCountMap.entries()]
		.map(([title, count]) => ({ title, count }))
		.sort((left, right) => right.count - left.count)
		.slice(0, 5);

	const maxCount = sortedBreakdown[0]?.count || 0;

	return sortedBreakdown.map((item) => ({
		...item,
		percentage: maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0
	}));
};

const renderTrainingBreakdown = (listElement, emptyElement, breakdownItems) => {
	if (!listElement || !emptyElement) {
		return;
	}

	if (!Array.isArray(breakdownItems) || breakdownItems.length === 0) {
		listElement.innerHTML = '';
		listElement.classList.add('d-none');
		emptyElement.classList.remove('d-none');
		return;
	}

	listElement.classList.remove('d-none');
	emptyElement.classList.add('d-none');
	listElement.innerHTML = breakdownItems
		.map(
			(item, index) => {
				const barAlpha = Math.max(0.45, 1 - index * 0.12);
				const sessionLabel = `${item.count} ${item.count === 1 ? 'session' : 'sessions'}`;

				return `
			<li class="dashboard-breakdown-item">
			  <div class="dashboard-breakdown-head">
			    <span class="dashboard-breakdown-title">${escapeHtml(item.title)}</span>
			    <span class="dashboard-breakdown-badge">${sessionLabel}</span>
			  </div>
			  <div class="dashboard-breakdown-track" role="progressbar" aria-label="${escapeHtml(item.title)} frequency" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.percentage}">
			    <span class="dashboard-breakdown-fill" style="width: ${item.percentage}%; --breakdown-alpha: ${barAlpha};"></span>
			  </div>
			</li>
		`;
			}
		)
		.join('');
};

const renderBookingCards = (containerElement, bookings = [], actionFactory = null) => {
	if (!containerElement) {
		return;
	}

	containerElement.innerHTML = bookings
		.map((booking) => {
			const instructorText = booking.trainer_name ? ` • ${booking.trainer_name}` : '';
			const roomText = booking.room ? ` • ${booking.room}` : '';
			const cardMeta = `${formatSessionDateTime(booking.start_time)}${instructorText}${roomText}`;

			return createClassCard(
				{
					title: booking.title || 'Workout Session',
					description: cardMeta,
					duration_minutes: booking.duration_minutes || 45,
					difficulty_level: booking.difficulty_level || 2
				},
				{
					action: typeof actionFactory === 'function' ? actionFactory(booking) : null
				}
			);
		})
		.join('');
};

const setSectionState = (listElement, emptyElement, items) => {
	if (!listElement || !emptyElement) {
		return;
	}

	const hasItems = Array.isArray(items) && items.length > 0;
	listElement.classList.toggle('d-none', !hasItems);
	emptyElement.classList.toggle('d-none', hasItems);
};

const loadDashboardData = async (userId) => {
	const [{ data: profile, error: profileError }, { data: bookingRows, error: bookingError }] = await Promise.all([
		supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
		supabase
			.from('view_bookings_status')
			.select('id, schedule_id, user_id, start_time, session_status')
			.eq('user_id', userId)
			.order('start_time', { ascending: true })
	]);

	if (profileError) {
		throw profileError;
	}

	if (bookingError) {
		throw bookingError;
	}

	const bookings = Array.isArray(bookingRows) ? bookingRows : [];

	if (bookings.length === 0) {
		return {
			fullName: profile?.full_name || 'Athlete',
			bookings: []
		};
	}

	const scheduleIds = [...new Set(bookings.map((booking) => booking.schedule_id).filter(Boolean))];

	const { data: scheduleRows, error: scheduleError } = await supabase
		.from('schedule')
		.select('id, trainer_name, room, workout_type:workout_types(title, duration_minutes, difficulty_level)')
		.in('id', scheduleIds);

	if (scheduleError) {
		throw scheduleError;
	}

	const scheduleById = new Map(
		(scheduleRows || []).map((schedule) => {
			const workoutType = schedule.workout_type || {};

			return [
				schedule.id,
				{
					trainer_name: schedule.trainer_name,
					room: schedule.room,
					title: workoutType.title,
					duration_minutes: workoutType.duration_minutes,
					difficulty_level: workoutType.difficulty_level
				}
			];
		})
	);

	const enrichedBookings = bookings.map((booking) => ({
		...booking,
		...(scheduleById.get(booking.schedule_id) || {})
	}));

	return {
		fullName: profile?.full_name || 'Athlete',
		bookings: enrichedBookings
	};
};

const bindBookClassActions = () => {
	const quickActionButton = document.querySelector('#dashboard-book-class-btn');
	const emptyStateButton = document.querySelector('#dashboard-empty-cta');

	const goToClasses = () => window.location.assign('/classes');

	quickActionButton?.addEventListener('click', goToClasses);
	emptyStateButton?.addEventListener('click', goToClasses);
};

const bindCancelBookingAction = (userId, onRefresh) => {
	const dashboardPage = document.querySelector('.dashboard-page');

	if (!dashboardPage) {
		return;
	}

	dashboardPage.addEventListener('click', async (event) => {
		const buttonElement = event.target.closest('[data-card-action="cancel-booking"]');

		if (!buttonElement) {
			return;
		}

		const bookingId = buttonElement.getAttribute('data-booking-id');

		if (!bookingId) {
			return;
		}

		buttonElement.disabled = true;
		buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cancelling...';
		setDashboardFeedback('');

		try {
			const { error } = await supabase.from('bookings').delete().eq('id', bookingId).eq('user_id', userId);

			if (error) {
				throw error;
			}

			setDashboardFeedback('Booking cancelled successfully.', false);
			await onRefresh();
		} catch (error) {
			setDashboardFeedback(error?.message || 'Unable to cancel booking right now. Please try again.');
			buttonElement.disabled = false;
			buttonElement.textContent = 'Cancel Booking';
		}
	});
};

const renderDashboardView = ({ fullName, bookings }) => {
	const userNameElement = document.querySelector('#dashboard-user-name');
	const workoutsMonthElement = document.querySelector('#dashboard-workouts-month');
	const totalWorkoutsElement = document.querySelector('#dashboard-total-workouts');
	const totalWorkoutsSubtextElement = document.querySelector('#dashboard-total-workouts-subtext');
	const trainingBreakdownListElement = document.querySelector('#dashboard-training-breakdown-list');
	const trainingBreakdownEmptyElement = document.querySelector('#dashboard-training-breakdown-empty');
	const emptyStateElement = document.querySelector('#dashboard-empty-state');
	const contentGridElement = document.querySelector('#dashboard-content-grid');
	const upcomingListElement = document.querySelector('#dashboard-upcoming-list');
	const historyListElement = document.querySelector('#dashboard-history-list');
	const upcomingEmptyElement = document.querySelector('#dashboard-upcoming-empty');
	const historyEmptyElement = document.querySelector('#dashboard-history-empty');

	if (userNameElement) {
		userNameElement.textContent = fullName || 'Athlete';
	}

	const upcomingBookings = bookings.filter((booking) => booking.session_status === 'upcoming');
	const historyBookings = bookings
		.filter((booking) => booking.session_status === 'past')
		.sort((left, right) => new Date(right.start_time).getTime() - new Date(left.start_time).getTime())
		.slice(0, 3);
	const allPastBookings = bookings.filter((booking) => booking.session_status === 'past');
	const workoutsThisMonth = bookings.filter((booking) => isInCurrentMonth(booking.start_time)).length;
	const totalWorkouts = allPastBookings.length;
	const trainingBreakdown = getTrainingBreakdown(allPastBookings);

	if (workoutsMonthElement) {
		workoutsMonthElement.textContent = String(workoutsThisMonth);
	}

	if (totalWorkoutsElement) {
		totalWorkoutsElement.textContent = String(totalWorkouts);
	}

	if (totalWorkoutsSubtextElement) {
		totalWorkoutsSubtextElement.textContent = totalWorkouts > 0 ? 'Completed sessions in your training history.' : 'Your journey starts here!';
	}

	renderTrainingBreakdown(trainingBreakdownListElement, trainingBreakdownEmptyElement, trainingBreakdown);

	const hasNoBookings = bookings.length === 0;
	emptyStateElement?.classList.toggle('d-none', !hasNoBookings);
	contentGridElement?.classList.toggle('d-none', hasNoBookings);

	if (hasNoBookings) {
		return;
	}

	renderBookingCards(upcomingListElement, upcomingBookings, (booking) => ({
		label: 'Cancel Booking',
		variant: 'outline-secondary',
		action: 'cancel-booking',
		bookingId: booking.id,
		scheduleId: booking.schedule_id
	}));

	renderBookingCards(historyListElement, historyBookings);
	setSectionState(upcomingListElement, upcomingEmptyElement, upcomingBookings);
	setSectionState(historyListElement, historyEmptyElement, historyBookings);
};

export const initDashboardPage = async () => {
	bindBookClassActions();

	if (!isSupabaseConfigured || !supabase) {
		setDashboardFeedback(
			'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
		);
		return;
	}

	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session?.user?.id) {
		navigateTo('/login', true);
		return;
	}

	const userId = session.user.id;

	const refreshDashboard = async () => {
		const dashboardData = await loadDashboardData(userId);
		renderDashboardView(dashboardData);
	};

	bindCancelBookingAction(userId, refreshDashboard);

	try {
		await refreshDashboard();
	} catch (error) {
		setDashboardFeedback(error?.message || 'Unable to load your dashboard right now.');
	}
};