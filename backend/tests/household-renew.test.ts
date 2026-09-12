import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, MembershipStatus, PersonnelCategory, Department } from '@prisma/client';

describe('PermanentPass renew guard — linked member must be ACTIVE', () => {
  let ownerId: string;
  let ownerToken: string;
  let communityId: string;
  let unitId: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const community = await prisma.community.create({ data: { name: `Renew Test ${suffix}`, address: 'Test Lane' } });
    communityId = community.id;
    const unit = await prisma.unit.create({ data: { communityId, unitNumber: `W-${suffix}`, block: 'Block W' } });
    unitId = unit.id;
    const owner = await prisma.user.create({ data: { email: `renew_owner_${suffix}@test.com`, passwordHash: 'dummyhash', firstName: 'Owner', role: Role.OWNER } });
    ownerId = owner.id;
    ownerToken = generateTokens(owner.id).accessToken;
    await prisma.unitOwnership.create({ data: { userId: owner.id, unitId: unit.id, status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: owner.id, communityId, role: Role.OWNER, status: MembershipStatus.APPROVED } });
    await prisma.unitResidency.create({ data: { userId: owner.id, unitId: unit.id, relationshipType: 'OWNER', status: 'ACTIVE' } });
  });

  afterAll(async () => {
    await prisma.permanentPass.deleteMany({ where: { communityId } });
    await prisma.householdMember.deleteMany({ where: { unitId } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unitResidency.deleteMany({ where: { unitId } });
    await prisma.unitOwnership.deleteMany({ where: { unitId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.community.deleteMany({ where: { id: communityId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it('ACTIVE member → renew succeeds', async () => {
    const member = await prisma.householdMember.create({ data: { unitId, createdById: ownerId, name: 'Active Member', relationship: 'BROTHER', status: 'ACTIVE', communityId } });
    const validUntil = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    const pass = await prisma.permanentPass.create({ data: { unitId, communityId, createdById: ownerId, name: 'Active Member', householdMemberId: member.id, status: 'ACTIVE', validFrom: new Date(), validUntil } });

    const res = await request(app).post(`/household/permanent-passes/${pass.id}/renew`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pass.status).toBe('ACTIVE');

    const row = await prisma.permanentPass.findUnique({ where: { id: pass.id } });
    expect(row!.status).toBe('ACTIVE');

    await prisma.permanentPass.delete({ where: { id: pass.id } });
    await prisma.householdMember.delete({ where: { id: member.id } });
  });

  it('PAUSED member → renew denied + pass remains PAUSED', async () => {
    const member = await prisma.householdMember.create({ data: { unitId, createdById: ownerId, name: 'Paused Member', relationship: 'SISTER', status: 'ACTIVE', communityId } });
    const validUntil = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    const pass = await prisma.permanentPass.create({ data: { unitId, communityId, createdById: ownerId, name: 'Paused Member', householdMemberId: member.id, status: 'ACTIVE', validFrom: new Date(), validUntil } });

    // Pause member → cascade should make pass PAUSED (via df39f2f logic)
    const patchRes = await request(app).patch(`/household/members/${member.id}/status`).set('Authorization', `Bearer ${ownerToken}`).send({ status: 'PAUSED' });
    expect(patchRes.status).toBe(200);
    const pausedPass = await prisma.permanentPass.findUnique({ where: { id: pass.id } });
    expect(pausedPass!.status).toBe('PAUSED');

    const renewRes = await request(app).post(`/household/permanent-passes/${pass.id}/renew`).set('Authorization', `Bearer ${ownerToken}`);
    expect(renewRes.status).toBe(400);
    expect(renewRes.body.error.message).toMatch(/not active/i);

    const after = await prisma.permanentPass.findUnique({ where: { id: pass.id } });
    expect(after!.status).toBe('PAUSED');

    await prisma.permanentPass.delete({ where: { id: pass.id } });
    await prisma.householdMember.delete({ where: { id: member.id } });
  });

  it('REVOKED member → renew denied + pass remains REVOKED', async () => {
    const member = await prisma.householdMember.create({ data: { unitId, createdById: ownerId, name: 'Revoked Member', relationship: 'COUSIN', status: 'ACTIVE', communityId } });
    const validUntil = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    const pass = await prisma.permanentPass.create({ data: { unitId, communityId, createdById: ownerId, name: 'Revoked Member', householdMemberId: member.id, status: 'ACTIVE', validFrom: new Date(), validUntil } });

    const patchRes = await request(app).patch(`/household/members/${member.id}/status`).set('Authorization', `Bearer ${ownerToken}`).send({ status: 'REVOKED' });
    expect(patchRes.status).toBe(200);
    const revokedPass = await prisma.permanentPass.findUnique({ where: { id: pass.id } });
    expect(revokedPass!.status).toBe('REVOKED');

    const renewRes = await request(app).post(`/household/permanent-passes/${pass.id}/renew`).set('Authorization', `Bearer ${ownerToken}`);
    expect(renewRes.status).toBe(400);
    expect(renewRes.body.error.message).toMatch(/not active/i);

    const after = await prisma.permanentPass.findUnique({ where: { id: pass.id } });
    expect(after!.status).toBe('REVOKED');

    await prisma.permanentPass.delete({ where: { id: pass.id } });
    await prisma.householdMember.delete({ where: { id: member.id } });
  });
});
