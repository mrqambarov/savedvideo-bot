import { useState, useEffect, useCallback } from 'react';
import { dlApi, movieApi, adultApi, safe } from './api.js';

export function useResource(apiCall, interval = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data: res, error: err } = await safe(apiCall());
    if (err) setError(err);
    else setData(res);
    setLoading(false);
  }, [apiCall]);

  useEffect(() => {
    load();
    if (interval > 0) {
      const timer = setInterval(load, interval);
      return () => clearInterval(timer);
    }
  }, [load, interval]);

  return { data, loading, error, reload: load };
}

export function useStats() {
  const [dl, setDl] = useState(null);
  const [movie, setMovie] = useState(null);
  const [adult, setAdult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [dlRes, movieRes, adultRes] = await Promise.allSettled([
      safe(dlApi.get('/stats')),
      safe(movieApi.get('/stats')),
      safe(adultApi.get('/stats')),
    ]);

    if (dlRes.status === 'fulfilled' && dlRes.value.data) setDl(dlRes.value.data);
    if (movieRes.status === 'fulfilled' && movieRes.value.data) setMovie(movieRes.value.data);
    if (adultRes.status === 'fulfilled' && adultRes.value.data) setAdult(adultRes.value.data);
    
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { dl, movie, adult, loading, updatedAt, reload: load };
}


