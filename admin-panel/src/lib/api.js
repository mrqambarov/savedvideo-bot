import axios from 'axios';

const DEV_HOST = 'http://94.237.103.133';
const isDev = import.meta.env.DEV;

export const dlApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/api` : '/api' });
export const movieApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/movies/api` : '/movies/api' });
export const adultApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/adult/api` : '/adult/api' });

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
  const [dl, movie, adult] = await Promise.allSettled([
    dlApi.post('/login', { password }),
    movieApi.post('/login', { password }),
    adultApi.post('/login', { password }),
  ]);
  
  let validToken = null;
  if (dl.status === 'fulfilled' && dl.value.data?.token) validToken = dl.value.data.token;
  if (movie.status === 'fulfilled' && movie.value.data?.token) validToken = movie.value.data.token;
  if (adult.status === 'fulfilled' && adult.value.data?.token) validToken = adult.value.data.token;

  if (validToken) {
    localStorage.setItem(TOKENS.dl, validToken);
    localStorage.setItem(TOKENS.movie, validToken);
    localStorage.setItem(TOKENS.adult, validToken);
    return true;
  }
  return false;
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

