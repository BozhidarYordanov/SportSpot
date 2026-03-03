import './profile.css';
import profileTemplate from './profile.html?raw';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { navigateTo } from '../../router';
import { showToast } from '../../components/toast/toast';
import { getUserRole } from '../../components/header/header';

export const renderProfilePage = () => profileTemplate;

const state = {
  userId: null,
  profile: {
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: ''
  }
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

const setTextFeedback = (element, message = '', isError = true) => {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle('d-none', !message);
  element.classList.toggle('text-danger', Boolean(message) && isError);
  element.classList.toggle('text-success', Boolean(message) && !isError);
};

const setButtonLoading = (buttonElement, isLoading, idleLabel, loadingLabel) => {
  if (!buttonElement) {
    return;
  }

  buttonElement.disabled = isLoading;
  buttonElement.innerHTML = isLoading
    ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${loadingLabel}`
    : idleLabel;
};

const renderAvatar = ({ avatarUrl, fullName, email }) => {
  const imageElement = document.querySelector('#profile-avatar-image');
  const fallbackElement = document.querySelector('#profile-avatar-fallback');
  const initialsElement = document.querySelector('#profile-avatar-initials');
  const iconElement = document.querySelector('#profile-avatar-icon');

  if (!imageElement || !fallbackElement || !initialsElement || !iconElement) {
    return;
  }

  if (avatarUrl) {
    imageElement.src = avatarUrl;
    imageElement.classList.remove('d-none');
    fallbackElement.classList.add('d-none');
    return;
  }

  const initials = getInitials(fullName, email);
  const showInitials = initials.length > 0;

  initialsElement.textContent = initials;
  initialsElement.classList.toggle('d-none', !showInitials);
  iconElement.classList.toggle('d-none', showInitials);

  imageElement.removeAttribute('src');
  imageElement.classList.add('d-none');
  fallbackElement.classList.remove('d-none');
};

const populateProfileForm = (profile) => {
  const fullNameInput = document.querySelector('#profile-full-name');
  const emailInput = document.querySelector('#profile-email');
  const phoneInput = document.querySelector('#profile-phone');

  if (fullNameInput) {
    fullNameInput.value = profile.fullName || '';
  }

  if (emailInput) {
    emailInput.value = profile.email || '';
  }

  if (phoneInput) {
    phoneInput.value = profile.phone || '';
  }

  renderAvatar(profile);
};

const loadProfile = async (user) => {
  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('full_name, email, phone, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const fullName = String(profileRow?.full_name || user.user_metadata?.full_name || '').trim();
  const email = String(profileRow?.email || user.email || '').trim();
  const phone = String(profileRow?.phone || user.phone || user.user_metadata?.phone || '').trim();
  const avatarUrl = String(profileRow?.avatar_url || '').trim();

  state.profile = { fullName, email, phone, avatarUrl };
  populateProfileForm(state.profile);
};

const uploadAvatar = async (file, userId) => {
  const extension = String(file?.name || 'avatar.jpg').split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
    cacheControl: '3600',
    upsert: true
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = String(urlData?.publicUrl || '').trim();

  if (!publicUrl) {
    throw new Error('Avatar uploaded, but URL generation failed.');
  }

  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

  if (profileError) {
    throw profileError;
  }

  state.profile.avatarUrl = publicUrl;
  renderAvatar(state.profile);
  showToast('Photo uploaded!', 'success');
};

const bindPhotoUpload = () => {
  const fileInput = document.querySelector('#profile-photo-input');
  const triggerButton = document.querySelector('#profile-change-photo-btn');

  if (!fileInput || !triggerButton) {
    return;
  }

  triggerButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];

    if (!file || !state.userId) {
      return;
    }

    triggerButton.disabled = true;

    try {
      await uploadAvatar(file, state.userId);
    } catch (error) {
      showToast(error?.message || 'Unable to upload photo right now. Please try again.', 'error');
    } finally {
      triggerButton.disabled = false;
      fileInput.value = '';
    }
  });
};

const bindProfileForm = () => {
  const formElement = document.querySelector('#profile-details-form');
  const submitButton = document.querySelector('#profile-details-submit');
  const feedbackElement = document.querySelector('#profile-details-feedback');
  const fullNameInput = document.querySelector('#profile-full-name');
  const emailInput = document.querySelector('#profile-email');
  const phoneInput = document.querySelector('#profile-phone');

  if (!formElement || !submitButton || !fullNameInput || !emailInput || !phoneInput || !feedbackElement) {
    return;
  }

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();

    setTextFeedback(feedbackElement, '');

    if (fullName.length < 2) {
      setTextFeedback(feedbackElement, 'Full name must be at least 2 characters.');
      return;
    }

    if (!isValidEmail(email)) {
      setTextFeedback(feedbackElement, 'Please enter a valid email address.');
      return;
    }

    if (!phone) {
      setTextFeedback(feedbackElement, 'Please enter your phone number.');
      return;
    }

    setButtonLoading(submitButton, true, 'Save Changes', 'Saving...');

    try {
      const authPayload = {};

      if (email !== state.profile.email) {
        authPayload.email = email;
      }

      if (phone !== state.profile.phone) {
        authPayload.phone = phone;
      }

      if (Object.keys(authPayload).length > 0) {
        const { error: authUpdateError } = await supabase.auth.updateUser(authPayload);

        if (authUpdateError) {
          throw authUpdateError;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          phone
        })
        .eq('id', state.userId);

      if (profileError) {
        throw profileError;
      }

      state.profile.fullName = fullName;
      state.profile.email = email;
      state.profile.phone = phone;

      renderAvatar(state.profile);
      setTextFeedback(feedbackElement, 'Saved successfully.', false);
      showToast('Profile updated!', 'success');
    } catch (error) {
      const message = error?.message || 'Unable to update profile right now. Please try again.';
      setTextFeedback(feedbackElement, message);
      showToast(message, 'error');
    } finally {
      setButtonLoading(submitButton, false, 'Save Changes', 'Saving...');
    }
  });
};

const bindPasswordForm = () => {
  const formElement = document.querySelector('#profile-password-form');
  const submitButton = document.querySelector('#profile-password-submit');
  const feedbackElement = document.querySelector('#profile-password-feedback');
  const newPasswordInput = document.querySelector('#profile-new-password');
  const confirmPasswordInput = document.querySelector('#profile-confirm-password');

  if (!formElement || !submitButton || !feedbackElement || !newPasswordInput || !confirmPasswordInput) {
    return;
  }

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    setTextFeedback(feedbackElement, '');

    if (newPassword.length < 6) {
      setTextFeedback(feedbackElement, 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setTextFeedback(feedbackElement, 'Passwords do not match.');
      return;
    }

    setButtonLoading(submitButton, true, 'Change Password', 'Updating...');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      formElement.reset();
      setTextFeedback(feedbackElement, 'Password updated successfully.', false);
      showToast('Password changed!', 'success');
    } catch (error) {
      const message = error?.message || 'Unable to change password right now. Please try again.';
      setTextFeedback(feedbackElement, message);
      showToast(message, 'error');
    } finally {
      setButtonLoading(submitButton, false, 'Change Password', 'Updating...');
    }
  });
};

export const initProfilePage = async () => {
  if (!isSupabaseConfigured || !supabase) {
    showToast('Missing Supabase configuration. Please set your environment variables.', 'error');
    navigateTo('/login');
    return;
  }

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user?.id) {
      navigateTo('/login');
      return;
    }

    state.userId = user.id;

    await getUserRole(user.id);
    await loadProfile(user);

    bindPhotoUpload();
    bindProfileForm();
    bindPasswordForm();
  } catch (error) {
    showToast(error?.message || 'Unable to load your profile right now.', 'error');
  }
};
