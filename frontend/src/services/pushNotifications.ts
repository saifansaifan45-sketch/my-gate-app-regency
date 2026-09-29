import { Platform } from 'react-native';
import { api } from '../api/client';
import { storage } from '../api/storage';

export interface PushTokenPayload {
  token: string;
  deviceType: 'ios' | 'android' | 'web';
  deviceName?: string;
}

export interface NotificationPayload {
  id: string;
  type: 'GATE_ARRIVAL' | 'CHAT_MESSAGE' | 'EMERGENCY_SOS' | 'TICKET_UPDATE' | 'COMMUNITY_ANNOUNCEMENT' | 'GENERAL';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

type NotificationListener = (notification: NotificationPayload) => void;
type ResponseListener = (data: Record<string, unknown>) => void;

class PushNotificationService {
  private pushToken: string | null = null;
  private isRegistered = false;
  private notificationListeners = new Set<NotificationListener>();
  private responseListeners = new Set<ResponseListener>();

  public async registerForPushNotifications(): Promise<string | null> {
    if (this.pushToken && this.isRegistered) {
      return this.pushToken;
    }

    try {
      // Check stored token first
      const storedToken = await storage.getPushToken?.();
      if (storedToken) {
        this.pushToken = storedToken;
      }

      // Generate a client device token identifier if native expo-notifications is mocked or in dev
      if (!this.pushToken) {
        const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        const randomId = Math.random().toString(36).substring(2, 12);
        this.pushToken = `ExponentPushToken[regency-${platform}-${Date.now()}-${randomId}]`;
        if (storage.savePushToken) {
          await storage.savePushToken(this.pushToken);
        }
      }

      // Sync token to backend
      await this.syncTokenWithBackend(this.pushToken);
      this.isRegistered = true;
      return this.pushToken;
    } catch {
      return null;
    }
  }

  public async syncTokenWithBackend(token: string): Promise<boolean> {
    try {
      const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      await api.post('/notifications/push-token', {
        pushToken: token,
        deviceType,
      });
      return true;
    } catch {
      // Backend push token route may be optional in local dev
      return false;
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Broadcast in-app foreground notification event to banner listeners
   */
  public emitForegroundNotification(notification: NotificationPayload): void {
    this.notificationListeners.forEach((listener) => listener(notification));
  }

  /**
   * Broadcast notification action/tap navigation
   */
  public emitNotificationResponse(data: Record<string, unknown>): void {
    this.responseListeners.forEach((listener) => listener(data));
  }

  public onNotificationReceived(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  public onNotificationResponse(listener: ResponseListener): () => void {
    this.responseListeners.add(listener);
    return () => {
      this.responseListeners.delete(listener);
    };
  }
}

export const pushNotifications = new PushNotificationService();
