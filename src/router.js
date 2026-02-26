import { renderHeader, initHeader } from './components/header/header';
import { renderFooter } from './components/footer/footer';
import { renderIndexPage, initIndexPage } from './pages/index/index';
import { renderLoginPage, initLoginPage } from './pages/login/login';
import { renderRegisterPage, initRegisterPage } from './pages/register/register';
import { renderDashboardPage, initDashboardPage } from './pages/dashboard/dashboard';

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
  }
};

const resolvePath = (path) => {
  if (path === '') {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const renderLayout = (appElement, path) => {
  const route = routes[path] ?? routes['/'];

  appElement.innerHTML = `
    ${renderHeader(path)}
    <main class="container py-4" id="route-content">
      ${route.render()}
    </main>
    ${renderFooter()}
  `;

  initHeader();
  route.init();
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
