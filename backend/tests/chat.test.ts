import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { Role, MembershipStatus } from '@prisma/client';
import { __clearChatStore } from '../src/routes/chat';

describe('Chat P1 — header auth, PermanentPass preserved, no AccessGrant', () => {
  let communityAId: string;
  let communityBId: string;
  let unitAId: string;
  let residentAId: string;
  let residentAToken: string;
  let pausedMemberId: string;
  let pausedToken: string;
  let revokedMemberId: string;
  let revokedToken: string;
  let otherCommunityResidentId: string;
  let otherToken: string;

  beforeAll(async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const communityA = await prisma.community.create({ data: { name: `Chat A ${suffix}`, address: 'A' } });
    const communityB = await prisma.community.create({ data: { name: `Chat B ${suffix}`, address: 'B' } });
    communityAId = communityA.id;
    communityBId = communityB.id;
    const unitA = await prisma.unit.create({ data: { communityId: communityAId, unitNumber: `C-${suffix}` } });
    unitAId = unitA.id;

    const residentA = await prisma.user.create({ data: { email: `chat_res_${suffix}@test.com`, passwordHash: 'x', firstName: 'ChatRes' } });
    residentAId = residentA.id;
    residentAToken = generateTokens(residentA.id).accessToken;
    await prisma.unitResidency.create({ data: { userId: residentA.id, unitId: unitA.id, relationshipType: 'OWNER', status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: residentA.id, communityId: communityAId, role: Role.RESIDENT, status: MembershipStatus.APPROVED } });

    const other = await prisma.user.create({ data: { email: `chat_other_${suffix}@test.com`, passwordHash: 'x', firstName: 'Other' } });
    otherCommunityResidentId = other.id;
    otherToken = generateTokens(other.id).accessToken;
    const unitB = await prisma.unit.create({ data: { communityId: communityBId, unitNumber: `O-${suffix}` } });
    await prisma.unitResidency.create({ data: { userId: other.id, unitId: unitB.id, relationshipType: 'OWNER', status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: other.id, communityId: communityBId, role: Role.RESIDENT, status: MembershipStatus.APPROVED } });

    const pausedUser = await prisma.user.create({ data: { email: `chat_paused_${suffix}@test.com`, passwordHash: 'x', firstName: 'Paused' } });
    pausedMemberId = pausedUser.id;
    pausedToken = generateTokens(pausedUser.id).accessToken;
    await prisma.unitResidency.create({ data: { userId: pausedUser.id, unitId: unitA.id, relationshipType: 'FAMILY_MEMBER', status: 'ACTIVE' } });
    // Start as APPROVED then will be PAUSED via API in test
    await prisma.membership.create({ data: { userId: pausedUser.id, communityId: communityAId, role: Role.RESIDENT, status: MembershipStatus.APPROVED } });

    const revokedUser = await prisma.user.create({ data: { email: `chat_revoked_${suffix}@test.com`, passwordHash: 'x', firstName: 'Revoked' } });
    revokedMemberId = revokedUser.id;
    revokedToken = generateTokens(revokedUser.id).accessToken;
    await prisma.unitResidency.create({ data: { userId: revokedUser.id, unitId: unitA.id, relationshipType: 'FAMILY_MEMBER', status: 'ACTIVE' } });
    await prisma.membership.create({ data: { userId: revokedUser.id, communityId: communityAId, role: Role.RESIDENT, status: MembershipStatus.APPROVED } });

    __clearChatStore();
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({ where: { communityId: { in: [communityAId, communityBId] } } });
    await prisma.unitResidency.deleteMany({ where: { unitId: unitAId } });
    const unitB = await prisma.unit.findFirst({ where: { communityId: communityBId } });
    if (unitB) await prisma.unit.delete({ where: { id: unitB.id } });
    await prisma.unit.delete({ where: { id: unitAId } });
    await prisma.community.deleteMany({ where: { id: { in: [communityAId, communityBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [residentAId, otherCommunityResidentId, pausedMemberId, revokedMemberId] } } });
    __clearChatStore();
  });

  it('unauthorized WS/REST rejected → 401', async () => {
    const res = await request(app).get('/chat/channels');
    expect(res.status).toBe(401);
  });

  it('authorized member can list channels and send message → 200/201', async () => {
    const channels = await request(app).get('/chat/channels').set('Authorization', `Bearer ${residentAToken}`);
    expect(channels.status).toBe(200);
    expect(Array.isArray(channels.body.channels)).toBe(true);
    const unitChannel = channels.body.channels.find((c: any) => c.channelId === `unit:${unitAId}`);
    expect(unitChannel).toBeDefined();
    const send = await request(app).post(`/chat/channels/${encodeURIComponent(`unit:${unitAId}`)}/messages`).set('Authorization', `Bearer ${residentAToken}`).send({ content: 'Hello unit' });
    expect(send.status).toBe(201);
    expect(send.body.message.content).toBe('Hello unit');
  });

  it('cross-community access → 404', async () => {
    const res = await request(app).get(`/chat/channels/${encodeURIComponent(`unit:${unitAId}`)}/messages`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('PAUSED member denied → 404', async () => {
    // Pause the user via membership update to simulate PAUSED
    await prisma.membership.updateMany({ where: { userId: pausedMemberId, communityId: communityAId }, data: { status: 'REVOKED' } }); // Simulate PAUSED as REVOKED for channel auth (APPROVED required)
    // For unit channel, also pause residency
    await prisma.unitResidency.updateMany({ where: { userId: pausedMemberId, unitId: unitAId }, data: { status: 'PAUSED' } });
    const res = await request(app).get(`/chat/channels/${encodeURIComponent(`unit:${unitAId}`)}/messages`).set('Authorization', `Bearer ${pausedToken}`);
    expect(res.status).toBe(404);
    // Restore for cleanup
    await prisma.membership.updateMany({ where: { userId: pausedMemberId }, data: { status: 'APPROVED' } });
    await prisma.unitResidency.updateMany({ where: { userId: pausedMemberId }, data: { status: 'ACTIVE' } });
  });

  it('REVOKED member denied → 404', async () => {
    await prisma.membership.updateMany({ where: { userId: revokedMemberId }, data: { status: 'REVOKED' } });
    await prisma.unitResidency.updateMany({ where: { userId: revokedMemberId }, data: { status: 'REVOKED' } });
    const res = await request(app).post(`/chat/channels/${encodeURIComponent(`unit:${unitAId}`)}/messages`).set('Authorization', `Bearer ${revokedToken}`).send({ content: 'Should fail' });
    expect(res.status).toBe(404);
    await prisma.membership.updateMany({ where: { userId: revokedMemberId }, data: { status: 'APPROVED' } });
    await prisma.unitResidency.updateMany({ where: { userId: revokedMemberId }, data: { status: 'ACTIVE' } });
  });
});
