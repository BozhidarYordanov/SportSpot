import './index.css';
import indexTemplate from './index.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

export const renderIndexPage = () => indexTemplate;

const FALLBACK_TOP_CLASSES = [
	{
		category: 'Strength',
		title: 'Performance Boxing',
		description: 'Coach Ava • 45 min',
		difficulty_level: 3
	},
	{
		category: 'Mind & Body',
		title: 'Flow Yoga',
		description: 'Coach Emma • 50 min',
		difficulty_level: 1
	},
	{
		category: 'Core',
		title: 'Pilates Sculpt',
		description: 'Coach Mila • 40 min',
		difficulty_level: 2
	},
	{
		category: 'Cardio',
		title: 'HIIT Ride',
		description: 'Coach Leo • 35 min',
		difficulty_level: 3
	}
];

const difficultyMetaByLevel = {
	1: { label: 'Easy', toneClass: 'difficulty-badge--easy' },
	2: { label: 'Intermediate', toneClass: 'difficulty-badge--intermediate' },
	3: { label: 'Advanced', toneClass: 'difficulty-badge--advanced' }
};

const categoryMappings = [
	{ keywords: ['yoga', 'pilates', 'mobility'], category: 'Mind & Body' },
	{ keywords: ['boxing', 'strength', 'functional'], category: 'Strength' },
	{ keywords: ['hiit', 'spinning', 'cardio', 'endurance'], category: 'Cardio' },
	{ keywords: ['core'], category: 'Core' }
];

const escapeHtml = (value) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const getDifficultyMeta = (level) => {
	const normalizedLevel = Number(level);
	return difficultyMetaByLevel[normalizedLevel] ?? difficultyMetaByLevel[2];
};

const inferCategory = (workoutTitle) => {
	const normalizedTitle = String(workoutTitle || '').toLowerCase();

	const mappedCategory = categoryMappings.find(({ keywords }) =>
		keywords.some((keyword) => normalizedTitle.includes(keyword))
	);

	return mappedCategory?.category || 'Workout';
};

const renderDifficultyBadge = (difficultyLevel) => {
	const normalizedLevel = Math.min(3, Math.max(1, Number(difficultyLevel) || 1));
	const difficultyMeta = getDifficultyMeta(normalizedLevel);

	const barsMarkup = Array.from({ length: 3 }, (_, index) => {
		const isActive = index < normalizedLevel;
		return `<span class="difficulty-indicator-bar${isActive ? ' is-active' : ''}"></span>`;
	}).join('');

	return `
		<span class="difficulty-badge ${difficultyMeta.toneClass}" aria-label="Difficulty ${difficultyMeta.label}">
			<span class="difficulty-indicator" aria-hidden="true">${barsMarkup}</span>
			<span class="difficulty-label">${difficultyMeta.label}</span>
		</span>
	`;
};

const renderTopClassCard = (workoutClass) => {
	const category = escapeHtml(workoutClass.category || inferCategory(workoutClass.title));
	const title = escapeHtml(workoutClass.title);
	const metaText = escapeHtml(workoutClass.description || `${Number(workoutClass.duration_minutes) || 45} min`);

	return `
		<div class="col-md-6 col-xl-3">
			<article class="class-card rounded-4 border h-100 p-3 p-md-4 bg-white">
				<p class="text-uppercase small fw-semibold text-secondary mb-2">${category}</p>
				<h3 class="h5 mb-2">${title}</h3>
				<p class="text-secondary mb-3">${metaText}</p>
				${renderDifficultyBadge(workoutClass.difficulty_level)}
			</article>
		</div>
	`;
};

const renderTopClasses = (classes) => {
	const topClassesGrid = document.querySelector('#top-classes-grid');

	if (!topClassesGrid) {
		return;
	}

	const cardsMarkup = classes.slice(0, 4).map(renderTopClassCard).join('');
	topClassesGrid.innerHTML = cardsMarkup;
};

const loadTopClasses = async () => {
	if (!isSupabaseConfigured || !supabase) {
		return FALLBACK_TOP_CLASSES;
	}

	const { data, error } = await supabase
		.from('workout_types')
		.select('title, description, duration_minutes, difficulty_level')
		.order('title', { ascending: true })
		.limit(4);

	if (error || !Array.isArray(data) || data.length === 0) {
		return FALLBACK_TOP_CLASSES;
	}

	return data;
};

export const initIndexPage = async () => {
	const topClasses = await loadTopClasses();
	renderTopClasses(topClasses);
};
