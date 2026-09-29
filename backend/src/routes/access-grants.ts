import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const MAX_MASTER_ACCESS = 3;

const grantSchema = z.object({
  email: z.string().email('A valid existing account email is required.'),
  unitId: z.string().uuid().optional(),
  accessType: z.enum(['MASTER_ACCESS', 'DELEGATE']),
  permissions: z.object({
    viewHousehold: z.boolean().optional(),
    manageVisitors: z.boolean().optional(),
    manageHousehold: z.boolean().optional(),
    inviteResidents: z.boolean().optional(),
  }).optional(),
  endsAt: z.string().datetime().optional(),
});

async function activeGrant(userId: string, unitId: string) {
  const now = new Date();
  return prisma.accessGrant.findFirst({
    where: {
      userId,
      unitId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });
}

async function ownedUnit(userId: string, unitId?: string) {
  const ownership = await prisma.unitOwnership.findFirst({
    where: { userId, status: 'ACTIVE', ...(unitId ? { unitId } : {}) },
    select: { unitId: true },
  });
  if (ownership) return ownership.unitId;
  const coOwner = await prisma.unitResidency.findFirst({
    where: { userId, ...(unitId ? { unitId } : {}), relationshipType: 'CO_OWNER', status: 'ACTIVE' },
    select: { unitId: true },
  });
  return coOwner?.unitId || null;
}

async function accessibleUnit(userId: string, unitId?: string) {
  const direct = await prisma.unitResidency.findFirst({
    where: { userId, status: 'ACTIVE', ...(unitId ? { unitId } : {}) },
    select: { unitId: true },
  });
  if (direct) return direct.unitId;
  const ownership = await prisma.unitOwnership.findFirst({
    where: { userId, status: 'ACTIVE', ...(unitId ? { unitId } : {}) },
    select: { unitId: true },
  });
  if (ownership) return ownership.unitId;
  if (unitId && await activeGrant(userId, unitId)) return unitId;
  const grant = await prisma.accessGrant.findFirst({
    where: { userId, status: 'ACTIVE', startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'asc' },
    select: { unitId: true },
  });
  return grant?.unitId || null;
}

function canGrant(actor: { owns: boolean; coOwns: boolean; grant: { accessType: string } | null }, requested: string) {
  // Only the property owner may appoint Master Access. Co-owners and Master
  // Access users can delegate household tasks, but cannot escalate privileges.
  if (requested === 'MASTER_ACCESS') return actor.owns;
  if (actor.owns || actor.coOwns) return true;
  return actor.grant?.accessType === 'MASTER_ACCESS' && requested === 'DELEGATE';
}

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await accessibleUnit(req.user!.userId, typeof req.query.unitId === 'string' ? req.query.unitId : undefined);
    if (!unitId) return res.json({ grants: [], canManage: false });
    const grants = await prisma.accessGrant.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        grantedBy: { select: { id: true, firstName: true, lastName: true } },
        revokedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const ownership = await prisma.unitOwnership.findFirst({ where: { userId: req.user!.userId, unitId, status: 'ACTIVE' } });
    const coOwner = await prisma.unitResidency.findFirst({ where: { userId: req.user!.userId, unitId, relationshipType: 'CO_OWNER', status: 'ACTIVE' } });
    const grant = await activeGrant(req.user!.userId, unitId);
    res.json({ grants, canManage: canGrant({ owns: Boolean(ownership), coOwns: Boolean(coOwner), grant }, 'DELEGATE') });
  } catch (error) { next(error); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = grantSchema.parse(req.body);
    const unitId = await ownedUnit(req.user!.userId, body.unitId) || await accessibleUnit(req.user!.userId, body.unitId);
    if (!unitId) return res.status(403).json({ error: { message: 'You do not have access to this residence.' } });

    const [ownership, coOwner, actorGrant, recipient] = await Promise.all([
      prisma.unitOwnership.findFirst({ where: { userId: req.user!.userId, unitId, status: 'ACTIVE' } }),
      prisma.unitResidency.findFirst({ where: { userId: req.user!.userId, unitId, relationshipType: 'CO_OWNER', status: 'ACTIVE' } }),
      activeGrant(req.user!.userId, unitId),
      prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() }, select: { id: true, email: true, firstName: true, lastName: true } }),
    ]);
    if (!recipient) return res.status(404).json({ error: { message: 'That account does not exist. Send an invitation for new users.' } });
    if (recipient.id === req.user!.userId) return res.status(400).json({ error: { message: 'You already have access to this residence.' } });
    if (!canGrant({ owns: Boolean(ownership), coOwns: Boolean(coOwner), grant: actorGrant }, body.accessType)) {
      return res.status(403).json({ error: { message: 'Only an owner, co-owner, or master-access user can grant this access.' } });
    }
    const sameUnit = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM "UnitResidency" WHERE "userId" = ${recipient.id} AND "unitId" = ${unitId} AND "status" = 'ACTIVE'
        UNION ALL
        SELECT 1 FROM "UnitOwnership" WHERE "userId" = ${recipient.id} AND "unitId" = ${unitId} AND "status" = 'ACTIVE'
        UNION ALL
        SELECT 1 FROM "Membership" WHERE "userId" = ${recipient.id} AND "unitId" = ${unitId} AND "status" = 'APPROVED'
      ) AS exists
    `;
    if (!sameUnit[0]?.exists) return res.status(403).json({ error: { message: 'The account must already belong to this residence. Invite new residents first.' } });

    const grantData = {
      accessType: body.accessType,
      permissions: body.permissions ?? { viewHousehold: true, manageVisitors: true },
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      grantedById: req.user!.userId,
      revokedAt: null,
      revokedById: null,
      status: 'ACTIVE',
    };
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;
      const existing = await tx.accessGrant.findFirst({ where: { userId: recipient.id, unitId, status: 'ACTIVE' } });
      if (!existing && body.accessType === 'MASTER_ACCESS') {
        const masterCount = await tx.accessGrant.count({ where: { unitId, accessType: 'MASTER_ACCESS', status: 'ACTIVE' } });
        if (masterCount >= MAX_MASTER_ACCESS) throw new Error('MASTER_LIMIT');
      }
      return existing
        ? { grant: await tx.accessGrant.update({ where: { id: existing.id }, data: grantData }), created: false }
        : { grant: await tx.accessGrant.create({ data: { userId: recipient.id, unitId, ...grantData } }), created: true };
    });
    // Replaying the same grant is an update, not a new privilege event. This
    // keeps retries safe and prevents duplicate audit noise.
    if (result.created) {
      await prisma.auditLog.create({ data: { communityId: (await prisma.unit.findUniqueOrThrow({ where: { id: unitId }, select: { communityId: true } })).communityId, actorId: req.user!.userId, action: 'ACCESS_GRANTED', metadata: { grantId: result.grant.id, unitId, recipientId: recipient.id, accessType: body.accessType } } });
    }
    res.status(result.created ? 201 : 200).json({ grant: result.grant });
  } catch (error) { if (error instanceof Error && error.message === 'MASTER_LIMIT') return res.status(409).json({ error: { message: 'This residence already has the maximum of 3 master-access users.' } }); next(error); }
});

router.post('/:id/revoke', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const grantId = typeof req.params.id === 'string' ? req.params.id : '';
    const grant = await prisma.accessGrant.findUnique({ where: { id: grantId } });
    if (!grant) return res.status(404).json({ error: { message: 'Access grant not found.' } });
    const owner = await prisma.unitOwnership.findFirst({ where: { userId: req.user!.userId, unitId: grant.unitId, status: 'ACTIVE' } });
    const coOwner = await prisma.unitResidency.findFirst({ where: { userId: req.user!.userId, unitId: grant.unitId, relationshipType: 'CO_OWNER', status: 'ACTIVE' } });
    const actorGrant = await activeGrant(req.user!.userId, grant.unitId);
    if (!owner && !coOwner && actorGrant?.accessType !== 'MASTER_ACCESS') return res.status(403).json({ error: { message: 'Only an owner, co-owner, or master-access user can revoke access.' } });
    if (grant.status === 'REVOKED') return res.json({ success: true, grant });
    const updated = await prisma.accessGrant.update({ where: { id: grant.id }, data: { status: 'REVOKED', revokedAt: new Date(), revokedById: req.user!.userId } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: grant.unitId }, select: { communityId: true } });
    await prisma.auditLog.create({ data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'ACCESS_REVOKED', metadata: { grantId: grant.id, unitId: grant.unitId, recipientId: grant.userId } } });
    res.json({ success: true, grant: updated });
  } catch (error) { next(error); }
});

export default router;
