import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Petit cache mémoire « stale-while-revalidate » : un écran revisité s'affiche
 * immédiatement avec la dernière donnée connue, puis se rafraîchit.
 */
const cache = new Map<string, unknown>();

export function invalidate(prefix: string): void {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

export function clearQueryCache(): void {
  cache.clear();
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | undefined>(() => (key ? (cache.get(key) as T | undefined) : undefined));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(key !== null && !cache.has(key));
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async (isRefresh: boolean) => {
      if (!key) return;
      if (isRefresh) setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        cache.set(key, result);
        setData(result);
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key],
  );

  useEffect(() => {
    if (!key) return;
    setData(cache.get(key) as T | undefined);
    setLoading(!cache.has(key));
    void run(false);
  }, [key, run]);

  const refresh = useCallback(() => run(true), [run]);
  return { data, error, loading, refreshing, refresh };
}
