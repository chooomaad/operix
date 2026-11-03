import { useCallback, useEffect, useState } from 'react';
import { offlineQueue, type QueuedItem } from '@/services/offlineQueue';
import { invalidate } from './useQuery';
import { useIsOnline } from './useNetwork';

/** Expose la file hors-ligne et la vide automatiquement au retour du réseau. */
export function useOfflineQueue() {
  const online = useIsOnline();
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void offlineQueue.list().then(setItems);
    return offlineQueue.subscribe(setItems);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const { sent } = await offlineQueue.flush();
      if (sent > 0) {
        invalidate('incidents');
        invalidate('near-miss');
        invalidate('dashboard');
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (online && items.length > 0 && !syncing) void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, items.length]);

  return { online, pending: items.length, syncing, sync };
}
