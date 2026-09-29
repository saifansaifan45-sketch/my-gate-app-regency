import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireVerifiedResidence, AuthRequest } from '../middleware/auth';
import { TicketPriority, TicketStatus, Role, ResidencyStatus, OwnershipStatus } from '@prisma/client';
import { broadcastTicketCreated } from '../services/spaceBroadcast';
import { notifyUsers } from '../services/notificationService';

const router = Router();

router.use(requireAuth);

const createTicketSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  unitId: z.string().optional(),
});

// ----------------------------------------------------
// 1. POST /tickets (Resident/Owner raises ticket)
// ----------------------------------------------------
router.post('/', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, title, description, priority, unitId: explicitUnitId } = createTicketSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { unit: true, community: true } },
        residencies: { where: { status: ResidencyStatus.ACTIVE }, include: { unit: true } },
        ownerships: { where: { status: OwnershipStatus.ACTIVE }, include: { unit: true } },
      },
    });

    let targetUnitId = explicitUnitId;
    let targetCommunityId = user?.memberships[0]?.communityId || null;
    let unitNumber = user?.unitNumber || 'Unit';

    if (!targetUnitId) {
      if (user?.residencies && user.residencies[0]) {
        targetUnitId = user.residencies[0].unitId;
        unitNumber = user.residencies[0].unit.unitNumber;
        targetCommunityId = user.residencies[0].unit.communityId;
      } else if (user?.ownerships && user.ownerships[0]) {
        targetUnitId = user.ownerships[0].unitId;
        unitNumber = user.ownerships[0].unit.unitNumber;
        targetCommunityId = user.ownerships[0].unit.communityId;
      } else if (user?.memberships && user.memberships[0]?.unitId) {
        targetUnitId = user.memberships[0].unitId;
        unitNumber = user.memberships[0].unit?.unitNumber || unitNumber;
      }
    }

    if (!targetCommunityId) {
      const defaultComm = await prisma.community.findFirst();
      targetCommunityId = defaultComm?.id || null;
    }

    const ticket = await prisma.ticket.create({
      data: {
        residentId: userId,
        unitId: targetUnitId || null,
        communityId: targetCommunityId,
        category,
        title,
        description,
        priority: (priority as TicketPriority) || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
      },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
        unit: true,
      },
    });

    // Notify all active managers and leadership in the community
    const managers = await prisma.user.findMany({
      where: {
        OR: [
          { role: Role.MANAGER },
          { role: Role.LEADERSHIP },
          { memberships: { some: { role: { in: [Role.MANAGER, Role.LEADERSHIP] }, status: 'APPROVED' } } },
        ],
      },
    });

    await notifyUsers(
      managers.map((m) => m.id),
      {
        type: 'NEW_TICKET',
        title: 'New maintenance request',
        message: `${ticket.resident.firstName || 'Resident'} (${unitNumber}) reported: ${ticket.title}`,
        metadata: { ticketId: ticket.id, unitNumber },
      }
    );

    // Broadcast system event to Leadership & Community Spaces
    await broadcastTicketCreated({
      id: ticket.id,
      category: ticket.category,
      title: ticket.title,
      priority: ticket.priority,
      unitId: ticket.unitId,
      communityId: ticket.communityId,
      unitNumber,
      residentName: `${ticket.resident.firstName || 'Resident'} ${ticket.resident.lastName || ''}`.trim(),
    });

    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. POST /tickets/:id/verify (Resident verifies ticket)
// ----------------------------------------------------
router.post('/:id/verify', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const { decision, note } = req.body;
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      return res.status(400).json({ error: { message: 'Invalid decision' } });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    if (ticket.residentId !== userId) {
      return res.status(403).json({ error: { message: 'You can only verify your own tickets' } });
    }

    if (ticket.status !== TicketStatus.PENDING_RESIDENT_CONFIRMATION) {
      return res.status(400).json({ error: { message: 'Ticket is not awaiting verification' } });
    }

    const newStatus = decision === 'ACCEPTED' ? TicketStatus.CLOSED : TicketStatus.REOPENED;

    const [updatedTicket, verification] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
      }),
      prisma.ticketVerification.create({
        data: {
          ticketId,
          verifierId: userId,
          type: 'RESIDENT_CONFIRMATION',
          decision,
          note,
          createdByRole: 'RESIDENT',
        },
      }),
    ]);

    if (decision === 'REJECTED') {
      // Notify assigned worker if ticket is reopened
      const latestTask = ticket.tasks[0];
      if (latestTask && latestTask.assignedPersonnelId) {
        const personnel = await prisma.personnel.findUnique({ where: { id: latestTask.assignedPersonnelId } });
        if (personnel && personnel.userId) {
          await notifyUsers([personnel.userId], {
            type: 'TICKET_REOPENED',
            title: 'Task Reopened by Resident',
            message: `The resident marked the issue as still existing. Note: ${note || 'None'}`,
            metadata: { ticketId, taskId: latestTask.id },
          });
        }
      }
    } else if (ticket.communityId) {
      const escalationRecipients = await prisma.user.findMany({
        where: {
          memberships: {
            some: {
              communityId: ticket.communityId,
              status: 'APPROVED',
              role: { in: [Role.MANAGER, Role.LEADERSHIP] },
            },
          },
        },
        select: { id: true },
      });
      if (escalationRecipients.length > 0) {
        await notifyUsers(
          escalationRecipients.map((r) => r.id),
          {
            type: 'TICKET_CLOSED',
            title: `Ticket #${ticketId.slice(0, 6)} Closed`,
            message: `The resident confirmed that "${ticket.title}" is resolved.`,
            metadata: { ticketId, residentId: userId },
          }
        );
      }
    }

    res.json({ success: true, ticket: updatedTicket, verification });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. GET /tickets (Resident gets their tickets)
// ----------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tickets = await prisma.ticket.findMany({
      where: { residentId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        unit: true,
        verifications: { orderBy: { createdAt: 'desc' } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedPersonnel: {
              select: { id: true, name: true, phone: true, category: true },
            },
          },
        },
      },
    });

    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. GET /tickets/:id (Ticket detail with full workflow & property status)
// ----------------------------------------------------
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            unitNumber: true,
            phoneNumber: true,
            email: true,
            residencies: {
              where: { status: ResidencyStatus.ACTIVE },
              select: { relationshipType: true, unitId: true },
            },
            ownerships: {
              where: { status: OwnershipStatus.ACTIVE },
              select: { unitId: true },
            },
          },
        },
        unit: {
          include: {
            ownerships: {
              where: { status: OwnershipStatus.ACTIVE },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } } },
            },
            residencies: {
              where: { status: ResidencyStatus.ACTIVE },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } } },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedPersonnel: true,
            assignedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    // Determine occupancy relationship of creator
    const creatorResidency = ticket.resident.residencies.find((r) => r.unitId === ticket.unitId);
    const creatorOwnership = ticket.resident.ownerships.find((o) => o.unitId === ticket.unitId);

    const occupancyType = creatorResidency
      ? creatorResidency.relationshipType
      : creatorOwnership
      ? 'OWNER'
      : 'RESIDENT';

    res.json({
      ...ticket,
      occupancyType,
      unitOwners: ticket.unit?.ownerships.map((o) => o.user) || [],
      currentResidents: ticket.unit?.residencies.map((r) => ({ ...r.user, relationshipType: r.relationshipType })) || [],
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. DELETE /tickets/:id (Soft delete ticket with role context)
// ----------------------------------------------------
router.delete('/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    const isOwner = ticket.residentId === userId;
    const isManagement = userRole === Role.MANAGER || userRole === Role.LEADERSHIP;

    if (!isOwner && !isManagement) {
      return res.status(403).json({ error: { message: 'You do not have permission to delete this request' } });
    }

    const deletedBy = isManagement && !isOwner ? 'MANAGEMENT' : 'RESIDENT';

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        status: TicketStatus.CANCELLED,
      },
    });

    res.json({
      success: true,
      message: `Request marked as deleted by ${deletedBy === 'MANAGEMENT' ? 'Management' : 'Resident'}`,
      ticket: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
