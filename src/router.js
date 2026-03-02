import { renderHeader, initHeader } from './components/header/header';
import { renderFooter } from './components/footer/footer';
import { renderIndexPage, initIndexPage } from './pages/index/index';
import { renderLoginPage, initLoginPage } from './pages/login/login';
import { renderRegisterPage, initRegisterPage } from './pages/register/register';
import { renderDashboardPage, initDashboardPage } from './pages/dashboard/dashboard';
import { renderClassesPage, initClassesPage } from './pages/classes/classes';
import { renderClassDetailsPage, initClassDetailsPage } from './pages/class-details/class-details';
import { renderSchedulePage, initSchedulePage } from './pages/schedule/schedule';
import { renderAdminPage, initAdminPage } from './pages/admin/admin';

let currentAppElement = null;

const routes = {
  '/': {
    render: renderIndexPage,
    init: initIndexPage
  },
  '/login': {
    render: renderLoginPage,
    init: initLoginPage
  },
  '/register': {
    render: renderRegisterPage,
    init: initRegisterPage
  },
  '/dashboard': {
    render: renderDashboardPage,
    init: initDashboardPage
  },
  '/classes': {
    render: renderClassesPage,
    init: initClassesPage
  },
  '/schedule': {
    render: renderSchedulePage,
    init: initSchedulePage
  },
  '/admin': {
    render: renderAdminPage,
    init: initAdminPage
  },
  '/class-details/:slug': {
    render: renderClassDetailsPage,
    init: initClassDetailsPage
  }
};

const resolvePath = (path) => {
  const normalizedPath = String(path || '').trim();

  if (normalizedPath === '') {
    return '/';
  }

  const withLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.replace(/\/+$/, '');
  }

  return withLeadingSlash;
};

const matchPath = (routePath, currentPath) => {
  const routeParts = routePath.split('/').filter(Boolean);
  const currentParts = currentPath.split('/').filter(Boolean);

  if (routeParts.length !== currentParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const currentPart = currentParts[index];

    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = decodeURIComponent(currentPart || '');
      continue;
    }

    if (routePart !== currentPart) {
      return null;
    }
  }

  return params;
};

const resolveRoute = (path) => {
  if (routes[path]) {
    return {
      route: routes[path],
      params: {}
    };
  }

  const dynamicRoutePath = Object.keys(routes).find((routePath) => routePath.includes(':') && matchPath(routePath, path));

  if (!dynamicRoutePath) {
    return {
      route: routes['/'],
      params: {}
    };
  }

  return {
    route: routes[dynamicRoutePath],
    params: matchPath(dynamicRoutePath, path) || {}
  };
};

const renderLayout = (appElement, path) => {
  const { route, params } = resolveRoute(path);

  appElement.innerHTML = `
    ${renderHeader(path)}
    <main class="container py-4" id="route-content">
      ${route.render()}
    </main>
    ${renderFooter()}
  `;

  initHeader();
  route.init({ params, path });
};

const navigate = (appElement, path, replace = false) => {
  const resolvedPath = resolvePath(path);

  if (replace) {
    window.history.replaceState({}, '', resolvedPath);
  } else {
    window.history.pushState({}, '', resolvedPath);
  }

  renderLayout(appElement, resolvedPath);
};

export const navigateTo = (path, replace = false) => {
  if (!currentAppElement) {
    return;
  }

  navigate(currentAppElement, path, replace);
};

export const initRouter = (appElement) => {
  currentAppElement = appElement;
  const initialPath = resolvePath(window.location.pathname || '/');
  renderLayout(appElement, initialPath);

  window.addEventListener('popstate', () => {
    renderLayout(appElement, resolvePath(window.location.pathname || '/'));
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-link]');

    if (!link) {
      return;
    }

    const href = link.getAttribute('href');

    if (!href || href.startsWith('http') || href.startsWith('#')) {
      return;
    }

    event.preventDefault();
    navigateTo(href);
  });
};
