import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OwnershipTransferStatus, OwnershipStatus, ResidencyStatus, ResidencyType } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const clauseId = 'OWNERSHIP_HANDOVER_V1';
const clauseVersion = '1.0';
const clauseText = 'I acknowledge that accepting this handover transfers the ownership rights and responsibilities for this unit to me, subject to community records and applicable law. The outgoing owner authorizes the handover and the incoming owner accepts responsibility for the unit from the time the transfer is completed in the system.';

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transfers = await prisma.ownershipTransfer.findMany({
      where: { OR: [{ fromOwnerId: req.user!.userId }, { toOwnerId: req.user!.userId }] },
      orderBy: { createdAt: 'desc' },
      select: { id: true, unitId: true, fromOwnerId: true, toOwnerId: true, status: true, clauseId: true, clauseVersion: true, clauseText: true, proposedAt: true, acceptedAt: true, completedAt: true, cancelledAt: true, unit: { select: { unitNumber: true } }, fromOwner: { select: { firstName: true, lastName: true, email: true } }, toOwner: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.json({ transfers });
  } catch (error) { next(error); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ unitId: z.string().uuid(), toUserEmail: z.string().email(), effectiveDate: z.string().datetime(), documentReference: z.string().trim().max(240).optional() }).parse(req.body);
    const owner = await prisma.unitOwnership.findFirst({ where: { unitId: body.unitId, userId: req.user!.userId, status: OwnershipStatus.ACTIVE } });
    if (!owner) return res.status(403).json({ error: { message: 'Only the current owner can start an ownership handover.' } });
    const target = await prisma.user.findUnique({ where: { email: body.toUserEmail.trim().toLowerCase() }, select: { id: true, email: true } });
    if (!target) return res.status(404).json({ error: { message: 'The incoming owner must already have an account.' } });
    if (target.id === req.user!.userId) return res.status(400).json({ error: { message: 'The incoming owner must be a different account.' } });
    const belongs = await prisma.unitResidency.findFirst({ where: { unitId: body.unitId, userId: target.id, status: ResidencyStatus.ACTIVE } });
    if (!belongs) return res.status(403).json({ error: { message: 'The incoming owner must first be an active resident of this unit.' } });
    const existing = await prisma.ownershipTransfer.findFirst({ where: { unitId: body.unitId, status: { in: [OwnershipTransferStatus.PROPOSED, OwnershipTransferStatus.ACCEPTED] } } });
    if (existing) return res.status(409).json({ error: { message: 'This unit already has a pending ownership handover.' } });
    const effectiveAt = new Date(body.effectiveDate);
    if (effectiveAt < new Date()) return res.status(400).json({ error: { message: 'The effective date must be now or in the future.' } });
    const transfer = await prisma.ownershipTransfer.create({ data: { unitId: body.unitId, fromOwnerId: req.user!.userId, toOwnerId: target.id, clauseId, clauseVersion, clauseText, effectiveAt, documentReference: body.documentReference || null } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: body.unitId }, select: { communityId: true } });
    await prisma.auditLog.create({ data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'OWNERSHIP_TRANSFER_PROPOSED', metadata: { transferId: transfer.id, unitId: body.unitId, toOwnerId: target.id, clauseId, clauseVersion } } });
    res.status(201).json({ transfer });
  } catch (error) { next(error); }
});

router.post('/:id/accept', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const accepted = z.object({ accepted: z.literal(true) }).parse(req.body);
    if (!accepted.accepted) return res.status(400).json({ error: { message: 'The handover clause must be accepted.' } });
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id } });
    if (!transfer || transfer.toOwnerId !== req.user!.userId || transfer.status !== OwnershipTransferStatus.PROPOSED) return res.status(404).json({ error: { message: 'Pending handover not found.' } });
    const updated = await prisma.ownershipTransfer.update({ where: { id }, data: { status: OwnershipTransferStatus.ACCEPTED, acceptedAt: new Date() } });
    await prisma.tenantClauseAcceptance.upsert({ where: { userId_unitId_clauseId_clauseVersion: { userId: req.user!.userId, unitId: transfer.unitId, clauseId: transfer.clauseId, clauseVersion: transfer.clauseVersion } }, update: { acceptedAt: new Date(), acceptedById: req.user!.userId }, create: { userId: req.user!.userId, unitId: transfer.unitId, clauseId: transfer.clauseId, clauseVersion: transfer.clauseVersion, acceptedById: req.user!.userId } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: transfer.unitId }, select: { communityId: true } });
    await prisma.auditLog.create({ data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'OWNERSHIP_TRANSFER_ACCEPTED', metadata: { transferId: id, unitId: transfer.unitId, clauseId: transfer.clauseId, clauseVersion: transfer.clauseVersion } } });
    res.json({ transfer: updated });
  } catch (error) { next(error); }
});

router.post('/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.ownershipTransfer.findUnique({ where: { id } });
      if (!transfer || transfer.fromOwnerId !== req.user!.userId || transfer.status !== OwnershipTransferStatus.ACCEPTED || transfer.effectiveAt > new Date()) throw new Error('NOT_ALLOWED');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${transfer.unitId}))`;
      const current = await tx.unitOwnership.findFirst({ where: { unitId: transfer.unitId, userId: transfer.fromOwnerId, status: OwnershipStatus.ACTIVE } });
      if (!current) throw new Error('NOT_ALLOWED');
      await tx.unitOwnership.update({ where: { id: current.id }, data: { status: OwnershipStatus.TRANSFERRED } });
      await tx.unitOwnership.upsert({ where: { userId_unitId: { userId: transfer.toOwnerId, unitId: transfer.unitId } }, update: { status: OwnershipStatus.ACTIVE }, create: { userId: transfer.toOwnerId, unitId: transfer.unitId, status: OwnershipStatus.ACTIVE } });
      await tx.unitResidency.updateMany({ where: { userId: transfer.toOwnerId, unitId: transfer.unitId }, data: { status: ResidencyStatus.ACTIVE, relationshipType: ResidencyType.OWNER } });
      const completed = await tx.ownershipTransfer.update({ where: { id }, data: { status: OwnershipTransferStatus.COMPLETED, completedAt: new Date() } });
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: transfer.unitId }, select: { communityId: true } });
      await tx.auditLog.create({ data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'OWNERSHIP_TRANSFER_COMPLETED', metadata: { transferId: id, unitId: transfer.unitId, effectiveAt: transfer.effectiveAt.toISOString() } } });
      return completed;
    });
    res.json({ transfer: result });
  } catch (error) { if (error instanceof Error && error.message === 'NOT_ALLOWED') return res.status(403).json({ error: { message: 'Only the current owner can complete an accepted handover.' } }); next(error); }
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id } });
    if (!transfer || transfer.fromOwnerId !== req.user!.userId || (transfer.status !== OwnershipTransferStatus.PROPOSED && transfer.status !== OwnershipTransferStatus.ACCEPTED)) return res.status(404).json({ error: { message: 'Cancellable handover not found.' } });
    const updated = await prisma.ownershipTransfer.update({ where: { id }, data: { status: OwnershipTransferStatus.CANCELLED, cancelledAt: new Date() } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: transfer.unitId }, select: { communityId: true } });
    await prisma.auditLog.create({ data: { communityId: unit.communityId, actorId: req.user!.userId, action: 'OWNERSHIP_TRANSFER_CANCELLED', metadata: { transferId: id, unitId: transfer.unitId } } });
    res.json({ transfer: updated });
  } catch (error) { next(error); }
});

export default router;
