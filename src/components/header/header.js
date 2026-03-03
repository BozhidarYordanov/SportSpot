import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../toast/toast';

const renderGuestActions = () => `
	<a class="btn btn-sm btn-outline-secondary px-3" href="/login" data-link>Login</a>
	<a class="btn btn-sm btn-primary px-3" href="/register" data-link>Register</a>
`;

const renderAuthenticatedActions = (options = {}) => {
	const { isDashboardActive = false, isAdminActive = false, showAdminLink = false } = options;

	return `
		<li class="nav-item">
			<a class="${getNavLinkClass(isDashboardActive)}" href="/dashboard" data-link>Dashboard</a>
		</li>
		${
			showAdminLink
				? `<li class="nav-item">
					<a class="${getNavLinkClass(isAdminActive)} nav-link-admin" href="/admin" data-link>
						<i class="bi bi-shield-lock" aria-hidden="true"></i>
						<span>Admin</span>
					</a>
				</li>`
				: ''
		}
	`;
};

const renderLogoutButton = () => `
	<button type="button" class="btn btn-sm btn-primary px-3" id="header-logout-btn">Logout</button>
`;

const ROLE_CACHE_KEY = 'user_role';

export const getUserRole = async (userId) => {
	if (!userId) {
		return 'user';
	}

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

		const role = String(roleRow?.role || 'user').toLowerCase();
		sessionStorage.setItem(ROLE_CACHE_KEY, role);
		return role;
	} catch (error) {
		if (error?.code === 'PGRST116') {
			sessionStorage.setItem(ROLE_CACHE_KEY, 'user');
			return 'user';
		}

		return 'user';
	}
};

const setHeaderActions = (isAuthenticated, currentPath = '/', userRole = 'user') => {
	const navList = document.querySelector('.navbar-nav');
	const logoutContainer = document.querySelector('#header-auth-actions');

	if (!navList || !logoutContainer) {
		return;
	}

	// Remove existing Dashboard nav item if present
	const existingDashboard = navList.querySelector('[href="/dashboard"]');
	if (existingDashboard) {
		existingDashboard.closest('.nav-item')?.remove();
	}

	const existingAdmin = navList.querySelector('[href="/admin"]');
	if (existingAdmin) {
		existingAdmin.closest('.nav-item')?.remove();
	}

	// Add Dashboard to nav list if authenticated
	if (isAuthenticated) {
		navList.insertAdjacentHTML(
			'beforeend',
			renderAuthenticatedActions({
				isDashboardActive: currentPath === '/dashboard',
				isAdminActive: currentPath === '/admin',
				showAdminLink: userRole === 'admin'
			})
		);
	}

	// Set logout button
	logoutContainer.innerHTML = isAuthenticated ? renderLogoutButton() : renderGuestActions();

	const logoutButton = document.querySelector('#header-logout-btn');

	if (!logoutButton) {
		return;
	}

	logoutButton.addEventListener('click', async () => {
		try {
			if (isSupabaseConfigured && supabase) {
				const { error } = await supabase.auth.signOut();

				if (error) {
					throw error;
				}
			}

			sessionStorage.removeItem(ROLE_CACHE_KEY);
			setHeaderActions(false, '/');
			showToast('Logged out safely', 'success');
			navigateTo('/');
		} catch (error) {
			showToast(error?.message || 'Unable to log out right now. Please try again.', 'error');
		}
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
					<li class="nav-item">
						<a class="${getNavLinkClass(currentPath === '/schedule')}" href="/schedule" data-link>Schedule</a>
					</li>
				</ul>
				<div class="d-flex align-items-center gap-2" id="header-auth-actions">
					${renderGuestActions()}
				</div>
			</div>
		</nav>
	</header>
`;

export const updateHeaderActiveState = (currentPath = '/') => {
	const allLinks = document.querySelectorAll('.navbar-nav .nav-link');

	allLinks.forEach((link) => {
		const href = link.getAttribute('href');
		let isActive = false;

		if (href === '/') {
			isActive = currentPath === '/';
		} else if (href === '/classes') {
			isActive = currentPath === '/classes' || currentPath.startsWith('/class-details');
		} else if (href) {
			isActive = href === currentPath;
		}

		link.classList.toggle('active', isActive);
	});
};

export const initHeader = async () => {
	const currentPath = window.location.pathname;

	if (!isSupabaseConfigured || !supabase) {
		setHeaderActions(false, currentPath);
		return;
	}

	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session?.user?.id) {
		setHeaderActions(false, currentPath);
		return;
	}

	const cachedRole = sessionStorage.getItem(ROLE_CACHE_KEY);

	if (cachedRole) {
		setHeaderActions(true, currentPath, cachedRole);
		// Background refresh to detect role changes without blocking the UI
		getUserRole(session.user.id).then((freshRole) => {
			if (freshRole !== cachedRole) {
				setHeaderActions(true, currentPath, freshRole);
			}
		});
	} else {
		const userRole = await getUserRole(session.user.id);
		setHeaderActions(true, currentPath, userRole);
	}
};
