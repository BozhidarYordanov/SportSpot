import './login.css';
import loginTemplate from './login.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../../components/toast/toast';

export const renderLoginPage = () => loginTemplate;

const getElementOuterHeight = (element) => {
  if (!element) {
    return 0;
  }

  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(styles.marginTop) || 0;
  const marginBottom = Number.parseFloat(styles.marginBottom) || 0;

  return rect.height + marginTop + marginBottom;
};

const syncLoginViewportHeight = () => {
  const loginPage = document.querySelector('.login-page');

  if (!loginPage) {
    return;
  }

  const headerHeight = getElementOuterHeight(document.querySelector('.main-header'));
  const footerHeight = getElementOuterHeight(document.querySelector('footer'));

  loginPage.style.setProperty('--login-header-height', `${headerHeight}px`);
  loginPage.style.setProperty('--login-footer-height', `${footerHeight}px`);
};

let isResizeBound = false;

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const setFieldValidity = (fieldElement, message = '') => {
  if (!fieldElement) {
    return;
  }

  fieldElement.setCustomValidity(message);

  if (message) {
    fieldElement.classList.add('is-invalid');
  } else {
    fieldElement.classList.remove('is-invalid');
  }
};

const validateLoginForm = (emailInput, passwordInput) => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setFieldValidity(emailInput);
  setFieldValidity(passwordInput);

  if (!email) {
    setFieldValidity(emailInput, 'Please enter your email address.');
    return { valid: false, message: 'Please enter your email address.' };
  }

  if (!isValidEmail(email)) {
    setFieldValidity(emailInput, 'Please enter a valid email address.');
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  if (!password) {
    setFieldValidity(passwordInput, 'Please enter your password.');
    return { valid: false, message: 'Please enter your password.' };
  }

  if (password.length < 6) {
    setFieldValidity(passwordInput, 'Password must be at least 6 characters.');
    return { valid: false, message: 'Password must be at least 6 characters.' };
  }

  return { valid: true, email, password };
};

const setSubmitLoading = (buttonElement, isLoading) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = isLoading;
  buttonElement.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Signing in...</span>'
    : '<span class="login-submit-label">Sign In</span>';
};

export const initLoginPage = () => {
  const formElement = document.querySelector('#login-form');
  const submitButton = document.querySelector('#login-submit');
  const feedbackElement = document.querySelector('#login-feedback');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');

  syncLoginViewportHeight();
  if (!isResizeBound) {
    window.addEventListener('resize', syncLoginViewportHeight);
    isResizeBound = true;
  }

  if (!formElement || !submitButton || !feedbackElement || !emailInput || !passwordInput) {
    return;
  }

  const clearValidationState = () => {
    feedbackElement.textContent = '';
    setFieldValidity(emailInput);
    setFieldValidity(passwordInput);
  };

  emailInput.addEventListener('input', () => {
    feedbackElement.textContent = '';
    setFieldValidity(emailInput);
  });

  passwordInput.addEventListener('input', () => {
    feedbackElement.textContent = '';
    setFieldValidity(passwordInput);
  });

  if (!isSupabaseConfigured || !supabase) {
    submitButton.disabled = true;
    feedbackElement.textContent =
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).';
    return;
  }

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearValidationState();
    const validation = validateLoginForm(emailInput, passwordInput);

    if (!validation.valid) {
      feedbackElement.textContent = validation.message;
      return;
    }

    setSubmitLoading(submitButton, true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password: validation.password
      });

      if (error) {
        throw error;
      }

      showToast('Login successful!', 'success');
      navigateTo('/dashboard');
    } catch (error) {
      const errorMessage = error?.message || 'Unable to sign in right now. Please try again.';
      feedbackElement.textContent = errorMessage;
      showToast(errorMessage, 'error');
    } finally {
      setSubmitLoading(submitButton, false);
    }
  });
};