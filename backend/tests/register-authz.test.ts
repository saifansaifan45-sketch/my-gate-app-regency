import supertest from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { Role, MembershipStatus } from '@prisma/client';

const request = supertest;

describe('Register self-escalation — MANAGER via public registration', () => {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const managerEmail = `manager_escalate_${suffix}@test.com`;
  const ownerEmail = `owner_legit_${suffix}@test.com`;
  let managerToken: string;
  let _managerMembershipId: string;

  it('MANAGER requested via public register → membership PENDING, not APPROVED manager', async () => {
    const res = await request(app).post('/auth/register').send({
      email: managerEmail,
      password: 'Password123!',
      fullName: 'Escalate Manager',
      floor: '9',
      room: 'A',
      role: 'MANAGER',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();

    const user = await prisma.user.findUnique({ where: { email: managerEmail } });
    expect(user).not.toBeNull();
    // User role should remain RESIDENT, not MANAGER, until approved
    expect(user!.role).not.toBe(Role.MANAGER);

    const membership = await prisma.membership.findFirst({ where: { userId: user!.id, role: Role.MANAGER } });
    expect(membership).not.toBeNull();
    expect(membership!.status).toBe(MembershipStatus.PENDING);
    _managerMembershipId = membership!.id;
    managerToken = res.body.accessToken;

    // Must not be able to operate as manager immediately
    const gateRes = await request(app).post('/manager/roles/assign-manager').set('Authorization', `Bearer ${managerToken}`).send({ email: 'someone@test.com' });
    // Leadership endpoint should deny — 403, not 200
    expect([401, 403, 404]).toContain(gateRes.status);

    const pendingRes = await request(app).get('/community/memberships/pending').set('Authorization', `Bearer ${managerToken}`);
    expect(pendingRes.status).toBe(403);
  });

  it('Legitimate OWNER via public register → still APPROVED', async () => {
    const res = await request(app).post('/auth/register').send({
      email: ownerEmail,
      password: 'Password123!',
      fullName: 'Legit Owner',
      floor: '10',
      room: 'B',
      role: 'owner',
    });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
    const membership = await prisma.membership.findFirst({ where: { userId: user!.id, role: Role.OWNER } });
    expect(membership!.status).toBe(MembershipStatus.APPROVED);
  });

  afterAll(async () => {
    const mUser = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (mUser) {
      await prisma.membership.deleteMany({ where: { userId: mUser.id } });
      await prisma.unitResidency.deleteMany({ where: { userId: mUser.id } });
      await prisma.unitOwnership.deleteMany({ where: { userId: mUser.id } });
      await prisma.session.deleteMany({ where: { userId: mUser.id } });
      await prisma.user.delete({ where: { id: mUser.id } });
    }
    const oUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (oUser) {
      await prisma.membership.deleteMany({ where: { userId: oUser.id } });
      await prisma.unitResidency.deleteMany({ where: { userId: oUser.id } });
      await prisma.unitOwnership.deleteMany({ where: { userId: oUser.id } });
      await prisma.session.deleteMany({ where: { userId: oUser.id } });
      await prisma.user.delete({ where: { id: oUser.id } });
    }
  });
});
