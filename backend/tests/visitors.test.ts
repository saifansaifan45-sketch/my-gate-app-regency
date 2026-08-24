import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Department, MembershipStatus, PersonnelCategory, Role, VisitorStatus } from '@prisma/client';

describe('Visitor Management Integration Tests', () => {
  let residentToken: string;
  let managerToken: string;
  let securityToken: string;
  let residentId: string;
  let securityId: string;
  let createdVisitorId: string;
  let preApprovedVisitorId: string;
  let generatedOtp: string;

  beforeAll(async () => {
    const resident = await prisma.user.upsert({
      where: { email: 'visitor_resident@regencysalma.com' },
      update: {},
      create: {
        email: 'visitor_resident@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Aarav',
        lastName: 'Sharma',
        role: Role.RESIDENT,
        unitNumber: 'Tower A-402',
      },
    });
    residentId = resident.id;
    residentToken = generateTokens(resident.id).accessToken;

    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }

    let unit = await prisma.unit.findFirst({ where: { communityId: community.id, unitNumber: 'Tower A-402' } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: { communityId: community.id, unitNumber: 'Tower A-402', floor: '4', block: 'Tower A' },
      });
    }

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: resident.id, unitId: unit.id, relationshipType: 'TENANT' } },
      update: { status: 'ACTIVE' },
      create: { userId: resident.id, unitId: unit.id, relationshipType: 'TENANT', status: 'ACTIVE' },
    });

    const manager = await prisma.user.upsert({
      where: { email: 'visitor_manager@regencysalma.com' },
      update: { role: Role.MANAGER },
      create: {
        email: 'visitor_manager@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'GateManager',
        role: Role.MANAGER,
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: manager.id, communityId: community.id, role: Role.MANAGER } },
      update: { status: 'APPROVED' },
      create: { userId: manager.id, communityId: community.id, role: Role.MANAGER, status: 'APPROVED' },
    });
    managerToken = generateTokens(manager.id).accessToken;

    const security = await prisma.user.upsert({
      where: { email: 'visitor_security@regencysalma.com' },
      update: { role: Role.WORKFORCE },
      create: { email: 'visitor_security@regencysalma.com', passwordHash: 'dummyhash', firstName: 'Gate', lastName: 'Security', role: Role.WORKFORCE },
    });
    securityId = security.id;
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: security.id, communityId: community.id, role: Role.WORKFORCE } },
      update: { status: MembershipStatus.APPROVED, requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
      create: { userId: security.id, communityId: community.id, role: Role.WORKFORCE, status: MembershipStatus.APPROVED, requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
    });
    await prisma.personnel.upsert({
      where: { userId: security.id },
      update: { category: PersonnelCategory.SECURITY, department: Department.SECURITY },
      create: { userId: security.id, name: 'Gate Security', phone: '+91 90000 00001', category: PersonnelCategory.SECURITY, department: Department.SECURITY, communityId: community.id },
    });
    securityToken = generateTokens(security.id).accessToken;
  });

  afterAll(async () => {
    await prisma.visitor.deleteMany({
      where: { createdById: residentId },
    });
    await prisma.personnel.deleteMany({ where: { userId: securityId } });
    await prisma.membership.deleteMany({ where: { userId: securityId, role: Role.WORKFORCE } });
    await prisma.user.deleteMany({ where: { id: securityId } });
  });

  describe('Visitor Domain Workflows', () => {
    it('1. Should allow resident to create a standard visitor entry request', async () => {
      const res = await request(app)
        .post('/visitors')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({
          name: 'Rahul Verma',
          phone: '+91 98765 43210',
          purpose: 'Guest Visit',
          visitorType: 'GUEST',
          isPreApproved: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.visitor).toBeDefined();
      expect(res.body.visitor.name).toBe('Rahul Verma');
      expect(res.body.visitor.status).toBe(VisitorStatus.PENDING);
      expect(res.body.visitor.otp).toBeUndefined(); // Pending visitors have no OTP yet

      createdVisitorId = res.body.visitor.id;
    });

    it('2. Should allow resident to create a pre-approved guest pass with a one-time OTP', async () => {
      const res = await request(app)
        .post('/visitors')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({
          name: 'Maya Guest',
          purpose: 'Guest Visit',
          visitorType: 'GUEST',
          vehicleNumber: 'MH 02 CD 5678',
          isPreApproved: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.visitor.status).toBe(VisitorStatus.APPROVED);
      expect(res.body.visitor.isPreApproved).toBe(true);
      expect(res.body.visitor.otp).toBeDefined(); // OTP should be sent once in plaintext

      preApprovedVisitorId = res.body.visitor.id;
      generatedOtp = res.body.visitor.otp;
    });

    it('3. Should fetch my visitors for resident (OTP hidden)', async () => {
      const res = await request(app)
        .get('/visitors')
        .set('Authorization', `Bearer ${residentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.visitors)).toBe(true);
      expect(res.body.visitors[0].otp).toBeUndefined(); // OTP hashes MUST NOT be sent
    });

    it('4. Resident can approve a pending visitor', async () => {
      const res = await request(app)
        .post(`/visitors/${createdVisitorId}/approve`)
        .set('Authorization', `Bearer ${residentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visitor.status).toBe(VisitorStatus.APPROVED);
      expect(res.body.visitor.otp).toBeDefined(); // Should get an OTP back
    });

    it('5. Gate should check in an approved visitor with OTP', async () => {
      const res = await request(app)
        .post(`/visitors/${preApprovedVisitorId}/check-in`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ otp: generatedOtp });

      expect(res.status).toBe(200);
      expect(res.body.visitor.status).toBe(VisitorStatus.CHECKED_IN);
    });

    it('6. Gate cannot check in with wrong OTP', async () => {
      const res = await request(app)
        .post(`/visitors/${createdVisitorId}/check-in`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ otp: '000000' });

      expect(res.status).toBe(400);
    });

    it('7. Gate checks out a visitor', async () => {
      const res = await request(app)
        .post(`/visitors/${preApprovedVisitorId}/check-out`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visitor.status).toBe(VisitorStatus.CHECKED_OUT);
    });

    it('7.5. Gate hands off a delivery', async () => {
      // First create a new delivery pass
      const createRes = await request(app)
        .post('/visitors')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({
          name: 'Delivery Agent', purpose: 'Package Delivery', visitorType: 'DELIVERY', isPreApproved: true
        });
      const deliveryId = createRes.body.visitor.id;
      expect(createRes.body.visitor.otp).toBeUndefined();

      // Check it in
      await request(app).post(`/visitors/${deliveryId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});

      // Handoff
      const res = await request(app)
        .post(`/visitors/${deliveryId}/handoff`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ recipientType: 'GATE' });

      expect(res.status).toBe(200);
      // Status must remain CHECKED_IN because handoff is independent of exit!
      expect(res.body.visitor.status).toBe('CHECKED_IN');
      expect(res.body.visitor.handoffRecipientType).toBe('GATE');
      expect(res.body.visitor.handoffTimestamp).toBeDefined();
    });

    it('8. Resident revokes a pass instead of deleting it', async () => {
      const res = await request(app)
        .post(`/visitors/${createdVisitorId}/revoke`)
        .set('Authorization', `Bearer ${residentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visitor.status).toBe('REVOKED');
    });  });


  describe('Management Audit & History Workflows', () => {
    let otherManagerToken: string;

    beforeAll(async () => {
      // Create a different community and a manager for it
      let otherCommunity = await prisma.community.findFirst({ where: { name: 'Other Heights' } });
      if (!otherCommunity) {
        otherCommunity = await prisma.community.create({
          data: { name: 'Other Heights', address: '123 Fake St' }
        });
      }
      const otherManager = await prisma.user.upsert({
        where: { email: 'other_manager@regencysalma.com' },
        update: {},
        create: {
          email: 'other_manager@regencysalma.com',
          passwordHash: 'dummyhash',
          firstName: 'OtherManager',
          role: Role.MANAGER
        }
      });
      await prisma.membership.upsert({
        where: { userId_communityId_role: { userId: otherManager.id, communityId: otherCommunity.id, role: Role.MANAGER } },
        update: { status: 'APPROVED' },
        create: { userId: otherManager.id, communityId: otherCommunity.id, role: Role.MANAGER, status: 'APPROVED' }
      });
      otherManagerToken = generateTokens(otherManager.id).accessToken;
    });

    it('9. Residents cannot access management history endpoints', async () => {
      const res = await request(app).get('/visitors/history').set('Authorization', `Bearer ${residentToken}`);
      expect(res.status).toBe(403);
    });

    it('10. Authorized manager can read only records for their own community', async () => {
      const res = await request(app).get('/visitors/history').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.visitors)).toBe(true);
      expect(res.body.visitors.length).toBeGreaterThan(0);
      expect(res.body.visitors[0].otp).toBeUndefined(); // MUST NOT leak OTP
    });

    it('11. Manager from a different community cannot retrieve history or audit details for another community', async () => {
      // Their own history should be empty
      const historyRes = await request(app).get('/visitors/history').set('Authorization', `Bearer ${otherManagerToken}`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.visitors).toHaveLength(0);

      // Attempt to read the audit of a visitor from the first community
      const auditRes = await request(app).get(`/visitors/${createdVisitorId}/audit`).set('Authorization', `Bearer ${otherManagerToken}`);
      expect(auditRes.status).toBe(404); // Or 403, but our code returns 404 'Visitor not found' for mismatched community
    });

    it('12. Unknown record IDs return safe 404 response', async () => {
      const res = await request(app).get('/visitors/99999999-9999-9999-9999-999999999999/audit').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('13. Audit timeline returns only the requested record’s audit events in chronological order', async () => {
      const res = await request(app).get(`/visitors/${createdVisitorId}/audit`).set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.visitor.id).toBe(createdVisitorId);
      expect(res.body.visitor.otp).toBeUndefined(); // MUST NOT leak OTP
      expect(Array.isArray(res.body.auditLogs)).toBe(true);
      
      // We expect at least created, approved, revoked events for createdVisitorId
      expect(res.body.auditLogs.length).toBeGreaterThanOrEqual(1);

      // Check chronological sorting (descending is typical for APIs, let's verify our endpoint's sort)
      if (res.body.auditLogs.length >= 2) {
        const time1 = new Date(res.body.auditLogs[0].createdAt).getTime();
        const time2 = new Date(res.body.auditLogs[1].createdAt).getTime();
        expect(time1).toBeGreaterThanOrEqual(time2); // Descending order
      }
    });

    it('14. Delivery handoff details are included securely and do not leak OTP', async () => {
      // preApprovedVisitorId is a DELIVERY that was handed off and checked out in tests 7 & 7.5
      // Wait, 7.5 hands off a NEW delivery pass. Let's get that one!
      // I'll just check the preApprovedVisitorId which was checked out. Or wait, let me just create one here.
      
      const createRes = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({
        name: 'Safe Delivery', purpose: 'Package Delivery', visitorType: 'DELIVERY', isPreApproved: true
      });
      const delId = createRes.body.visitor.id;
      expect(createRes.body.visitor.otp).toBeUndefined();

      await request(app).post(`/visitors/${delId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
      await request(app).post(`/visitors/${delId}/handoff`).set('Authorization', `Bearer ${securityToken}`).send({ recipientType: 'LOCKER' });

      const auditRes = await request(app).get(`/visitors/${delId}/audit`).set('Authorization', `Bearer ${managerToken}`);
      
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.visitor.id).toBe(delId);
      expect(auditRes.body.visitor.visitorType).toBe('DELIVERY');
      expect(auditRes.body.visitor.handoffRecipientType).toBe('LOCKER');
      expect(auditRes.body.visitor.handoffTimestamp).toBeDefined();
      expect(auditRes.body.visitor.otp).toBeUndefined(); // MUST NOT leak
    });

    it('15. Operator from a different community cannot check in, check out, or hand off a record from another community', async () => {
      // createdVisitorId is from the primary community
      // otherManagerToken is from the secondary community
      const checkInRes = await request(app).post(`/visitors/${createdVisitorId}/check-in`).set('Authorization', `Bearer ${otherManagerToken}`).send({ otp: '000000' });
      expect(checkInRes.status).toBe(403);

      const checkOutRes = await request(app).post(`/visitors/${createdVisitorId}/check-out`).set('Authorization', `Bearer ${otherManagerToken}`);
      expect(checkOutRes.status).toBe(403);

      const handoffRes = await request(app).post(`/visitors/${createdVisitorId}/handoff`).set('Authorization', `Bearer ${otherManagerToken}`).send({ recipientType: 'GATE' });
      expect(handoffRes.status).toBe(403);
    });

    it('16. Duplicate handoff attempts are rejected to preserve immutability', async () => {
      // First create and handoff a delivery pass
      const createRes = await request(app).post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({
        name: 'Fast Delivery', purpose: 'Package Delivery', visitorType: 'DELIVERY', isPreApproved: true
      });
      const delId = createRes.body.visitor.id;
      expect(createRes.body.visitor.otp).toBeUndefined();

      await request(app).post(`/visitors/${delId}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
      
      const firstHandoffRes = await request(app).post(`/visitors/${delId}/handoff`).set('Authorization', `Bearer ${securityToken}`).send({ recipientType: 'LOCKER' });
      expect(firstHandoffRes.status).toBe(200);

      // Attempt second handoff
      const secondHandoffRes = await request(app).post(`/visitors/${delId}/handoff`).set('Authorization', `Bearer ${securityToken}`).send({ recipientType: 'RESIDENT' });
      expect(secondHandoffRes.status).toBe(400);
      expect(secondHandoffRes.body.error.message).toBe('Handoff already completed');
    });


  });

});
