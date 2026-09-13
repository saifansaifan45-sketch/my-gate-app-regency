import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, MembershipStatus, PersonnelCategory, Department } from '@prisma/client';

describe('Visitor partySize — concurrent admission', () => {
  let communityId: string;
  let unitId: string;
  let residentId: string;
  let residentToken: string;
  let securityToken: string;
  let securityId: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const community = await prisma.community.create({ data: { name: `Party Test ${suffix}`, address: 'Test' } });
    communityId = community.id;
    const unit = await prisma.unit.create({ data: { communityId, unitNumber: `PT-${suffix}` } });
    unitId = unit.id;
    const resident = await prisma.user.create({ data: { email: `party_res_${suffix}@test.com`, passwordHash: 'x', firstName: 'PartyRes' } });
    residentId = resident.id;
    residentToken = generateTokens(resident.id).accessToken;
    await prisma.unitResidency.create({ data: { userId: resident.id, unitId: unit.id, relationshipType: 'OWNER', status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: resident.id, communityId, role: Role.RESIDENT, status: MembershipStatus.APPROVED } });

    const security = await prisma.user.create({ data: { email: `party_sec_${suffix}@test.com`, passwordHash: 'x', firstName: 'Sec' } });
    securityId = security.id;
    securityToken = generateTokens(security.id).accessToken;
    await prisma.membership.create({ data: { userId: security.id, communityId, role: Role.WORKFORCE, status: MembershipStatus.APPROVED } });
    await prisma.personnel.create({ data: { userId: security.id, name: 'Party Sec', phone: '+91 90000 00088', category: PersonnelCategory.SECURITY, department: Department.SECURITY, communityId } });
  });

  afterAll(async () => {
    await prisma.visitor.deleteMany({ where: { communityId } });
    await prisma.personnel.deleteMany({ where: { userId: securityId } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unitResidency.deleteMany({ where: { unitId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.community.delete({ where: { id: communityId } });
    await prisma.user.deleteMany({ where: { id: { in: [residentId, securityId] } } });
  });

  it('partySize 3 → sequential admit 3 succeed, concurrent 4th rejected', async () => {
    const create = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({ name: 'Party Service', purpose: 'Maintenance', visitorType: 'SERVICE', partySize: 3, isPreApproved: true });
    expect(create.status).toBe(201);
    const visitorId = create.body.visitor.id;
    expect(create.body.visitor.partySize).toBe(3);

    // Sequential admits
    const admit1 = await request(app).post(`/visitors/${visitorId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
    expect(admit1.status).toBe(200);
    const admit2 = await request(app).post(`/visitors/${visitorId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
    expect(admit2.status).toBe(200);
    const admit3 = await request(app).post(`/visitors/${visitorId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
    expect(admit3.status).toBe(200);
    expect(admit3.body.visitor.status).toBe('CHECKED_IN');

    const final = await prisma.visitor.findUnique({ where: { id: visitorId } });
    expect(final!.admittedCount).toBe(3);

    // Concurrent test: create new party visitor and try 4 concurrent admits
    const create2 = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({ name: 'Concurrent Party', purpose: 'Event', visitorType: 'SERVICE', partySize: 3, isPreApproved: true });
    const vid2 = create2.body.visitor.id;
    const results = await Promise.all([
      request(app).post(`/visitors/${vid2}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({}),
      request(app).post(`/visitors/${vid2}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({}),
      request(app).post(`/visitors/${vid2}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({}),
      request(app).post(`/visitors/${vid2}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({}),
    ]);
    const okCount = results.filter((r) => r.status === 200).length;
    const rejCount = results.filter((r) => r.status === 409).length;
    expect(okCount).toBe(3);
    expect(rejCount).toBe(1);
    const final2 = await prisma.visitor.findUnique({ where: { id: vid2 } });
    expect(final2!.admittedCount).toBe(3);
    await prisma.visitor.delete({ where: { id: vid2 } });
  });
});
