import { randomUUID } from 'crypto';
import { Router, Response, NextFunction } from 'express';
import { Role, MembershipStatus, OwnershipStatus, ResidencyStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { broadcastEmergencyAlert } from '../services/spaceBroadcast';
import { notifyUsers } from '../services/notificationService';

const router = Router();
router.use(requireAuth);

const createEmergencySchema = z.object({
  message: z.string().trim().min(3, 'Please describe the emergency.').max(500),
});

// Creates a durable emergency event in the existing EMERGENCY space and sends
// real in-app notifications to the household and on-duty community leadership.
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = createEmergencySchema.parse(req.body);
    const userId = req.user!.userId;
    const resident = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        residencies: { where: { status: ResidencyStatus.ACTIVE }, include: { unit: true } },
        ownerships: { where: { status: OwnershipStatus.ACTIVE }, include: { unit: true } },
        memberships: { where: { status: MembershipStatus.APPROVED }, include: { unit: true } },
      },
    });

    const unit = resident?.residencies[0]?.unit || resident?.ownerships[0]?.unit || resident?.memberships.find((membership) => membership.unit)?.unit;
    if (!resident || !unit) {
      return res.status(400).json({ error: { message: 'An active home is required before sending an SOS.' } });
    }

    const communityId = unit.communityId;
    const household = await prisma.user.findMany({
      where: {
        OR: [
          { residencies: { some: { unitId: unit.id, status: ResidencyStatus.ACTIVE } } },
          { ownerships: { some: { unitId: unit.id, status: OwnershipStatus.ACTIVE } } },
          { memberships: { some: { unitId: unit.id, status: MembershipStatus.APPROVED } } },
        ],
      },
      select: { id: true },
    });
    const escalation = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            communityId,
            status: MembershipStatus.APPROVED,
            role: { in: [Role.MANAGER, Role.LEADERSHIP] },
          },
        },
      },
      select: { id: true },
    });

    const eventId = randomUUID();
    const createdAt = new Date();
    const residentName = `${resident.firstName || 'Resident'} ${resident.lastName || ''}`.trim();
    const recipientIds = [...new Set([...household, ...escalation].map((recipient) => recipient.id))];
    const title = `Emergency SOS — Unit ${unit.unitNumber}`;
    const notificationMessage = `${residentName}: ${message}`;
    const metadata = {
      emergencyEventId: eventId,
      status: 'SENT',
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      residentId: userId,
      residentName,
      message,
      createdAt: createdAt.toISOString(),
    };

    await notifyUsers(recipientIds, {
      type: 'EMERGENCY_SOS',
      title,
      message: notificationMessage,
      metadata,
    });
    await broadcastEmergencyAlert(communityId, title, notificationMessage, metadata);

    res.status(201).json({
      id: eventId,
      status: 'SENT',
      createdAt: createdAt.toISOString(),
      notifiedRecipients: recipientIds.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
