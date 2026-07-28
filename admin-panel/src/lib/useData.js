import { useState, useEffect, useCallback, useRef } from 'react';
import { dlApi, movieApi, safe } from './api.js';

// Poll both bots' /stats endpoints. Returns combined state.
export function useStats(intervalMs = 20000) {
  const [dl, setDl] = useState(null);
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const first = useRef(true);

  const load = useCallback(async () => {
    const [d, m] = await Promise.all([safe(dlApi.get('/stats')), safe(movieApi.get('/stats'))]);
    if (d.data) setDl(d.data);
    if (m.data) setMovie(m.data);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; load(); }
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);

  return { dl, movie, loading, updatedAt, reload: load };
}

// Generic polled resource.
export function useResource(fetcher, intervalMs = 0, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fRef = useRef(fetcher);
  fRef.current = fetcher;

  const load = useCallback(async () => {
    const { data } = await safe(fRef.current());
    setData(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (intervalMs > 0) {
      const t = setInterval(load, intervalMs);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, reload: load, setData };
}
