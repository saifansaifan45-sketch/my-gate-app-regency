import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, AvailabilityStatus, TaskStatus, TicketStatus } from '@prisma/client';

const request = supertest(app);

describe('Leadership, Manager & Workforce Operational Hierarchy Suite', () => {
  let communityId: string;
  let leaderUser: any;
  let leaderToken: string;

  let managerUser: any;
  let managerToken: string;

  let workforceUser: any;
  let workforceToken: string;
  let workforcePersonnel: any;

  let offDutyPersonnel: any;

  let residentUser: any;
  let residentToken: string;
  let unit9A: any;

  let createdTicketId: string;
  let createdTaskId: string;

  beforeAll(async () => {
    // 1. Ensure Community & Unit
    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }
    communityId = community.id;

    unit9A = await prisma.unit.findFirst({ where: { communityId: community.id, unitNumber: '9A' } });
    if (!unit9A) {
      unit9A = await prisma.unit.create({
        data: { communityId: community.id, unitNumber: '9A', floor: '9', block: 'Penthouse Tower' },
      });
    }

    // 2. Setup Leadership User
    leaderUser = await prisma.user.upsert({
      where: { email: 'op_leader@regencysalma.com' },
      update: { role: Role.LEADERSHIP },
      create: {
        email: 'op_leader@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Anand',
        lastName: 'Leader',
        role: Role.LEADERSHIP,
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: leaderUser.id, communityId, role: Role.LEADERSHIP } },
      update: { status: 'APPROVED' },
      create: { userId: leaderUser.id, communityId, role: Role.LEADERSHIP, status: 'APPROVED' },
    });
    leaderToken = generateTokens(leaderUser.id).accessToken;

    // 3. Setup Resident User
    residentUser = await prisma.user.upsert({
      where: { email: 'op_resident@regencysalma.com' },
      update: { role: Role.RESIDENT },
      create: {
        email: 'op_resident@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Rohan',
        lastName: 'Resident',
        role: Role.RESIDENT,
        unitNumber: '9A',
      },
    });
    residentToken = generateTokens(residentUser.id).accessToken;

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: residentUser.id, unitId: unit9A.id, relationshipType: 'TENANT' } },
      update: { status: 'ACTIVE' },
      create: { userId: residentUser.id, unitId: unit9A.id, relationshipType: 'TENANT', status: 'ACTIVE' },
    });

    // 4. Setup Off-Duty Personnel for negative testing
    const existingOffDuty = await prisma.personnel.findFirst({ where: { phone: '+91 99999 11111' } });
    if (existingOffDuty) {
      offDutyPersonnel = await prisma.personnel.update({
        where: { id: existingOffDuty.id },
        data: { availabilityStatus: AvailabilityStatus.OFF_DUTY },
      });
    } else {
      offDutyPersonnel = await prisma.personnel.create({
        data: {
          name: 'OffDuty Guard',
          phone: '+91 99999 11111',
          department: 'SECURITY',
          availabilityStatus: AvailabilityStatus.OFF_DUTY,
          communityId,
        },
      });
    }
  });

  afterAll(async () => {
    if (createdTaskId) {
      await prisma.task.deleteMany({ where: { id: createdTaskId } }).catch(() => {});
    }
    if (createdTicketId) {
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } }).catch(() => {});
    }
    await prisma.personnelActivity.deleteMany({
      where: { personnelId: { in: [workforcePersonnel?.id, offDutyPersonnel?.id].filter(Boolean) } },
    }).catch(() => {});
    await prisma.personnel.deleteMany({
      where: { phone: { in: ['+91 99999 11111', '+91 99999 22222', '+91 99999 33333'] } },
    }).catch(() => {});
    await prisma.membership.deleteMany({
      where: { userId: { in: [managerUser?.id, workforceUser?.id].filter(Boolean) } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: ['pending_mgr_test@regencysalma.com', 'pending_wf_test@regencysalma.com'] } },
    }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 1. Leadership Approves Manager
  // ---------------------------------------------------------------------------
  it('1. Leadership approves manager application and promotes role', async () => {
    // 1.1 Manager registers and applies for MANAGER role
    const regRes = await request.post('/auth/register').send({
      fullName: 'Vikram Manager',
      email: 'pending_mgr_test@regencysalma.com',
      phoneNumber: '+91 99999 22222',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(201);
    const candidateToken = regRes.body.accessToken;
    managerUser = regRes.body.user;

    await request
      .post('/auth/onboarding/employee')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        role: 'MANAGER',
        department: 'Operations',
      });

    // 1.2 Leadership views pending managers
    const listRes = await request
      .get('/leadership/managers/pending')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(listRes.status).toBe(200);
    const pendingApp = listRes.body.pendingManagers.find(
      (m: any) => m.user.email === 'pending_mgr_test@regencysalma.com'
    );
    expect(pendingApp).toBeDefined();

    // 1.3 Leadership approves manager
    const approveRes = await request
      .post(`/leadership/managers/${pendingApp.id}/approve`)
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.membership.status).toBe('APPROVED');

    // 1.4 Manager logs in and verifies role is MANAGER
    const loginRes = await request.post('/auth/login').send({
      email: 'pending_mgr_test@regencysalma.com',
      password: 'Password123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.role).toBe(Role.MANAGER);
    managerToken = loginRes.body.accessToken;
  });

  // ---------------------------------------------------------------------------
  // 2. Manager cannot approve another manager
  // ---------------------------------------------------------------------------
  it('2. Manager cannot approve another manager (Leadership guard enforced)', async () => {
    const unauthRes = await request
      .get('/leadership/managers/pending')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(unauthRes.status).toBe(403);
    expect(unauthRes.body.error.message).toContain('Leadership membership required');
  });

  // ---------------------------------------------------------------------------
  // 3. Manager Approves Workforce
  // ---------------------------------------------------------------------------
  it('3. Manager views and approves workforce application', async () => {
    // 3.1 Worker registers and applies for WORKFORCE role
    const regRes = await request.post('/auth/register').send({
      fullName: 'Deepak Electrician',
      email: 'pending_wf_test@regencysalma.com',
      phoneNumber: '+91 99999 33333',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(201);
    const workerCandidateToken = regRes.body.accessToken;
    workforceUser = regRes.body.user;

    await request
      .post('/auth/onboarding/employee')
      .set('Authorization', `Bearer ${workerCandidateToken}`)
      .send({
        role: 'MAINTENANCE',
        department: 'Electrical',
      });

    // 3.2 Manager views pending workforce
    const listRes = await request
      .get('/manager/workforce/pending')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listRes.status).toBe(200);
    const pendingWf = listRes.body.pendingWorkforce.find(
      (m: any) => m.user.email === 'pending_wf_test@regencysalma.com'
    );
    expect(pendingWf).toBeDefined();

    // 3.3 Manager approves workforce
    const approveRes = await request
      .post(`/manager/workforce/${pendingWf.id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // 3.4 Worker logs in -> Sees role WORKFORCE and has Personnel record
    const loginRes = await request.post('/auth/login').send({
      email: 'pending_wf_test@regencysalma.com',
      password: 'Password123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.role).toBe(Role.WORKFORCE);
    workforceToken = loginRes.body.accessToken;

    workforcePersonnel = await prisma.personnel.findUnique({
      where: { userId: workforceUser.id },
    });
    expect(workforcePersonnel).toBeDefined();
    expect(workforcePersonnel.employmentStatus).toBe('ACTIVE');
  });

  // ---------------------------------------------------------------------------
  // 4. Workforce Cannot Access Manager Endpoints
  // ---------------------------------------------------------------------------
  it('4. Workforce member cannot access manager operational endpoints', async () => {
    const deniedRes = await request
      .get('/manager/dashboard')
      .set('Authorization', `Bearer ${workforceToken}`);

    expect(deniedRes.status).toBe(403);
    expect(deniedRes.body.error.message).toContain('Manager or Leadership membership required');
  });

  // ---------------------------------------------------------------------------
  // 5. Resident Ticket reaches Manager & Manager Assigns Task
  // ---------------------------------------------------------------------------
  it('5. Resident creates ticket -> Manager receives and assigns to active workforce member', async () => {
    // 5.1 Resident raises ticket
    const ticketRes = await request
      .post('/tickets')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({
        unitId: unit9A.id,
        category: 'Electrical',
        title: 'Flickering Hallway Lights',
        description: 'Fluorescent tubes blinking continuously in 9A corridor.',
        priority: 'HIGH',
      });

    expect(ticketRes.status).toBe(201);
    createdTicketId = ticketRes.body.id;
    expect(ticketRes.body.status).toBe(TicketStatus.OPEN);

    // 5.2 Worker starts shift / goes on duty
    await request
      .patch('/work/availability')
      .set('Authorization', `Bearer ${workforceToken}`)
      .send({ availabilityStatus: 'AVAILABLE' });

    // 5.3 Manager assigns task to active workforce member
    const assignRes = await request
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: createdTicketId,
        personnelId: workforcePersonnel.id,
        remarks: 'Check wiring and replace starter ballast',
      });

    expect(assignRes.status).toBe(201);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.task.status).toBe(TaskStatus.ASSIGNED);
    createdTaskId = assignRes.body.task.id;
  });

  // ---------------------------------------------------------------------------
  // 6. OFF_DUTY Worker Cannot Receive Task
  // ---------------------------------------------------------------------------
  it('6. OFF_DUTY or LEAVE worker is rejected for task assignment', async () => {
    const failAssignRes = await request
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: createdTicketId,
        personnelId: offDutyPersonnel.id,
      });

    expect(failAssignRes.status).toBe(400);
    expect(failAssignRes.body.error.message).toContain('off duty');
  });

  // ---------------------------------------------------------------------------
  // 7. Workforce Views Dashboard & Toggles Availability
  // ---------------------------------------------------------------------------
  it('7. Workforce accesses /work/dashboard and toggles duty availability', async () => {
    const dashRes = await request
      .get('/work/dashboard')
      .set('Authorization', `Bearer ${workforceToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.personnelProfile).toBeDefined();
    expect(dashRes.body.assignedTasks.length).toBeGreaterThanOrEqual(1);
    expect(dashRes.body.assignedTasks[0].ticket.title).toBe('Flickering Hallway Lights');

    // Toggle availability to BUSY
    const availRes = await request
      .patch('/work/availability')
      .set('Authorization', `Bearer ${workforceToken}`)
      .send({ availabilityStatus: 'BUSY' });

    expect(availRes.status).toBe(200);
    expect(availRes.body.availabilityStatus).toBe('BUSY');
  });

  // ---------------------------------------------------------------------------
  // 8. Workforce Completes Task
  // ---------------------------------------------------------------------------
  it('8. Workforce completes assigned task -> Status mirrors to Ticket and creates Activity', async () => {
    const completeRes = await request
      .post(`/work/tasks/${createdTaskId}/complete`)
      .set('Authorization', `Bearer ${workforceToken}`)
      .send({ remarks: 'Replaced ballast and verified voltage output.' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.task.status).toBe(TaskStatus.COMPLETED);

    // Verify ticket status
    const ticketInDb = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
    expect(ticketInDb?.status).toBe(TicketStatus.COMPLETED_BY_WORKER);
  });

  // ---------------------------------------------------------------------------
  // 9. Activity Logs Created
  // ---------------------------------------------------------------------------
  it('9. Personnel activities logged for task completion and manager can inspect them', async () => {
    const actRes = await request
      .get(`/manager/personnel/${workforcePersonnel.id}/activities`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(actRes.status).toBe(200);
    expect(Array.isArray(actRes.body.activities)).toBe(true);
    expect(actRes.body.activities.some((a: any) => a.type === 'TASK_COMPLETED')).toBe(true);
  });
});
