import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OwnershipStatus, ResidencyStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth, requireVerifiedResidence } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
// Prisma client generation is performed as part of deployment after migrations.
// Keep this route compatible with the checked-in client during local type checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const householdDb: any = prisma;

const memberSchema = z.object({
  name: z.string().trim().min(2, 'Member name is required'),
  relationship: z.string().trim().min(2, 'Relationship is required'),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Enter a valid email address').optional(),
});

const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(3, 'Vehicle number is required').max(30),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  color: z.string().trim().max(40).optional(),
});

const petSchema = z.object({
  name: z.string().trim().min(1, 'Pet name is required').max(80),
  species: z.string().trim().min(2, 'Pet type is required').max(60),
  breed: z.string().trim().max(80).optional(),
  color: z.string().trim().max(40).optional(),
});

async function getAccessibleUnit(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ownerships: { where: { status: OwnershipStatus.ACTIVE }, orderBy: { createdAt: 'asc' }, select: { unitId: true } },
      residencies: { where: { status: ResidencyStatus.ACTIVE }, orderBy: { createdAt: 'asc' }, select: { unitId: true } },
    },
  });
  return user?.ownerships[0]?.unitId || user?.residencies[0]?.unitId || null;
}

async function getOwnedUnit(userId: string) {
  const ownership = await prisma.unitOwnership.findFirst({
    where: { userId, status: OwnershipStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
    select: { unitId: true },
  });
  return ownership?.unitId || null;
}

async function getOwnerRecordId<T extends { id: string; unitId: string; relationship?: string }>(
  model: { findUnique: (args: { where: { id: string } }) => Promise<T | null> },
  id: string,
  userId: string
) {
  const record = await model.findUnique({ where: { id } });
  if (!record) return null;
  const unitId = await getOwnedUnit(userId);
  return record.unitId === unitId ? record : null;
}

const visitorTypeLabel = (type: string) => {
  const labels: Record<string, string> = { GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab', SERVICE: 'Service visit', OTHER: 'Visitor' };
  return labels[type] || 'Visitor';
};

const personName = (person?: { firstName: string | null; lastName: string | null } | null) =>
  `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'A household member';

// Shared activity ledger for everyone linked to the same residence. It resolves
// visitor audit events against the unit's passes so no other household's events
// can be exposed through the community-wide audit table.
router.get('/activity', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getAccessibleUnit(req.user!.userId);
    if (!unitId) return res.json({ activities: [] });

    const visitors = await prisma.visitor.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    const visitorIds = new Set(visitors.map((visitor) => visitor.id));
    const communityId = visitors[0]?.communityId;
    const logs = communityId
      ? await prisma.auditLog.findMany({
          where: { communityId, action: { in: ['VISITOR_APPROVED', 'VISITOR_REJECTED', 'VISITOR_REVOKED', 'VISITOR_CHECK_IN', 'VISITOR_CHECK_OUT', 'DELIVERY_HANDOFF'] } },
          orderBy: { createdAt: 'desc' },
          take: 500,
          include: { actor: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const visitorById = new Map(visitors.map((visitor) => [visitor.id, visitor]));

    const createdActivities = visitors.map((visitor) => ({
      id: `created-${visitor.id}`,
      kind: visitor.visitorType,
      title: visitor.isPreApproved ? `${visitor.name} was pre-approved` : `${visitor.name} was added to expected visits`,
      detail: visitor.isPreApproved
        ? `${visitorTypeLabel(visitor.visitorType)} approved by ${personName(visitor.createdBy)}`
        : `${visitorTypeLabel(visitor.visitorType)} added by ${personName(visitor.createdBy)}`,
      createdAt: visitor.createdAt,
    }));

    const eventActivities = logs.flatMap((log) => {
      const metadata = (log.metadata || {}) as { visitorId?: unknown; recipientType?: unknown };
      const visitorId = typeof metadata.visitorId === 'string' ? metadata.visitorId : null;
      if (!visitorId || !visitorIds.has(visitorId)) return [];
      const visitor = visitorById.get(visitorId);
      if (!visitor) return [];
      const actor = personName(log.actor);
      const type = visitorTypeLabel(visitor.visitorType);
      if (log.action === 'VISITOR_APPROVED') return [{ id: log.id, kind: visitor.visitorType, title: `${visitor.name} approved for entry`, detail: `${type} approved by ${actor}`, createdAt: log.createdAt }];
      if (log.action === 'VISITOR_REJECTED') return [{ id: log.id, kind: visitor.visitorType, title: `${visitor.name} was declined at the gate`, detail: `${type} declined by ${actor}`, createdAt: log.createdAt }];
      if (log.action === 'VISITOR_REVOKED') return [{ id: log.id, kind: visitor.visitorType, title: `${visitor.name}'s pass was revoked`, detail: `Pass cancelled by ${actor}`, createdAt: log.createdAt }];
      if (log.action === 'VISITOR_CHECK_IN') return [{ id: log.id, kind: visitor.visitorType, title: `${visitor.name} arrived at the property`, detail: `Checked in by ${actor}`, createdAt: log.createdAt }];
      if (log.action === 'VISITOR_CHECK_OUT') return [{ id: log.id, kind: visitor.visitorType, title: `${visitor.name} checked out`, detail: `Checked out by ${actor}`, createdAt: log.createdAt }];
      const recipient = metadata.recipientType === 'RESIDENT' ? 'your door' : metadata.recipientType === 'LOCKER' ? 'the parcel locker' : 'the gate';
      return [{ id: log.id, kind: 'DELIVERY', title: `${visitor.name} delivered`, detail: `Handed to ${recipient} by ${actor}`, createdAt: log.createdAt }];
    });

    const fromValue = typeof req.query.from === 'string' ? new Date(`${req.query.from}T00:00:00.000`) : null;
    const toValue = typeof req.query.to === 'string' ? new Date(`${req.query.to}T23:59:59.999`) : null;
    const from = fromValue && !Number.isNaN(fromValue.getTime()) ? fromValue : null;
    const to = toValue && !Number.isNaN(toValue.getTime()) ? toValue : null;
    const activities = [...createdActivities, ...eventActivities]
      .filter((activity) => (!from || activity.createdAt >= from) && (!to || activity.createdAt <= to))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 150);
    res.json({ activities });
  } catch (error) { next(error); }
});

router.get('/help-desk', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getAccessibleUnit(req.user!.userId);
    if (!unitId) return res.json({ manager: null });
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { communityId: true } });
    const manager = unit
      ? await prisma.membership.findFirst({
          where: { communityId: unit.communityId, status: 'APPROVED', role: { in: ['MANAGER', 'LEADERSHIP'] } },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { firstName: true, lastName: true, phoneNumber: true } } },
        })
      : null;
    res.json({ manager: manager ? { name: personName(manager.user), phoneNumber: manager.user.phoneNumber } : null });
  } catch (error) { next(error); }
});

router.get('/', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getAccessibleUnit(req.user!.userId);
    if (!unitId) return res.json({ members: [], vehicles: [], pets: [], canManageAssets: false });
    const [members, vehicles, pets, ownerUnitId] = await Promise.all([
      householdDb.householdMember.findMany({
        where: { unitId },
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      householdDb.householdVehicle.findMany({ where: { unitId }, orderBy: { createdAt: 'asc' } }),
      householdDb.householdPet.findMany({ where: { unitId }, orderBy: { createdAt: 'asc' } }),
      getOwnedUnit(req.user!.userId),
    ]);
    res.json({ members, vehicles, pets, canManageAssets: ownerUnitId === unitId });
  } catch (error) { next(error); }
});

router.post('/members', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only an active property owner can update household records.' } });
    const data = memberSchema.parse(req.body);
    const member = await householdDb.householdMember.create({
      data: { ...data, phone: data.phone || null, email: data.email || null, unitId, createdById: req.user!.userId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json({ member });
  } catch (error) { next(error); }
});

router.post('/vehicles', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only an active property owner can add vehicles.' } });
    const data = vehicleSchema.parse(req.body);
    const vehicle = await householdDb.householdVehicle.create({ data: { ...data, registrationNumber: data.registrationNumber.toUpperCase(), make: data.make || null, model: data.model || null, color: data.color || null, unitId, createdById: req.user!.userId } });
    res.status(201).json({ vehicle });
  } catch (error) { next(error); }
});

router.post('/pets', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only an active property owner can add pets.' } });
    const data = petSchema.parse(req.body);
    const pet = await householdDb.householdPet.create({ data: { ...data, breed: data.breed || null, color: data.color || null, unitId, createdById: req.user!.userId } });
    res.status(201).json({ pet });
  } catch (error) { next(error); }
});

router.delete('/members/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const record = await getOwnerRecordId(householdDb.householdMember, id, req.user!.userId);
    if (!record) return res.status(404).json({ error: { message: 'Household member not found.' } });
    await householdDb.householdMember.delete({ where: { id: record.id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.delete('/vehicles/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const record = await getOwnerRecordId(householdDb.householdVehicle, id, req.user!.userId);
    if (!record) return res.status(404).json({ error: { message: 'Vehicle not found.' } });
    await householdDb.householdVehicle.delete({ where: { id: record.id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.delete('/pets/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const record = await getOwnerRecordId(householdDb.householdPet, id, req.user!.userId);
    if (!record) return res.status(404).json({ error: { message: 'Pet not found.' } });
    await householdDb.householdPet.delete({ where: { id: record.id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

// ----------------------------------------------------
// Household Member Status Management (Pause/Revoke)
// ----------------------------------------------------

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'REVOKED']),
});

router.patch('/members/:id/status', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const record = await getOwnerRecordId(householdDb.householdMember, id, req.user!.userId);
    if (!record) return res.status(404).json({ error: { message: 'Household member not found.' } });
    
    const { status } = statusSchema.parse(req.body);
    
    // Prevent changing status of OWNER records
    if (record.relationship === 'OWNER' && status !== 'ACTIVE') {
      return res.status(400).json({ error: { message: 'Cannot pause or revoke the property owner.' } });
    }
    
    const updated = await householdDb.householdMember.update({
      where: { id: record.id },
      data: { status },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    
    res.json({ member: updated });
  } catch (error) { next(error); }
});

export default router;

// ----------------------------------------------------
// Household Help (Persistent Staff)
// ----------------------------------------------------

const helpSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(5, 'Valid phone is required'),
  role: z.string().min(2, 'Role is required'),
  vehicleNumber: z.string().optional(),
  recurringDays: z.string(), // e.g. "1,2,3,4,5"
  arrivalWindow: z.string().optional(),
  departureWindow: z.string().optional()
});

router.get('/help', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getAccessibleUnit(req.user!.userId);
    if (!unitId) return res.json({ help: [] });
    
    const help = await prisma.householdHelp.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ help });
  } catch(error) { next(error); }
});

router.post('/help', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only active property owner can add household help.' } });
    
    const data = helpSchema.parse(req.body);
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    
    const help = await prisma.householdHelp.create({
      data: {
        ...data,
        vehicleNumber: data.vehicleNumber || null,
        arrivalWindow: data.arrivalWindow || null,
        departureWindow: data.departureWindow || null,
        unitId,
        communityId: unit!.communityId,
        createdById: req.user!.userId,
        status: 'ACTIVE'
      }
    });
    res.status(201).json({ help });
  } catch(error) { next(error); }
});

router.put('/help/:id/status', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ error: { message: 'Missing id' } });
    const { status } = req.body;
    if (status !== 'ACTIVE' && status !== 'PAUSED') return res.status(400).json({ error: { message: 'Invalid status' } });
    
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only active property owner can manage household help.' } });
    
    const help = await prisma.householdHelp.findFirst({ where: { id: String(id), unitId: String(unitId) } });
    if (!help) return res.status(404).json({ error: { message: 'Household help not found' } });
    
    const updated = await prisma.householdHelp.update({ where: { id: String(id) }, data: { status } });
    res.json({ help: updated });
  } catch(error) { next(error); }
});

router.delete('/help/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only active property owner can manage household help.' } });
    
    const help = await prisma.householdHelp.findFirst({ where: { id: String(id), unitId: String(unitId) } });
    if (!help) return res.status(404).json({ error: { message: 'Household help not found' } });
    
    await prisma.householdHelp.delete({ where: { id: String(id) } });
    res.status(204).send();
  } catch(error) { next(error); }
});

// ----------------------------------------------------
// Permanent Passes (Family / Frequent Visitor Access)
// ----------------------------------------------------
// 28-day passes that bypass OTP at the gate. One-tap check-in.

const PASS_DURATION_DAYS = 28;

const permanentPassSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().max(40).optional(),
  vehicleNumber: z.string().trim().max(40).optional(),
  purpose: z.string().trim().max(240).optional(),
  householdMemberId: z.string().uuid().optional(),
});

// GET /household/permanent-passes
router.get('/permanent-passes', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getAccessibleUnit(req.user!.userId);
    if (!unitId) return res.json({ passes: [] });

    const passes = await prisma.permanentPass.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-expire passes past their validity window
    const now = new Date();
    const expiredIds = passes
      .filter((p) => p.status === 'ACTIVE' && p.validUntil < now)
      .map((p) => p.id);

    if (expiredIds.length > 0) {
      await prisma.permanentPass.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'EXPIRED' },
      });
      for (const p of passes) {
        if (expiredIds.includes(p.id)) p.status = 'EXPIRED';
      }
    }

    const ownerUnitId = await getOwnedUnit(req.user!.userId);
    res.json({ passes, canManage: ownerUnitId === unitId });
  } catch (error) { next(error); }
});

// POST /household/permanent-passes
router.post('/permanent-passes', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only the active property owner can issue permanent passes.' } });

    const data = permanentPassSchema.parse(req.body);
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) return res.status(404).json({ error: { message: 'Unit not found.' } });

    const now = new Date();
    const validUntil = new Date(now.getTime() + PASS_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const pass = await prisma.permanentPass.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        vehicleNumber: data.vehicleNumber || null,
        purpose: data.purpose || 'Family member access',
        householdMemberId: data.householdMemberId || null,
        unitId,
        communityId: unit.communityId,
        createdById: req.user!.userId,
        validFrom: now,
        validUntil,
      },
    });

    res.status(201).json({ pass });
  } catch (error) { next(error); }
});

// POST /household/permanent-passes/:id/renew
router.post('/permanent-passes/:id/renew', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only the active property owner can renew passes.' } });

    const pass = await prisma.permanentPass.findFirst({ where: { id, unitId } });
    if (!pass) return res.status(404).json({ error: { message: 'Pass not found.' } });

    const now = new Date();
    const validUntil = new Date(now.getTime() + PASS_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.permanentPass.update({
      where: { id },
      data: { status: 'ACTIVE', validFrom: now, validUntil, useCount: 0 },
    });

    res.json({ pass: updated });
  } catch (error) { next(error); }
});

// PATCH /household/permanent-passes/:id/status
router.patch('/permanent-passes/:id/status', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only the active property owner can manage passes.' } });

    const { status } = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'EXPIRED']) }).parse(req.body);
    const pass = await prisma.permanentPass.findFirst({ where: { id, unitId } });
    if (!pass) return res.status(404).json({ error: { message: 'Pass not found.' } });

    const updated = await prisma.permanentPass.update({ where: { id }, data: { status } });
    res.json({ pass: updated });
  } catch (error) { next(error); }
});

// DELETE /household/permanent-passes/:id
router.delete('/permanent-passes/:id', requireVerifiedResidence, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const unitId = await getOwnedUnit(req.user!.userId);
    if (!unitId) return res.status(403).json({ error: { message: 'Only the active property owner can delete passes.' } });

    const pass = await prisma.permanentPass.findFirst({ where: { id, unitId } });
    if (!pass) return res.status(404).json({ error: { message: 'Pass not found.' } });

    await prisma.permanentPass.delete({ where: { id } });
    res.status(204).send();
  } catch (error) { next(error); }
});
