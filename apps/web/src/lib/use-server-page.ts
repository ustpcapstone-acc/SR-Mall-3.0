"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The value a moment after it stops changing, so typing doesn't ask the server on every key. */
export function useDebounced<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** The current page, back to 1 whenever the search or a filter changes. */
export function usePageFor(...filters: unknown[]) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ key, page: 1 });
  if (state.key !== key) setState({ key, page: 1 });
  const setPage = (page: number) => setState({ key, page });
  return [state.key === key ? state.page : 1, setPage] as const;
}

type Result<D> = { success: true; data: D } | { success: false; error?: string };

/**
 * Loads from the server again whenever the query changes. An answer that arrives
 * after a newer request is ignored.
 */
export function useServerData<Q, D>(query: Q, fetcher: (query: Q) => Promise<Result<D>>, initial: D | null = null) {
  const [data, setData] = useState<D | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const request = useRef({ query, fetcher });
  request.current = { query, fetcher };

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await request.current.fetcher(request.current.query);
      if (id !== latest.current) return;
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || "Couldn't load this list.");
      }
    } catch {
      if (id === latest.current) setError("Couldn't load this list. Check your connection.");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  const key = JSON.stringify(query);
  useEffect(() => {
    void reload();
  }, [key, reload]);

  return { data, setData, error, loading, reload };
}
