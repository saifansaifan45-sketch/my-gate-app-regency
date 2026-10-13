import request from 'supertest';
import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { setupChatWebSocketServer } from '../src/services/chatSocket';
import {
  notifyUsers,
  notifyUnitResidents,
  notifyRoleInCommunity,
} from '../src/services/notificationService';
import {
  Role,
  OwnershipStatus,
  ResidencyStatus,
  ResidencyType,
} from '@prisma/client';

describe('Standalone Notification Module Integration Suite', () => {
  let server: http.Server;
  let wsUrl: string;

  let communityId: string;
  let unitId: string;

  let residentUser: any;
  let residentToken: string;
  let residentWs: WebSocket;

  let ownerUser: any;

  let managerUser: any;
  let managerToken: string;

  const openSockets: WebSocket[] = [];

  function createTrackedSocket(url: string): WebSocket {
    const ws = new WebSocket(url);
    openSockets.push(ws);
    return ws;
  }

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const township = `Notification Township ${suffix}`;
  const residentEmail = `notif.resident.${suffix}@test.com`;
  const ownerEmail = `notif.owner.${suffix}@test.com`;
  const managerEmail = `notif.manager.${suffix}@test.com`;

  beforeAll(async () => {
    // 1. Community & Unit (unique per run; unit scoped to this community)
    let community = await prisma.community.findFirst({ where: { name: township } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: township, address: '500 Alert Way' },
      });
    }
    communityId = community.id;

    let unit = await prisma.unit.findFirst({ where: { communityId, unitNumber: '301' } });
    if (!unit) {
      unit = await prisma.unit.create({
        data: { communityId, unitNumber: '301', floor: '3', block: 'Block C' },
      });
    }
    unitId = unit.id;

    // 2. Resident User (with Push Token)
    residentUser = await prisma.user.upsert({
      where: { email: residentEmail },
      update: { role: Role.RESIDENT, unitNumber: '301', pushToken: 'ExponentPushToken[resident_token_123]' },
      create: {
        email: residentEmail,
        passwordHash: 'dummy',
        firstName: 'Aarav',
        lastName: 'Resident',
        role: Role.RESIDENT,
        unitNumber: '301',
        pushToken: 'ExponentPushToken[resident_token_123]',
      },
    });
    await prisma.membership.deleteMany({ where: { userId: residentUser.id } });
    await prisma.membership.create({
      data: { userId: residentUser.id, communityId, role: Role.RESIDENT, status: 'APPROVED' },
    });
    await prisma.unitResidency.deleteMany({ where: { userId: residentUser.id } });
    await prisma.unitResidency.create({
      data: { userId: residentUser.id, unitId, relationshipType: ResidencyType.TENANT, status: ResidencyStatus.ACTIVE },
    });
    residentToken = generateTokens(residentUser.id).accessToken;

    // 3. Owner User (with Push Token)
    ownerUser = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { role: Role.OWNER, unitNumber: '301', pushToken: 'ExponentPushToken[owner_token_456]' },
      create: {
        email: ownerEmail,
        passwordHash: 'dummy',
        firstName: 'Meera',
        lastName: 'Owner',
        role: Role.OWNER,
        unitNumber: '301',
        pushToken: 'ExponentPushToken[owner_token_456]',
      },
    });
    await prisma.membership.deleteMany({ where: { userId: ownerUser.id } });
    await prisma.membership.create({
      data: { userId: ownerUser.id, communityId, role: Role.OWNER, status: 'APPROVED' },
    });
    await prisma.unitOwnership.deleteMany({ where: { userId: ownerUser.id } });
    await prisma.unitOwnership.create({
      data: { userId: ownerUser.id, unitId, status: OwnershipStatus.ACTIVE },
    });

    // 4. Manager User
    managerUser = await prisma.user.upsert({
      where: { email: managerEmail },
      update: { role: Role.MANAGER },
      create: {
        email: managerEmail,
        passwordHash: 'dummy',
        firstName: 'Vikram',
        lastName: 'Manager',
        role: Role.MANAGER,
      },
    });
    await prisma.membership.deleteMany({ where: { userId: managerUser.id } });
    await prisma.membership.create({
      data: { userId: managerUser.id, communityId, role: Role.MANAGER, status: 'APPROVED' },
    });
    managerToken = generateTokens(managerUser.id).accessToken;

    // 5. Clean prior notifications for test users
    await prisma.notification.deleteMany({
      where: { userId: { in: [residentUser.id, ownerUser.id, managerUser.id] } },
    });

    // 6. Start HTTP Server and setup WebSockets
    server = http.createServer(app);
    setupChatWebSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        wsUrl = `ws://127.0.0.1:${port}/chat`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of openSockets) {
      try {
        ws.terminate();
      } catch {
        // socket already closed; safe to ignore during teardown
      }
    }
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Scoped cleanup: only rows owned by this run.
    await prisma.notification.deleteMany({
      where: { userId: { in: [residentUser.id, ownerUser.id, managerUser.id] } },
    });
    await prisma.unitResidency.deleteMany({ where: { unitId } });
    await prisma.unitOwnership.deleteMany({ where: { unitId } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unit.deleteMany({ where: { communityId } });
    await prisma.user.deleteMany({
      where: { id: { in: [residentUser.id, ownerUser.id, managerUser.id] } },
    });
    await prisma.community.delete({ where: { id: communityId } });
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. Standalone notificationService Multi-Channel Dispatch
  // ===========================================================================
  describe('Multi-Channel Dispatch Engine', () => {
    it('1. Connects WebSocket client and receives live notification payload', async () => {
      residentWs = createTrackedSocket(`${wsUrl}?token=${residentToken}`);

      const authPromise = new Promise<void>((resolve) => {
        residentWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'AUTHENTICATED') resolve();
        });
      });
      await authPromise;

      const liveNotifPromise = new Promise<any>((resolve) => {
        residentWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'NOTIFICATION' && msg.notification?.type === 'TEST_ALERT') {
            resolve(msg.notification);
          }
        });
      });

      // Dispatch notification via notificationService
      const result = await notifyUsers(
        [residentUser.id],
        {
          type: 'TEST_ALERT',
          title: 'System Test Alert',
          message: 'This is a multi-channel notification verification test.',
          metadata: { testKey: 'testValue123' },
        }
      );

      expect(result.persistedCount).toBe(1);
      expect(result.pushDispatchedCount).toBe(1);
      expect(result.wsDispatchedCount).toBe(1);

      const receivedWsNotif = await liveNotifPromise;
      expect(receivedWsNotif.title).toBe('System Test Alert');
      expect(receivedWsNotif.message).toContain('verification test');
      expect(receivedWsNotif.metadata?.testKey).toBe('testValue123');

      // Verify Prisma database persistence
      const dbNotif = await prisma.notification.findFirst({
        where: { userId: residentUser.id, type: 'TEST_ALERT' },
      });
      expect(dbNotif).toBeDefined();
      expect(dbNotif?.title).toBe('System Test Alert');
      expect((dbNotif?.metadata as any)?.testKey).toBe('testValue123');
    });

    it('2. notifyUnitResidents broadcasts to all active residents and owners of the unit', async () => {
      const result = await notifyUnitResidents(unitId, {
        type: 'UNIT_MAINTENANCE',
        title: 'Water Supply Scheduled Maintenance',
        message: 'Water supply will be paused tomorrow from 10 AM to 12 PM for pipeline service.',
        metadata: { unitId },
      });

      expect(result.persistedCount).toBe(2); // residentUser and ownerUser
      expect(result.pushDispatchedCount).toBe(2);

      const notifs = await prisma.notification.findMany({
        where: { type: 'UNIT_MAINTENANCE', userId: { in: [residentUser.id, ownerUser.id] } },
      });
      expect(notifs).toHaveLength(2);
    });

    it('3. notifyRoleInCommunity notifies all approved role members in community', async () => {
      const result = await notifyRoleInCommunity(
        communityId,
        [Role.MANAGER],
        {
          type: 'STAFF_ALERT',
          title: 'Manager Notice',
          message: 'Monthly inspection review scheduled.',
        }
      );

      expect(result.persistedCount).toBe(1);
      const managerNotif = await prisma.notification.findFirst({
        where: { userId: managerUser.id, type: 'STAFF_ALERT' },
      });
      expect(managerNotif).toBeDefined();
      expect(managerNotif?.title).toBe('Manager Notice');
    });
  });

  // ===========================================================================
  // 2. REST Endpoints: Push Token Registration & Management
  // ===========================================================================
  describe('Push Token Registration & Notification Inbox REST APIs', () => {
    it('4. POST /notifications/push-token updates user token', async () => {
      const newPushToken = 'ExponentPushToken[updated_token_999]';
      const res = await request(app)
        .post('/notifications/push-token')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ pushToken: newPushToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedMgr = await prisma.user.findUnique({ where: { id: managerUser.id } });
      expect(updatedMgr?.pushToken).toBe(newPushToken);
    });

    it('5. GET /notifications and /notifications/unread-count return accurate counts', async () => {
      const countRes = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${residentToken}`);

      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBeGreaterThanOrEqual(2);

      const listRes = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${residentToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.notifications)).toBe(true);
      expect(listRes.body.unreadCount).toBe(countRes.body.count);
    });

    it('6. PATCH /notifications/:id/read marks single notification as read', async () => {
      const unreadNotif = await prisma.notification.findFirst({
        where: { userId: residentUser.id, readStatus: false },
      });
      expect(unreadNotif).toBeDefined();

      const patchRes = await request(app)
        .patch(`/notifications/${unreadNotif!.id}/read`)
        .set('Authorization', `Bearer ${residentToken}`);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);

      const checkDb = await prisma.notification.findUnique({ where: { id: unreadNotif!.id } });
      expect(checkDb?.readStatus).toBe(true);
    });

    it('7. PATCH /notifications/read-all marks all unread notifications as read', async () => {
      const patchAllRes = await request(app)
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${residentToken}`);

      expect(patchAllRes.status).toBe(200);
      expect(patchAllRes.body.success).toBe(true);

      const countRes = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${residentToken}`);

      expect(countRes.body.count).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Domain Event Triggers: SOS, Tickets, Gate
  // ===========================================================================
  describe('Domain Event Trigger Integration', () => {
    it('8. Emergency SOS triggers EMERGENCY_SOS notification with metadata', async () => {
      const sosRes = await request(app)
        .post('/emergency')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({ message: 'Medical assistance required in Unit 301' });

      expect(sosRes.status).toBe(201);
      expect(sosRes.body.status).toBe('SENT');

      const sosNotif = await prisma.notification.findFirst({
        where: { type: 'EMERGENCY_SOS', metadata: { path: ['residentId'], equals: residentUser.id } },
      });
      expect(sosNotif).toBeDefined();
      expect(sosNotif?.title).toContain('Emergency SOS');
      expect((sosNotif?.metadata as any)?.unitNumber).toBe('301');
    });

    it('9. Maintenance Ticket creation triggers NEW_TICKET notification for managers', async () => {
      const ticketRes = await request(app)
        .post('/tickets')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({
          category: 'PLUMBING',
          title: 'Kitchen sink pipe dripping',
          description: 'Minor leak observed under the kitchen counter.',
          priority: 'MEDIUM',
        });

      expect(ticketRes.status).toBe(201);

      const managerTicketNotif = await prisma.notification.findFirst({
        where: {
          userId: managerUser.id,
          type: 'NEW_TICKET',
          metadata: { path: ['ticketId'], equals: ticketRes.body.id },
        },
      });
      expect(managerTicketNotif).toBeDefined();
      expect(managerTicketNotif?.title).toBe('New maintenance request');
    });
  });
});
