import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';

const renderGuestActions = () => `
	<a class="btn btn-sm btn-outline-secondary px-3" href="/login" data-link>Login</a>
	<a class="btn btn-sm btn-primary px-3" href="/register" data-link>Register</a>
`;

const renderAuthenticatedActions = () => `
	<a class="btn btn-sm btn-outline-secondary px-3" href="/dashboard" data-link>Dashboard</a>
	<button type="button" class="btn btn-sm btn-primary px-3" id="header-logout-btn">Logout</button>
`;

const setHeaderActions = (isAuthenticated) => {
	const actionsContainer = document.querySelector('#header-auth-actions');

	if (!actionsContainer) {
		return;
	}

	actionsContainer.innerHTML = isAuthenticated ? renderAuthenticatedActions() : renderGuestActions();

	const logoutButton = document.querySelector('#header-logout-btn');

	if (!logoutButton) {
		return;
	}

	logoutButton.addEventListener('click', async () => {
		if (isSupabaseConfigured && supabase) {
			await supabase.auth.signOut();
		}

		navigateTo('/');
	});
};

const getNavLinkClass = (isActive) => `nav-link${isActive ? ' active' : ''}`;

export const renderHeader = (currentPath = '/') => `
	<header class="main-header border-bottom bg-white">
		<nav class="navbar navbar-expand-lg container py-3">
			<a class="navbar-brand fw-semibold" href="/" data-link>SportSpot</a>
			<button
				class="navbar-toggler"
				type="button"
				data-bs-toggle="collapse"
				data-bs-target="#main-nav"
				aria-controls="main-nav"
				aria-expanded="false"
				aria-label="Toggle navigation"
			>
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class="collapse navbar-collapse" id="main-nav">
				<ul class="navbar-nav ms-auto mb-2 mb-lg-0 gap-lg-2 me-lg-3">
					<li class="nav-item">
						<a class="${getNavLinkClass(currentPath === '/')}" href="/" data-link>Home</a>
					</li>
					<li class="nav-item">
						<a class="${getNavLinkClass(currentPath === '/classes' || currentPath.startsWith('/class-details/'))}" href="/classes" data-link>Classes</a>
					</li>
				</ul>
				<div class="d-flex align-items-center gap-2" id="header-auth-actions">
					${renderGuestActions()}
				</div>
			</div>
		</nav>
	</header>
`;

export const initHeader = async () => {
	if (!isSupabaseConfigured || !supabase) {
		setHeaderActions(false);
		return;
	}

	const {
		data: { session }
	} = await supabase.auth.getSession();

	setHeaderActions(Boolean(session?.user));
};
