import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { notificationsService } from '@/services/notifications';
import { useQuery } from './useQuery';

export function useUnreadCount(): number {
  const q = useQuery('notifications:unread', notificationsService.unreadCount);
  useFocusEffect(
    useCallback(() => {
      void q.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  return q.data ?? 0;
}
