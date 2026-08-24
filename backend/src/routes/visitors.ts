import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireVerifiedResidence, requireWorkforceOrManager, requireSecurityOrLeadership, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { VisitorStatus, VisitorType, ResidencyStatus, OwnershipStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = Router();

async function verifySecurityMembership(userId: string, communityId: string | null): Promise<boolean> {
  if (!communityId) return false;
  const mem = await prisma.membership.findFirst({
    where: { userId, communityId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'WORKFORCE'] } }
  });
  if (!mem) return false;
  if (mem.role === 'WORKFORCE') {
    const p = await prisma.personnel.findUnique({ where: { userId } });
    if (!p || p.category !== 'SECURITY' || p.employmentStatus === 'TERMINATED') return false;
  }
  return true;
}

router.use(requireAuth);

const createVisitorSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  purpose: z.string().optional(),
  vehicleNumber: z.string().optional(),
  visitorType: z.nativeEnum(VisitorType).default(VisitorType.GUEST),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  provider: z.string().optional(),
  orderReference: z.string().optional(),
  packageCount: z.number().int().optional(),
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Only GUEST visitors require OTP verification. CAB, DELIVERY, SERVICE never need OTP. */
function visitorRequiresOtp(visitor: { visitorType: VisitorType; otp: string | null }) {
  return visitor.visitorType === VisitorType.GUEST && Boolean(visitor.otp);
}

/** Determine if a visitor type should have OTP generated. Only GUEST gets OTP. */
function shouldGenerateOtp(visitorType: VisitorType): boolean {
  return visitorType === VisitorType.GUEST;
}

async function getResidentActiveUnit(userId: string) {
  const resident = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      residencies: { where: { status: ResidencyStatus.ACTIVE }, include: { unit: true } },
      ownerships: { where: { status: OwnershipStatus.ACTIVE }, include: { unit: true } },
    },
  });
  const unit = resident?.residencies[0]?.unit || resident?.ownerships[0]?.unit;
  return unit;
}

// Helper to verify visitor belongs to resident
async function getResidentVisitor(visitorId: string, userId: string) {
  const visitor = await prisma.visitor.findUnique({ where: { id: visitorId }, include: { unit: true } });
  if (!visitor) throw new Error('Visitor not found');
  const unit = await getResidentActiveUnit(userId);
  if (visitor.unitId !== unit?.id) throw new Error('Unauthorized to manage this visitor');
  return visitor;
}


// ----------------------------------------------------
// POST /visitors/unannounced (Gate Security)
// ----------------------------------------------------
router.post('/unannounced', requireSecurityOrLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const userId = req.user!.userId;
    const body = createVisitorSchema.parse(req.body);
    // require target unit
    const unitId = req.body.unitId;
    if (!unitId) return res.status(400).json({ error: { message: 'unitId is required for unannounced arrivals' } });
    
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || !(await verifySecurityMembership(userId, unit.communityId))) {
       return res.status(403).json({ error: { message: 'Not authorized for this community' } });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await prisma.visitor.findFirst({
      where: {
        unitId: unit!.id,
        visitorType: body.visitorType,
        provider: body.provider?.trim() || null,
        status: 'PENDING',
        createdAt: { gte: fiveMinutesAgo }
      }
    });

    if (existing) {
      return res.json({ success: true, visitor: existing });
    }

    const visitor = await prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          name: body.name?.trim() || body.provider?.trim() || 'Unannounced Arrival',
          phone: body.phone?.trim() || null,
          purpose: body.purpose?.trim() || 'Unannounced',
          provider: body.provider?.trim() || null,
          vehicleNumber: body.vehicleNumber?.trim() || null,
          visitorType: body.visitorType,
          status: 'PENDING',
          isPreApproved: false,
          createdById: userId,
          unitId: unit!.id,
          communityId: unit.communityId,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours validity for unannounced
        }
      });
      await tx.auditLog.create({
        data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'VISITOR_UNANNOUNCED_ARRIVAL', metadata: { visitorId: v.id } }
      });
      return v;
    });

    // Notify residents
    const residents = await prisma.user.findMany({
      where: {
        OR: [
          { residencies: { some: { unitId: unit!.id, status: 'ACTIVE' } } },
          { ownerships: { some: { unitId: unit!.id, status: 'ACTIVE' } } }
        ]
      }
    });

    for (const resident of residents) {
      await prisma.notification.create({
        data: {
          userId: resident.id,
          type: 'UNANNOUNCED_ARRIVAL',
          title: `${body.visitorType} at the Gate`,
          message: `${body.name} is waiting at the gate. Please approve or deny entry.`,
          metadata: { visitorId: visitor.id }
        }
      });
    }

    res.status(201).json({ success: true, visitor });
  } catch(error) {
    next(error);
  }
});

// ----------------------------------------------------
// 1. POST /visitors (Resident creates an expected visitor / pass - always pre-approved)
// ----------------------------------------------------
router.post('/', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const body = createVisitorSchema.parse(req.body);

    const unit = await getResidentActiveUnit(userId);
    if (!unit) {
      return res.status(403).json({ error: { message: 'Verified residence required.' } });
    }

    // All resident-created passes are pre-approved
    const initialStatus = VisitorStatus.APPROVED;
    let plaintextOtp: string | undefined;
    let hashedOtp: string | null = null;

    // Only GUEST visitors get OTP
    if (shouldGenerateOtp(body.visitorType)) {
      plaintextOtp = generateOtp();
      hashedOtp = await bcrypt.hash(plaintextOtp, 10);
    }

    const validFromDate = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntilDate = body.validUntil
      ? new Date(body.validUntil)
      : new Date(validFromDate.getTime() + 24 * 60 * 60 * 1000);

    const visitor = await prisma.visitor.create({
      data: {
        name: body.name?.trim() || body.provider?.trim() || 'Visitor',
        phone: body.phone?.trim() || null,
        purpose: body.purpose?.trim() || 'Visitor',
        vehicleNumber: body.vehicleNumber?.trim() || null,
        visitorType: body.visitorType,
        status: initialStatus,
        otp: hashedOtp,
        isPreApproved: true,
        createdById: userId,
        unitId: unit!.id,
        communityId: unit.communityId,
        validFrom: validFromDate,
        validUntil: validUntilDate,
        provider: body.provider ? body.provider.trim() : null,
        orderReference: body.orderReference ? body.orderReference.trim() : null,
        packageCount: body.packageCount ? body.packageCount : null,
      },
      include: { unit: true, createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } } },
    });

    const isGuest = visitor.visitorType === VisitorType.GUEST;
    await prisma.notification.create({
      data: {
        userId,
        type: 'VISITOR_PASS_CREATED',
        title: isGuest ? 'Guest Pass Generated' : 'Entry Pre-Approved',
        message: isGuest
          ? `Pass generated for ${visitor.name}. OTP: ${plaintextOtp}`
          : `${visitor.visitorType} pre-approved for ${visitor.name}. No OTP required.`,
        metadata: { visitorId: visitor.id },
      },
    });
    
    await prisma.auditLog.create({
      data: {
        communityId: unit.communityId!,
        actorId: req.user!.userId,
        action: 'VISITOR_CREATED',
        metadata: { visitorId: visitor.id, type: visitor.visitorType, status: initialStatus }
      }
    });

    const { otp: _, ...visitorData } = visitor;
    res.status(201).json({ visitor: { ...visitorData, otp: plaintextOtp } });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// 2. GET /visitors (Resident gets their unit's visitors)
// ----------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { status, type } = req.query;

    const unit = await getResidentActiveUnit(userId);
    if (!unit) {
      return res.json({ visitors: [] });
    }

    const where: any = { unitId: unit!.id };
    if (status && typeof status === 'string') {
      where.status = status as VisitorStatus;
    }
    if (type && typeof type === 'string') {
      where.visitorType = type as VisitorType;
    }

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });
    
    const sanitized = visitors.map(v => {
      const { otp: _otp, ...rest } = v;
      return { ...rest, requiresOtp: visitorRequiresOtp(v) };
    });

    res.json({ visitors: sanitized });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------

// ----------------------------------------------------
// GET /visitors/history (Manager)
// ----------------------------------------------------
router.get('/history', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const manager = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'APPROVED', role: { in: ['MANAGER', 'LEADERSHIP'] } } } }
    });
    
    const communityId = manager?.memberships[0]?.communityId;
    if (!communityId) return res.status(403).json({ error: { message: 'Unauthorized.' } });

    const visitors = await prisma.visitor.findMany({
      where: { communityId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });
    
    const sanitized = visitors.map(v => {
      const { otp: _otp, ...rest } = v;
      return { ...rest, requiresOtp: visitorRequiresOtp(v) };
    });
    res.json({ visitors: sanitized });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 3. GET /visitors/gate (Gate / Security / Manager overview)
// ----------------------------------------------------
router.get('/gate', requireSecurityOrLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { unitLabel } = req.query; // optional lookup
    
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'WORKFORCE'] } }
    });
    const communityId = ((req.query.communityId as string)) || membership?.communityId;
    if (!communityId) {
      return res.status(403).json({ error: { message: 'Unauthorized.' } });
    }
    
    // Verify explicitly
    const hasAccess = await verifySecurityMembership(userId, communityId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Unauthorized for this community.' } });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const visitors = await prisma.visitor.findMany({
      where: {
        communityId,
        ...(unitLabel && typeof unitLabel === 'string' ? { unit: { unitNumber: unitLabel.toUpperCase() } } : {}),
        OR: [
          { status: { in: ['PENDING', 'APPROVED', 'CHECKED_IN'] } },
          { updatedAt: { gte: startOfToday } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });
    
    const sanitized = visitors.map(v => {
      const { otp: _otp, ...rest } = v;
      // The hash never leaves the server. The gate only needs to know whether to request a code.
      return { ...rest, requiresOtp: visitorRequiresOtp(v) };
    });

    const pending = sanitized.filter((v) => v.status === VisitorStatus.PENDING);
    const approved = sanitized.filter((v) => v.status === VisitorStatus.APPROVED);
    const checkedIn = sanitized.filter((v) => v.status === VisitorStatus.CHECKED_IN);
    const checkedOut = sanitized.filter((v) => v.status === VisitorStatus.CHECKED_OUT);
    const expired = sanitized.filter((v) => v.status === VisitorStatus.EXPIRED);

    res.json({
      summary: {
        totalToday: sanitized.length,
        pending: pending.length,
        approved: approved.length,
        checkedIn: checkedIn.length,
        checkedOut: checkedOut.length,
        expired: expired.length,
      },
      visitors: sanitized,
      pending,
      approved,
      checkedIn,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ---



// ----------------------------------------------------
// GET /visitors/:id/audit (Manager)
// ----------------------------------------------------
router.get('/:id/audit', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const userId = req.user!.userId;
    const manager = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'APPROVED', role: { in: ['MANAGER', 'LEADERSHIP'] } } } }
    });
    
    const communityId = manager?.memberships[0]?.communityId;
    if (!communityId) return res.status(403).json({ error: { message: 'Unauthorized.' } });

    const visitor = await prisma.visitor.findUnique({
      where: { id: visitorId },
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });
    
    if (!visitor || visitor.communityId !== communityId) return res.status(404).json({ error: { message: 'Visitor not found' } });
    
    const auditLogs = await prisma.auditLog.findMany({
      where: { communityId, metadata: { path: ['visitorId'], equals: visitor.id } },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { firstName: true, lastName: true, role: true } } }
    });

    const { otp: _otp, ...rest } = visitor;
    res.json({ visitor: rest, auditLogs });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/approve (Resident approves unannounced arrival)
// ----------------------------------------------------
router.post('/:id/approve', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const visitor = await getResidentVisitor(visitorId, req.user!.userId);
    if (visitor.status === VisitorStatus.APPROVED) {
      return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(visitor) });
    }
    if (visitor.status !== VisitorStatus.PENDING) {
      return res.status(400).json({ error: { message: 'Visitor is already in a terminal state: ' + visitor.status } });
    }
    
    // Only GUEST visitors get OTP when approved (for both unannounced and resident's own)
    let plaintextOtp: string | null = null;
    let hashedOtp: string | null = null;
    
    if (shouldGenerateOtp(visitor.visitorType)) {
      plaintextOtp = generateOtp();
      hashedOtp = await bcrypt.hash(plaintextOtp, 10);
    }
    
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, status: 'PENDING' },
        data: { status: 'APPROVED', otp: hashedOtp, isPreApproved: true },
      });
      if (updateResult.count === 0) {
        throw new Error('CONCURRENCY_ERROR');
      }

      const v = (await tx.visitor.findUnique({
        where: { id: visitorId },
        include: { unit: true }
      }))!;

      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_APPROVED', metadata: { visitorId: v.id } }
      });

      // Notify all residents of the unit
      if (v.unitId) {
        const residents = await tx.user.findMany({
          where: {
            OR: [
              { residencies: { some: { unitId: v.unitId, status: 'ACTIVE' } } },
              { ownerships: { some: { unitId: v.unitId, status: 'ACTIVE' } } }
            ]
          }
        });
        for (const resident of residents) {
          if (resident.id === req.user!.userId) continue;
          await tx.notification.create({
            data: {
              userId: resident.id,
              type: 'VISITOR_APPROVED',
              title: `${v.visitorType} Approved`,
              message: shouldGenerateOtp(v.visitorType)
                ? `${v.name}'s entry approved. OTP: ${plaintextOtp}`
                : `${v.name}'s entry approved. No OTP required.`,
              metadata: { visitorId: v.id }
            }
          });
        }
      }
      return v;
    });

    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: { ...visitorData, otp: plaintextOtp || undefined } });
  } catch (error: any) {
    if (error.message === 'Visitor not found') return res.status(404).json({ error: { message: 'Not found' } });
    if (error.message.includes('Unauthorized')) return res.status(403).json({ error: { message: 'Unauthorized' } });
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/reject (Resident)
// ----------------------------------------------------
router.post('/:id/reject', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const visitor = await getResidentVisitor(visitorId, req.user!.userId);
    if (visitor.status === VisitorStatus.REJECTED) {
      return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(visitor) });
    }
    if (visitor.status !== VisitorStatus.PENDING) {
      return res.status(400).json({ error: { message: 'Visitor is already in a terminal state: ' + visitor.status } });
    }
    const reason = req.body.reason?.trim() || null;
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, status: 'PENDING' },
        data: { status: 'REJECTED' }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');
      const v = (await tx.visitor.findUnique({ where: { id: visitorId } }))!;
      await tx.auditLog.create({ data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_REJECTED', metadata: { visitorId: v.id, reason } } });
      return v;
    });
    res.json({ success: true, visitor: updated });
  } catch (error: any) {
    if (error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       if (current?.status === 'APPROVED') return res.json({ success: true, visitor: current });
       return res.status(409).json({ error: { message: `Conflict: visitor is ${current?.status}` } });
    }
    if (error.message === 'Visitor not found') return res.status(404).json({ error: { message: 'Not found' } });
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/revoke (Resident)
// ----------------------------------------------------
router.post('/:id/revoke', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const visitor = await getResidentVisitor(visitorId, req.user!.userId);
    if (visitor.status !== VisitorStatus.APPROVED && visitor.status !== VisitorStatus.PENDING) {
      return res.status(400).json({ error: { message: 'Only PENDING or APPROVED visitors can be revoked' } });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'REVOKED' }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');
      const v = (await tx.visitor.findUnique({ where: { id: visitorId } }))!;
      await tx.auditLog.create({ data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_REVOKED', metadata: { visitorId: v.id } } });
      return v;
    });
    res.json({ success: true, visitor: updated });
  } catch (error: any) {
    if (error.message === 'Visitor not found') return res.status(404).json({ error: { message: 'Not found' } });
    next(error);
  }
});


// ----------------------------------------------------
// POST /visitors/:id/suggest-handoff (Resident)
// ----------------------------------------------------
const suggestHandoffSchema = z.object({
  recipientType: z.enum(['RESIDENT', 'GATE', 'LOCKER']),
  recipientName: z.string().optional()
});

router.post('/:id/suggest-handoff', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const body = suggestHandoffSchema.parse(req.body);
    const visitor = await getResidentVisitor(visitorId, req.user!.userId);
    
    if (visitor.visitorType !== 'DELIVERY') {
      return res.status(400).json({ error: { message: 'Only deliveries can have handoff suggestions' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, handoffTimestamp: null },
        data: {
          handoffRecipientType: body.recipientType,
          handoffRecipientName: body.recipientName ? body.recipientName : null,
          handoffTimestamp: new Date(),
          handoffActorId: req.user!.userId,
          handoffProofReference: null,
        }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');

      const v = (await tx.visitor.findUnique({ where: { id: visitorId } }))!;

      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'DELIVERY_HANDOFF', metadata: { visitorId: v.id, recipientType: body.recipientType } }
      });
      if (v.otp === null && v.unitId) {
        // Unannounced arrival: notify all residents
        const residents = await tx.user.findMany({
          where: {
            OR: [
              { residencies: { some: { unitId: v.unitId, status: 'ACTIVE' } } },
              { ownerships: { some: { unitId: v.unitId, status: 'ACTIVE' } } }
            ]
          }
        });
        for (const resident of residents) {
          await tx.notification.create({
            data: {
              userId: resident.id,
              type: 'DELIVERY_HANDOFF',
              title: 'Delivery Handed Off',
              message: `Your delivery from ${v.provider || v.name} was handed off to ${body.recipientType}.`,
              metadata: { visitorId: v.id, recipientType: body.recipientType }
            }
          });
        }
      } else {
        await tx.notification.create({
          data: {
            userId: v.createdById,
            type: 'DELIVERY_HANDOFF',
            title: 'Delivery Handed Off',
            message: `Your delivery from ${v.provider || v.name} was handed off to ${body.recipientType}.`,
            metadata: { visitorId: v.id, recipientType: body.recipientType }
          }
        });
      }
      return v;
    });
    
    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: visitorData });
  } catch(error: any) {
    if (error.message === 'Visitor not found' || error.message === 'Unauthorized to manage this visitor') return res.status(404).json({ error: { message: 'Not found' } });
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/check-in (Gate / Manager)
// ----------------------------------------------------

const checkInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { error: { message: 'Too many check-in attempts from this IP, please try again later.' } }
});

const checkInSchema = z.object({
  otp: z.string().optional()
});
router.post('/:id/check-in', requireSecurityOrLeadership, checkInLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const { otp } = checkInSchema.parse(req.body);
    const userId = req.user!.userId;
    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || !(await verifySecurityMembership(userId, visitor.communityId))) {
      return res.status(404).json({ error: { message: 'Visitor not found' } });
    }
    if (visitor.status === VisitorStatus.CHECKED_IN) return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(visitor) });
    if (visitor.status !== VisitorStatus.APPROVED) return res.status(400).json({ error: { message: 'Visitor is not approved for entry' } });
    if (visitor.validUntil && new Date() > new Date(visitor.validUntil)) return res.status(400).json({ error: { message: 'Pass expired' } });

    if (visitorRequiresOtp(visitor) && visitor.otp) {
      if (!otp) return res.status(400).json({ error: { message: 'OTP is required' } });
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: { message: 'Enter the six-digit OTP for this pass' } });
      }
      const isValid = await bcrypt.compare(otp, visitor.otp);
      if (!isValid) return res.status(400).json({ error: { message: 'Invalid OTP' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, status: 'APPROVED' },
        data: { status: 'CHECKED_IN', checkInTime: new Date() }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');

      const v = (await tx.visitor.findUnique({ where: { id: visitorId }, include: { unit: true } }))!;
      
      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_CHECK_IN', metadata: { visitorId: v.id } }
      });
      if (v.otp === null && v.unitId) {
        // Unannounced arrival: notify all residents
        const residents = await tx.user.findMany({
          where: {
            OR: [
              { residencies: { some: { unitId: v.unitId, status: 'ACTIVE' } } },
              { ownerships: { some: { unitId: v.unitId, status: 'ACTIVE' } } }
            ]
          }
        });
        for (const resident of residents) {
          await tx.notification.create({
            data: {
              userId: resident.id,
              type: 'VISITOR_ARRIVAL',
              title: `${v.visitorType === 'DELIVERY' ? 'Delivery' : v.visitorType === 'CAB' ? 'Cab' : 'Visitor'} Arrived`,
              message: `${v.name} has arrived at the gate and checked in.`,
              metadata: { visitorId: v.id }
            }
          });
        }
      } else {
        await tx.notification.create({
          data: {
            userId: v.createdById,
            type: 'VISITOR_ARRIVAL',
            title: `${v.visitorType === 'DELIVERY' ? 'Delivery' : v.visitorType === 'CAB' ? 'Cab' : 'Visitor'} Arrived`,
            message: `${v.name} has arrived at the gate and checked in.`,
            metadata: { visitorId: v.id }
          }
        });
      }
      return v;
    });

    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: visitorData });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current } });
    }
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/check-out (Gate / Manager)
// ----------------------------------------------------
router.post('/:id/check-out', requireSecurityOrLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const userId = req.user!.userId;
    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || !(await verifySecurityMembership(userId, visitor.communityId))) {
      return res.status(404).json({ error: { message: 'Visitor not found' } });
    }
    if (visitor.status === VisitorStatus.CHECKED_OUT) return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(visitor) });
    if (visitor.status !== VisitorStatus.CHECKED_IN) return res.status(400).json({ error: { message: 'Visitor is not checked in' } });

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, status: 'CHECKED_IN' },
        data: { status: 'CHECKED_OUT', checkOutTime: new Date() }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');
      
      const v = (await tx.visitor.findUnique({ where: { id: visitorId } }))!;
      
      if (v.visitorType === 'DELIVERY' && !v.handoffTimestamp) {
        await tx.auditLog.create({
          data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'DELIVERY_CHECKOUT_EXCEPTION', metadata: { visitorId: v.id, reason: 'Checked out without recorded handoff' } }
        });
      }
      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_CHECK_OUT', metadata: { visitorId: v.id } }
      });
      return v;
    });

    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: visitorData });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current } });
    }
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/handoff (Gate / Manager)
// ----------------------------------------------------
const handoffSchema = z.object({
  recipientType: z.enum(['RESIDENT', 'GATE', 'LOCKER']),
  recipientName: z.string().optional(),
  proofReference: z.string().optional()
});
router.post('/:id/handoff', requireSecurityOrLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = req.params.id;
    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    }
    const body = handoffSchema.parse(req.body);
    const userId = req.user!.userId;
    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || !(await verifySecurityMembership(userId, visitor.communityId))) {
      return res.status(404).json({ error: { message: 'Visitor not found' } });
    }
    if (visitor.handoffTimestamp) {
      return res.status(400).json({ error: { message: 'Handoff already completed' } });
    }
    if (visitor.visitorType !== VisitorType.DELIVERY) return res.status(400).json({ error: { message: 'Only deliveries can be handed off' } });
    if (visitor.status !== VisitorStatus.CHECKED_IN) return res.status(400).json({ error: { message: 'Delivery must be checked in first' } });

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.visitor.update({
        where: { id: visitorId },
        data: {
          handoffRecipientType: body.recipientType,
          handoffRecipientName: body.recipientName ? body.recipientName : null,
          handoffTimestamp: new Date(),
          handoffActorId: req.user!.userId,
          handoffProofReference: body.proofReference ? body.proofReference : null
        },
      });
      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'DELIVERY_HANDOFF', metadata: { visitorId: v.id, recipientType: body.recipientType } }
      });
      
      if (v.otp === null && v.unitId) {
        // Unannounced arrival: notify all residents
        const residents = await tx.user.findMany({
          where: {
            OR: [
              { residencies: { some: { unitId: v.unitId, status: 'ACTIVE' } } },
              { ownerships: { some: { unitId: v.unitId, status: 'ACTIVE' } } }
            ]
          }
        });
        for (const resident of residents) {
          await tx.notification.create({
            data: {
              userId: resident.id,
              type: 'DELIVERY_HANDOFF',
              title: 'Delivery Handed Off',
              message: `Your delivery from ${v.provider || v.name} was handed off to ${body.recipientType}.`,
              metadata: { visitorId: v.id, recipientType: body.recipientType }
            }
          });
        }
      } else {
        await tx.notification.create({
          data: {
            userId: v.createdById,
            type: 'DELIVERY_HANDOFF',
            title: 'Delivery Handed Off',
            message: `Your delivery from ${v.provider || v.name} was handed off to ${body.recipientType}.`,
            metadata: { visitorId: v.id, recipientType: body.recipientType }
          }
        });
      }

      return v;
    });

    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: visitorData });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current } });
    }
    console.error(error);
    next(error);
  }
});


// ----------------------------------------------------
// GET /visitors/gate/activity (Watchman Activity Log)
// ----------------------------------------------------
router.get('/gate/activity', requireSecurityOrLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { unitLabel, type } = req.query;
    
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'WORKFORCE'] } }
    });
    const communityId = ((req.query.communityId as string)) || membership?.communityId;
    if (!communityId || !(await verifySecurityMembership(userId, communityId))) {
      return res.status(403).json({ error: { message: 'Unauthorized.' } });
    }

    const whereClause: any = {
      communityId,
      action: {
        in: [
          'VISITOR_UNANNOUNCED_ARRIVAL',
          'VISITOR_APPROVED',
          'VISITOR_REJECTED',
          'VISITOR_CHECK_IN',
          'VISITOR_CHECK_OUT',
          'VISITOR_HANDOFF_SUGGESTED',
          'VISITOR_REVOKED',
          'DELIVERY_HANDOFF',
          'DELIVERY_CHECKOUT_EXCEPTION'
        ]
      }
    };
    
    if (type && typeof type === 'string') {
      whereClause.action = type;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });

    // To get unit details, we must fetch the visitors associated with these logs
    const visitorIds = [...new Set(logs.map(l => (l.metadata as any)?.visitorId).filter(Boolean))];
    const visitors = await prisma.visitor.findMany({
      where: { id: { in: visitorIds as string[] } },
      include: { unit: true }
    });
    
    const visitorMap = new Map(visitors.map(v => [v.id, v]));

    const enrichedLogs = logs.map(log => {
      const visitorId = (log.metadata as any)?.visitorId;
      const visitor = visitorId ? visitorMap.get(visitorId) : null;
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        actor: log.actor,
        metadata: log.metadata,
        visitor: visitor ? {
          id: visitor.id,
          visitorName: visitor.name,
          provider: visitor.provider,
          type: visitor.visitorType,
          unitNumber: visitor.unit?.unitNumber
        } : null
      };
    });

    // Filter by unit if requested
    let finalLogs = enrichedLogs;
    if (unitLabel && typeof unitLabel === 'string') {
      const normalizedUnit = unitLabel.toUpperCase();
      finalLogs = finalLogs.filter(l => l.visitor?.unitNumber === normalizedUnit);
    }

    res.json({ success: true, logs: finalLogs });
  } catch (error) {
    next(error);
  }
});

export default router;
