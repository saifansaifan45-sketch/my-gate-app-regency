import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role } from '@prisma/client';

describe('Visitor purpose hardening — purpose required', () => {
  let residentToken: string;
  let communityId: string;
  let unitId: string;
  let residentId: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const community = await prisma.community.create({ data: { name: `Purpose Test ${suffix}`, address: 'Test Lane' } });
    communityId = community.id;
    const unit = await prisma.unit.create({ data: { communityId, unitNumber: `V-${suffix}`, block: 'Block V' } });
    unitId = unit.id;
    const resident = await prisma.user.create({ data: { email: `purpose_${suffix}@test.com`, passwordHash: 'dummyhash', firstName: 'Purpose', role: Role.RESIDENT } });
    residentId = resident.id;
    residentToken = generateTokens(resident.id).accessToken;
    await prisma.unitResidency.create({ data: { userId: resident.id, unitId: unit.id, relationshipType: 'OWNER', status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: resident.id, communityId, role: Role.RESIDENT, status: 'APPROVED' } });
  });

  afterAll(async () => {
    await prisma.visitor.deleteMany({ where: { communityId } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unitResidency.deleteMany({ where: { unitId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.community.deleteMany({ where: { id: communityId } });
    await prisma.user.deleteMany({ where: { id: residentId } });
  });

  it('POST /visitors without purpose → 400', async () => {
    const res = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({ name: 'No Purpose', visitorType: 'GUEST' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /visitors with purpose → 201', async () => {
    const res = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({ name: 'With Purpose', purpose: 'Guest Visit', visitorType: 'GUEST' });
    expect(res.status).toBe(201);
    expect(res.body.visitor.purpose).toBe('Guest Visit');
  });
});
