import { api } from './client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readStatus: boolean;
  metadata?: any;
  createdAt: string;
}

export const notificationsApi = {
  getNotifications: async (): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
    const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
    return res.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get<{ count: number }>('/notifications/unread-count');
    return res.data;
  },

  markRead: async (id: string): Promise<{ success: boolean; count: number }> => {
    const res = await api.patch<{ success: boolean; count: number }>(`/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async (): Promise<{ success: boolean; updatedCount: number }> => {
    const res = await api.patch<{ success: boolean; updatedCount: number }>('/notifications/read-all');
    return res.data;
  },
};
