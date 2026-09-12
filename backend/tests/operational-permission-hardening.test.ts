import supertest from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, AvailabilityStatus, TaskStatus, TicketStatus, EmploymentStatus } from '@prisma/client';

const request = supertest(app);

describe('Operational Role Permission Hardening & Database-Backed Security Audit', () => {
  jest.setTimeout(30000);

  let communityId: string;
  let leaderUser: any;
  let leaderToken: string;

  let managerUser: any;
  let managerToken: string;

  let fakeRoleUser: any;
  let fakeRoleToken: string;

  let workforceUser: any;
  let workforceToken: string;
  let workforcePersonnel: any;

  let residentUser: any;
  let _residentToken: string;
  let unit9A: any;
  let testTicket: any;

  beforeAll(async () => {
    // 1. Setup Community & Unit
    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }
    communityId = community.id;

    unit9A = await prisma.unit.findFirst({ where: { communityId, unitNumber: '9A' } });
    if (!unit9A) {
      unit9A = await prisma.unit.create({
        data: { communityId, unitNumber: '9A', floor: '9', block: 'Tower A' },
      });
    }

    // 2. Setup Approved Leadership
    leaderUser = await prisma.user.upsert({
      where: { email: 'sec_leader@regencysalma.com' },
      update: { role: Role.LEADERSHIP },
      create: {
        email: 'sec_leader@regencysalma.com',
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

    // 3. Setup Approved Manager
    managerUser = await prisma.user.upsert({
      where: { email: 'sec_manager@regencysalma.com' },
      update: { role: Role.MANAGER },
      create: {
        email: 'sec_manager@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Suresh',
        lastName: 'Manager',
        role: Role.MANAGER,
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: managerUser.id, communityId, role: Role.MANAGER } },
      update: { status: 'APPROVED' },
      create: { userId: managerUser.id, communityId, role: Role.MANAGER, status: 'APPROVED' },
    });
    managerToken = generateTokens(managerUser.id).accessToken;

    // 4. Setup User with User.role = MANAGER but NO active approved membership
    fakeRoleUser = await prisma.user.upsert({
      where: { email: 'fake_role@regencysalma.com' },
      update: { role: Role.MANAGER },
      create: {
        email: 'fake_role@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Fake',
        lastName: 'Manager',
        role: Role.MANAGER,
      },
    });
    // Ensure no approved membership exists
    await prisma.membership.deleteMany({ where: { userId: fakeRoleUser.id } });
    fakeRoleToken = generateTokens(fakeRoleUser.id).accessToken;

    // 5. Setup Workforce user
    workforceUser = await prisma.user.upsert({
      where: { email: 'sec_worker@regencysalma.com' },
      update: { role: Role.WORKFORCE },
      create: {
        email: 'sec_worker@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Ramesh',
        lastName: 'Electrician',
        phoneNumber: '+91 99999 88888',
        role: Role.WORKFORCE,
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: workforceUser.id, communityId, role: Role.WORKFORCE } },
      update: { status: 'APPROVED' },
      create: { userId: workforceUser.id, communityId, role: Role.WORKFORCE, status: 'APPROVED' },
    });
    workforceToken = generateTokens(workforceUser.id).accessToken;

    workforcePersonnel = await prisma.personnel.upsert({
      where: { userId: workforceUser.id },
      update: { employmentStatus: EmploymentStatus.ACTIVE, availabilityStatus: AvailabilityStatus.AVAILABLE },
      create: {
        userId: workforceUser.id,
        name: 'Ramesh Electrician',
        phone: '+91 99999 88888',
        department: 'MAINTENANCE',
        designation: 'Staff Electrician',
        employmentStatus: EmploymentStatus.ACTIVE,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        communityId,
      },
    });

    // 6. Setup Resident User and Ticket
    residentUser = await prisma.user.upsert({
      where: { email: 'sec_resident@regencysalma.com' },
      update: { role: Role.RESIDENT },
      create: {
        email: 'sec_resident@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'Pooja',
        lastName: 'Resident',
        role: Role.RESIDENT,
        unitNumber: '9A',
      },
    });
    const _residentToken = generateTokens(residentUser.id).accessToken;

    testTicket = await prisma.ticket.create({
      data: {
        residentId: residentUser.id,
        communityId,
        unitId: unit9A.id,
        category: 'Electrical',
        title: 'Geyser Short Circuit',
        description: 'Bathroom heater tripper popping continuously.',
        priority: 'HIGH',
        status: TicketStatus.OPEN,
      },
    });
  });

  afterAll(async () => {
    if (testTicket?.id) {
      await prisma.task.deleteMany({ where: { ticketId: testTicket.id } }).catch(() => {});
      await prisma.ticket.deleteMany({ where: { id: testTicket.id } }).catch(() => {});
    }
    await prisma.personnelActivity.deleteMany({
      where: { personnelId: workforcePersonnel?.id },
    }).catch(() => {});
    await prisma.personnel.deleteMany({
      where: { userId: { in: [workforceUser?.id, managerUser?.id, fakeRoleUser?.id].filter(Boolean) } },
    }).catch(() => {});
    await prisma.membership.deleteMany({
      where: { userId: { in: [leaderUser?.id, managerUser?.id, fakeRoleUser?.id, workforceUser?.id].filter(Boolean) } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'sec_leader@regencysalma.com',
            'sec_manager@regencysalma.com',
            'fake_role@regencysalma.com',
            'sec_worker@regencysalma.com',
            'sec_resident@regencysalma.com',
          ],
        },
      },
    }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 1. User.role alone does NOT grant Manager or Leadership access
  // ---------------------------------------------------------------------------
  it('1. Rejects manager access if CommunityMembership is missing, even if User.role === MANAGER', async () => {
    const res = await request
      .get('/manager/dashboard')
      .set('Authorization', `Bearer ${fakeRoleToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Active Manager or Leadership membership required');
  });

  // ---------------------------------------------------------------------------
  // 2. User.role alone does NOT grant Workforce access
  // ---------------------------------------------------------------------------
  it('2. Rejects workforce access if CommunityMembership is missing, even if User.role === WORKFORCE', async () => {
    // Demote fake user role to WORKFORCE
    await prisma.user.update({
      where: { id: fakeRoleUser.id },
      data: { role: Role.WORKFORCE },
    });

    const res = await request
      .get('/work/dashboard')
      .set('Authorization', `Bearer ${fakeRoleToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Active Workforce membership required');
  });

  // ---------------------------------------------------------------------------
  // 3. Manager Assignment & Task Assignment Validation
  // ---------------------------------------------------------------------------
  it('3. Manager can assign task to active & available workforce member', async () => {
    const res = await request
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: testTicket.id,
        personnelId: workforcePersonnel.id,
        remarks: 'Check fuse wire',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task.status).toBe(TaskStatus.ASSIGNED);
  });

  // ---------------------------------------------------------------------------
  // 4. OFF_DUTY or LEAVE worker cannot receive assignments
  // ---------------------------------------------------------------------------
  it('4. Rejects task assignment if workforce member is OFF_DUTY or LEAVE', async () => {
    await prisma.personnel.update({
      where: { id: workforcePersonnel.id },
      data: { availabilityStatus: AvailabilityStatus.OFF_DUTY },
    });

    const res = await request
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: testTicket.id,
        personnelId: workforcePersonnel.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('off duty');

    // Restore to AVAILABLE
    await prisma.personnel.update({
      where: { id: workforcePersonnel.id },
      data: { availabilityStatus: AvailabilityStatus.AVAILABLE },
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Suspended worker cannot receive assignments or complete tasks
  // ---------------------------------------------------------------------------
  it('5. Suspended workforce member cannot receive tasks or complete tasks', async () => {
    // 5.1 Manager sets status to SUSPENDED
    const patchRes = await request
      .patch(`/manager/personnel/${workforcePersonnel.id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employmentStatus: 'SUSPENDED' });

    expect(patchRes.status).toBe(200);

    // 5.2 Attempt to assign task
    const assignRes = await request
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: testTicket.id,
        personnelId: workforcePersonnel.id,
      });

    expect(assignRes.status).toBe(400);
    expect(assignRes.body.error.message).toContain('suspended');

    // 5.3 Attempt to complete task
    const activeTask = await prisma.task.findFirst({
      where: { assignedPersonnelId: workforcePersonnel.id, status: TaskStatus.ASSIGNED },
    });

    if (activeTask) {
      const compRes = await request
        .post(`/work/tasks/${activeTask.id}/complete`)
        .set('Authorization', `Bearer ${workforceToken}`)
        .send({ remarks: 'Done while suspended' });

      expect(compRes.status).toBe(403);
      expect(compRes.body.error.message).toContain('suspended');
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Terminated worker loses operational access immediately
  // ---------------------------------------------------------------------------
  it('6. Terminated workforce member cannot access /work endpoints', async () => {
    // 6.1 Manager sets status to TERMINATED
    const patchRes = await request
      .patch(`/manager/personnel/${workforcePersonnel.id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employmentStatus: 'TERMINATED' });

    expect(patchRes.status).toBe(200);

    // 6.2 Worker tries to access /work/dashboard
    const dashRes = await request
      .get('/work/dashboard')
      .set('Authorization', `Bearer ${workforceToken}`);

    expect(dashRes.status).toBe(403);
    expect(dashRes.body.error.message).toContain('Access denied');
  });

  // ---------------------------------------------------------------------------
  // 7. Leadership revokes Manager -> Manager loses access immediately
  // ---------------------------------------------------------------------------
  it('7. Manager revoked by Leadership immediately loses operational access', async () => {
    // 7.1 Leadership removes manager privileges
    const removeRes = await request
      .post('/manager/roles/remove-manager')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ userId: managerUser.id, communityId });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.success).toBe(true);

    // 7.2 Revoked manager attempts to access /manager/dashboard
    const deniedRes = await request
      .get('/manager/dashboard')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(deniedRes.status).toBe(403);
    expect(deniedRes.body.error.message).toContain('Active Manager or Leadership membership required');
  });
});
