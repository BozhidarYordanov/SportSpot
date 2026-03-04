import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../toast/toast';

const PROFILE_UPDATED_EVENT = 'sportspot:profile-updated';
const ROLE_CACHE_KEY = 'user_role';

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

const escapeHtml = (value) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const getInitials = (fullName, email) => {
	const fromName = String(fullName || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() || '')
		.join('');

	if (fromName) {
		return fromName;
	}

	return String(email || '').trim().charAt(0).toUpperCase() || 'U';
};

const normalizeProfileData = (profileData = {}) => ({
	fullName: String(profileData?.fullName || '').trim(),
	email: String(profileData?.email || '').trim(),
	avatarUrl: String(profileData?.avatarUrl || '').trim()
});

const renderHeaderAvatar = (profileData = {}, currentPath = '/') => {
	const normalizedProfile = normalizeProfileData(profileData);
	const initials = getInitials(normalizedProfile.fullName, normalizedProfile.email);
	const isProfileActive = currentPath === '/profile';
	const labelName = normalizedProfile.fullName || 'Profile';

	return `
		<button
			type="button"
			id="header-user-menu-trigger"
			class="header-profile-avatar-link${isProfileActive ? ' is-active' : ''}"
			aria-label="Open user menu for ${escapeHtml(labelName)}"
			aria-haspopup="menu"
			aria-expanded="false"
			title="Account"
		>
			<span id="header-user-avatar-content">
				${
					normalizedProfile.avatarUrl
						? `<img src="${escapeHtml(normalizedProfile.avatarUrl)}" alt="${escapeHtml(labelName)} avatar" class="header-profile-avatar-image" />`
						: `<span class="header-profile-avatar-fallback">${escapeHtml(initials)}</span>`
				}
			</span>
		</button>
	`;
};

const renderUserDropdown = (currentPath = '/') => `
	<div class="header-user-menu" id="header-user-menu">
		${renderHeaderAvatar(currentHeaderProfile, currentPath)}
		<div class="header-user-dropdown" id="header-user-menu-dropdown" role="menu" aria-label="User actions">
			<a class="header-user-dropdown-item${currentPath === '/profile' ? ' active' : ''}" href="/profile" data-link role="menuitem">
				<i class="bi bi-person" aria-hidden="true"></i>
				<span>Profile</span>
			</a>
			<button type="button" class="header-user-dropdown-item header-user-dropdown-item-logout" id="header-logout-btn" role="menuitem">
				<i class="bi bi-box-arrow-right" aria-hidden="true"></i>
				<span>Logout</span>
			</button>
		</div>
	</div>
`;

let clearUserMenuListeners = null;
let clearMobileNavListeners = null;
let currentHeaderProfile = normalizeProfileData();
let isProfileSyncListenerBound = false;

const getMainNavElements = () => ({
	collapseElement: document.querySelector('#main-nav'),
	navbarToggler: document.querySelector('.navbar-toggler[aria-controls="main-nav"]')
});

const isMainNavOpen = (collapseElement) =>
	collapseElement?.classList.contains('show') || collapseElement?.classList.contains('active');

const setMainNavExpandedState = (isExpanded) => {
	const { collapseElement, navbarToggler } = getMainNavElements();

	if (!collapseElement || !navbarToggler) {
		return;
	}

	collapseElement.classList.toggle('show', isExpanded);
	navbarToggler.classList.toggle('collapsed', !isExpanded);
	navbarToggler.setAttribute('aria-expanded', String(isExpanded));
};

const hideMainNavCollapse = () => {
	const { collapseElement } = getMainNavElements();

	if (!collapseElement || !isMainNavOpen(collapseElement)) {
		return;
	}

	setMainNavExpandedState(false);
};

const showMainNavCollapse = () => {
	const { collapseElement } = getMainNavElements();

	if (!collapseElement || isMainNavOpen(collapseElement)) {
		return;
	}

	setMainNavExpandedState(true);
};

const syncMainNavExpandedState = (isExpanded) => {
	setMainNavExpandedState(isExpanded);
};

const bindMobileNavListeners = () => {
	if (clearMobileNavListeners) {
		clearMobileNavListeners();
		clearMobileNavListeners = null;
	}

	const { collapseElement, navbarToggler } = getMainNavElements();

	if (!collapseElement || !navbarToggler) {
		return;
	}

	const onTogglerClick = (event) => {
		event.preventDefault();
		event.stopPropagation();

		const isExpanded = collapseElement.classList.contains('show');

		if (isExpanded) {
			hideMainNavCollapse();
			syncMainNavExpandedState(false);
			return;
		}

		showMainNavCollapse();
		syncMainNavExpandedState(true);
	};

	const onCollapseClick = (event) => {
		const navLink = event.target.closest('.nav-link[data-link]');
		const profileLink = event.target.closest('#header-user-menu-dropdown a[data-link]');
		const logoutButton = event.target.closest('#header-logout-btn');

		if (navLink || profileLink || logoutButton) {
			hideMainNavCollapse();
		}
	};

	navbarToggler.addEventListener('click', onTogglerClick);
	collapseElement.addEventListener('click', onCollapseClick);

	syncMainNavExpandedState(isMainNavOpen(collapseElement));

	clearMobileNavListeners = () => {
		navbarToggler.removeEventListener('click', onTogglerClick);
		collapseElement.removeEventListener('click', onCollapseClick);
	};
};

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

	if (clearUserMenuListeners) {
		clearUserMenuListeners();
		clearUserMenuListeners = null;
	}

	if (clearMobileNavListeners) {
		clearMobileNavListeners();
		clearMobileNavListeners = null;
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

	// Set auth actions
	logoutContainer.innerHTML = isAuthenticated
		? renderUserDropdown(currentPath)
		: renderGuestActions();

	bindMobileNavListeners();

	if (!isAuthenticated) {
		return;
	}

	const menuRoot = document.querySelector('#header-user-menu');
	const menuTrigger = document.querySelector('#header-user-menu-trigger');
	const menuDropdown = document.querySelector('#header-user-menu-dropdown');

	const logoutButton = document.querySelector('#header-logout-btn');
	const profileLink = menuDropdown?.querySelector('a[href="/profile"]');

	if (!menuRoot || !menuTrigger || !menuDropdown || !logoutButton) {
		return;
	}

	const openMenu = () => {
		menuTrigger.setAttribute('aria-expanded', 'true');
		menuDropdown.classList.add('is-open');
	};

	const closeMenu = () => {
		menuTrigger.setAttribute('aria-expanded', 'false');
		menuDropdown.classList.remove('is-open');
	};

	const toggleMenu = () => {
		if (menuDropdown.classList.contains('is-open')) {
			closeMenu();
			return;
		}

		openMenu();
	};

	const onTriggerClick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleMenu();
	};

	const onDocumentClick = (event) => {
		if (!menuRoot.contains(event.target)) {
			closeMenu();
		}
	};

	const onDocumentPointerDown = (event) => {
		if (!menuRoot.contains(event.target)) {
			closeMenu();
		}
	};

	const onEscapeKey = (event) => {
		if (event.key === 'Escape') {
			closeMenu();
		}
	};

	const onProfileClick = () => {
		closeMenu();
	};

	menuTrigger.addEventListener('click', onTriggerClick);
	document.addEventListener('click', onDocumentClick);
	document.addEventListener('pointerdown', onDocumentPointerDown);
	document.addEventListener('keydown', onEscapeKey);
	profileLink?.addEventListener('click', onProfileClick);

	logoutButton.addEventListener('click', async () => {
		try {
			closeMenu();

			if (isSupabaseConfigured && supabase) {
				const { error } = await supabase.auth.signOut();

				if (error) {
					throw error;
				}
			}

			sessionStorage.removeItem(ROLE_CACHE_KEY);
			currentHeaderProfile = normalizeProfileData();
			setHeaderActions(false, '/');
			showToast('Logged out safely', 'success');
			navigateTo('/');
		} catch (error) {
			showToast(error?.message || 'Unable to log out right now. Please try again.', 'error');
		}
	});

	clearUserMenuListeners = () => {
		menuTrigger.removeEventListener('click', onTriggerClick);
		document.removeEventListener('click', onDocumentClick);
		document.removeEventListener('pointerdown', onDocumentPointerDown);
		document.removeEventListener('keydown', onEscapeKey);
		profileLink?.removeEventListener('click', onProfileClick);
	};
};

const updateHeaderAvatarElement = (profileData = {}) => {
	const avatarContent = document.querySelector('#header-user-avatar-content');
	const profileTrigger = document.querySelector('#header-user-menu-trigger');

	if (!avatarContent || !profileTrigger) {
		return;
	}

	const normalizedProfile = normalizeProfileData(profileData);
	currentHeaderProfile = normalizedProfile;

	const initials = getInitials(normalizedProfile.fullName, normalizedProfile.email);
	const labelName = normalizedProfile.fullName || 'Profile';

	profileTrigger.setAttribute('aria-label', `Open user menu for ${labelName}`);

	if (normalizedProfile.avatarUrl) {
		avatarContent.innerHTML = `<img src="${escapeHtml(normalizedProfile.avatarUrl)}" alt="${escapeHtml(labelName)} avatar" class="header-profile-avatar-image" />`;
		return;
	}

	avatarContent.innerHTML = `<span class="header-profile-avatar-fallback">${escapeHtml(initials)}</span>`;
};

const bindProfileSyncListener = () => {
	if (isProfileSyncListenerBound) {
		return;
	}

	window.addEventListener(PROFILE_UPDATED_EVENT, (event) => {
		updateHeaderAvatarElement(event?.detail || {});
	});

	isProfileSyncListenerBound = true;
};

const fetchHeaderProfile = async (user) => {
	if (!user?.id) {
		return normalizeProfileData();
	}

	try {
		const { data, error } = await supabase
			.from('profiles')
			.select('full_name, email, avatar_url')
			.eq('id', user.id)
			.maybeSingle();

		if (error) {
			throw error;
		}

		return normalizeProfileData({
			fullName: data?.full_name || user.user_metadata?.full_name,
			email: data?.email || user.email,
			avatarUrl: data?.avatar_url
		});
	} catch (error) {
		return normalizeProfileData({
			fullName: user.user_metadata?.full_name,
			email: user.email,
			avatarUrl: ''
		});
	}
};

const getNavLinkClass = (isActive) => `nav-link${isActive ? ' active' : ''}`;

export const renderHeader = (currentPath = '/') => `
	<header class="main-header border-bottom bg-white">
		<nav class="navbar navbar-expand-lg container py-3">
			<a class="navbar-brand fw-semibold" href="/" data-link>SportSpot</a>
			<button
				class="navbar-toggler"
				type="button"
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
		currentHeaderProfile = normalizeProfileData();
		setHeaderActions(false, currentPath);
		return;
	}

	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session?.user?.id) {
		currentHeaderProfile = normalizeProfileData();
		setHeaderActions(false, currentPath);
		return;
	}

	bindProfileSyncListener();
	currentHeaderProfile = await fetchHeaderProfile(session.user);

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
