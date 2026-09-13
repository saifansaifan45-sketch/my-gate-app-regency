import supertest from 'supertest';
import { describe, it, expect, beforeAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';
import { SpaceType, AnnouncementCategory, AnnouncementStatus, SpaceMessageType } from '@prisma/client';

const request = supertest(app);

describe('Community Spaces, Posts, Polls & Announcements Suite', () => {
  let presidentToken: string;
  let presidentId: string;
  let managerToken: string;
  let managerId: string;
  let landlordToken: string;
  let landlordId: string;
  let tenantToken: string;
  let tenantId: string;
  let pendingTenantToken: string;
  let pendingTenantId: string;

  let leadershipSpaceId: string;
  let ownersSpaceId: string;
  let residentsSpaceId: string;

  let createdPollId: string;
  let createdOptionId: string;
  let createdAnnouncementId: string;

  beforeAll(async () => {
    // 1. Fetch Users
    const pres = await prisma.user.findUnique({ where: { email: 'president@regencysalma.com' } });
    presidentId = pres!.id;
    presidentToken = generateTokens(presidentId).accessToken;

    const mgr = await prisma.user.findUnique({ where: { email: 'manager@regencysalma.com' } });
    managerId = mgr!.id;
    managerToken = generateTokens(managerId).accessToken;

    const land = await prisma.user.findUnique({ where: { email: 'landlord@regencysalma.com' } });
    landlordId = land!.id;
    landlordToken = generateTokens(landlordId).accessToken;

    const ten = await prisma.user.findUnique({ where: { email: 'tenant@regencysalma.com' } });
    tenantId = ten!.id;
    tenantToken = generateTokens(tenantId).accessToken;

    const pen = await prisma.user.findUnique({ where: { email: 'pending.tenant@regencysalma.com' } });
    pendingTenantId = pen!.id;
    pendingTenantToken = generateTokens(pendingTenantId).accessToken;

    // 2. Fetch Spaces
    const leadSpace = await prisma.space.findFirst({ where: { type: SpaceType.LEADERSHIP_OPERATIONS } });
    leadershipSpaceId = leadSpace!.id;

    const ownSpace = await prisma.space.findFirst({ where: { type: SpaceType.OWNER_COMMUNITY } });
    ownersSpaceId = ownSpace!.id;

    const resSpace = await prisma.space.findFirst({ where: { type: SpaceType.RESIDENT_COMMUNITY } });
    residentsSpaceId = resSpace!.id;

  });

  // ===========================================================================
  // 1. Space Access Tests
  // ===========================================================================
  it('1. Leadership user sees all community spaces', async () => {
    const res = await request
      .get('/community/spaces')
      .set('Authorization', `Bearer ${presidentToken}`);

    expect(res.status).toBe(200);
    const spaceTypes = res.body.spaces.map((s: any) => s.type);
    expect(spaceTypes).toContain(SpaceType.LEADERSHIP_OPERATIONS);
    expect(spaceTypes).toContain(SpaceType.OWNER_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.RESIDENT_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.EMERGENCY);
  });

  it('2. Manager sees operational, owner, resident, and emergency spaces', async () => {
    const res = await request
      .get('/community/spaces')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const spaceTypes = res.body.spaces.map((s: any) => s.type);
    expect(spaceTypes).toContain(SpaceType.LEADERSHIP_OPERATIONS);
    expect(spaceTypes).toContain(SpaceType.OWNER_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.RESIDENT_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.EMERGENCY);
  });

  it('3. Landlord (Owner) can access Owners Community, but NOT Leadership Operations', async () => {
    const res = await request
      .get('/community/spaces')
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(res.status).toBe(200);
    const spaceTypes = res.body.spaces.map((s: any) => s.type);
    expect(spaceTypes).toContain(SpaceType.OWNER_COMMUNITY);
    expect(spaceTypes).not.toContain(SpaceType.RESIDENT_COMMUNITY);
    expect(spaceTypes).not.toContain(SpaceType.LEADERSHIP_OPERATIONS);

    // Direct access check
    const deniedRes = await request
      .get(`/community/spaces/${leadershipSpaceId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(deniedRes.status).toBe(403);
  });

  it('4. Approved Tenant can access Residents Community, but NOT Owners Community', async () => {
    const res = await request
      .get('/community/spaces')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    const spaceTypes = res.body.spaces.map((s: any) => s.type);
    expect(spaceTypes).toContain(SpaceType.RESIDENT_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.EMERGENCY);
    expect(spaceTypes).not.toContain(SpaceType.OWNER_COMMUNITY);
    expect(spaceTypes).not.toContain(SpaceType.LEADERSHIP_OPERATIONS);

    const deniedRes = await request
      .get(`/community/spaces/${ownersSpaceId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(deniedRes.status).toBe(403);
  });

  it('5. Pending Tenant cannot access Residents Community until verified', async () => {
    const res = await request
      .get('/community/spaces')
      .set('Authorization', `Bearer ${pendingTenantToken}`);

    expect(res.status).toBe(200);
    const spaceTypes = res.body.spaces.map((s: any) => s.type);
    expect(spaceTypes).not.toContain(SpaceType.RESIDENT_COMMUNITY);
    expect(spaceTypes).not.toContain(SpaceType.OWNER_COMMUNITY);
    expect(spaceTypes).toContain(SpaceType.EMERGENCY);

    const deniedRes = await request
      .get(`/community/spaces/${residentsSpaceId}`)
      .set('Authorization', `Bearer ${pendingTenantToken}`);
    expect(deniedRes.status).toBe(403);
  });

  // ===========================================================================
  // 2. Posts & Feed Tests
  // ===========================================================================
  it('6. User can create and list posts in authorized space', async () => {
    const postRes = await request
      .post(`/community/spaces/${residentsSpaceId}/posts`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        content: 'Anyone interested in table tennis at the clubhouse tonight?',
        type: 'DISCUSSION',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.content).toContain('table tennis');
    expect(postRes.body.author.firstName).toBeDefined();

    const listRes = await request
      .get(`/community/spaces/${residentsSpaceId}/posts`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.posts.some((p: any) => p.content.includes('table tennis'))).toBe(true);
  });

  it('7. User cannot create post in unauthorized space', async () => {
    const res = await request
      .post(`/community/spaces/${ownersSpaceId}/posts`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        content: 'Unauthorized post attempt in owner space',
      });

    expect(res.status).toBe(403);
  });

  // ===========================================================================
  // 3. Poll System Tests
  // ===========================================================================
  it('8. User creates a poll and votes on an option', async () => {
    const createPollRes = await request
      .post(`/community/spaces/${residentsSpaceId}/polls`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({
        question: 'Should we install EV charging stations in Basement 1?',
        options: ['Yes, definitely', 'Need more cost details', 'No'],
      });

    expect(createPollRes.status).toBe(201);
    expect(createPollRes.body.question).toBe('Should we install EV charging stations in Basement 1?');
    expect(createPollRes.body.options.length).toBe(3);

    createdPollId = createPollRes.body.id;
    createdOptionId = createPollRes.body.options[0].id;

    // Tenant votes on option
    const voteRes = await request
      .post(`/community/polls/${createdPollId}/vote`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ optionId: createdOptionId });

    expect(voteRes.status).toBe(201);
    expect(voteRes.body.success).toBe(true);
    expect(voteRes.body.vote.optionId).toBe(createdOptionId);
  });

  it('9. Duplicate votes by the same user are rejected', async () => {
    const dupRes = await request
      .post(`/community/polls/${createdPollId}/vote`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ optionId: createdOptionId });

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error.message).toContain('already voted');
  });

  // ===========================================================================
  // 4. Official Announcements Tests
  // ===========================================================================
  it('10. Leadership/Manager can create official announcements', async () => {
    const res = await request
      .post(`/community/spaces/${residentsSpaceId}/announcements`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({
        title: 'Clubhouse Swimming Pool Annual Cleaning',
        content: 'The swimming pool will be closed on Monday for deep cleaning and chlorine calibration.',
        category: 'MAINTENANCE',
        priority: 'IMPORTANT',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Clubhouse Swimming Pool Annual Cleaning');
    expect(res.body.category).toBe(AnnouncementCategory.MAINTENANCE);
    expect(res.body.priority).toBe('IMPORTANT');
    expect(res.body.status).toBe(AnnouncementStatus.PUBLISHED);
    createdAnnouncementId = res.body.id;

    const residentNotification = await prisma.notification.findFirst({
      where: { userId: tenantId, type: 'ANNOUNCEMENT_PUBLISHED', metadata: { path: ['announcementId'], equals: createdAnnouncementId } },
    });
    expect(residentNotification).toBeTruthy();
  });

  it('10a. Resident receives the published feed item and can mark it read', async () => {
    const feed = await request.get('/community/announcements?category=MAINTENANCE').set('Authorization', `Bearer ${tenantToken}`);
    expect(feed.status).toBe(200);
    expect(feed.body.announcements.some((announcement: any) => announcement.id === createdAnnouncementId && announcement.isRead === false)).toBe(true);

    const read = await request.post(`/community/announcements/${createdAnnouncementId}/read`).set('Authorization', `Bearer ${tenantToken}`);
    expect(read.status).toBe(200);

    const detail = await request.get(`/community/announcements/${createdAnnouncementId}`).set('Authorization', `Bearer ${tenantToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.announcement.isRead).toBe(true);
  });


  it('10b. Resident cannot read announcement from unauthorized space', async () => {
    // President creates an announcement in Owners space
    const ownerAnnRes = await request
      .post(`/community/spaces/${ownersSpaceId}/announcements`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({
        title: 'Owner Assessment Update',
        content: 'Special assessment details.',
        priority: 'NORMAL',
      });
    expect(ownerAnnRes.status).toBe(201);

    // Tenant tries to read it
    const getRes = await request
      .get(`/community/announcements/${ownerAnnRes.body.id}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(getRes.status).toBe(403);
  });

  it('10c. Missing announcement returns 404', async () => {
    const res = await request
      .get('/community/announcements/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(404);
  });

  it('11. Regular resident cannot create official announcements', async () => {
    const res = await request
      .post(`/community/spaces/${residentsSpaceId}/announcements`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        title: 'Fake Announcement',
        content: 'This should be blocked for non-managers',
      });

    expect(res.status).toBe(403);
  });

  // ===========================================================================
  // 5. Automated Space Broadcasting on Ticket Creation
  // ===========================================================================
  it('12. Ticket creation broadcasts SpaceMessage to Leadership & Community Spaces', async () => {
    const ticketRes = await request
      .post('/tickets')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        category: 'Plumbing',
        title: 'Kitchen Tap Sprayer Broken',
        description: 'Sprayer head cracked and spraying water on kitchen counter',
        priority: 'HIGH',
      });

    expect(ticketRes.status).toBe(201);

    // Verify SpaceMessage was broadcast to leadership space
    const messages = await prisma.spaceMessage.findMany({
      where: { spaceId: leadershipSpaceId, type: SpaceMessageType.TICKET_CREATED },
      orderBy: { createdAt: 'desc' },
    });

    expect(messages.length).toBeGreaterThan(0);
    const firstMsg = messages[0];
    expect(firstMsg).toBeDefined();
    expect(firstMsg?.title).toContain('Kitchen Tap Sprayer Broken');
    expect((firstMsg?.metadata as any)?.ticketId).toBe(ticketRes.body.id);
  });
});
