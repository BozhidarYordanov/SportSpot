import './register.css';
import registerTemplate from './register.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../../components/toast/toast';

export const renderRegisterPage = () => registerTemplate;

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

const syncRegisterViewportHeight = () => {
  const registerPage = document.querySelector('.register-page');

  if (!registerPage) {
    return;
  }

  const headerHeight = getElementOuterHeight(document.querySelector('.main-header'));
  const footerHeight = getElementOuterHeight(document.querySelector('footer'));

  registerPage.style.setProperty('--register-header-height', `${headerHeight}px`);
  registerPage.style.setProperty('--register-footer-height', `${footerHeight}px`);
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

const validateRegisterForm = (fullNameInput, emailInput, phoneInput, passwordInput) => {
  const fullName = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  setFieldValidity(fullNameInput);
  setFieldValidity(emailInput);
  setFieldValidity(phoneInput);
  setFieldValidity(passwordInput);

  if (!fullName) {
    setFieldValidity(fullNameInput, 'Please enter your full name.');
    return { valid: false, message: 'Please enter your full name.' };
  }

  if (fullName.length < 2) {
    setFieldValidity(fullNameInput, 'Full name must be at least 2 characters.');
    return { valid: false, message: 'Full name must be at least 2 characters.' };
  }

  if (!email) {
    setFieldValidity(emailInput, 'Please enter your email address.');
    return { valid: false, message: 'Please enter your email address.' };
  }

  if (!isValidEmail(email)) {
    setFieldValidity(emailInput, 'Please enter a valid email address.');
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  if (!phone) {
    setFieldValidity(phoneInput, 'Please enter your phone number.');
    return { valid: false, message: 'Please enter your phone number.' };
  }

  if (!password) {
    setFieldValidity(passwordInput, 'Please enter your password.');
    return { valid: false, message: 'Please enter your password.' };
  }

  if (password.length < 6) {
    setFieldValidity(passwordInput, 'Password must be at least 6 characters.');
    return { valid: false, message: 'Password must be at least 6 characters.' };
  }

  if (getPasswordStrengthScore(password) < 3) {
    setFieldValidity(
      passwordInput,
      'Password is too weak. Use at least 6 characters with uppercase, lowercase, and a number or symbol.'
    );
    return {
      valid: false,
      message: 'Password is too weak. Use at least 6 characters with uppercase, lowercase, and a number or symbol.'
    };
  }

  return { valid: true, fullName, email, phone, password };
};

const setSubmitLoading = (buttonElement, isLoading) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = isLoading;
  buttonElement.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Creating account...</span>'
    : '<span class="register-submit-label">Create Account</span>';
};

function getPasswordStrengthScore(password) {
  if (!password) {
    return 0;
  }

  let score = 0;

  if (password.length >= 6) {
    score += 1;
  }

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  return score;
}

const setPasswordStrengthMeter = (meterElement, password = '') => {
  if (!meterElement) {
    return;
  }

  const score = getPasswordStrengthScore(password);
  const widths = ['0%', '25%', '50%', '75%', '100%'];
  const colors = ['#cbd5e1', '#ef4444', '#f59e0b', '#84cc16', '#22c55e'];

  meterElement.style.width = widths[score];
  meterElement.style.backgroundColor = colors[score];
};

export const initRegisterPage = () => {
  const formElement = document.querySelector('#register-form');
  const submitButton = document.querySelector('#register-submit');
  const feedbackElement = document.querySelector('#register-feedback');
  const fullNameInput = document.querySelector('#register-full-name');
  const emailInput = document.querySelector('#register-email');
  const phoneInput = document.querySelector('#register-phone');
  const passwordInput = document.querySelector('#register-password');
  const passwordToggleButton = document.querySelector('#register-password-toggle');
  const passwordStrengthFill = document.querySelector('#register-password-strength-fill');

  syncRegisterViewportHeight();
  if (!isResizeBound) {
    window.addEventListener('resize', syncRegisterViewportHeight);
    isResizeBound = true;
  }

  if (!formElement || !submitButton || !feedbackElement || !fullNameInput || !emailInput || !phoneInput || !passwordInput) {
    return;
  }

  const setFeedback = (message, isError = true) => {
    feedbackElement.textContent = message;
    feedbackElement.classList.toggle('text-danger', isError);
    feedbackElement.classList.toggle('text-success', !isError);
  };

  const clearValidationState = () => {
    setFeedback('', true);
    setFieldValidity(fullNameInput);
    setFieldValidity(emailInput);
    setFieldValidity(phoneInput);
    setFieldValidity(passwordInput);
    setPasswordStrengthMeter(passwordStrengthFill, passwordInput.value);
  };

  fullNameInput.addEventListener('input', () => {
    setFeedback('', true);
    setFieldValidity(fullNameInput);
  });

  emailInput.addEventListener('input', () => {
    setFeedback('', true);
    setFieldValidity(emailInput);
  });

  phoneInput.addEventListener('input', () => {
    setFeedback('', true);
    setFieldValidity(phoneInput);
  });

  passwordInput.addEventListener('input', () => {
    setFeedback('', true);
    setFieldValidity(passwordInput);
    setPasswordStrengthMeter(passwordStrengthFill, passwordInput.value);
  });

  passwordToggleButton?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    passwordToggleButton.setAttribute('aria-pressed', String(isHidden));
    passwordToggleButton.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');

    const iconElement = passwordToggleButton.querySelector('i');

    if (iconElement) {
      iconElement.classList.toggle('bi-eye', !isHidden);
      iconElement.classList.toggle('bi-eye-slash', isHidden);
    }
  });

  setPasswordStrengthMeter(passwordStrengthFill, passwordInput.value);

  if (!isSupabaseConfigured || !supabase) {
    submitButton.disabled = true;
    setFeedback(
      'Missing Supabase configuration. Please set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
    );
    return;
  }

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearValidationState();
    const validation = validateRegisterForm(fullNameInput, emailInput, phoneInput, passwordInput);

    if (!validation.valid) {
      setFeedback(validation.message);
      return;
    }

    setSubmitLoading(submitButton, true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: validation.email,
        password: validation.password,
        options: {
          data: {
            full_name: validation.fullName,
            phone: validation.phone
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data?.session) {
        showToast('Welcome to the club!', 'success');
        navigateTo('/dashboard');
        return;
      }

      setFeedback('Registration successful! Please check your email for confirmation.', false);
      showToast('Welcome to the club!', 'success');
      formElement.reset();
      setPasswordStrengthMeter(passwordStrengthFill, '');
    } catch (error) {
      const errorMessage = error?.message || 'Unable to register right now. Please try again.';
      setFeedback(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSubmitLoading(submitButton, false);
    }
  });
};
