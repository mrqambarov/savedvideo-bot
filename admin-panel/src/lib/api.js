import axios from 'axios';

const DEV_HOST = 'http://94.237.103.133';
const isDev = import.meta.env.DEV;

export const dlApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/api` : '/api' });
export const movieApi = axios.create({ baseURL: isDev ? `${DEV_HOST}/movies/api` : '/movies/api' });

const TOKENS = { dl: 'dlToken', movie: 'movieToken' };

function attach(instance, key) {
  instance.interceptors.request.use((config) => {
    const t = localStorage.getItem(TOKENS[key]);
    if (t) config.headers['Authorization'] = `Bearer ${t}`;
    return config;
  });
  instance.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response && err.response.status === 401) {
        localStorage.removeItem(TOKENS.dl);
        localStorage.removeItem(TOKENS.movie);
        window.dispatchEvent(new Event('auth-expired'));
      }
      return Promise.reject(err);
    }
  );
}
attach(dlApi, 'dl');
attach(movieApi, 'movie');

export async function login(password) {
  const [dl, movie] = await Promise.allSettled([
    dlApi.post('/login', { password }),
    movieApi.post('/login', { password }),
  ]);
  let ok = false;
  if (dl.status === 'fulfilled' && dl.value.data?.token) {
    localStorage.setItem(TOKENS.dl, dl.value.data.token);
    ok = true;
  }
  if (movie.status === 'fulfilled' && movie.value.data?.token) {
    localStorage.setItem(TOKENS.movie, movie.value.data.token);
    ok = true;
  }
  return ok;
}

export function logout() {
  localStorage.removeItem(TOKENS.dl);
  localStorage.removeItem(TOKENS.movie);
}

export function isLoggedIn() {
  return !!(localStorage.getItem(TOKENS.dl) || localStorage.getItem(TOKENS.movie));
}

export async function safe(promise) {
  try {
    const res = await promise;
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e.response?.data?.error || e.message || 'Xatolik yuz berdi' };
  }
}
