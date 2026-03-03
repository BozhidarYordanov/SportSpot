const APP_TITLE = 'SportSpot';

const normalizePageName = (pageName) => String(pageName || '').trim();

export const setPageTitle = (pageName = '') => {
  const normalizedPageName = normalizePageName(pageName);

  if (!normalizedPageName) {
    document.title = APP_TITLE;
    return;
  }

  document.title = `${APP_TITLE} | ${normalizedPageName}`;
};
