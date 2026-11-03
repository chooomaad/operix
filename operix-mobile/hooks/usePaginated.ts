import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paginated } from '@/types/api';

/** Pagination infinie pour FlatList sur les endpoints Laravel `{ data, meta }`. */
export function usePaginated<T>(key: string, fetchPage: (page: number) => Promise<Paginated<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ref = useRef(fetchPage);
  ref.current = fetchPage;

  const load = useCallback(async (p: number, mode: 'initial' | 'refresh' | 'more') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await ref.current(p);
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(1, 'initial');
  }, [key, load]);

  return {
    items,
    loading,
    refreshing,
    error,
    refresh: () => load(1, 'refresh'),
    loadMore: () => (page < lastPage && !loading ? load(page + 1, 'more') : undefined),
  };
}
