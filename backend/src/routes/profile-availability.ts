import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ResidentAvailabilityStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const availabilitySchema = z.object({
  status: z.nativeEnum(ResidentAvailabilityStatus),
  until: z.string().datetime().nullable().optional(),
});

router.get('/availability', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { availabilityStatus: true, availabilityUntil: true } });
    if (user.availabilityUntil && user.availabilityUntil <= new Date()) {
      const updated = await prisma.user.update({ where: { id: req.user!.userId }, data: { availabilityStatus: ResidentAvailabilityStatus.AVAILABLE, availabilityUntil: null }, select: { availabilityStatus: true, availabilityUntil: true } });
      return res.json({ availability: updated });
    }
    res.json({ availability: user });
  } catch (error) { next(error); }
});

router.patch('/availability', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = availabilitySchema.parse(req.body);
    const until = body.until ? new Date(body.until) : null;
    if (until && until <= new Date()) return res.status(400).json({ error: { message: 'The away-until date must be in the future.' } });
    if (body.status === ResidentAvailabilityStatus.AVAILABLE && until) return res.status(400).json({ error: { message: 'Available status cannot have an away-until date.' } });
    const availability = await prisma.user.update({ where: { id: req.user!.userId }, data: { availabilityStatus: body.status, availabilityUntil: body.status === ResidentAvailabilityStatus.AVAILABLE ? null : until }, select: { availabilityStatus: true, availabilityUntil: true } });
    res.json({ availability });
  } catch (error) { next(error); }
});

export default router;
