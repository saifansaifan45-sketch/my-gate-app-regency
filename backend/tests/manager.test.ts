import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, PersonnelCategory, AvailabilityStatus } from '@prisma/client';

describe('Manager Operations & Personnel Management Module — Full Domain Workflow', () => {
  let leadershipToken: string;
  let managerToken: string;
  let residentToken: string;
  let leadershipId: string;
  let managerId: string;
  let residentId: string;
  let testPersonnelId: string;
  let testTicketId: string;
  let testTaskId: string;

  beforeAll(async () => {
    let community = await prisma.community.findFirst({ where: { name: 'Regency Salma Township' } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue' },
      });
    }

    // 1. Create or get leadership user
    const leadership = await prisma.user.upsert({
      where: { email: 'testleadership@regencysalma.com' },
      update: { role: Role.LEADERSHIP },
      create: {
        email: 'testleadership@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'LeadershipAdmin',
        role: Role.LEADERSHIP,
        unitNumber: 'PH-1',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: leadership.id, communityId: community.id, role: Role.LEADERSHIP } },
      update: { status: 'APPROVED' },
      create: { userId: leadership.id, communityId: community.id, role: Role.LEADERSHIP, status: 'APPROVED' },
    });
    leadershipId = leadership.id;
    leadershipToken = generateTokens(leadership.id).accessToken;

    // 2. Create or get manager user
    const manager = await prisma.user.upsert({
      where: { email: 'testmanager@regencysalma.com' },
      update: { role: Role.MANAGER },
      create: {
        email: 'testmanager@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'TestManager',
        role: Role.MANAGER,
        unitNumber: '9A',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: manager.id, communityId: community.id, role: Role.MANAGER } },
      update: { status: 'APPROVED' },
      create: { userId: manager.id, communityId: community.id, role: Role.MANAGER, status: 'APPROVED' },
    });
    managerId = manager.id;
    managerToken = generateTokens(manager.id).accessToken;

    // 3. Create or get resident user
    const resident = await prisma.user.upsert({
      where: { email: 'testresident@regencysalma.com' },
      update: { role: Role.OWNER },
      create: {
        email: 'testresident@regencysalma.com',
        passwordHash: 'dummyhash',
        firstName: 'RahulResident',
        role: Role.OWNER,
        unitNumber: 'B-301',
      },
    });
    residentId = resident.id;
    residentToken = generateTokens(resident.id).accessToken;

    let testUnit = await prisma.unit.findFirst({ where: { communityId: community.id, unitNumber: 'B-301' } });
    if (!testUnit) {
      testUnit = await prisma.unit.create({
        data: { communityId: community.id, unitNumber: 'B-301', floor: '3', block: 'B' },
      });
    }

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: resident.id, unitId: testUnit.id, relationshipType: 'OWNER' } },
      update: { status: 'ACTIVE' },
      create: { userId: resident.id, unitId: testUnit.id, relationshipType: 'OWNER', status: 'ACTIVE' },
    });

    // 4. Create test personnel
    const personnel = await prisma.personnel.create({
      data: {
        name: 'Rahul Plumber',
        phone: '+91 99999 88888',
        category: PersonnelCategory.PLUMBER,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        employmentStatus: 'ACTIVE',
        communityId: community.id,
      },
    });
    testPersonnelId = personnel.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.notification.deleteMany({ where: { userId: { in: [leadershipId, managerId, residentId] } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { assignedPersonnelId: testPersonnelId } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { personnelId: testPersonnelId } }).catch(() => {});
    await prisma.ticket.deleteMany({ where: { residentId } }).catch(() => {});
    await prisma.personnel.delete({ where: { id: testPersonnelId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: { in: [leadershipId, managerId, residentId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [leadershipId, managerId, residentId] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Step 1: Resident creates a ticket -> Managers receive NEW_TICKET notification with unitNumber', async () => {
    const res = await request(app)
      .post('/tickets')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({
        category: 'Plumbing',
        title: 'Leaking pipe in kitchen',
        description: 'Under sink pipe is spraying water heavily',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('OPEN');
    testTicketId = res.body.id;

    // Verify manager received NEW_TICKET notification
    const mgrNotifs = await prisma.notification.findMany({
      where: { userId: managerId, type: 'NEW_TICKET' },
    });
    expect(mgrNotifs.length).toBeGreaterThan(0);
    const firstNotif = mgrNotifs[0];
    expect(firstNotif).toBeDefined();
    expect(firstNotif?.title).toBe('New maintenance request');
    expect((firstNotif?.metadata as any)?.ticketId).toBe(testTicketId);
    expect((firstNotif?.metadata as any)?.unitNumber).toBeDefined();
  });

  it('Step 2: Manager retrieves dashboard metrics and ticket inbox', async () => {
    const dashRes = await request(app)
      .get('/manager/dashboard')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.stats.pendingTickets).toBeGreaterThanOrEqual(1);

    const listRes = await request(app)
      .get('/manager/tickets?status=OPEN')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.tickets.some((t: any) => t.id === testTicketId)).toBe(true);

    const detailRes = await request(app)
      .get(`/manager/tickets/${testTicketId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.title).toBe('Leaking pipe in kitchen');
  });

  it('Step 3: Manager filters available personnel -> Excludes off-duty, shows trade and active workload', async () => {
    const res = await request(app)
      .get('/manager/personnel?available=true&category=PLUMBER')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.personnel)).toBe(true);
    const plumber = res.body.personnel.find((p: any) => p.id === testPersonnelId);
    expect(plumber).toBeDefined();
    expect(plumber.trade).toBe('PLUMBER');
    expect(plumber.availability).toBe('AVAILABLE');
    expect(typeof plumber.activeTasks).toBe('number');
  });

  it('Step 4: Manager assigns personnel to ticket -> Task created, ticket moves to ASSIGNED, resident notified', async () => {
    const res = await request(app)
      .post('/manager/tasks/assign')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        ticketId: testTicketId,
        personnelId: testPersonnelId,
        remarks: 'Please carry replacement rubber washers',
      });

    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.status).toBe('ASSIGNED');
    testTaskId = res.body.task.id;

    // Verify ticket status became ASSIGNED
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(updatedTicket?.status).toBe('ASSIGNED');

    // Verify personnel availability status is now BUSY
    const updatedPersonnel = await prisma.personnel.findUnique({ where: { id: testPersonnelId } });
    expect(updatedPersonnel?.availabilityStatus).toBe('BUSY');

    // Verify resident got notification
    const resNotifs = await prisma.notification.findMany({
      where: { userId: residentId, type: 'TASK_ASSIGNED' },
    });
    expect(resNotifs.length).toBeGreaterThan(0);
  });

  it('Step 5: Personnel starts task -> Status moves to IN_PROGRESS -> Resident notified', async () => {
    const res = await request(app)
      .patch(`/manager/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'IN_PROGRESS', remarks: 'Arrived at unit and started pipe repair' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.startedAt).toBeDefined();

    const ticket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(ticket?.status).toBe('IN_PROGRESS');

    const notifs = await prisma.notification.findMany({
      where: { userId: residentId, type: 'WORK_STARTED' },
    });
    expect(notifs.length).toBeGreaterThan(0);
  });

  it('Step 6: Personnel completes task -> Status moves to COMPLETED -> Personnel released to AVAILABLE', async () => {
    const res = await request(app)
      .patch(`/manager/tasks/${testTaskId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'COMPLETED', remarks: 'Replaced pipe gasket, no further leaks' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).toBeDefined();

    const ticket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(ticket?.status).toBe('COMPLETED_BY_WORKER');

    // Verify personnel returned to AVAILABLE
    const personnel = await prisma.personnel.findUnique({ where: { id: testPersonnelId } });
    expect(personnel?.availabilityStatus).toBe('AVAILABLE');

    const notifs = await prisma.notification.findMany({
      where: { userId: residentId, type: 'WORK_COMPLETED' },
    });
    expect(notifs.length).toBeGreaterThan(0);
  });

  it('Step 7: Manager verifies completion -> Ticket awaits resident confirmation', async () => {
    const res = await request(app)
      .patch(`/manager/tasks/${testTaskId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'VERIFIED', remarks: 'Quality inspection passed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');

    const ticket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(ticket?.status).toBe('PENDING_RESIDENT_CONFIRMATION');

    const notifs = await prisma.notification.findMany({
      where: { userId: residentId, type: 'TICKET_VERIFICATION_REQUEST' },
    });
    expect(notifs.length).toBeGreaterThan(0);
  });

  it('Step 8: Resident confirms completion -> Ticket closes', async () => {
    const res = await request(app)
      .post(`/tickets/${testTicketId}/verify`)
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ decision: 'ACCEPTED' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('CLOSED');

    const ticket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(ticket?.status).toBe('CLOSED');

    const closureNotifications = await prisma.notification.findMany({
      where: { userId: { in: [managerId, leadershipId] }, type: 'TICKET_CLOSED' },
    });
    expect(closureNotifications).toHaveLength(2);
  });

  it('Step 9: Attendance sync -> Marking personnel ABSENT sets availability to OFF_DUTY', async () => {
    // 1. Mark ABSENT via POST /manager/attendance
    const absRes = await request(app)
      .post('/manager/attendance')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        personnelId: testPersonnelId,
        status: 'ABSENT',
        remarks: 'Sick leave today',
      });

    expect(absRes.status).toBe(200);
    expect(absRes.body.success).toBe(true);

    const absentPersonnel = await prisma.personnel.findUnique({ where: { id: testPersonnelId } });
    expect(absentPersonnel?.availabilityStatus).toBe('OFF_DUTY');

    // 2. Mark PRESENT via PATCH /manager/personnel/:id/attendance
    const presRes = await request(app)
      .patch(`/manager/personnel/${testPersonnelId}/attendance`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'PRESENT',
        remarks: 'Back on duty',
      });

    expect(presRes.status).toBe(200);
    const presentPersonnel = await prisma.personnel.findUnique({ where: { id: testPersonnelId } });
    expect(presentPersonnel?.availabilityStatus).toBe('AVAILABLE');
  });

  it('Step 9: Leadership role administration -> Assign & remove manager role', async () => {
    // Grant manager role to resident
    const grantRes = await request(app)
      .post('/manager/roles/assign-manager')
      .set('Authorization', `Bearer ${leadershipToken}`)
      .send({ userId: residentId });

    expect(grantRes.status).toBe(200);
    let user = await prisma.user.findUnique({ where: { id: residentId } });
    expect(user?.role).toBe(Role.MANAGER);

    // Revoke manager role from resident
    const revokeRes = await request(app)
      .post('/manager/roles/remove-manager')
      .set('Authorization', `Bearer ${leadershipToken}`)
      .send({ userId: residentId });

    expect(revokeRes.status).toBe(200);
    user = await prisma.user.findUnique({ where: { id: residentId } });
    expect(user?.role).toBe(Role.RESIDENT);
  });
});
