import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireVerifiedResidence, requireWorkforceOrManager, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { VisitorStatus, VisitorType, ResidencyStatus, OwnershipStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

const router = Router();

async function verifySecurityMembership(userId: string, communityId: string | null): Promise<boolean> {
  if (!communityId) return false;
  const mem = await prisma.membership.findFirst({
    where: { userId, communityId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } }
  });
  if (!mem) return false;
  if (mem.role === 'WORKFORCE') {
    const p = await prisma.personnel.findUnique({ where: { userId } });
    if (!p || p.category !== 'SECURITY' || p.employmentStatus === 'TERMINATED') return false;
  }
  return true;
}

async function getManagementMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER'] } },
    orderBy: { createdAt: 'asc' },
  });
}

router.use(requireAuth);

const createVisitorSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  purpose: z.string().trim().min(1, 'Purpose is required.').max(240),
  vehicleNumber: z.string().trim().max(40).optional(),
  visitorType: z.nativeEnum(VisitorType).default(VisitorType.GUEST),
  validFrom: z.string().trim().max(80).optional(),
  validUntil: z.string().trim().max(80).optional(),
  provider: z.string().trim().max(120).optional(),
  orderReference: z.string().trim().max(120).optional(),
  packageCount: z.number().int().optional(),
});

const unannouncedArrivalSchema = createVisitorSchema.extend({
  unitId: z.string().uuid().optional(),
  hostUserId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.unitId) !== Boolean(value.hostUserId), {
  message: 'Choose either a residence or a manager host.',
});

function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

function sanitizeVisitor<T extends { otp?: unknown }>(visitor: T): Omit<T, 'otp'> {
  const { otp: _otp, ...safeVisitor } = visitor;
  return safeVisitor;
}

const MAX_OTP_ATTEMPTS = 5;

async function getOtpFailedAttempts(visitorId: string) {
  const rows = await prisma.$queryRaw<Array<{ otpFailedAttempts: number }>>`
    SELECT "otpFailedAttempts" FROM "Visitor" WHERE "id" = ${visitorId} LIMIT 1
  `;
  return Number(rows[0]?.otpFailedAttempts || 0);
}

async function incrementOtpFailedAttempts(visitorId: string) {
  const rows = await prisma.$queryRaw<Array<{ otpFailedAttempts: number }>>`
    UPDATE "Visitor"
    SET "otpFailedAttempts" = "otpFailedAttempts" + 1, "updatedAt" = NOW()
    WHERE "id" = ${visitorId}
    RETURNING "otpFailedAttempts"
  `;
  return Number(rows[0]?.otpFailedAttempts || 0);
}

async function resetOtpFailedAttempts(visitorId: string) {
  await prisma.$executeRaw`
    UPDATE "Visitor"
    SET "otpFailedAttempts" = 0, "updatedAt" = NOW()
    WHERE "id" = ${visitorId}
  `;
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

/**
 * Reconcile time-bound passes before they are shown or acted on at the gate.
 * Pending/approved passes expire; visitors already inside are auto-checked out.
 * This function is exported for use by cron jobs (recommended: run every 5 minutes).
 * It should NOT be called on every GET request for performance.
 */
export async function reconcileVisitorLifecycle(communityId?: string) {
  const now = new Date();
  const scope = communityId ? { communityId } : { communityId: { not: null } };
  const [passesToExpire, visitorsToCheckOut] = await Promise.all([
    prisma.visitor.findMany({
      where: {
        ...scope,
        status: { in: [VisitorStatus.PENDING, VisitorStatus.APPROVED] },
        validUntil: { not: null, lte: now },
      },
      select: { id: true, communityId: true, createdById: true, unitId: true },
    }),
    prisma.visitor.findMany({
      where: {
        ...scope,
        status: VisitorStatus.CHECKED_IN,
        validUntil: { not: null, lte: now },
      },
      select: { id: true, communityId: true, createdById: true, visitorType: true },
    }),
  ]);

  if (passesToExpire.length === 0 && visitorsToCheckOut.length === 0) {
    return { expired: 0, autoCheckedOut: 0 };
  }

  return prisma.$transaction(async (tx) => {
    let expired = 0;
    let autoCheckedOut = 0;

    for (const pass of passesToExpire) {
      const result = await tx.visitor.updateMany({
        where: { id: pass.id, status: { in: [VisitorStatus.PENDING, VisitorStatus.APPROVED] } },
        data: { status: VisitorStatus.EXPIRED },
      });
      if (result.count === 0 || !pass.communityId) continue;

      expired += 1;
      await tx.auditLog.create({
        data: {
          communityId: pass.communityId,
          actorId: pass.createdById,
          action: 'VISITOR_EXPIRED',
          metadata: { visitorId: pass.id, reason: 'VALID_UNTIL_REACHED' },
        },
      });
    }

    for (const visitor of visitorsToCheckOut) {
      const result = await tx.visitor.updateMany({
        where: { id: visitor.id, status: VisitorStatus.CHECKED_IN },
        data: { status: VisitorStatus.CHECKED_OUT, checkOutTime: now },
      });
      if (result.count === 0 || !visitor.communityId) continue;

      autoCheckedOut += 1;
      await tx.auditLog.create({
        data: {
          communityId: visitor.communityId,
          actorId: visitor.createdById,
          action: 'VISITOR_AUTO_CHECK_OUT',
          metadata: { visitorId: visitor.id, reason: 'VALID_UNTIL_REACHED' },
        },
      });

      if (visitor.visitorType === VisitorType.DELIVERY) {
        await tx.auditLog.create({
          data: {
            communityId: visitor.communityId,
            actorId: visitor.createdById,
            action: 'DELIVERY_CHECKOUT_EXCEPTION',
            metadata: { visitorId: visitor.id, reason: 'Auto checked out before handoff was recorded' },
          },
        });
      }
    }

    return { expired, autoCheckedOut };
  });
}



// ----------------------------------------------------
// POST /visitors/reconcile (Cron job endpoint - requires auth)
// ----------------------------------------------------
router.post('/reconcile', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { communityId } = req.body;

    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } }
    });
    const targetCommunityId = communityId || membership?.communityId;
    if (!targetCommunityId) {
      return res.status(403).json({ error: { message: 'Community ID required' } });
    }

    const hasAccess = await verifySecurityMembership(userId, targetCommunityId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Unauthorized for this community.' } });
    }

    const result = await reconcileVisitorLifecycle(targetCommunityId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});


// ----------------------------------------------------
// POST /visitors/unannounced (Gate Security)
// ----------------------------------------------------
router.post('/unannounced', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const userId = req.user!.userId;
    const body = unannouncedArrivalSchema.parse(req.body);
    const unit = body.unitId ? await prisma.unit.findUnique({ where: { id: body.unitId } }) : null;
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } },
    });
    const communityId = unit?.communityId || membership?.communityId || null;
    if (!communityId || !(await verifySecurityMembership(userId, communityId))) {
      return res.status(403).json({ error: { message: 'Not authorized for this community' } });
    }

    let hostUserId: string | null = null;
    if (body.hostUserId) {
      const host = await prisma.membership.findFirst({
        where: {
          userId: body.hostUserId,
          communityId,
          status: 'APPROVED',
          role: { in: ['MANAGER', 'LEADERSHIP'] },
        },
      });
      if (!host) return res.status(404).json({ error: { message: 'Manager host not found in this community.' } });
      hostUserId = body.hostUserId;
    }
    if (body.unitId && (!unit || unit.communityId !== communityId)) {
      return res.status(404).json({ error: { message: 'Residence not found in this community.' } });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await prisma.visitor.findFirst({
      where: {
        ...(body.unitId ? { unitId: body.unitId } : { hostUserId }),
        visitorType: body.visitorType,
        provider: body.provider?.trim() || null,
        status: 'PENDING',
        createdAt: { gte: fiveMinutesAgo }
      }
    });

    if (existing) {
      return res.json({ success: true, deduped: true, visitor: sanitizeVisitor(existing) });
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
          unitId: body.unitId || null,
          hostUserId,
          communityId,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours validity for unannounced
        }
      });
      await tx.auditLog.create({
        data: {
          communityId,
          actorId: req.user!.userId,
          action: 'VISITOR_UNANNOUNCED_ARRIVAL',
          metadata: { visitorId: v.id, unitId: body.unitId || null, hostUserId },
        }
      });
      return v;
    });

    if (body.unitId) {
      const residents = await prisma.user.findMany({
        where: {
          OR: [
            { residencies: { some: { unitId: body.unitId, status: 'ACTIVE' } } },
            { ownerships: { some: { unitId: body.unitId, status: 'ACTIVE' } } }
          ]
        }
      });
      if (residents.length > 0) {
        await prisma.notification.createMany({
          data: residents.map((resident) => ({
            userId: resident.id,
            type: 'UNANNOUNCED_ARRIVAL',
            title: `${body.visitorType} at the Gate`,
            message: `${visitor.name} is waiting at the gate. Please approve or deny entry.`,
            metadata: { visitorId: visitor.id }
          }))
        });
      }
    } else if (hostUserId) {
      await prisma.notification.create({
        data: {
          userId: hostUserId,
          type: 'UNANNOUNCED_ARRIVAL',
          title: `${body.visitorType} at the Gate`,
          message: `${visitor.name} is waiting at the gate for you. Review the arrival before entry.`,
          metadata: { visitorId: visitor.id },
        },
      });
    }

    res.status(201).json({ success: true, deduped: false, visitor: sanitizeVisitor(visitor) });
  } catch(error) {
    next(error);
  }
});

// ----------------------------------------------------
// 1. POST /visitors (Resident creates an expected visitor / pass - always pre-approved)
// ----------------------------------------------------
router.post('/manager-invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const membership = await getManagementMembership(userId);
    if (!membership) return res.status(403).json({ error: { message: 'Manager access required.' } });

    const body = createVisitorSchema.parse(req.body);
    const validFromDate = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntilDate = body.validUntil
      ? new Date(body.validUntil)
      : new Date(validFromDate.getTime() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(validFromDate.getTime()) || Number.isNaN(validUntilDate.getTime()) || validUntilDate <= validFromDate) {
      return res.status(400).json({ error: { message: 'Validity dates must be valid and the end must be after the start.' } });
    }

    let plaintextOtp: string | undefined;
    let hashedOtp: string | null = null;
    if (shouldGenerateOtp(body.visitorType)) {
      plaintextOtp = generateOtp();
      hashedOtp = await bcrypt.hash(plaintextOtp, 10);
    }

    const visitor = await prisma.visitor.create({
      data: {
        name: body.name?.trim() || body.provider?.trim() || 'Visitor',
        phone: body.phone?.trim() || null,
        purpose: body.purpose?.trim() || 'Visitor',
        vehicleNumber: body.vehicleNumber?.trim() || null,
        visitorType: body.visitorType,
        status: VisitorStatus.APPROVED,
        otp: hashedOtp,
        isPreApproved: true,
        createdById: userId,
        hostUserId: userId,
        communityId: membership.communityId,
        validFrom: validFromDate,
        validUntil: validUntilDate,
        provider: body.provider?.trim() || null,
        orderReference: body.orderReference?.trim() || null,
        packageCount: body.packageCount || null,
      },
      include: { hostUser: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    await prisma.auditLog.create({
      data: {
        communityId: membership.communityId,
        actorId: userId,
        action: 'VISITOR_CREATED',
        metadata: { visitorId: visitor.id, type: visitor.visitorType, status: visitor.status, source: 'MANAGER_INVITE', hostUserId: userId },
      },
    });

    const { otp: _otp, ...visitorData } = visitor;
    res.status(201).json({ visitor: { ...visitorData, otp: plaintextOtp } });
  } catch (error) {
    next(error);
  }
});

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
    if (Number.isNaN(validFromDate.getTime()) || Number.isNaN(validUntilDate.getTime())) {
      return res.status(400).json({ error: { message: 'Validity dates must be valid dates.' } });
    }
    if (validUntilDate <= validFromDate) {
      return res.status(400).json({ error: { message: 'Valid until must be after valid from.' } });
    }

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
        hostUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
router.get('/gate', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitLabel = typeof req.query.unitLabel === 'string' ? req.query.unitLabel.trim().toUpperCase() : '';
    
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } }
    });
    const communityId = ((req.query.communityId as string)) || membership?.communityId;
    if (!communityId) {
      return res.status(403).json({ error: { message: 'Unauthorized.' } });
    }

    // Verify explicitly before performing any community-scoped reconciliation work.
    const hasAccess = await verifySecurityMembership(userId, communityId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Unauthorized for this community.' } });
    }

    await reconcileVisitorLifecycle(communityId);

    // Determine if requester is a security guard (WORKFORCE + SECURITY category)
    const isSecurityGuard = membership?.role === 'WORKFORCE';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const visitors = await prisma.visitor.findMany({
      where: {
        communityId,
        ...(unitLabel ? { unit: { unitNumber: { startsWith: unitLabel } } } : {}),
        OR: [
          { status: { in: ['PENDING', 'APPROVED', 'CHECKED_IN'] } },
          { updatedAt: { gte: startOfToday } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
        hostUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    
    const sanitized = visitors.map(v => {
      const { otp: _otp, phone: _phone, ...rest } = v;
      // Security guards only get unit number, not full unit details
      const unit = isSecurityGuard && v.unit
        ? { unitNumber: v.unit.unitNumber }
        : v.unit;
      // The hash never leaves the server. The gate only needs to know whether to request a code.
      return { ...rest, unit, requiresOtp: visitorRequiresOtp(v) };
    });

    // Include active permanent passes as always-available entries
    const permanentPasses = await prisma.permanentPass.findMany({
      where: {
        communityId,
        status: 'ACTIVE',
        validUntil: { gt: new Date() },
        ...(unitLabel ? { unit: { unitNumber: { startsWith: unitLabel } } } : {}),
      },
      include: {
        unit: true,
      },
    });

    const permanentPassEntries = permanentPasses.map((pp) => ({
      id: `pp-${pp.id}`,
      name: pp.name,
      phone: isSecurityGuard ? undefined : pp.phone,
      vehicleNumber: pp.vehicleNumber,
      visitorType: 'GUEST' as const,
      status: 'APPROVED' as const,
      isPreApproved: true,
      requiresOtp: false,
      isPermanentPass: true,
      permanentPassId: pp.id,
      validFrom: pp.validFrom,
      validUntil: pp.validUntil,
      unit: isSecurityGuard && pp.unit ? { unitNumber: pp.unit.unitNumber } : pp.unit,
      purpose: pp.purpose,
      createdAt: pp.createdAt,
      updatedAt: pp.updatedAt,
    }));

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
        permanentPasses: permanentPassEntries.length,
      },
      pending,
      approved,
      checkedIn,
      permanentPasses: permanentPassEntries,
      // Keep one aggregate queue for Management and Gate Operations consumers.
      visitors: [...checkedIn, ...approved, ...pending],
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ---



// ----------------------------------------------------
// GET /visitors/gate-hosts (Manager/leadership targets for security alerts)
// ----------------------------------------------------
router.get('/gate-hosts', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } },
    });
    if (!membership || !(await verifySecurityMembership(userId, membership.communityId))) {
      return res.status(403).json({ error: { message: 'Unauthorized.' } });
    }

    const hosts = await prisma.user.findMany({
      where: {
        memberships: { some: { communityId: membership.communityId, status: 'APPROVED', role: { in: ['MANAGER', 'LEADERSHIP'] } } },
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json({ hosts });
  } catch (error) {
    next(error);
  }
});

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
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } },
    });
    const communityId = membership?.communityId;
    if (!communityId) return res.status(403).json({ error: { message: 'Unauthorized.' } });
    if (!(await verifySecurityMembership(userId, communityId))) return res.status(403).json({ error: { message: 'Unauthorized.' } });

    const visitor = await prisma.visitor.findUnique({
      where: { id: visitorId },
      include: {
        unit: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
        hostUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
      if (shouldGenerateOtp(visitor.visitorType) && await getOtpFailedAttempts(visitor.id) >= MAX_OTP_ATTEMPTS) {
        const plaintextOtp = generateOtp();
        const hashedOtp = await bcrypt.hash(plaintextOtp, 10);
        const regenerated = await prisma.visitor.update({ where: { id: visitor.id }, data: { otp: hashedOtp } });
        await resetOtpFailedAttempts(visitor.id);
        return res.json({ success: true, visitor: { ...sanitizeVisitor(regenerated), otp: plaintextOtp } });
      }
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
        const otherResidents = residents.filter((resident) => resident.id !== req.user!.userId);
        if (otherResidents.length > 0) {
          await tx.notification.createMany({
            data: otherResidents.map((resident) => ({
              userId: resident.id,
              type: 'VISITOR_APPROVED',
              title: `${v.visitorType} Approved`,
              message: shouldGenerateOtp(v.visitorType)
                ? `${v.name}'s entry approved. OTP: ${plaintextOtp}`
                : `${v.name}'s entry approved. No OTP required.`,
              metadata: { visitorId: v.id }
            }))
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
// POST /visitors/:id/host-approve (Manager/leadership approves an arrival addressed to them)
// ----------------------------------------------------
router.post('/:id/host-approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = typeof req.params.id === 'string' ? req.params.id : null;
    if (!visitorId) return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    const userId = req.user!.userId;
    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || visitor.hostUserId !== userId) return res.status(404).json({ error: { message: 'Arrival not found.' } });
    if (visitor.status !== VisitorStatus.PENDING) return res.status(400).json({ error: { message: `Arrival is already ${visitor.status.toLowerCase()}.` } });

    const plaintextOtp = shouldGenerateOtp(visitor.visitorType) ? generateOtp() : null;
    const hashedOtp = plaintextOtp ? await bcrypt.hash(plaintextOtp, 10) : null;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.visitor.updateMany({
        where: { id: visitor.id, status: VisitorStatus.PENDING },
        data: { status: VisitorStatus.APPROVED, otp: hashedOtp, isPreApproved: true },
      });
      if (result.count === 0) throw new Error('CONCURRENCY_ERROR');
      const current = await tx.visitor.findUnique({ where: { id: visitor.id }, include: { hostUser: { select: { id: true, firstName: true, lastName: true, role: true } } } });
      await tx.auditLog.create({
        data: { communityId: visitor.communityId!, actorId: userId, action: 'VISITOR_APPROVED', metadata: { visitorId: visitor.id, source: 'HOST_CONFIRMATION' } },
      });
      await tx.notification.create({
        data: {
          userId: visitor.createdById,
          type: 'VISITOR_APPROVED',
          title: 'Entry approved',
          message: plaintextOtp ? `${visitor.name} was approved. OTP: ${plaintextOtp}` : `${visitor.name} was approved for entry.`,
          metadata: { visitorId: visitor.id },
        },
      });
      return current!;
    });
    const { otp: _otp, ...visitorData } = updated;
    res.json({ success: true, visitor: { ...visitorData, otp: plaintextOtp || undefined } });
  } catch (error: any) {
    if (error.message === 'CONCURRENCY_ERROR') return res.status(409).json({ error: { message: 'Arrival was updated by someone else.' } });
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/host-reject (Manager/leadership rejects an arrival addressed to them)
// ----------------------------------------------------
router.post('/:id/host-reject', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = typeof req.params.id === 'string' ? req.params.id : null;
    if (!visitorId) return res.status(400).json({ error: { message: 'Invalid visitor ID' } });
    const userId = req.user!.userId;
    const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!visitor || visitor.hostUserId !== userId) return res.status(404).json({ error: { message: 'Arrival not found.' } });
    if (visitor.status !== VisitorStatus.PENDING) return res.status(400).json({ error: { message: `Arrival is already ${visitor.status.toLowerCase()}.` } });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.visitor.updateMany({ where: { id: visitor.id, status: VisitorStatus.PENDING }, data: { status: VisitorStatus.REJECTED } });
      if (result.count === 0) throw new Error('CONCURRENCY_ERROR');
      const current = await tx.visitor.findUnique({ where: { id: visitor.id } });
      await tx.auditLog.create({ data: { communityId: visitor.communityId!, actorId: userId, action: 'VISITOR_REJECTED', metadata: { visitorId: visitor.id, source: 'HOST_CONFIRMATION' } } });
      await tx.notification.create({ data: { userId: visitor.createdById, type: 'VISITOR_REJECTED', title: 'Entry declined', message: `${visitor.name} was not approved for entry.`, metadata: { visitorId: visitor.id } } });
      return current!;
    });
    res.json({ success: true, visitor: sanitizeVisitor(updated) });
  } catch (error: any) {
    if (error.message === 'CONCURRENCY_ERROR') return res.status(409).json({ error: { message: 'Arrival was updated by someone else.' } });
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
    res.json({ success: true, visitor: sanitizeVisitor(updated) });
  } catch (error: any) {
    if (error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       if (current?.status === 'APPROVED') return res.json({ success: true, visitor: sanitizeVisitor(current) });
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
    res.json({ success: true, visitor: sanitizeVisitor(updated) });
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
    if (visitor.handoffTimestamp) {
      return res.status(400).json({ error: { message: 'Delivery handoff has already been completed' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitor.id, handoffTimestamp: null },
        data: {
          handoffSuggestionType: body.recipientType,
          handoffSuggestionName: body.recipientName ? body.recipientName : null,
        }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');

      const v = (await tx.visitor.findUnique({ where: { id: visitorId } }))!;

      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_HANDOFF_SUGGESTED', metadata: { visitorId: v.id, recipientType: body.recipientType } }
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
        if (residents.length > 0) {
          await tx.notification.createMany({
            data: residents.map((resident) => ({
              userId: resident.id,
              type: 'DELIVERY_HANDOFF',
              title: 'Delivery handoff preference saved',
              message: `Your delivery preference is ${body.recipientType}.`,
              metadata: { visitorId: v.id, recipientType: body.recipientType }
            }))
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
router.post('/:id/check-in', requireWorkforceOrManager, checkInLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    await reconcileVisitorLifecycle(visitor.communityId || undefined);
    const currentVisitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!currentVisitor) return res.status(404).json({ error: { message: 'Visitor not found' } });
    const visitorForCheckIn = currentVisitor;
    if (visitorForCheckIn.status === VisitorStatus.CHECKED_IN) return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(visitorForCheckIn) });
    if (visitorForCheckIn.status !== VisitorStatus.APPROVED) return res.status(400).json({ error: { message: 'Visitor is not approved for entry' } });
    if (visitorForCheckIn.validFrom && new Date() < new Date(visitorForCheckIn.validFrom)) {
      return res.status(400).json({ error: { message: 'This pass is not active yet' } });
    }
    if (visitorForCheckIn.validUntil && new Date() > new Date(visitorForCheckIn.validUntil)) return res.status(400).json({ error: { message: 'Pass expired' } });

    if (visitorRequiresOtp(visitorForCheckIn) && visitorForCheckIn.otp) {
      const failedAttempts = await getOtpFailedAttempts(visitorForCheckIn.id);
      if (failedAttempts >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({ error: { message: 'Too many incorrect OTP attempts. Ask the resident to approve the pass again.' } });
      }
      if (!otp) return res.status(400).json({ error: { message: 'OTP is required' } });
      if (!/^\d{6}$/.test(otp)) {
        await incrementOtpFailedAttempts(visitorForCheckIn.id);
        return res.status(400).json({ error: { message: 'Enter the six-digit OTP for this pass' } });
      }
      const isValid = await bcrypt.compare(otp, visitorForCheckIn.otp);
      if (!isValid) {
        const nextFailedAttempts = await incrementOtpFailedAttempts(visitorForCheckIn.id);
        return res.status(nextFailedAttempts >= MAX_OTP_ATTEMPTS ? 429 : 400).json({
          error: {
            message: nextFailedAttempts >= MAX_OTP_ATTEMPTS
              ? 'Too many incorrect OTP attempts. Ask the resident to approve the pass again.'
              : 'Invalid OTP',
          },
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitor.updateMany({
        where: { id: visitorForCheckIn.id, status: 'APPROVED' },
        data: { status: 'CHECKED_IN', checkInTime: new Date() }
      });
      if (updateResult.count === 0) throw new Error('CONCURRENCY_ERROR');

      const v = (await tx.visitor.findUnique({ where: { id: visitorId }, include: { unit: true } }))!;
      
      await tx.auditLog.create({
        data: { communityId: v.communityId!, actorId: req.user!.userId, action: 'VISITOR_CHECK_IN', metadata: { visitorId: v.id } }
      });
      if (v.otp === null && v.hostUserId) {
        await tx.notification.create({
          data: {
            userId: v.hostUserId,
            type: 'VISITOR_ARRIVAL',
            title: `${v.visitorType === 'DELIVERY' ? 'Delivery' : v.visitorType === 'CAB' ? 'Cab' : 'Visitor'} Arrived`,
            message: `${v.name} has arrived at the gate and checked in.`,
            metadata: { visitorId: v.id },
          },
        });
      } else if (v.otp === null && v.unitId) {
        // Unannounced arrival: notify all residents
        const residents = await tx.user.findMany({
          where: {
            OR: [
              { residencies: { some: { unitId: v.unitId, status: 'ACTIVE' } } },
              { ownerships: { some: { unitId: v.unitId, status: 'ACTIVE' } } }
            ]
          }
        });
        if (residents.length > 0) {
          await tx.notification.createMany({
            data: residents.map((resident) => ({
              userId: resident.id,
              type: 'VISITOR_ARRIVAL',
              title: `${v.visitorType === 'DELIVERY' ? 'Delivery' : v.visitorType === 'CAB' ? 'Cab' : 'Visitor'} Arrived`,
              message: `${v.name} has arrived at the gate and checked in.`,
              metadata: { visitorId: v.id }
            }))
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

    await resetOtpFailedAttempts(visitorForCheckIn.id);

    const { otp: _, ...visitorData } = updated;
    res.json({ success: true, visitor: visitorData });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONCURRENCY_ERROR') {
       const current = typeof req.params.id === 'string'
         ? await prisma.visitor.findUnique({ where: { id: req.params.id } })
         : null;
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current ? sanitizeVisitor(current) : null } });
    }
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/permanent-pass/:passId/check-in (Gate – One-Tap)
// Creates a Visitor record from a PermanentPass and checks in immediately.
// No OTP required.
// ----------------------------------------------------
router.post('/permanent-pass/:passId/check-in', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { passId } = req.params;
    if (!passId || typeof passId !== 'string') {
      return res.status(400).json({ error: { message: 'Invalid pass ID' } });
    }
    const userId = req.user!.userId;

    const pass = await prisma.permanentPass.findUnique({ where: { id: passId }, include: { unit: true } });
    if (!pass || !(await verifySecurityMembership(userId, pass.communityId))) {
      return res.status(404).json({ error: { message: 'Permanent pass not found' } });
    }

    if (pass.status !== 'ACTIVE') {
      return res.status(400).json({ error: { message: 'This pass is not active' } });
    }
    if (new Date() > pass.validUntil) {
      return res.status(400).json({ error: { message: 'This pass has expired. Ask the resident to renew it.' } });
    }

    // Create a Visitor record and check in immediately
    const now = new Date();
    const checkInWindow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2-hour window

    const visitor = await prisma.$transaction(async (tx) => {
      const v = await tx.visitor.create({
        data: {
          name: pass.name,
          phone: pass.phone,
          vehicleNumber: pass.vehicleNumber,
          purpose: pass.purpose || 'Family member access',
          visitorType: 'GUEST',
          status: 'CHECKED_IN',
          isPreApproved: true,
          createdById: pass.createdById,
          unitId: pass.unitId,
          communityId: pass.communityId,
          validFrom: now,
          validUntil: checkInWindow,
          checkInTime: now,
        },
        include: { unit: true },
      });

      await tx.permanentPass.update({
        where: { id: passId },
        data: { lastUsedAt: now, useCount: { increment: 1 } },
      });

      await tx.auditLog.create({
        data: {
          communityId: pass.communityId,
          actorId: userId,
          action: 'VISITOR_CHECK_IN',
          metadata: { visitorId: v.id, permanentPassId: passId, source: 'PERMANENT_PASS' },
        },
      });

      return v;
    });

    // Notify residents
    if (pass.unitId) {
      const residents = await prisma.user.findMany({
        where: {
          OR: [
            { residencies: { some: { unitId: pass.unitId, status: 'ACTIVE' } } },
            { ownerships: { some: { unitId: pass.unitId, status: 'ACTIVE' } } },
          ],
        },
      });
      if (residents.length > 0) {
        await prisma.notification.createMany({
          data: residents.map((r) => ({
            userId: r.id,
            type: 'VISITOR_ARRIVAL',
            title: 'Family Member Arrived',
            message: `${pass.name} has arrived at the gate.`,
            metadata: { visitorId: visitor.id },
          })),
        });
      }
    }

    const { otp: _, ...visitorData } = visitor;
    res.json({ success: true, visitor: visitorData });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// ----------------------------------------------------
// POST /visitors/:id/check-out (Gate / Manager)
// ----------------------------------------------------
router.post('/:id/check-out', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    await reconcileVisitorLifecycle(visitor.communityId || undefined);
    const currentVisitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!currentVisitor) return res.status(404).json({ error: { message: 'Visitor not found' } });
    if (currentVisitor.status === VisitorStatus.CHECKED_OUT) return res.json({ success: true, visitor: (({ otp: _, ...v }) => v)(currentVisitor) });
    if (currentVisitor.status !== VisitorStatus.CHECKED_IN) return res.status(400).json({ error: { message: 'Visitor is not checked in' } });

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
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current ? sanitizeVisitor(current) : null } });
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
router.post('/:id/handoff', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        if (residents.length > 0) {
          await tx.notification.createMany({
            data: residents.map((resident) => ({
              userId: resident.id,
              type: 'DELIVERY_HANDOFF',
              title: 'Delivery Handed Off',
              message: `Your delivery from ${v.provider || v.name} was handed off to ${body.recipientType}.`,
              metadata: { visitorId: v.id, recipientType: body.recipientType }
            }))
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
       return res.status(409).json({ error: { message: 'Conflict: action already completed.', visitor: current ? sanitizeVisitor(current) : null } });
    }
    console.error(error);
    next(error);
  }
});


// ----------------------------------------------------
// GET /visitors/gate/activity (Watchman Activity Log)
// ----------------------------------------------------
router.get('/gate/activity', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { unitLabel, type } = req.query;
    
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } }
    });
    const communityId = ((req.query.communityId as string)) || membership?.communityId;
    if (!communityId || !(await verifySecurityMembership(userId, communityId))) {
      return res.status(403).json({ error: { message: 'Unauthorized.' } });
    }

    await reconcileVisitorLifecycle(communityId);

    const whereClause: any = {
      communityId,
      action: {
        in: [
          'VISITOR_UNANNOUNCED_ARRIVAL',
          'VISITOR_APPROVED',
          'VISITOR_REJECTED',
          'VISITOR_CHECK_IN',
          'VISITOR_CHECK_OUT',
          'VISITOR_AUTO_CHECK_OUT',
          'VISITOR_EXPIRED',
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
      include: { unit: true, hostUser: { select: { id: true, firstName: true, lastName: true, role: true } } }
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
          status: visitor.status,
          unitNumber: visitor.unit?.unitNumber,
          hostUser: visitor.hostUser,
        } : null
      };
    });

    // Filter by unit if requested
    let finalLogs = enrichedLogs;
    if (unitLabel && typeof unitLabel === 'string') {
      const normalizedUnit = unitLabel.trim().toUpperCase();
      finalLogs = finalLogs.filter(l => l.visitor?.unitNumber?.toUpperCase().startsWith(normalizedUnit));
    }

    res.json({ success: true, logs: finalLogs });
  } catch (error) {
    next(error);
  }
});

export default router;
