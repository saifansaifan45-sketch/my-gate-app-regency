import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, MembershipStatus, PersonnelCategory, Department } from '@prisma/client';

describe('Household revoke cascade — PermanentPass', () => {
  let ownerId: string;
  let ownerToken: string;
  let securityToken: string;
  let securityId: string;
  let communityId: string;
  let unitId: string;
  let memberId: string;
  let passId: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36);
    const community = await prisma.community.create({
      data: { name: `Revoke Test ${suffix}`, address: 'Test Lane' },
    });
    communityId = community.id;

    const unit = await prisma.unit.create({
      data: { communityId, unitNumber: `R-${suffix}`, block: 'Block R' },
    });
    unitId = unit.id;

    const owner = await prisma.user.create({
      data: {
        email: `revoke_owner_${suffix}@test.com`,
        passwordHash: 'dummyhash',
        firstName: 'Owner',
        role: Role.OWNER,
      },
    });
    ownerId = owner.id;
    ownerToken = generateTokens(owner.id).accessToken;

    await prisma.unitOwnership.create({
      data: { userId: owner.id, unitId: unit.id, status: 'ACTIVE' },
    });
    await prisma.membership.create({
      data: { userId: owner.id, communityId, role: Role.OWNER, status: MembershipStatus.APPROVED },
    });
    // Also need verified residency for requireVerifiedResidence (checks ownership or residency ACTIVE)
    await prisma.unitResidency.create({
      data: { userId: owner.id, unitId: unit.id, relationshipType: 'OWNER', status: 'ACTIVE' },
    });

    const security = await prisma.user.create({
      data: { email: `revoke_sec_${suffix}@test.com`, passwordHash: 'dummyhash', firstName: 'Sec', role: Role.WORKFORCE },
    });
    securityId = security.id;
    await prisma.membership.create({
      data: { userId: security.id, communityId, role: Role.WORKFORCE, status: MembershipStatus.APPROVED, requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
    });
    await prisma.personnel.create({
      data: { userId: security.id, name: 'Revoke Sec', phone: '+91 90000 00099', category: PersonnelCategory.SECURITY, department: Department.SECURITY, communityId },
    });
    securityToken = generateTokens(security.id).accessToken;

    // Create household member via API to ensure correct flow (or directly via prisma for determinism)
    const member = await prisma.householdMember.create({
      data: { unitId, createdById: owner.id, name: 'Family Member', relationship: 'BROTHER', phone: '+91 90000 00011', status: 'ACTIVE', communityId },
    });
    memberId = member.id;

    const validUntil = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    const pass = await prisma.permanentPass.create({
      data: {
        unitId,
        communityId,
        createdById: owner.id,
        name: 'Family Member',
        phone: '+91 90000 00011',
        purpose: 'Family member access',
        householdMemberId: member.id,
        status: 'ACTIVE',
        validFrom: new Date(),
        validUntil,
      },
    });
    passId = pass.id;
  });

  afterAll(async () => {
    await prisma.permanentPass.deleteMany({ where: { communityId } });
    await prisma.householdMember.deleteMany({ where: { unitId } });
    await prisma.personnel.deleteMany({ where: { userId: securityId } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unitResidency.deleteMany({ where: { unitId } });
    await prisma.unitOwnership.deleteMany({ where: { unitId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.community.deleteMany({ where: { id: communityId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
    await prisma.user.deleteMany({ where: { id: securityId } });
  });

  it('ACTIVE member ACTIVE pass → gate ALLOW, then REVOKED member → pass REVOKED → gate DENY (endpoint-level)', async () => {
    // 3. verify gate allows ACTIVE pass
    const allowRes = await request(app)
      .post(`/visitors/permanent-pass/${passId}/check-in`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(allowRes.status).toBe(200);
    expect(allowRes.body.visitor).toBeDefined();

    // Cleanup visitor created by first check-in to allow second check-in attempt cleanly
    // Visitor is created per check-in; no need to delete.

    // 4. PATCH member REVOKED (one transaction should revoke linked passes)
    const patchRes = await request(app)
      .patch(`/household/members/${memberId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'REVOKED' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.member.status).toBe('REVOKED');

    // 5. verify PermanentPass row is REVOKED
    const passRow = await prisma.permanentPass.findUnique({ where: { id: passId } });
    expect(passRow).not.toBeNull();
    expect(passRow!.status).toBe('REVOKED');

    // 6. same gate endpoint must DENY revoked pass (current contract: 400 "not active", preserve if 403)
    const denyRes = await request(app)
      .post(`/visitors/permanent-pass/${passId}/check-in`)
      .set('Authorization', `Bearer ${securityToken}`);
    // Gate currently returns 400 for non-ACTIVE passes (visitors.ts:1233)
    expect([400, 403, 404]).toContain(denyRes.status);
    expect(denyRes.body.error).toBeDefined();
  });
});
