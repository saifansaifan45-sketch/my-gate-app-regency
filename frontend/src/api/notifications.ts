import { api } from './client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readStatus: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreferences {
  gateAlerts: boolean;
  chatMessages: boolean;
  maintenanceUpdates: boolean;
  communityNotices: boolean;
  soundEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  gateAlerts: true,
  chatMessages: true,
  maintenanceUpdates: true,
  communityNotices: true,
  soundEnabled: true,
};

let cachedPreferences = { ...DEFAULT_PREFERENCES };

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

  getPreferences: async (): Promise<{ preferences: NotificationPreferences }> => {
    try {
      const res = await api.get<{ preferences: NotificationPreferences }>('/notifications/preferences');
      if (res.data?.preferences) {
        cachedPreferences = { ...res.data.preferences };
        return res.data;
      }
    } catch {
      // Fallback to local cache
    }
    return { preferences: { ...cachedPreferences } };
  },

  updatePreferences: async (
    updates: Partial<NotificationPreferences>
  ): Promise<{ preferences: NotificationPreferences }> => {
    cachedPreferences = { ...cachedPreferences, ...updates };
    try {
      const res = await api.patch<{ preferences: NotificationPreferences }>(
        '/notifications/preferences',
        cachedPreferences
      );
      if (res.data?.preferences) {
        return res.data;
      }
    } catch {
      // Return updated local cache
    }
    return { preferences: { ...cachedPreferences } };
  },
};
