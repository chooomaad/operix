import { api } from './api';
import type { AppNotification, Paginated } from '@/types/api';

export const notificationsService = {
  list: (page = 1) => api.get<Paginated<AppNotification>>('/notifications', { params: { page, per_page: 30 } }).then((r) => r.data),
  unreadCount: () => api.get<{ count?: number; unread_count?: number }>('/notifications/unread-count').then((r) => r.data.count ?? r.data.unread_count ?? 0),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
