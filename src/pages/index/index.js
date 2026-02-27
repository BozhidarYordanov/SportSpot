import './index.css';
import indexTemplate from './index.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { renderClassCard } from '../../components/class-card/class-card';

export const renderIndexPage = () => indexTemplate;

const buildClassDetailsLink = (slug) => `/class-details/${encodeURIComponent(String(slug || '').trim())}`;

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

	const { data, error } = await supabase
		.from('workout_types')
		.select('slug, title, description, duration_minutes, difficulty_level')
		.order('title', { ascending: true })
		.limit(4);

	if (error || !Array.isArray(data) || data.length === 0) {
		return [];
	}

	return data;
};

export const initIndexPage = async () => {
	const topClasses = await loadTopClasses();
	renderTopClasses(topClasses);
};
