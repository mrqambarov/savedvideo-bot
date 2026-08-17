import axios from 'axios';

const DEV_HOST = 'https://xitfilm.uz';
const isDev = import.meta.env.DEV;

export const dlApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/api` : '/api', headers: { 'X-Bot-Type': 'downloader' } });
export const movieApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/movies/api` : '/movies/api', headers: { 'X-Bot-Type': 'movie' } });
export const adultApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/adult/api` : '/adult/api', headers: { 'X-Bot-Type': 'adult' } });

const TOKENS = { dl: 'dlToken', movie: 'movieToken', adult: 'adultToken' };

function getAnyToken() {
  return localStorage.getItem(TOKENS.movie) || localStorage.getItem(TOKENS.dl) || localStorage.getItem(TOKENS.adult);
}

function attach(instance, key) {
  instance.interceptors.request.use((config) => {
    const t = localStorage.getItem(TOKENS[key]) || getAnyToken();
    if (t) config.headers['Authorization'] = `Bearer ${t}`;
    return config;
  });
  instance.interceptors.response.use(
    (r) => r,
    (err) => {
      // Do not automatically clear auth on individual 401s to prevent blank screens
      return Promise.reject(err);
    }
  );
}
attach(dlApi, 'dl');
attach(movieApi, 'movie');
attach(adultApi, 'adult');

export async function login(password) {
  try {
    const res = await dlApi.post('/login', { password });
    if (res.data?.require2FA) {
      return { require2FA: true, tempId: res.data.tempId };
    }
    if (res.data?.token) {
      localStorage.setItem(TOKENS.dl, res.data.token);
      localStorage.setItem(TOKENS.movie, res.data.token);
      localStorage.setItem(TOKENS.adult, res.data.token);
      return { success: true };
    }
    return { success: false, error: 'Token topilmadi' };
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'Kirishda xatolik';
    return { success: false, error: msg };
  }
}

export async function verifyOtp(tempId, otp) {
  try {
    const res = await dlApi.post('/verify-otp', { tempId, otp });
    if (res.data?.token) {
      localStorage.setItem(TOKENS.dl, res.data.token);
      localStorage.setItem(TOKENS.movie, res.data.token);
      localStorage.setItem(TOKENS.adult, res.data.token);
      return { success: true };
    }
    return { success: false, error: 'Tasdiqlash kodi noto\'g\'ri' };
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'OTP tasdiqlashda xato';
    return { success: false, error: msg };
  }
}

export function logout() {
  localStorage.removeItem(TOKENS.dl);
  localStorage.removeItem(TOKENS.movie);
  localStorage.removeItem(TOKENS.adult);
}

export function isLoggedIn() {
  return !!getAnyToken();
}

export async function safe(promise) {
  try {
    const res = await promise;
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e.response?.data?.error || e.message || 'Xatolik yuz berdi' };
  }
}

