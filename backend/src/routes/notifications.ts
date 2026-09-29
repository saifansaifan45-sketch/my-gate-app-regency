import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

export async function sendPushNotification(
  userIds: string[],
  payload: { title: string; body: string; data?: Record<string, any> }
) {
  try {
    if (!userIds.length) return;
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, pushToken: { not: null } },
      select: { pushToken: true },
    });

    const tokens = users.map((u) => u.pushToken).filter((t): t is string => Boolean(t));
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    }).catch((err) => {
      console.error('Failed to send Expo push notification:', err);
    });
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
  }
}

router.use(requireAuth);

// Older visitor notifications may have contained a plaintext OTP. Redact that
// shape at the read boundary so historical records cannot disclose credentials.
function redactSensitiveNotificationText(message: string): string {
  return message
    .replace(/\bOTP\s*:\s*\d{6}\b/gi, 'OTP: [redacted]')
    .replace(/\bOTP\s+(?:is|was)\s+\d{6}\b/gi, 'OTP [redacted]');
}

// ----------------------------------------------------
// 1. GET /notifications (Get user's notifications)
// ----------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      // Keep the page useful for active communities where the latest 50 can be
      // consumed by chat and gate activity alone.
      take: 100,
    });

    const safeNotifications = notifications.map((notification) => ({
      ...notification,
      message: redactSensitiveNotificationText(notification.message),
    }));

    const unreadCount = await prisma.notification.count({
      where: { userId, readStatus: false },
    });

    res.json({ notifications: safeNotifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. GET /notifications/unread-count
// ----------------------------------------------------
router.get('/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const count = await prisma.notification.count({
      where: { userId, readStatus: false },
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. PATCH /notifications/:id/read (Mark single as read)
// ----------------------------------------------------
router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing notification id' } });
    }
    const userId = req.user!.userId;

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readStatus: true },
    });

    res.json({ success: true, count: notification.count });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. PATCH /notifications/read-all (Mark all as read)
// ----------------------------------------------------
router.patch('/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const result = await prisma.notification.updateMany({
      where: { userId, readStatus: false },
      data: { readStatus: true },
    });

    res.json({ success: true, updatedCount: result.count });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 5. POST /notifications/push-token (Register device push token)
// ----------------------------------------------------
const pushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token cannot be empty'),
});

router.post('/push-token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { pushToken } = pushTokenSchema.parse(req.body);

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
