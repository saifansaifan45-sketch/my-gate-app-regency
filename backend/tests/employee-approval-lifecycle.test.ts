import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, AvailabilityStatus, EmploymentStatus } from '@prisma/client';

const request = supertest(app);

describe('Community Employee Onboarding & Approval Lifecycle Verification', () => {
  jest.setTimeout(30000);

  let communityId: string;
  let leaderUser: any;
  let leaderToken: string;

  beforeAll(async () => {
    // 1. Ensure test community
    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }
    communityId = community.id;

    // 2. Setup verified Leadership User
    leaderUser = await prisma.user.upsert({
      where: { email: 'president.lifecycle@regencysalma.com' },
      update: { role: Role.LEADERSHIP },
      create: {
        email: 'president.lifecycle@regencysalma.com',
        passwordHash: 'hashed_pw',
        firstName: 'President',
        lastName: 'Sharma',
        role: Role.LEADERSHIP,
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_communityId_role: {
          userId: leaderUser.id,
          communityId,
          role: Role.LEADERSHIP,
        },
      },
      update: { status: 'APPROVED' },
      create: {
        userId: leaderUser.id,
        communityId,
        role: Role.LEADERSHIP,
        status: 'APPROVED',
      },
    });

    leaderToken = generateTokens(leaderUser.id).accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Manager Lifecycle (Applicant -> Leadership Approval -> Active Manager)', () => {
    let applicantUser: any;
    let applicantToken: string;
    let membershipId: string;

    it('Step A: Manager registers and submits employee onboarding request', async () => {
      applicantUser = await prisma.user.create({
        data: {
          email: `mgr.applicant.${Date.now()}@regencysalma.com`,
          passwordHash: 'hashed_pw',
          firstName: 'Kavita',
          lastName: 'Deshmukh',
          role: Role.RESIDENT, // identity default
        },
      });

      applicantToken = generateTokens(applicantUser.id).accessToken;

      const res = await request
        .post('/auth/onboarding/employee')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          role: 'MANAGER',
          department: 'Township Operations',
          experience: '8 years facility management',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_APPROVAL');

      // Verify DB membership is PENDING
      const membership = await prisma.membership.findFirst({
        where: { userId: applicantUser.id, role: Role.MANAGER },
      });
      expect(membership).toBeTruthy();
      expect(membership?.status).toBe('PENDING');
      membershipId = membership!.id;
    });

    it('Step B: Pending manager CANNOT access manager endpoints', async () => {
      const res = await request
        .get('/manager/dashboard')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/access restricted|denied/i);
    });

    it('Step C: Leadership views pending manager applications', async () => {
      const res = await request
        .get('/leadership/managers/pending')
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.pendingManagers)).toBe(true);
      const found = res.body.pendingManagers.find((m: any) => m.id === membershipId);
      expect(found).toBeTruthy();
      expect(found.user.email).toBe(applicantUser.email);
    });

    it('Step D: Leadership approves manager application', async () => {
      const res = await request
        .post(`/leadership/managers/${membershipId}/approve`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbMembership = await prisma.membership.findUnique({ where: { id: membershipId } });
      expect(dbMembership?.status).toBe('APPROVED');
    });

    it('Step E: Newly approved Manager now has operational manager access', async () => {
      const res = await request
        .get('/manager/dashboard')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
    });
  });

  describe('2. Workforce Lifecycle (Applicant -> Manager Approval -> Active Workforce with OFF_DUTY default)', () => {
    let approvedManagerUser: any;
    let approvedManagerToken: string;

    let workerUser: any;
    let workerToken: string;
    let workerMembershipId: string;

    beforeAll(async () => {
      approvedManagerUser = await prisma.user.create({
        data: {
          email: `approved.mgr.${Date.now()}@regencysalma.com`,
          passwordHash: 'hashed_pw',
          firstName: 'Vikram',
          lastName: 'Mehta',
          role: Role.MANAGER,
        },
      });

      await prisma.membership.create({
        data: {
          userId: approvedManagerUser.id,
          communityId,
          role: Role.MANAGER,
          status: 'APPROVED',
        },
      });

      approvedManagerToken = generateTokens(approvedManagerUser.id).accessToken;
    });

    it('Step A: Worker registers and submits workforce role (Security)', async () => {
      workerUser = await prisma.user.create({
        data: {
          email: `worker.applicant.${Date.now()}@regencysalma.com`,
          passwordHash: 'hashed_pw',
          firstName: 'Ramesh',
          lastName: 'Kumar',
          role: Role.RESIDENT,
        },
      });

      workerToken = generateTokens(workerUser.id).accessToken;

      const res = await request
        .post('/auth/onboarding/employee')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          role: 'SECURITY',
          department: 'Gate Security',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_APPROVAL');

      const membership = await prisma.membership.findFirst({
        where: { userId: workerUser.id, role: Role.WORKFORCE },
      });
      expect(membership).toBeTruthy();
      expect(membership?.status).toBe('PENDING');
      expect(membership?.requestedCategory).toBe('SECURITY');
      expect(membership?.requestedDepartment).toBe('SECURITY');
      workerMembershipId = membership!.id;
    });

    it('Step B: Pending worker CANNOT access /work operational routes', async () => {
      const res = await request
        .get('/work/dashboard')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
    });

    it('Step C: Leadership cannot approve workforce membership directly via manager endpoint', async () => {
      const res = await request
        .post(`/leadership/managers/${workerMembershipId}/approve`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/not a manager application/i);
    });

    it('Step D: Manager views pending workforce applications', async () => {
      const res = await request
        .get('/manager/workforce/pending')
        .set('Authorization', `Bearer ${approvedManagerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.pendingWorkforce)).toBe(true);
      const found = res.body.pendingWorkforce.find((w: any) => w.id === workerMembershipId);
      expect(found).toBeTruthy();
    });

    it('Step E: Manager approves workforce application and profile is activated with OFF_DUTY default', async () => {
      const res = await request
        .post(`/manager/workforce/${workerMembershipId}/approve`)
        .set('Authorization', `Bearer ${approvedManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbMembership = await prisma.membership.findUnique({ where: { id: workerMembershipId } });
      expect(dbMembership?.status).toBe('APPROVED');

      const dbPersonnel = await prisma.personnel.findUnique({ where: { userId: workerUser.id } });
      expect(dbPersonnel).toBeTruthy();
      expect(dbPersonnel?.category).toBe('SECURITY');
      expect(dbPersonnel?.department).toBe('SECURITY');
      expect(dbPersonnel?.employmentStatus).toBe(EmploymentStatus.ACTIVE);
      expect(dbPersonnel?.availabilityStatus).toBe(AvailabilityStatus.OFF_DUTY);
    });

    it('Step F: Approved worker can now access /work dashboard and toggle duty status', async () => {
      // Exercise the dashboard's legacy recovery path: if the Personnel row
      // is missing, it must be recreated from the approved Security request,
      // never from Prisma's MAINTENANCE default.
      await prisma.personnel.delete({ where: { userId: workerUser.id } });

      const res = await request
        .get('/work/dashboard')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.personnelProfile).toBeDefined();
      expect(res.body.personnelProfile.category).toBe('SECURITY');
      expect(res.body.personnelProfile.department).toBe('SECURITY');
      expect(res.body.personnelProfile.availabilityStatus).toBe('OFF_DUTY');

      // Worker starts duty
      const dutyRes = await request
        .patch('/work/availability')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ availabilityStatus: 'AVAILABLE' });

      expect(dutyRes.status).toBe(200);
      expect(dutyRes.body.availabilityStatus).toBe('AVAILABLE');
    });
  });

  describe('3. Rejection Workflow', () => {
    it('Leadership can reject a manager applicant', async () => {
      const rejectUser = await prisma.user.create({
        data: {
          email: `reject.mgr.${Date.now()}@regencysalma.com`,
          passwordHash: 'hashed_pw',
          role: Role.RESIDENT,
        },
      });

      const m = await prisma.membership.create({
        data: {
          userId: rejectUser.id,
          communityId,
          role: Role.MANAGER,
          status: 'PENDING',
        },
      });

      const res = await request
        .post(`/leadership/managers/${m.id}/reject`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(200);

      const updated = await prisma.membership.findUnique({ where: { id: m.id } });
      expect(updated?.status).toBe('REJECTED');
    });
  });
});
