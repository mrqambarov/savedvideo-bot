import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { isLoggedIn, logout as apiLogout } from '../lib/api.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const toast = useCallback((msg, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setAuthed(false);
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setAuthed(false);
    };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  return (
    <AppCtx.Provider value={{ authed, setAuthed, theme, toggleTheme, toast, toasts, logout }}>
      {children}
    </AppCtx.Provider>
  );
}
