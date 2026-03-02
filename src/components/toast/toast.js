import './toast.css';
import toastTemplate from './toast.html?raw';

const TOAST_DURATION_MS = 2000;
const TOAST_TYPES = {
  success: { icon: '✓' },
  error: { icon: '!' },
  info: { icon: 'ℹ' }
};

let toastElement;
let messageElement;
let iconElement;
let closeButton;
let progressElement;
let hideTimeoutId;

const ensureToastElements = () => {
  if (toastElement && messageElement && iconElement && closeButton && progressElement) {
    return;
  }

  const existingHost = document.querySelector('[data-app-toast-host]');

  if (existingHost) {
    toastElement = existingHost.querySelector('.app-toast');
    messageElement = existingHost.querySelector('[data-app-toast-message]');
    iconElement = existingHost.querySelector('[data-app-toast-icon]');
    closeButton = existingHost.querySelector('[data-app-toast-close]');
    progressElement = existingHost.querySelector('[data-app-toast-progress]');
  } else {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = toastTemplate.trim();
    const host = wrapper.firstElementChild;

    if (!host) {
      return;
    }

    document.body.append(host);

    toastElement = host.querySelector('.app-toast');
    messageElement = host.querySelector('[data-app-toast-message]');
    iconElement = host.querySelector('[data-app-toast-icon]');
    closeButton = host.querySelector('[data-app-toast-close]');
    progressElement = host.querySelector('[data-app-toast-progress]');
  }

  closeButton?.addEventListener('click', () => {
    hideToast();
  });
};

const resetProgressAnimation = () => {
  if (!progressElement) {
    return;
  }

  progressElement.style.animation = 'none';
  void progressElement.offsetWidth;
  progressElement.style.animation = '';
};

export const hideToast = () => {
  if (!toastElement) {
    return;
  }

  if (hideTimeoutId) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = undefined;
  }

  toastElement.classList.remove('is-visible');
  toastElement.setAttribute('aria-hidden', 'true');
};

export const showToast = (message, type = 'info') => {
  ensureToastElements();

  if (!toastElement || !messageElement || !iconElement) {
    return;
  }

  const normalizedType = TOAST_TYPES[type] ? type : 'info';

  toastElement.classList.remove('app-toast--success', 'app-toast--error', 'app-toast--info');
  toastElement.classList.add(`app-toast--${normalizedType}`);
  messageElement.textContent = String(message || '');
  iconElement.textContent = TOAST_TYPES[normalizedType].icon;

  resetProgressAnimation();

  toastElement.classList.add('is-visible');
  toastElement.setAttribute('aria-hidden', 'false');

  if (hideTimeoutId) {
    window.clearTimeout(hideTimeoutId);
  }

  hideTimeoutId = window.setTimeout(() => {
    hideToast();
  }, TOAST_DURATION_MS);
};
