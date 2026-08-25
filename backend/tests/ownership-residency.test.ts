import supertest from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, OwnershipStatus, ResidencyStatus, ResidencyType } from '@prisma/client';

const request = supertest(app);

describe('Ownership, Residency & Property Relationship Suite', () => {
  let communityId: string;
  let unit9BId: string;
  let landlordToken: string;
  let landlordId: string;
  let tenantToken: string;
  let tenantId: string;
  let managerToken: string;
  let managerId: string;
  let tenantResidencyId: string;
  let ticketId: string;

  beforeAll(async () => {
    // 1. Setup Community & Unit
    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }
    communityId = community.id;

    let unit = await prisma.unit.findFirst({
      where: { communityId: community.id, unitNumber: 'TEST-9B' },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: { communityId: community.id, unitNumber: 'TEST-9B', floor: '9', block: 'Penthouse Tower' },
      });
    }
    unit9BId = unit.id;

    // 2. Manager Setup
    const manager = await prisma.user.upsert({
      where: { email: 'testmgr_prop@regencysalma.com' },
      update: { role: Role.MANAGER },
      create: {
        email: 'testmgr_prop@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'TestManager',
        role: Role.MANAGER,
        unitNumber: '9A',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: manager.id, communityId, role: Role.MANAGER } },
      update: { status: 'APPROVED' },
      create: { userId: manager.id, communityId, role: Role.MANAGER, status: 'APPROVED' },
    });
    managerId = manager.id;
    managerToken = generateTokens(manager.id).accessToken;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [landlordId, tenantId, managerId] } } }).catch(() => {});
    await prisma.ticket.deleteMany({ where: { unitId: unit9BId } }).catch(() => {});
    await prisma.unitResidency.deleteMany({ where: { unitId: unit9BId } }).catch(() => {});
    await prisma.unitOwnership.deleteMany({ where: { unitId: unit9BId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: { in: [landlordId, tenantId, managerId] } } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { userId: { in: [landlordId, tenantId, managerId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [landlordId, tenantId, managerId] } } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unit9BId } }).catch(() => {});
  });

  it('1. Owner registers account and rents out property (Ownership only, no residency in 9B)', async () => {
    const res = await request.post('/auth/register').send({
      email: 'landlord_test@regencysalma.com',
      password: 'password123',
      fullName: 'Rahul Landlord',
      relationship: 'OWNER',
      livesHere: false,
      floor: '9',
      room: 'B',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    landlordId = res.body.user.id;
    landlordToken = res.body.accessToken;

    // Explicitly link ownership of TEST-9B to this landlord
    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: landlordId, unitId: unit9BId } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: landlordId, unitId: unit9BId, status: OwnershipStatus.ACTIVE },
    });

    const ownerships = await prisma.unitOwnership.findMany({ where: { userId: landlordId } });
    expect(ownerships.length).toBeGreaterThanOrEqual(1);

    // Verify landlord does NOT have active residency in 9B
    const residencies = await prisma.unitResidency.findMany({ where: { userId: landlordId, unitId: unit9BId } });
    expect(residencies.length).toBe(0);
  });

  it('2. Tenant registers and requests residency access for Unit 9B', async () => {
    const regRes = await request.post('/auth/register').send({
      email: 'tenant_test@regencysalma.com',
      password: 'password123',
      fullName: 'Ahmed Tenant',
      relationship: 'TENANT',
      floor: '9',
      room: 'B',
    });

    expect(regRes.status).toBe(201);
    tenantId = regRes.body.user.id;
    tenantToken = regRes.body.accessToken;

    // Tenant requests residency for TEST-9B
    const reqRes = await request
      .post(`/properties/units/${unit9BId}/residency-request`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ relationshipType: 'TENANT' });

    expect(reqRes.status).toBe(201);
    expect(reqRes.body.residency).toBeDefined();
    expect(reqRes.body.residency.status).toBe(ResidencyStatus.PENDING);
    expect(reqRes.body.residency.relationshipType).toBe(ResidencyType.TENANT);
    tenantResidencyId = reqRes.body.residency.id;
  });

  it('3. Landlord receives tenant verification request notification', async () => {
    const notifs = await prisma.notification.findMany({
      where: { userId: landlordId, type: 'TENANT_VERIFICATION_REQUEST' },
    });

    expect(notifs.length).toBeGreaterThan(0);
    const targetNotif = notifs.find((n) => (n.metadata as any)?.unitId === unit9BId);
    expect(targetNotif).toBeDefined();
    expect(targetNotif?.title).toBe('Tenant Verification Request');
    expect((targetNotif?.metadata as any)?.unitId).toBe(unit9BId);
  });

  it('4. Landlord views unit residencies and approves tenant request', async () => {
    const listRes = await request
      .get(`/properties/units/${unit9BId}/residencies`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.residencies.some((r: any) => r.id === tenantResidencyId)).toBe(true);

    const approveRes = await request
      .post(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/approve`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.residency.status).toBe(ResidencyStatus.ACTIVE);
    expect(approveRes.body.residency.verifiedById).toBe(landlordId);

    // Verify tenant received RESIDENCY_APPROVED notification
    const tenantNotifs = await prisma.notification.findMany({
      where: { userId: tenantId, type: 'RESIDENCY_APPROVED' },
    });
    expect(tenantNotifs.length).toBeGreaterThan(0);
  });

  it('5. Landlord can pause and restore a tenant residency', async () => {
    const pauseRes = await request
      .patch(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/access`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ action: 'pause' });

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.residency.status).toBe(ResidencyStatus.PAUSED);

    const restoreRes = await request
      .patch(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/access`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ action: 'resume' });

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.residency.status).toBe(ResidencyStatus.ACTIVE);
  });

  it('6. Approved tenant raises a maintenance ticket for Unit 9B', async () => {
    const res = await request
      .post('/tickets')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        unitId: unit9BId,
        category: 'Plumbing',
        title: 'Kitchen sink pipe dripping',
        description: 'Water leaking under the sink counter',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('OPEN');
    ticketId = res.body.id;
  });

  it('7. Manager inspects ticket -> Sees resident, owner, and occupancy type separately', async () => {
    const res = await request
      .get(`/manager/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
    expect(res.body.occupancyType).toBe('TENANT');
    expect(Array.isArray(res.body.unitOwners)).toBe(true);
    expect(res.body.unitOwners.some((o: any) => o.id === landlordId)).toBe(true);
    expect(Array.isArray(res.body.currentResidents)).toBe(true);
    expect(res.body.currentResidents.some((r: any) => r.id === tenantId)).toBe(true);
  });

  it('8. Landlord can permanently revoke tenant residency access', async () => {
    const revokeRes = await request
      .patch(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/access`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ action: 'revoke' });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.residency.status).toBe(ResidencyStatus.REVOKED);

    const tenant = await prisma.unitResidency.findUnique({ where: { id: tenantResidencyId } });
    expect(tenant?.status).toBe(ResidencyStatus.REVOKED);
  });

  it('9. Unauthorized user cannot approve or reject residency requests', async () => {
    const unauthRes = await request
      .post(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/reject`)
      .set('Authorization', `Bearer ${tenantToken}`); // Tenant trying to reject own residency

    expect(unauthRes.status).toBe(403);

    const unauthAccessRes = await request
      .patch(`/properties/units/${unit9BId}/residencies/${tenantResidencyId}/access`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ action: 'pause' });

    expect(unauthAccessRes.status).toBe(403);
  });

  it('10. Unlinked user attempting to raise a maintenance ticket receives 403 RESIDENCE_VERIFICATION_REQUIRED', async () => {
    const unlinkedUser = await prisma.user.create({
      data: {
        email: 'unlinked_user_test@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Unlinked',
        lastName: 'User',
        role: Role.RESIDENT,
      },
    });

    const unlinkedToken = generateTokens(unlinkedUser.id).accessToken;

    const res = await request
      .post('/tickets')
      .set('Authorization', `Bearer ${unlinkedToken}`)
      .send({
        category: 'Plumbing',
        title: 'Leaking pipe',
        description: 'Water leak',
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('RESIDENCE_VERIFICATION_REQUIRED');

    // Clean up
    await prisma.user.delete({ where: { id: unlinkedUser.id } }).catch(() => {});
  });

  it('11. Unlinked user attempting to create a visitor pass receives 403 RESIDENCE_VERIFICATION_REQUIRED', async () => {
    const unlinkedUser = await prisma.user.create({
      data: {
        email: 'unlinked_visitor_test@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Unlinked',
        lastName: 'VisitorUser',
        role: Role.RESIDENT,
      },
    });

    const unlinkedToken = generateTokens(unlinkedUser.id).accessToken;

    const res = await request
      .post('/visitors')
      .set('Authorization', `Bearer ${unlinkedToken}`)
      .send({
        name: 'Guest Name',
        visitorType: 'GUEST',
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('RESIDENCE_VERIFICATION_REQUIRED');

    // Clean up
    await prisma.user.delete({ where: { id: unlinkedUser.id } }).catch(() => {});
  });
});
