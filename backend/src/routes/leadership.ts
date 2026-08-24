import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { requireAuth, requireLeadership, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// All leadership routes require authentication and leadership role
router.use(requireAuth);
router.use(requireLeadership);

// ----------------------------------------------------
// 1. GET /leadership/managers/pending
// ----------------------------------------------------
router.get('/managers/pending', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pendingManagers = await prisma.membership.findMany({
      where: {
        role: Role.MANAGER,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            createdAt: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ pendingManagers });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. POST /leadership/managers/:id/approve
// ----------------------------------------------------
router.post('/managers/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership application not found' } });
    }

    if (membership.role !== Role.MANAGER) {
      return res.status(400).json({ error: { message: 'This application is not a manager application' } });
    }

    // 1. Approve membership
    const updatedMembership = await prisma.membership.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { user: true, community: true },
    });

    // 2. Promote user's role to MANAGER
    await prisma.user.update({
      where: { id: membership.userId },
      data: { role: Role.MANAGER },
    });

    // 3. Notify user
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'MANAGER_APPROVED',
        title: 'Manager Access Approved',
        message: 'Regency Salma leadership has approved your Operations Manager access.',
      },
    });

    res.json({
      success: true,
      message: `Approved ${membership.user.firstName || 'User'} as Operations Manager.`,
      membership: updatedMembership,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. POST /leadership/managers/:id/reject
// ----------------------------------------------------
router.post('/managers/:id/reject', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership application not found' } });
    }

    const updatedMembership = await prisma.membership.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'MANAGER_REJECTED',
        title: 'Manager Application Update',
        message: 'Your application for Manager access was not approved by leadership.',
      },
    });

    res.json({
      success: true,
      message: 'Manager application rejected.',
      membership: updatedMembership,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. GET /leadership/overview
// ----------------------------------------------------
router.get('/overview', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      activeManagersCount,
      activeWorkforceCount,
      pendingManagersCount,
      pendingWorkforceCount,
      totalPersonnelCount,
      activeTicketsCount,
      securityCount,
      maintenanceCount,
      housekeepingCount,
      otherCount,
      recentApprovals,
      recentAnnouncements,
    ] = await Promise.all([
      prisma.membership.count({ where: { role: Role.MANAGER, status: 'APPROVED' } }),
      prisma.membership.count({ where: { role: Role.WORKFORCE, status: 'APPROVED' } }),
      prisma.membership.count({ where: { role: Role.MANAGER, status: 'PENDING' } }),
      prisma.membership.count({ where: { role: Role.WORKFORCE, status: 'PENDING' } }),
      prisma.personnel.count({ where: { employmentStatus: 'ACTIVE' } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.personnel.count({ where: { category: 'SECURITY', employmentStatus: 'ACTIVE' } }),
      prisma.personnel.count({ where: { category: 'MAINTENANCE', employmentStatus: 'ACTIVE' } }),
      prisma.personnel.count({ where: { category: 'CLEANER', employmentStatus: 'ACTIVE' } }),
      prisma.personnel.count({ where: { category: 'OTHER', employmentStatus: 'ACTIVE' } }),
      prisma.membership.findMany({
        where: { status: 'APPROVED', role: { in: [Role.MANAGER, Role.WORKFORCE] } },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
          },
        },
      }),
      prisma.announcement.findMany({
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      }),
    ]);

    res.json({
      stats: {
        activeManagers: activeManagersCount,
        activeWorkforce: activeWorkforceCount,
        pendingManagers: pendingManagersCount,
        pendingWorkforce: pendingWorkforceCount,
        totalPersonnel: totalPersonnelCount,
        activeTickets: activeTicketsCount,
        workforceBreakdown: {
          security: securityCount,
          maintenance: maintenanceCount,
          housekeeping: housekeepingCount,
          other: otherCount,
        },
      },
      recentApprovals: recentApprovals.map((a) => ({
        id: a.id,
        role: a.role,
        userName: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || 'User',
        email: a.user.email,
        phone: a.user.phoneNumber,
        approvedAt: a.updatedAt,
      })),
      recentAnnouncements: recentAnnouncements.map((ann) => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        authorName: `${ann.author.firstName || ''} ${ann.author.lastName || ''}`.trim() || 'Leadership',
        createdAt: ann.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
