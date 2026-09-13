import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, MembershipStatus } from '@prisma/client';

describe('Leadership authorization — requireLeadership strict', () => {
  let communityId: string;
  let leadershipId: string;
  let leadershipToken: string;
  let managerId: string;
  let managerToken: string;
  let workforceId: string;
  let workforceToken: string;
  let residentId: string;
  let residentToken: string;
  let ownerId: string;
  let ownerToken: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const community = await prisma.community.create({ data: { name: `Leadership Test ${suffix}`, address: 'Test Lane' } });
    communityId = community.id;

    const createUserWithRole = async (email: string, role: Role) => {
      const user = await prisma.user.create({ data: { email: `${email}_${suffix}@test.com`, passwordHash: 'dummyhash', firstName: email, role } });
      const token = generateTokens(user.id).accessToken;
      await prisma.membership.create({ data: { userId: user.id, communityId, role, status: MembershipStatus.APPROVED } });
      return { user, token };
    };

    const l = await createUserWithRole('leadership', Role.LEADERSHIP);
    leadershipId = l.user.id;
    leadershipToken = l.token;

    const m = await createUserWithRole('manager', Role.MANAGER);
    managerId = m.user.id;
    managerToken = m.token;

    const w = await createUserWithRole('workforce', Role.WORKFORCE);
    workforceId = w.user.id;
    workforceToken = w.token;

    const r = await createUserWithRole('resident', Role.RESIDENT);
    residentId = r.user.id;
    residentToken = r.token;

    const o = await createUserWithRole('owner', Role.OWNER);
    ownerId = o.user.id;
    ownerToken = o.token;
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.community.deleteMany({ where: { id: communityId } });
    await prisma.user.deleteMany({ where: { id: leadershipId } });
    await prisma.user.deleteMany({ where: { id: managerId } });
    await prisma.user.deleteMany({ where: { id: workforceId } });
    await prisma.user.deleteMany({ where: { id: residentId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it('WORKFORCE → 403 on leadership endpoint', async () => {
    const res = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${workforceToken}`);
    expect(res.status).toBe(403);
  });

  it('RESIDENT → 403', async () => {
    const res = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${residentToken}`);
    expect(res.status).toBe(403);
  });

  it('MANAGER → 403', async () => {
    const res = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('OWNER → 403', async () => {
    const res = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('LEADERSHIP → success (200)', async () => {
    const res = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${leadershipToken}`);
    expect(res.status).toBe(200);
  });
});
