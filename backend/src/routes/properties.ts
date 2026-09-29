import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ResidencyStatus, ResidencyType, OwnershipStatus } from '@prisma/client';

const router = Router();

// ----------------------------------------------------
// Public: GET /properties/units
// Returns all units with their ownership status
// ----------------------------------------------------
router.get('/units', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const community = await prisma.community.findFirst();
    if (!community) {
      return res.json({ units: [] });
    }

    const units = await prisma.unit.findMany({
      where: { communityId: community.id },
      include: {
        ownerships: {
          where: { status: OwnershipStatus.ACTIVE },
          select: { userId: true },
        },
      },
      orderBy: { unitNumber: 'asc' },
    });

    res.json({
      units: units.map((unit) => ({
        id: unit.id,
        unitNumber: unit.unitNumber,
        hasOwner: unit.ownerships.length > 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

// ----------------------------------------------------
// 1. GET /properties/my-properties
// Returns all units owned and/or lived in by the user
// ----------------------------------------------------
router.get('/my-properties', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const [ownerships, residencies] = await Promise.all([
      prisma.unitOwnership.findMany({
        where: { userId, status: OwnershipStatus.ACTIVE },
        include: {
          unit: {
            include: {
              community: true,
              residencies: {
                where: { status: ResidencyStatus.ACTIVE },
                include: { user: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true } } },
              },
            },
          },
        },
      }),
      prisma.unitResidency.findMany({
        where: { userId },
        include: {
          unit: {
            include: {
              community: true,
              ownerships: {
                where: { status: OwnershipStatus.ACTIVE },
                include: { user: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true } } },
              },
            },
          },
        },
      }),
    ]);

    res.json({
      ownedUnits: ownerships.map((o) => ({
        ownershipId: o.id,
        status: o.status,
        unit: o.unit,
        currentResidents: o.unit.residencies,
      })),
      residentUnits: residencies.map((r) => ({
        residencyId: r.id,
        status: r.status,
        relationshipType: r.relationshipType,
        unit: r.unit,
        owners: r.unit.ownerships,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. POST /properties/units/:unitId/residency-request
// Tenant applies for residency -> creates UnitResidency(PENDING) & notifies unit owners
// ----------------------------------------------------
const residencyRequestSchema = z.object({
  relationshipType: z.enum(['TENANT', 'CO_OWNER', 'FAMILY_MEMBER']).optional(),
  notes: z.string().optional(),
});

router.post('/units/:unitId/residency-request', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    if (!unitId) {
      return res.status(400).json({ error: { message: 'Missing unit id' } });
    }

    const { relationshipType } = residencyRequestSchema.parse(req.body);
    const relType = (relationshipType as ResidencyType) || ResidencyType.TENANT;

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        ownerships: {
          where: { status: OwnershipStatus.ACTIVE },
          include: { user: true },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: { message: 'Unit not found' } });
    }

    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    if (!applicant) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    // Upsert pending residency
    const residency = await prisma.unitResidency.upsert({
      where: {
        userId_unitId_relationshipType: {
          userId,
          unitId,
          relationshipType: relType,
        },
      },
      update: {
        status: ResidencyStatus.PENDING,
        verifiedById: null,
        verifiedAt: null,
      },
      create: {
        userId,
        unitId,
        relationshipType: relType,
        status: ResidencyStatus.PENDING,
      },
    });

    // Notify all active owners of the unit
    for (const ownership of unit.ownerships) {
      await prisma.notification.create({
        data: {
          userId: ownership.userId,
          type: 'TENANT_VERIFICATION_REQUEST',
          title: 'Tenant Verification Request',
          message: `${applicant.firstName || 'Resident'} (${applicant.email}) requested residency approval for Unit ${unit.unitNumber}.`,
          metadata: {
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            residencyId: residency.id,
            applicantId: applicant.id,
            relationshipType: relType,
          },
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Residency request submitted. Waiting for unit owner approval.',
      residency,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. GET /properties/units/:unitId/residencies
// List all pending and active residencies for an owner's unit
// ----------------------------------------------------
router.get('/units/:unitId/residencies', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    if (!unitId) {
      return res.status(400).json({ error: { message: 'Missing unit id' } });
    }

    // Check ownership or manager privilege
    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: OwnershipStatus.ACTIVE },
    });
    const isManager = req.user?.role === 'MANAGER' || req.user?.role === 'LEADERSHIP';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: { message: 'Access denied: Must be unit owner or manager' } });
    }

    const residencies = await prisma.unitResidency.findMany({
      where: { unitId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, availabilityStatus: true, availabilityUntil: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ residencies });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. POST /properties/units/:unitId/residencies/:residencyId/approve
// Owner approves tenant residency
// ----------------------------------------------------
router.post('/units/:unitId/residencies/:residencyId/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    const residencyId = Array.isArray(req.params.residencyId) ? req.params.residencyId[0] : req.params.residencyId;

    if (!unitId || !residencyId) {
      return res.status(400).json({ error: { message: 'Missing unitId or residencyId' } });
    }

    // Verify user owns the unit
    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: OwnershipStatus.ACTIVE },
    });
    const isManager = req.user?.role === 'MANAGER' || req.user?.role === 'LEADERSHIP';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: { message: 'Only unit owners or managers can approve residency requests' } });
    }

    const residency = await prisma.unitResidency.findUnique({
      where: { id: residencyId },
      include: { unit: true, user: true },
    });

    if (!residency || residency.unitId !== unitId) {
      return res.status(404).json({ error: { message: 'Residency request not found' } });
    }

    if (residency.relationshipType === ResidencyType.CO_OWNER) {
      const coOwnerCount = await prisma.unitResidency.count({ where: { unitId, relationshipType: ResidencyType.CO_OWNER, status: ResidencyStatus.ACTIVE } });
      if (coOwnerCount >= 2) return res.status(409).json({ error: { message: 'A unit can have at most 2 active co-owners besides the owner.' } });
    }

    // Activate residency
    const updated = await prisma.unitResidency.update({
      where: { id: residencyId },
      data: {
        status: ResidencyStatus.ACTIVE,
        verifiedById: userId,
        verifiedAt: new Date(),
      },
      include: { user: true, unit: true },
    });

    // Auto-populate household member record when a residency is approved.
    // This ensures owners and family members who register through the
    // onboarding flow appear in the family / household records section.
    if (
      residency.relationshipType === ResidencyType.OWNER ||
      residency.relationshipType === ResidencyType.CO_OWNER ||
      residency.relationshipType === ResidencyType.FAMILY_MEMBER
    ) {
      const relationshipLabel =
        residency.relationshipType === ResidencyType.OWNER ? 'OWNER'
        : residency.relationshipType === ResidencyType.CO_OWNER ? 'Co-Owner'
        : 'Family Member';

      const existingMember = await prisma.householdMember.findFirst({
        where: {
          unitId,
          email: residency.user.email ?? undefined,
          relationship: relationshipLabel,
        },
      });

      if (!existingMember) {
        const memberName =
          [residency.user.firstName, residency.user.lastName]
            .filter(Boolean)
            .join(' ') || (relationshipLabel === 'OWNER' ? 'Property Owner' : 'Family Member');
        await prisma.householdMember.create({
          data: {
            name: memberName,
            relationship: relationshipLabel,
            phone: residency.user.phoneNumber || null,
            email: residency.user.email,
            unitId,
            createdById: userId,
          },
        });
      }
    }

    // Update user's unitNumber on profile
    await prisma.user.update({
      where: { id: residency.userId },
      data: { unitNumber: residency.unit.unitNumber },
    });

    // Send notification to tenant
    await prisma.notification.create({
      data: {
        userId: residency.userId,
        type: 'RESIDENCY_APPROVED',
        title: 'Residency Access Approved',
        message: `Your residency access for Unit ${residency.unit.unitNumber} has been verified and approved.`,
        metadata: { unitId, unitNumber: residency.unit.unitNumber },
      },
    });

    res.json({
      success: true,
      message: `Residency approved for ${residency.user.firstName || 'Resident'} in Unit ${residency.unit.unitNumber}.`,
      residency: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 5. POST /properties/units/:unitId/residencies/:residencyId/reject
// Owner rejects tenant residency
// ----------------------------------------------------
router.post('/units/:unitId/residencies/:residencyId/reject', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    const residencyId = Array.isArray(req.params.residencyId) ? req.params.residencyId[0] : req.params.residencyId;

    if (!unitId || !residencyId) {
      return res.status(400).json({ error: { message: 'Missing unitId or residencyId' } });
    }

    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: OwnershipStatus.ACTIVE },
    });
    const isManager = req.user?.role === 'MANAGER' || req.user?.role === 'LEADERSHIP';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: { message: 'Only unit owners or managers can reject residency requests' } });
    }

    const residency = await prisma.unitResidency.findUnique({
      where: { id: residencyId },
      include: { unit: true },
    });

    if (!residency || residency.unitId !== unitId) {
      return res.status(404).json({ error: { message: 'Residency request not found' } });
    }

    const updated = await prisma.unitResidency.update({
      where: { id: residencyId },
      data: {
        status: ResidencyStatus.REJECTED,
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    // Notify tenant
    await prisma.notification.create({
      data: {
        userId: residency.userId,
        type: 'RESIDENCY_REJECTED',
        title: 'Residency Request Declined',
        message: `Your residency request for Unit ${residency.unit.unitNumber} was not approved.`,
        metadata: { unitId, unitNumber: residency.unit.unitNumber },
      },
    });

    res.json({ success: true, message: 'Residency request rejected.', residency: updated });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 6. PATCH /properties/units/:unitId/residencies/:residencyId/access
// Owner pauses, restores, or permanently revokes resident access
// ----------------------------------------------------
const residencyRoleSchema = z.object({
  relationshipType: z.enum(['TENANT', 'CO_OWNER', 'FAMILY_MEMBER']),
});

// An existing active resident can be promoted by the property owner without
// creating a second account or asking them to submit a new residency request.
// The lock makes the two-co-owner limit safe when two owner devices act at once.
router.patch('/units/:unitId/residencies/:residencyId/role', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    const residencyId = Array.isArray(req.params.residencyId) ? req.params.residencyId[0] : req.params.residencyId;
    const { relationshipType } = residencyRoleSchema.parse(req.body);
    if (!unitId || !residencyId) return res.status(400).json({ error: { message: 'Missing unitId or residencyId' } });

    const isOwner = await prisma.unitOwnership.findFirst({ where: { userId, unitId, status: OwnershipStatus.ACTIVE } });
    if (!isOwner) return res.status(403).json({ error: { message: 'Only the active property owner can change resident roles' } });

    const current = await prisma.unitResidency.findUnique({
      where: { id: residencyId },
      include: { unit: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!current || current.unitId !== unitId) return res.status(404).json({ error: { message: 'Residency record not found' } });
    if (current.relationshipType === ResidencyType.OWNER) return res.status(403).json({ error: { message: 'The property owner role cannot be changed here' } });
    if (!([ResidencyStatus.ACTIVE, ResidencyStatus.PAUSED] as ResidencyStatus[]).includes(current.status)) return res.status(409).json({ error: { message: 'Only an existing active resident can be assigned a role' } });
    if (current.relationshipType === relationshipType) {
      return res.json({ success: true, message: 'Resident role is already up to date.', residency: current });
    }

    const roleResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;
      const locked = await tx.unitResidency.findUnique({ where: { id: residencyId }, select: { relationshipType: true, status: true } });
      if (!locked || locked.status !== ResidencyStatus.ACTIVE && locked.status !== ResidencyStatus.PAUSED) throw Object.assign(new Error('Only an existing active resident can be assigned a role'), { statusCode: 409 });
      if (locked.relationshipType === relationshipType) return { updated: current, changed: false, from: locked.relationshipType };
      if (relationshipType === 'CO_OWNER' && locked.relationshipType !== ResidencyType.CO_OWNER) {
        const count = await tx.unitResidency.count({ where: { unitId, relationshipType: ResidencyType.CO_OWNER, status: ResidencyStatus.ACTIVE } });
        if (count >= 2) throw Object.assign(new Error('A unit can have at most 2 active co-owners besides the owner.'), { statusCode: 409 });
      }
      return { updated: await tx.unitResidency.update({ where: { id: residencyId }, data: { relationshipType: relationshipType as ResidencyType }, include: { unit: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } } }), changed: true, from: locked.relationshipType };
    });

    if (!roleResult.changed) return res.json({ success: true, message: 'Resident role is already up to date.', residency: roleResult.updated });
    await prisma.notification.create({ data: { userId: current.userId, type: 'RESIDENCY_ROLE_UPDATED', title: 'Residence role updated', message: `Your role for Unit ${current.unit.unitNumber} is now ${relationshipType.replace('_', ' ')}.`, metadata: { unitId, residencyId, relationshipType } } });
    await prisma.auditLog.create({ data: { communityId: current.unit.communityId, actorId: userId, targetId: current.userId, action: 'RESIDENCY_ROLE_UPDATED', metadata: { unitId, residencyId, from: roleResult.from, to: relationshipType } } });
    res.json({ success: true, message: `${current.user.firstName || 'Resident'} is now a ${relationshipType.replace('_', ' ').toLowerCase()}.`, residency: roleResult.updated });
  } catch (error: any) {
    if (error?.statusCode === 409) return res.status(409).json({ error: { message: error.message } });
    next(error);
  }
});

const residencyAccessSchema = z.object({
  action: z.enum(['pause', 'resume', 'revoke']),
});

router.patch('/units/:unitId/residencies/:residencyId/access', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const unitId = Array.isArray(req.params.unitId) ? req.params.unitId[0] : req.params.unitId;
    const residencyId = Array.isArray(req.params.residencyId) ? req.params.residencyId[0] : req.params.residencyId;
    const { action } = residencyAccessSchema.parse(req.body);

    if (!unitId || !residencyId) {
      return res.status(400).json({ error: { message: 'Missing unitId or residencyId' } });
    }

    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: OwnershipStatus.ACTIVE },
    });
    const isManager = req.user?.role === 'MANAGER' || req.user?.role === 'LEADERSHIP';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: { message: 'Only an active unit owner or manager can manage resident access' } });
    }

    const residency = await prisma.unitResidency.findUnique({
      where: { id: residencyId },
      include: {
        unit: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!residency || residency.unitId !== unitId) {
      return res.status(404).json({ error: { message: 'Residency record not found' } });
    }

    const targetOwnsUnit = await prisma.unitOwnership.findFirst({
      where: { userId: residency.userId, unitId, status: OwnershipStatus.ACTIVE },
    });
    if (targetOwnsUnit || residency.relationshipType === ResidencyType.OWNER || residency.relationshipType === ResidencyType.CO_OWNER) {
      return res.status(403).json({ error: { message: 'Owner access cannot be paused or revoked from this screen' } });
    }

    const nextStatus = action === 'pause'
      ? ResidencyStatus.PAUSED
      : action === 'resume'
        ? ResidencyStatus.ACTIVE
        : ResidencyStatus.REVOKED;

    if (action === 'pause' && residency.status !== ResidencyStatus.ACTIVE) {
      return res.status(409).json({ error: { message: 'Only active resident access can be paused' } });
    }
    if (action === 'resume' && residency.status !== ResidencyStatus.PAUSED) {
      return res.status(409).json({ error: { message: 'Only paused resident access can be restored' } });
    }
    if (action === 'revoke' && !([ResidencyStatus.ACTIVE, ResidencyStatus.PAUSED] as ResidencyStatus[]).includes(residency.status)) {
      return res.status(409).json({ error: { message: 'Only active or paused resident access can be revoked' } });
    }

    const updated = await prisma.unitResidency.update({
      where: { id: residencyId },
      data: {
        status: nextStatus,
        verifiedById: userId,
        verifiedAt: new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const actionCopy = action === 'pause'
      ? { type: 'RESIDENCY_ACCESS_PAUSED', title: 'Residency Access Paused', message: `Your access to Unit ${residency.unit.unitNumber} has been temporarily paused by the property owner.` }
      : action === 'resume'
        ? { type: 'RESIDENCY_ACCESS_RESTORED', title: 'Residency Access Restored', message: `Your access to Unit ${residency.unit.unitNumber} has been restored.` }
        : { type: 'RESIDENCY_ACCESS_REVOKED', title: 'Residency Access Revoked', message: `Your access to Unit ${residency.unit.unitNumber} has been revoked by the property owner.` };

    await prisma.notification.create({
      data: {
        userId: residency.userId,
        type: actionCopy.type,
        title: actionCopy.title,
        message: actionCopy.message,
        metadata: { unitId, unitNumber: residency.unit.unitNumber, residencyId, action },
      },
    });

    await prisma.auditLog.create({
      data: {
        communityId: residency.unit.communityId,
        actorId: userId,
        targetId: residency.userId,
        action: action === 'pause' ? 'RESIDENCY_ACCESS_PAUSED' : action === 'resume' ? 'RESIDENCY_ACCESS_RESTORED' : 'RESIDENCY_ACCESS_REVOKED',
        metadata: { unitId, unitNumber: residency.unit.unitNumber, residencyId, action },
      },
    });

    res.json({
      success: true,
      message: `${residency.user.firstName || 'Resident'} access ${action === 'pause' ? 'paused' : action === 'resume' ? 'restored' : 'revoked'}.`,
      residency: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// ----------------------------------------------------
// Public: GET /properties/has-manager
// Check if community already has a registered manager
// ----------------------------------------------------
router.get('/has-manager', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const community = await prisma.community.findFirst();
    if (!community) {
      return res.json({ hasManager: false });
    }

    const managerCount = await prisma.membership.count({
      where: {
        communityId: community.id,
        role: 'MANAGER',
        status: 'APPROVED',
      },
    });

    res.json({ hasManager: managerCount > 0 });
  } catch (error) {
    next(error);
  }
});
