import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// ----------------------------------------------------
// 1. GET /notifications (Get user's notifications)
// ----------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, readStatus: false },
    });

    res.json({ notifications, unreadCount });
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

export default router;
