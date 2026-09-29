import { prisma } from '../prisma';
import { sendToUsers, broadcastToChannel } from './chatSocket';
import { Role } from '@prisma/client';

export type NotificationType =
  | 'GATE_UNANNOUNCED_ARRIVAL'
  | 'GATE_CHECKIN'
  | 'GATE_HANDOFF'
  | 'CHAT_MESSAGE'
  | 'EMERGENCY_SOS'
  | 'TICKET_CREATED'
  | 'NEW_TICKET'
  | 'TASK_ASSIGNED'
  | 'WORK_COMPLETED'
  | 'TICKET_VERIFIED'
  | 'ANNOUNCEMENT_PUBLISHED'
  | 'EMPLOYEE_VERIFICATION_REQUEST'
  | string;

export interface NotificationEventPayload {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  broadcastChannel?: string;
}

export interface NotificationOptions {
  sendPush?: boolean;
  sendWebSocket?: boolean;
  persist?: boolean;
}

export interface NotificationResult {
  persistedCount: number;
  pushDispatchedCount: number;
  wsDispatchedCount: number;
}

/**
 * Strips undefined properties recursively so Prisma JSON serialization succeeds.
 */
function sanitizeMetadata(obj?: Record<string, any>): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') return null;
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = sanitizeMetadata(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/**
 * Dispatches a notification across all channels: Database persistence, WebSockets, and Expo Push Notifications.
 */
export async function notifyUsers(
  userIds: string[],
  payload: NotificationEventPayload,
  options: NotificationOptions = {}
): Promise<NotificationResult> {
  const { sendPush = true, sendWebSocket = true, persist = true } = options;
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (!uniqueUserIds.length) {
    return { persistedCount: 0, pushDispatchedCount: 0, wsDispatchedCount: 0 };
  }

  const sanitizedMetadata = sanitizeMetadata(payload.metadata);
  let persistedCount = 0;
  let pushDispatchedCount = 0;
  let wsDispatchedCount = 0;

  // Query existing users in database for valid user IDs and push tokens
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, pushToken: true },
  });

  const validUserIds = existingUsers.map((u) => u.id);
  if (!validUserIds.length) {
    return { persistedCount: 0, pushDispatchedCount: 0, wsDispatchedCount: 0 };
  }

  // 1. Prisma DB Persistence
  if (persist) {
    try {
      const records = validUserIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        ...(sanitizedMetadata ? { metadata: sanitizedMetadata } : {}),
        readStatus: false,
      }));

      const created = await prisma.notification.createMany({
        data: records,
      });
      persistedCount = created.count;
    } catch (error) {
      console.error('Error persisting notification records:', error);
    }
  }

  // 2. Real-Time WebSocket Alerts
  if (sendWebSocket) {
    try {
      const eventData = {
        type: 'NOTIFICATION',
        notification: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          metadata: sanitizedMetadata,
          createdAt: new Date().toISOString(),
        },
      };

      sendToUsers(validUserIds, eventData);
      wsDispatchedCount = validUserIds.length;

      if (payload.broadcastChannel) {
        broadcastToChannel(payload.broadcastChannel, {
          ...eventData,
          channelId: payload.broadcastChannel,
        });
      }
    } catch (error) {
      console.error('Error broadcasting WebSocket notifications:', error);
    }
  }

  // 3. Expo Push Notification Dispatch
  if (sendPush) {
    try {
      const validTokens = existingUsers
        .map((u) => u.pushToken)
        .filter((token): token is string => Boolean(token && token.trim().length > 0));

      if (validTokens.length > 0) {
        const pushMessages = validTokens.map((to) => ({
          to,
          sound: 'default',
          title: payload.title,
          body: payload.message,
          data: {
            notificationType: payload.type,
            ...(sanitizedMetadata || {}),
          },
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushMessages),
        }).catch((err) => {
          console.error('Failed to send Expo push notification messages:', err);
        });

        pushDispatchedCount = validTokens.length;
      }
    } catch (error) {
      console.error('Error dispatching push notifications:', error);
    }
  }

  return { persistedCount, pushDispatchedCount, wsDispatchedCount };
}

/**
 * Notifies all active residents and owners linked to a unit.
 */
export async function notifyUnitResidents(
  unitId: string,
  payload: NotificationEventPayload,
  options?: NotificationOptions
): Promise<NotificationResult> {
  const [residencies, ownerships] = await Promise.all([
    prisma.unitResidency.findMany({
      where: { unitId, status: 'ACTIVE' },
      select: { userId: true },
    }),
    prisma.unitOwnership.findMany({
      where: { unitId, status: 'ACTIVE' },
      select: { userId: true },
    }),
  ]);

  const userIds = [...new Set([...residencies.map((r) => r.userId), ...ownerships.map((o) => o.userId)])];
  return notifyUsers(userIds, payload, options);
}

/**
 * Notifies all users having specific approved roles in a community.
 */
export async function notifyRoleInCommunity(
  communityId: string,
  roles: Role[],
  payload: NotificationEventPayload,
  options?: NotificationOptions
): Promise<NotificationResult> {
  const memberships = await prisma.membership.findMany({
    where: {
      communityId,
      role: { in: roles },
      status: 'APPROVED',
    },
    select: { userId: true },
  });

  const userIds = [...new Set(memberships.map((m) => m.userId))];
  return notifyUsers(userIds, payload, options);
}
