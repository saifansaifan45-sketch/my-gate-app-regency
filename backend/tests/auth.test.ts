import supertest from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateTokens } from '../src/utils/jwt';

const request = supertest(app);

describe('Authentication Lifecycle & Role Verification Suite', () => {
  let _accessToken!: string;
  let refreshToken!: string;

  const testEmail = 'owner@test.com';
  const testPassword = 'password123';
  

  beforeAll(async () => {
    // Clear test user
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  afterAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.membership.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it('Test 1: Register new Owner account -> User created, password hashed, membership linked', async () => {
    const res = await request.post('/auth/register').send({
      email: testEmail,
      password: testPassword,
      fullName: 'Rahul Verma',
      phoneNumber: '+91 98765 43210',
      floor: '9',
      room: 'A',
      role: 'owner',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.unitNumber).toBe('9A');
    expect(res.body.user.role).toBe(Role.OWNER);
    expect(Array.isArray(res.body.roles)).toBe(true);
    expect(res.body.roles).toContain(Role.OWNER);

    // Verify DB record
    const userInDb = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { memberships: true },
    });
    expect(userInDb).toBeDefined();
    expect(userInDb!.passwordHash).not.toBe(testPassword);
    const isMatch = await bcrypt.compare(testPassword, userInDb!.passwordHash);
    expect(isMatch).toBe(true);
    expect(userInDb!.memberships.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 2: Login using the exact same registered credentials -> Success with tokens, user, roles, and memberships', async () => {
    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.roles).toContain(Role.OWNER);
    expect(res.body.memberships.length).toBeGreaterThanOrEqual(1);

    _accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    
  });

  it('Test 3: Login with wrong password -> Returns 401 Unauthorized', async () => {
    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: 'wrongpassword999',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/invalid/i);
  });

  it('Test 4: Manager account login -> Returns OWNER and MANAGER roles and approved memberships', async () => {
    // Add manager membership for the user
    const userInDb = await prisma.user.findUnique({ where: { email: testEmail } });
    const community = await prisma.community.findFirst();

    if (userInDb && community) {
      await prisma.membership.upsert({
        where: {
          userId_communityId_role: {
            userId: userInDb.id,
            communityId: community.id,
            role: Role.MANAGER,
          },
        },
        update: { status: 'APPROVED' },
        create: {
          userId: userInDb.id,
          communityId: community.id,
          role: Role.MANAGER,
          status: 'APPROVED',
        },
      });
    }

    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.roles).toContain(Role.OWNER);
    expect(res.body.roles).toContain(Role.MANAGER);
    
  });

  it('Test 5: Fresh application restart simulation -> Refresh token restores session and /auth/me fetches profile', async () => {
    // 1. Refresh token exchange
    const refreshRes = await request.post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('refreshToken');

    const newAccessToken = refreshRes.body.accessToken;

    // 2. Hydrate user profile via /auth/me
    const meRes = await request.get('/auth/me').set('Authorization', `Bearer ${newAccessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(testEmail);
    expect(meRes.body.roles).toContain(Role.OWNER);
    expect(meRes.body.memberships.length).toBeGreaterThanOrEqual(1);
  });

  describe('Registration & Onboarding Architecture Refactor', () => {
    let pureUserToken: string;

    it('Test 6: Pure account creation -> User created with identity only (no property attached)', async () => {
      const pureEmail = `pure_${Date.now()}@regencysalma.com`;
      const res = await request.post('/auth/register').send({
        fullName: 'Sameer Sen',
        email: pureEmail,
        phoneNumber: '+91 98888 77777',
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(pureEmail);
      expect(res.body.user.firstName).toBe('Sameer');
      expect(res.body.user.ownerships).toHaveLength(0);
      expect(res.body.user.residencies).toHaveLength(0);
      expect(res.body.user.isOnboarded).toBe(false);

      pureUserToken = res.body.accessToken;
    });

    it('Test 7: Option 1 — I own a property (livesHere: true) -> Owner + Resident', async () => {
      const res = await request
        .post('/auth/onboarding/owner')
        .set('Authorization', `Bearer ${pureUserToken}`)
        .send({
          flatNumber: '9A',
          livesHere: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.ownerships).toHaveLength(1);
      expect(res.body.user.residencies).toHaveLength(1);
      expect(res.body.user.residencies[0].relationshipType).toBe('OWNER');
      expect(res.body.user.residencies[0].status).toBe('ACTIVE');
      expect(res.body.user.isOnboarded).toBe(true);
    });

    it('Test 8: Option 2 — I live in a property -> UnitResidency(PENDING)', async () => {
      const tenantEmail = `tenant_onboard_${Date.now()}@regencysalma.com`;
      const regRes = await request.post('/auth/register').send({
        fullName: 'Priya Tenant',
        email: tenantEmail,
        phoneNumber: '+91 97777 66666',
        password: 'Password123!',
      });
      const tenantToken = regRes.body.accessToken;

      const res = await request
        .post('/auth/onboarding/resident')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          flatNumber: '10B',
          relationshipType: 'TENANT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.residencies).toHaveLength(1);
      expect(res.body.user.residencies[0].relationshipType).toBe('TENANT');
      expect(res.body.user.residencies[0].status).toBe('PENDING');
    });

    it('Test 9: Option 3 — I work with community -> Employee PENDING_APPROVAL', async () => {
      const empEmail = `emp_onboard_${Date.now()}@regencysalma.com`;
      const regRes = await request.post('/auth/register').send({
        fullName: 'Vikram Security',
        email: empEmail,
        phoneNumber: '+91 96666 55555',
        password: 'Password123!',
      });
      const empToken = regRes.body.accessToken;

      const res = await request
        .post('/auth/onboarding/employee')
        .set('Authorization', `Bearer ${empToken}`)
        .send({
          role: 'SECURITY',
          department: 'Gate Security',
          experience: '5 years residential security',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      expect(res.body.user.isPendingApproval).toBe(true);
      expect(res.body.user.ownerships).toHaveLength(0);
      expect(res.body.user.residencies).toHaveLength(0);
    });

    it('Test 10: Scenario 2 — Owner NOT living in property -> Ownership ONLY (No Residency)', async () => {
      const landlordEmail = `landlord_onboard_${Date.now()}@regencysalma.com`;
      const regRes = await request.post('/auth/register').send({
        fullName: 'Vikram Verma',
        email: landlordEmail,
        phoneNumber: '+91 95555 44444',
        password: 'Password123!',
      });
      const landlordToken = regRes.body.accessToken;

      const res = await request
        .post('/auth/onboarding/owner')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          flatNumber: '9B',
          livesHere: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.ownerships).toHaveLength(1);
      expect(res.body.user.residencies).toHaveLength(0); // MUST NOT create residency
      expect(res.body.user.isOnboarded).toBe(true);
    });

    it('Test 11: Leadership approves pending employee application -> Role promoted, access granted', async () => {
      // 1. Create a leadership user
      let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
      if (!community) {
        community = await prisma.community.create({
          data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
        });
      }

      const leader = await prisma.user.upsert({
        where: { email: 'auditleader@regencysalma.com' },
        update: { role: Role.LEADERSHIP },
        create: {
          email: 'auditleader@regencysalma.com',
          passwordHash: 'dummyhash',
          firstName: 'President',
          role: Role.LEADERSHIP,
        },
      });
      await prisma.membership.upsert({
        where: { userId_communityId_role: { userId: leader.id, communityId: community.id, role: Role.LEADERSHIP } },
        update: { status: 'APPROVED' },
        create: { userId: leader.id, communityId: community.id, role: Role.LEADERSHIP, status: 'APPROVED' },
      });
      const leaderToken = generateTokens(leader.id).accessToken;

      // 2. Create pending staff applicant
      const staffEmail = `staff_applicant_${Date.now()}@regencysalma.com`;
      const staffReg = await request.post('/auth/register').send({
        fullName: 'Kiran Technician',
        email: staffEmail,
        phoneNumber: '+91 94444 33333',
        password: 'Password123!',
      });
      const staffToken = staffReg.body.accessToken;

      await request
        .post('/auth/onboarding/employee')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          role: 'MAINTENANCE',
          department: 'Electrical',
        });

      // 3. Leadership fetches pending staff memberships
      const pendingListRes = await request
        .get('/community/memberships/pending')
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(pendingListRes.status).toBe(200);
      const pendingApp = pendingListRes.body.pendingMemberships.find(
        (m: any) => m.user.email === staffEmail
      );
      expect(pendingApp).toBeDefined();

      // 4. Leadership approves staff
      const approveRes = await request
        .post(`/community/memberships/${pendingApp.id}/approve`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.membership.status).toBe('APPROVED');

      // 5. Staff checks profile via /auth/me -> Sees updated role and no pending status
      const staffMeRes = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(staffMeRes.status).toBe(200);
      expect(staffMeRes.body.role).toBe('WORKFORCE');
      expect(staffMeRes.body.isPendingApproval).toBe(false);
      expect(staffMeRes.body.isOnboarded).toBe(true);
    });
  });
});
