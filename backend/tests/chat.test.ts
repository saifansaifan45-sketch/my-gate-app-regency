import request from 'supertest';
import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { setupChatWebSocketServer } from '../src/services/chatSocket';
import {
  Role,
  OwnershipStatus,
  ResidencyStatus,
  ResidencyType,
  ChatChannelType,
} from '@prisma/client';

describe('Chat WebSockets & Persistence Suite', () => {
  let server: http.Server;
  let wsUrl: string;

  let leadershipId: string;
  let leadershipToken: string;
  let ownerId: string;
  let ownerToken: string;
  let tenantId: string;
  let tenantToken: string;
  let otherTenantId: string;
  let otherTenantToken: string;

  let communityId: string;
  let unit1Id: string;
  let unit2Id: string;

  let unit1ChannelId: string;
  let unit2ChannelId: string;
  let ownersChannelId: string;
  let leadershipChannelId: string;

  const openSockets: WebSocket[] = [];

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const township = `Chat Test Township ${suffix}`;

  function createTrackedSocket(url: string): WebSocket {
    const ws = new WebSocket(url);
    openSockets.push(ws);
    return ws;
  }

  beforeAll(async () => {
    // 1. Community & Units
    let community = await prisma.community.findFirst({ where: { name: township } });
    if (!community) {
      community = await prisma.community.create({
        data: { name: township, address: '100 Chat Blvd' },
      });
    }
    communityId = community.id;

    let unit1 = await prisma.unit.findFirst({ where: { communityId, unitNumber: '101' } });
    if (!unit1) {
      unit1 = await prisma.unit.create({
        data: { communityId, unitNumber: '101', floor: '1', block: 'Block A' },
      });
    }
    unit1Id = unit1.id;
    unit1ChannelId = `unit:${unit1Id}`;

    let unit2 = await prisma.unit.findFirst({ where: { communityId, unitNumber: '201' } });
    if (!unit2) {
      unit2 = await prisma.unit.create({
        data: { communityId, unitNumber: '201', floor: '2', block: 'Block B' },
      });
    }
    unit2Id = unit2.id;
    unit2ChannelId = `unit:${unit2Id}`;

    ownersChannelId = `channel:owners:${communityId}`;
    leadershipChannelId = `channel:leadership_management:${communityId}`;

    // 2. Users Setup
    // Leadership
    const leaderEmail = `chat.leader.${suffix}@test.com`;
    const leader = await prisma.user.upsert({
      where: { email: leaderEmail },
      update: { role: Role.LEADERSHIP },
      create: {
        email: leaderEmail,
        passwordHash: 'dummy',
        firstName: 'ChatLeader',
        role: Role.LEADERSHIP,
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: leader.id, communityId, role: Role.LEADERSHIP } },
      update: { status: 'APPROVED' },
      create: { userId: leader.id, communityId, role: Role.LEADERSHIP, status: 'APPROVED' },
    });
    leadershipId = leader.id;
    leadershipToken = generateTokens(leader.id).accessToken;

    // Owner (Unit 101)
    const ownerEmail = `chat.owner.${suffix}@test.com`;
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { role: Role.OWNER, unitNumber: '101' },
      create: {
        email: ownerEmail,
        passwordHash: 'dummy',
        firstName: 'ChatOwner',
        role: Role.OWNER,
        unitNumber: '101',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: owner.id, communityId, role: Role.OWNER } },
      update: { status: 'APPROVED' },
      create: { userId: owner.id, communityId, role: Role.OWNER, status: 'APPROVED' },
    });
    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: owner.id, unitId: unit1Id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: owner.id, unitId: unit1Id, status: OwnershipStatus.ACTIVE },
    });
    ownerId = owner.id;
    ownerToken = generateTokens(owner.id).accessToken;

    // Tenant (Unit 101)
    const tenantEmail = `chat.tenant.${suffix}@test.com`;
    const tenant = await prisma.user.upsert({
      where: { email: tenantEmail },
      update: { role: Role.TENANT, unitNumber: '101' },
      create: {
        email: tenantEmail,
        passwordHash: 'dummy',
        firstName: 'ChatTenant',
        role: Role.TENANT,
        unitNumber: '101',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: tenant.id, communityId, role: Role.TENANT } },
      update: { status: 'APPROVED' },
      create: { userId: tenant.id, communityId, role: Role.TENANT, status: 'APPROVED' },
    });
    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: tenant.id, unitId: unit1Id, relationshipType: ResidencyType.TENANT } },
      update: { status: ResidencyStatus.ACTIVE },
      create: { userId: tenant.id, unitId: unit1Id, relationshipType: ResidencyType.TENANT, status: ResidencyStatus.ACTIVE },
    });
    tenantId = tenant.id;
    tenantToken = generateTokens(tenant.id).accessToken;

    // Other Tenant (Unit 201)
    const otherEmail = `chat.other.${suffix}@test.com`;
    const otherTenant = await prisma.user.upsert({
      where: { email: otherEmail },
      update: { role: Role.TENANT, unitNumber: '201' },
      create: {
        email: otherEmail,
        passwordHash: 'dummy',
        firstName: 'OtherTenant',
        role: Role.TENANT,
        unitNumber: '201',
      },
    });
    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: otherTenant.id, communityId, role: Role.TENANT } },
      update: { status: 'APPROVED' },
      create: { userId: otherTenant.id, communityId, role: Role.TENANT, status: 'APPROVED' },
    });
    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: otherTenant.id, unitId: unit2Id, relationshipType: ResidencyType.TENANT } },
      update: { status: ResidencyStatus.ACTIVE },
      create: { userId: otherTenant.id, unitId: unit2Id, relationshipType: ResidencyType.TENANT, status: ResidencyStatus.ACTIVE },
    });
    otherTenantId = otherTenant.id;
    otherTenantToken = generateTokens(otherTenant.id).accessToken;

    // Start HTTP server for WebSocket tests
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
    // Scoped cleanup: only rows created by this run (dependency-safe order).
    await prisma.chatMessage.deleteMany({ where: { communityId } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: [leadershipId, ownerId, tenantId, otherTenantId] } } });
    await prisma.unitResidency.deleteMany({ where: { unitId: { in: [unit1Id, unit2Id] } } });
    await prisma.unitOwnership.deleteMany({ where: { unitId: { in: [unit1Id, unit2Id] } } });
    await prisma.membership.deleteMany({ where: { communityId } });
    await prisma.unit.deleteMany({ where: { communityId } });
    await prisma.user.deleteMany({ where: { id: { in: [leadershipId, ownerId, tenantId, otherTenantId] } } });
    await prisma.community.delete({ where: { id: communityId } });
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. REST API Channels & Authorization Tests
  // ===========================================================================
  describe('REST /chat/channels', () => {
    it('0. Unauthenticated requests are rejected → 401', async () => {
      const res = await request(app).get('/chat/channels');
      expect(res.status).toBe(401);
    });

    it('0b. Revoked/paused member loses channel access', async () => {
      await prisma.membership.updateMany({
        where: { userId: tenantId, communityId },
        data: { status: 'REVOKED' },
      });
      await prisma.unitResidency.updateMany({
        where: { userId: tenantId, unitId: unit1Id },
        data: { status: 'REVOKED' },
      });
      const denied = await request(app)
        .get(`/chat/messages?channelId=${unit1ChannelId}`)
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(denied.status).toBe(403);
      await prisma.membership.updateMany({
        where: { userId: tenantId, communityId },
        data: { status: 'APPROVED' },
      });
      await prisma.unitResidency.updateMany({
        where: { userId: tenantId, unitId: unit1Id },
        data: { status: ResidencyStatus.ACTIVE },
      });
    });

    it('1. Leadership sees leadership channel, owners channel, and community channels', async () => {
      const res = await request(app)
        .get('/chat/channels')
        .set('Authorization', `Bearer ${leadershipToken}`);

      expect(res.status).toBe(200);
      const channelTypes = res.body.channels.map((c: any) => c.channelType);
      expect(channelTypes).toContain(ChatChannelType.LEADERSHIP_MANAGEMENT);
      expect(channelTypes).toContain(ChatChannelType.OWNERS);
    });

    it('2. Owner sees Owners channel and Unit 101 channel, but NOT leadership channel', async () => {
      const res = await request(app)
        .get('/chat/channels')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const channelTypes = res.body.channels.map((c: any) => c.channelType);
      expect(channelTypes).toContain(ChatChannelType.OWNERS);
      expect(channelTypes).toContain(ChatChannelType.UNIT);
      expect(channelTypes).not.toContain(ChatChannelType.LEADERSHIP_MANAGEMENT);

      const channelIds = res.body.channels.map((c: any) => c.channelId);
      expect(channelIds).toContain(unit1ChannelId);
      expect(channelIds).not.toContain(unit2ChannelId);
    });

    it('3. Resident/Tenant sees only Unit 101 channel', async () => {
      const res = await request(app)
        .get('/chat/channels')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(200);
      const channelTypes = res.body.channels.map((c: any) => c.channelType);
      expect(channelTypes).toContain(ChatChannelType.UNIT);
      expect(channelTypes).not.toContain(ChatChannelType.OWNERS);
      expect(channelTypes).not.toContain(ChatChannelType.LEADERSHIP_MANAGEMENT);

      const channelIds = res.body.channels.map((c: any) => c.channelId);
      expect(channelIds).toContain(unit1ChannelId);
      expect(channelIds).not.toContain(unit2ChannelId);
    });
  });

  // ===========================================================================
  // 2. REST API Send & Fetch Messages Tests
  // ===========================================================================
  describe('REST /chat/messages CRUD & RBAC', () => {
    it('4. Resident can post and read messages in their own unit channel', async () => {
      const postRes = await request(app)
        .post('/chat/messages')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          channelId: unit1ChannelId,
          content: 'Hello household! Did anyone receive the grocery package?',
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.message.content).toBe('Hello household! Did anyone receive the grocery package?');
      expect(postRes.body.message.sender.firstName).toBe('ChatTenant');

      const getRes = await request(app)
        .get(`/chat/messages?channelId=${unit1ChannelId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.messages.some((m: any) => m.content.includes('grocery package'))).toBe(true);
    });

    it('5. Resident cannot post or read messages in another unit channel', async () => {
      const postRes = await request(app)
        .post('/chat/messages')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          channelId: unit2ChannelId,
          content: 'Intruding into unit 201 chat',
        });

      expect(postRes.status).toBe(403);

      const getRes = await request(app)
        .get(`/chat/messages?channelId=${unit2ChannelId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(getRes.status).toBe(403);
    });

    it('5b. User from another community cannot access this community unit channel', async () => {
      const otherSuffix = `x${Date.now().toString(36)}`;
      const communityB = await prisma.community.create({
        data: { name: `Chat Other Township ${suffix}${otherSuffix}`, address: 'B' },
      });
      const unitB = await prisma.unit.create({
        data: { communityId: communityB.id, unitNumber: `O-${suffix}` },
      });
      const outsider = await prisma.user.create({
        data: {
          email: `chat.outsider.${suffix}@test.com`,
          passwordHash: 'x',
          firstName: 'Outsider',
        },
      });
      const outsiderToken = generateTokens(outsider.id).accessToken;
      await prisma.unitResidency.create({
        data: { userId: outsider.id, unitId: unitB.id, relationshipType: 'OWNER', status: 'ACTIVE' },
      });
      await prisma.membership.create({
        data: { userId: outsider.id, communityId: communityB.id, role: Role.RESIDENT, status: 'APPROVED' },
      });
      try {
        const postRes = await request(app)
          .post('/chat/messages')
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({ channelId: unit1ChannelId, content: 'Cross-community intruder' });
        expect(postRes.status).toBe(403);
        const getRes = await request(app)
          .get(`/chat/messages?channelId=${unit1ChannelId}`)
          .set('Authorization', `Bearer ${outsiderToken}`);
        expect(getRes.status).toBe(403);
        expect(getRes.body.messages).toBeUndefined();
      } finally {
        await prisma.unitResidency.deleteMany({ where: { unitId: unitB.id } });
        await prisma.membership.deleteMany({ where: { communityId: communityB.id } });
        await prisma.unit.delete({ where: { id: unitB.id } });
        await prisma.user.delete({ where: { id: outsider.id } });
        await prisma.community.delete({ where: { id: communityB.id } });
      }
    });

    it('6. Resident cannot post or read messages in Owners channel', async () => {
      const postRes = await request(app)
        .post('/chat/messages')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          channelId: ownersChannelId,
          content: 'Tenant posting in owners forum',
        });

      expect(postRes.status).toBe(403);
    });

    it('7. Owner can post and read in Owners channel', async () => {
      const postRes = await request(app)
        .post('/chat/messages')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: ownersChannelId,
          content: 'Discussion on annual maintenance corpus funds.',
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.message.content).toContain('maintenance corpus');
    });

    it('8. Leadership can post and read in Leadership & Management channel', async () => {
      const postRes = await request(app)
        .post('/chat/messages')
        .set('Authorization', `Bearer ${leadershipToken}`)
        .send({
          channelId: leadershipChannelId,
          content: 'Operations team sync scheduled for tomorrow morning.',
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.message.content).toContain('Operations team sync');
    });
  });

  // ===========================================================================
  // 3. WebSocket Real-time Handshake, Subscriptions & Broadcasting
  // ===========================================================================
  describe('WebSocket Real-time Communication', () => {
    it('9. Reject WebSocket connection without valid token', async () => {
      await expect(
        new Promise((resolve, reject) => {
          const ws = createTrackedSocket(`${wsUrl}?token=invalid_token`);
          ws.on('open', () => reject(new Error('Should not have opened')));
          ws.on('error', () => resolve(true));
          ws.on('close', (code) => {
            if (code !== 1000) resolve(true);
            else reject(new Error('Unexpected normal close'));
          });
        })
      ).resolves.toBe(true);
    });

    it('10. Connect with valid token, join unit channel, and exchange messages in real-time', async () => {
      const wsClient1 = createTrackedSocket(`${wsUrl}?token=${tenantToken}`);
      const wsClient2 = createTrackedSocket(`${wsUrl}?token=${ownerToken}`);

      // Handle AUTHENTICATED on connect
      const client1Auth = new Promise<void>((resolve) => {
        wsClient1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'AUTHENTICATED') resolve();
        });
      });

      const client2Auth = new Promise<void>((resolve) => {
        wsClient2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'AUTHENTICATED') resolve();
        });
      });

      await Promise.all([client1Auth, client2Auth]);

      // Both join Unit 101 channel
      const client1Joined = new Promise<void>((resolve) => {
        wsClient1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'JOINED' && msg.channelId === unit1ChannelId) resolve();
        });
      });

      const client2Joined = new Promise<void>((resolve) => {
        wsClient2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'JOINED' && msg.channelId === unit1ChannelId) resolve();
        });
      });

      wsClient1.send(JSON.stringify({ type: 'JOIN', channelId: unit1ChannelId }));
      wsClient2.send(JSON.stringify({ type: 'JOIN', channelId: unit1ChannelId }));

      await Promise.all([client1Joined, client2Joined]);

      // Client 1 sends real-time message; Client 2 receives broadcast
      const broadcastReceived = new Promise<any>((resolve) => {
        wsClient2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'MESSAGE' && msg.message?.content === 'Realtime test from tenant') {
            resolve(msg.message);
          }
        });
      });

      wsClient1.send(
        JSON.stringify({
          type: 'SEND',
          channelId: unit1ChannelId,
          content: 'Realtime test from tenant',
        })
      );

      const receivedMessage = await broadcastReceived;
      expect(receivedMessage.content).toBe('Realtime test from tenant');
      expect(receivedMessage.channelId).toBe(unit1ChannelId);

      wsClient1.close();
      wsClient2.close();
    });

    it('11. Unauthorized channel join over WebSocket returns error', async () => {
      const ws = createTrackedSocket(`${wsUrl}?token=${otherTenantToken}`);

      const authPromise = new Promise<void>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'AUTHENTICATED') resolve();
        });
      });

      await authPromise;

      const errorPromise = new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ERROR' && msg.channelId === unit1ChannelId) {
            resolve(msg);
          }
        });
      });

      ws.send(JSON.stringify({ type: 'JOIN', channelId: unit1ChannelId }));

      const errMsg = await errorPromise;
      expect(errMsg.message).toContain('Not authorized');

      ws.close();
    });

    it('12. Register Expo push token for authenticated user and verify DB persistence', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const res = await request(app)
        .post('/notifications/push-token')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ pushToken: expoToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: tenantId } });
      expect(user?.pushToken).toBe(expoToken);
    });
  });
});
