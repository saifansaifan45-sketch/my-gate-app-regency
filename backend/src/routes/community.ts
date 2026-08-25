import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireLeadership, AuthRequest } from '../middleware/auth';
import {
  getUserAccessibleSpaces,
  canUserAccessSpace,
  canUserPostAnnouncement,
  canUserCreatePoll,
  canUserAccessPoll,
  canUserManagePoll,
} from '../services/spaceMembership';
import { PostType, AnnouncementPriority, AnnouncementCategory, AnnouncementStatus, PollAudience, PollStatus } from '@prisma/client';

const router = Router();

router.use(requireAuth);

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

async function notifySpaceMembers(
  spaceId: string,
  notification: { type: string; title: string; message: string; metadata: Record<string, string> }
) {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  if (!space) return;

  const members = await prisma.user.findMany({
    where: { OR: [
      { memberships: { some: { communityId: space.communityId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'OWNER', 'RESIDENT', 'TENANT'] } } } },
      { ownerships: { some: { status: 'ACTIVE', unit: { communityId: space.communityId } } } },
      { residencies: { some: { status: 'ACTIVE', unit: { communityId: space.communityId } } } },
    ] },
    select: { id: true },
  });

  const recipients = (await Promise.all(
    members.map(async ({ id }) => ((await canUserAccessSpace(id, spaceId)) ? id : null))
  )).filter((id): id is string => id !== null);

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((id) => ({ userId: id, ...notification })),
    });
  }
}

async function notifyPollMembers(
  poll: { id: string; question: string; authorId: string; audience: PollAudience; audiences?: PollAudience[]; unitId: string | null; space: { id: string; communityId: string } },
  event: { type: string; title: string } = { type: 'POLL_CREATED', title: 'New community poll' },
) {
  const members = await prisma.user.findMany({
    where: {
      OR: [
        { memberships: { some: { communityId: poll.space.communityId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'OWNER', 'RESIDENT', 'TENANT'] } } } },
        { ownerships: { some: { status: 'ACTIVE', unit: { communityId: poll.space.communityId } } } },
        { residencies: { some: { status: 'ACTIVE', unit: { communityId: poll.space.communityId } } } },
      ],
    },
    select: { id: true },
  });

  const recipients = (await Promise.all(
    members.map(async ({ id }) => ((await canUserAccessPoll(id, poll)) ? id : null))
  )).filter((id): id is string => id !== null && id !== poll.authorId);

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((id) => ({
        userId: id,
        type: event.type,
        title: event.title,
        message: poll.question,
        metadata: { pollId: poll.id, spaceId: poll.space.id },
      })),
    });
  }
}

type PollResponseRecord = {
  id: string;
  spaceId: string;
  question: string;
  status: PollStatus;
  audience: PollAudience;
  audiences?: PollAudience[];
  unitId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  author?: { id: string; firstName: string | null; lastName: string | null; role?: string | null };
  space?: { id: string; name: string; type: string };
  options: Array<{ id: string; text: string; votes?: Array<{ id: string }>; _count?: { votes: number } }>;
};

function serializePoll(poll: PollResponseRecord) {
  const userVotedOption = poll.options.find((option) => option.votes && option.votes.length > 0);
  return {
    id: poll.id,
    spaceId: poll.spaceId,
    question: poll.question,
    status: poll.status,
    audience: poll.audience,
    audiences: poll.audiences?.length ? poll.audiences : [poll.audience],
    unitId: poll.unitId,
    expiresAt: poll.expiresAt,
    createdAt: poll.createdAt,
    author: poll.author,
    space: poll.space ? { id: poll.space.id, name: poll.space.name, type: poll.space.type } : undefined,
    options: poll.options.map(({ votes: _votes, _count, ...option }) => ({ ...option, voteCount: _count?.votes ?? 0 })),
    userHasVoted: Boolean(userVotedOption),
    userVotedOptionId: userVotedOption?.id ?? null,
  };
}

// Aggregated resident-facing feed. Space access remains the source of truth for
// announcement and poll visibility; this endpoint never exposes inaccessible spaces.
router.get('/announcements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = listQuerySchema.parse(req.query);
    const category = typeof req.query.category === 'string' ? AnnouncementCategory[req.query.category as keyof typeof AnnouncementCategory] : undefined;
    const spaces = await getUserAccessibleSpaces(req.user!.userId);
    const spaceIds = spaces.map((space) => space.id);
    if (!spaceIds.length) return res.json({ announcements: [], page, hasMore: false });

    const announcements = await prisma.announcement.findMany({
      where: { spaceId: { in: spaceIds }, status: AnnouncementStatus.PUBLISHED, ...(category ? { category } : {}), OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: {
        space: { select: { id: true, name: true,  } },
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        reads: { where: { userId: req.user!.userId }, select: { readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    const hasMore = announcements.length > limit;
    res.json({ announcements: announcements.slice(0, limit).map(({ reads, ...announcement }) => ({ ...announcement, isRead: reads.length > 0, readAt: reads[0]?.readAt ?? null })), page, hasMore });
  } catch (error) {
    next(error);
  }
});

router.get('/announcements/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const announcement = id
      ? await prisma.announcement.findUnique({
          where: { id },
          include: {
            space: { select: { id: true, name: true,  } },
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
            reads: { where: { userId: req.user!.userId }, select: { readAt: true } },
          },
        })
      : null;
    if (!announcement) return res.status(404).json({ error: { message: 'Announcement not found' } });
    if (announcement.status !== AnnouncementStatus.PUBLISHED || !(await canUserAccessSpace(req.user!.userId, announcement.spaceId))) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    const { reads, ...data } = announcement;
    res.json({ announcement: { ...data, isRead: reads.length > 0, readAt: reads[0]?.readAt ?? null } });
  } catch (error) {
    next(error);
  }
});

router.post('/announcements/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const announcement = id ? await prisma.announcement.findUnique({ where: { id } }) : null;
    if (!announcement || announcement.status !== AnnouncementStatus.PUBLISHED) return res.status(404).json({ error: { message: 'Announcement not found' } });
    if (!(await canUserAccessSpace(req.user!.userId, announcement.spaceId))) return res.status(403).json({ error: { message: 'Access denied' } });
    const read = await prisma.announcementRead.upsert({ where: { announcementId_userId: { announcementId: announcement.id, userId: req.user!.userId } }, update: {}, create: { announcementId: announcement.id, userId: req.user!.userId } });
    res.json({ read });
  } catch (error) { next(error); }
});

router.get('/polls', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = listQuerySchema.parse(req.query);
    const userId = req.user!.userId;
    const spaces = await getUserAccessibleSpaces(userId);
    const communityIds = [...new Set(spaces.map((space) => space.communityId))];
    if (!communityIds.length) return res.json({ polls: [], page, hasMore: false });
    const polls = await prisma.poll.findMany({
      where: { space: { communityId: { in: communityIds } } },
      include: {
        space: { select: { id: true, name: true, type: true, communityId: true } },
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        options: { include: { _count: { select: { votes: true } }, votes: { where: { userId }, select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visiblePolls = (await Promise.all(
      polls.map(async (poll) => ((await canUserAccessPoll(userId, poll)) ? poll : null))
    )).filter((poll): poll is NonNullable<typeof poll> => poll !== null);
    const pagedPolls = visiblePolls.slice((page - 1) * limit, page * limit);
    const hasMore = visiblePolls.length > page * limit;

    res.json({
      polls: pagedPolls.map((poll) => serializePoll(poll)),
      page,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/polls/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const poll = id
      ? await prisma.poll.findUnique({
          where: { id },
          include: {
            space: { select: { id: true, name: true, type: true, communityId: true } },
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
            options: { include: { _count: { select: { votes: true } }, votes: { where: { userId }, select: { id: true } } } },
          },
        })
      : null;
    if (!poll) return res.status(404).json({ error: { message: 'Poll not found' } });
    if (!(await canUserAccessPoll(userId, poll))) return res.status(403).json({ error: { message: 'Access denied' } });
    res.json({ poll: serializePoll(poll) });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 1. GET /community/spaces
// Returns all spaces visible to the authenticated user based on dynamic rules
// -----------------------------------------------------------------------------
router.get('/spaces', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaces = await getUserAccessibleSpaces(userId);

    res.json({
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        counts: s._count || { posts: 0, polls: 0, announcements: 0, messages: 0 },
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 2. GET /community/spaces/:id
// Returns space metadata, access state, recent posts, polls, and announcements
// -----------------------------------------------------------------------------
router.get('/spaces/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const hasAccess = await canUserAccessSpace(userId, spaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied to this community space' } });
    }

    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        accessRules: true,
        announcements: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
        polls: {
          take: 5,
          where: { status: PollStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
            options: {
              include: {
                _count: { select: { votes: true } },
                votes: { where: { userId } },
              },
            },
          },
        },
        posts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, unitNumber: true } } },
        },
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!space) {
      return res.status(404).json({ error: { message: 'Space not found' } });
    }

    const canAnnounce = await canUserPostAnnouncement(userId, spaceId);
    const visiblePolls = (await Promise.all(
      space.polls.map(async (poll) => (
        (await canUserAccessPoll(userId, { ...poll, space: { communityId: space.communityId } })) ? poll : null
      ))
    )).filter((poll): poll is NonNullable<typeof poll> => poll !== null);

    res.json({
      space: {
        id: space.id,
        name: space.name,
        description: space.description,
        type: space.type,
        canPostAnnouncement: canAnnounce,
        announcements: space.announcements,
        polls: visiblePolls.map((poll) => serializePoll({ ...poll, space: { id: space.id, name: space.name, type: space.type } })),
        recentPosts: space.posts,
        systemMessages: space.messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 3. POST /community/spaces/:id/posts (Create Community Post)
// -----------------------------------------------------------------------------
const createPostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty'),
  type: z.enum(['GENERAL', 'EVENT', 'DISCUSSION', 'UPDATE']).optional(),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
});

router.post('/spaces/:id/posts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const hasAccess = await canUserAccessSpace(userId, spaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'You do not have permission to post in this space' } });
    }

    const { content, type, attachmentUrl } = createPostSchema.parse(req.body);

    const post = await prisma.communityPost.create({
      data: {
        spaceId,
        authorId: userId,
        content,
        type: (type as PostType) || PostType.GENERAL,
        attachmentUrl: attachmentUrl || null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 4. GET /community/spaces/:id/posts (List Posts)
// -----------------------------------------------------------------------------
router.get('/spaces/:id/posts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const hasAccess = await canUserAccessSpace(userId, spaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const posts = await prisma.communityPost.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
      },
    });

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 5. POST /community/spaces/:id/polls (Create Poll)
// -----------------------------------------------------------------------------
const createPollSchema = z.object({
  question: z.string().min(3, 'Question must be at least 3 characters'),
  options: z.array(z.string().trim().min(1)).min(2, 'Poll must have at least 2 options'),
  expiresAt: z.string().datetime().optional(),
  audience: z.enum(['HOUSEHOLD', 'LEADERSHIP', 'OWNERS', 'RESIDENTS']).optional(),
  audiences: z.array(z.enum(['HOUSEHOLD', 'LEADERSHIP', 'OWNERS', 'RESIDENTS'])).min(1).max(3).optional(),
  unitId: z.string().uuid().optional(),
});

router.post('/spaces/:id/polls', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const { question, options, expiresAt, audience, audiences: requestedAudiences, unitId } = createPollSchema.parse(req.body);
    const selectedAudiences = [...new Set((requestedAudiences?.length ? requestedAudiences : [audience || (unitId ? PollAudience.HOUSEHOLD : PollAudience.RESIDENTS)]) as PollAudience[])];
    const selectedAudience = selectedAudiences[0];
    if (!selectedAudience || (selectedAudiences.includes(PollAudience.HOUSEHOLD) && selectedAudiences.length > 1)) {
      return res.status(400).json({ error: { message: 'Choose either one residence or one or more community audiences.' } });
    }
    const canCreatePoll = await canUserCreatePoll(userId, spaceId, selectedAudiences, unitId);
    if (!canCreatePoll) {
      return res.status(403).json({ error: { message: 'Poll audience or residence is not permitted for this account' } });
    }

    const poll = await prisma.poll.create({
      data: {
        spaceId,
        authorId: userId,
        audience: selectedAudience,
        audiences: selectedAudiences,
        unitId: selectedAudience === PollAudience.HOUSEHOLD ? unitId ?? null : null,
        question,
        status: PollStatus.ACTIVE,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        options: {
          create: options.map((text) => ({ text: text.trim() })),
        },
      },
      include: {
        space: { select: { id: true, name: true, type: true, communityId: true } },
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        options: true,
      },
    });

    await notifyPollMembers({
      id: poll.id,
      question: poll.question,
      authorId: poll.authorId,
      audience: poll.audience,
      audiences: poll.audiences,
      unitId: poll.unitId,
      space: { id: poll.space.id, communityId: poll.space.communityId },
    });

    res.status(201).json(poll);
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 6. POST /community/polls/:id/vote (Vote on Poll)
// -----------------------------------------------------------------------------
const votePollSchema = z.object({
  optionId: z.string().uuid(),
});

router.post('/polls/:id/vote', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const pollId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!pollId) {
      return res.status(400).json({ error: { message: 'Missing poll id' } });
    }

    const { optionId } = votePollSchema.parse(req.body);

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        space: { select: { communityId: true } },
        options: true,
      },
    });

    if (!poll) {
      return res.status(404).json({ error: { message: 'Poll not found' } });
    }

    if (poll.status !== PollStatus.ACTIVE || (poll.expiresAt && poll.expiresAt < new Date())) {
      return res.status(400).json({ error: { message: 'This poll is no longer active or has expired' } });
    }

    const hasAccess = await canUserAccessPoll(userId, poll);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'You do not have permission to vote in this poll' } });
    }

    const targetOption = poll.options.find((opt) => opt.id === optionId);
    if (!targetOption) {
      return res.status(400).json({ error: { message: 'Invalid option for this poll' } });
    }

    // Check existing vote
    const existingVote = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });

    if (existingVote) {
      return res.status(400).json({ error: { message: 'You have already voted in this poll' } });
    }

    const vote = await prisma.pollVote.create({
      data: {
        pollId,
        optionId,
        userId,
      },
    });

    // Fetch updated poll with counts
    const updatedPoll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      vote,
      poll: updatedPoll,
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 7. POST /community/spaces/:id/announcements (Create Official Announcement)
// -----------------------------------------------------------------------------
const createAnnouncementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(5),
  category: z.enum(['GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT', 'EMERGENCY']).optional(),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const announcementAudienceSchema = z.enum(['RESIDENTS', 'OWNERS', 'LEADERSHIP']);
const broadcastAnnouncementSchema = createAnnouncementSchema.extend({
  audiences: z.array(announcementAudienceSchema).min(1).max(3),
});

const announcementSpaceTypes: Record<z.infer<typeof announcementAudienceSchema>, string> = {
  RESIDENTS: 'RESIDENT_COMMUNITY',
  OWNERS: 'OWNER_COMMUNITY',
  LEADERSHIP: 'LEADERSHIP_OPERATIONS',
};

router.post('/announcements/broadcast', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { audiences, title, content, category, priority, status, expiresAt } = broadcastAnnouncementSchema.parse(req.body);
    const selectedAudiences = [...new Set(audiences)];
    const accessibleSpaces = await getUserAccessibleSpaces(userId);
    const targetSpaces = accessibleSpaces.filter((space) => selectedAudiences.some((audience) => announcementSpaceTypes[audience] === space.type));
    if (targetSpaces.length !== selectedAudiences.length) {
      return res.status(403).json({ error: { message: 'One or more selected notice audiences are not available for this account.' } });
    }

    const created = await prisma.$transaction(
      targetSpaces.map((space) => prisma.announcement.create({
        data: {
          communityId: space.communityId,
          spaceId: space.id,
          authorId: userId,
          title,
          content,
          category: (category as AnnouncementCategory) || AnnouncementCategory.GENERAL,
          priority: (priority as AnnouncementPriority) || AnnouncementPriority.NORMAL,
          status: (status as AnnouncementStatus) || AnnouncementStatus.PUBLISHED,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }))
    );

    if ((status || AnnouncementStatus.PUBLISHED) === AnnouncementStatus.PUBLISHED) {
      await Promise.all(created.map((announcement) => notifySpaceMembers(announcement.spaceId, {
        type: 'ANNOUNCEMENT_PUBLISHED',
        title: announcement.title,
        message: announcement.content.slice(0, 180),
        metadata: { announcementId: announcement.id, spaceId: announcement.spaceId, navigation: '/community' },
      })));
    }

    res.status(201).json({ announcements: created, audiences: selectedAudiences });
  } catch (error) {
    next(error);
  }
});

router.post('/spaces/:id/announcements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const canAnnounce = await canUserPostAnnouncement(userId, spaceId);
    if (!canAnnounce) {
      return res.status(403).json({ error: { message: 'Only Leadership and Managers can create official announcements' } });
    }

    const { title, content, category, priority, status, expiresAt } = createAnnouncementSchema.parse(req.body);
    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
    if (!space) return res.status(404).json({ error: { message: 'Community space not found' } });

    const announcement = await prisma.announcement.create({
      data: {
        communityId: space.communityId,
        spaceId,
        authorId: userId,
        title,
        content,
        category: (category as AnnouncementCategory) || AnnouncementCategory.GENERAL,
        priority: (priority as AnnouncementPriority) || AnnouncementPriority.NORMAL,
        status: (status as AnnouncementStatus) || AnnouncementStatus.PUBLISHED,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    if (announcement.status === AnnouncementStatus.PUBLISHED) {
      await notifySpaceMembers(spaceId, { type: 'ANNOUNCEMENT_PUBLISHED', title: announcement.title, message: announcement.content.slice(0, 180), metadata: { announcementId: announcement.id, spaceId, navigation: '/community' } });
    }

    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
});

const updateAnnouncementSchema = createAnnouncementSchema.partial();

router.patch('/announcements/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = id ? await prisma.announcement.findUnique({ where: { id } }) : null;
    if (!current) return res.status(404).json({ error: { message: 'Announcement not found' } });
    if (!(await canUserPostAnnouncement(req.user!.userId, current.spaceId))) {
      return res.status(403).json({ error: { message: 'Only Leadership and Managers can edit announcements' } });
    }
    const values = updateAnnouncementSchema.parse(req.body);
    const announcement = await prisma.announcement.update({
      where: { id: current.id },
      data: {
        ...(values.title !== undefined ? { title: values.title } : {}),
        ...(values.content !== undefined ? { content: values.content } : {}),
        ...(values.category !== undefined ? { category: values.category as AnnouncementCategory } : {}),
        ...(values.priority !== undefined ? { priority: values.priority as AnnouncementPriority } : {}),
        ...(values.status !== undefined ? { status: values.status as AnnouncementStatus } : {}),
        ...(values.expiresAt !== undefined ? { expiresAt: values.expiresAt ? new Date(values.expiresAt) : null } : {}),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    if (current.status !== AnnouncementStatus.PUBLISHED && announcement.status === AnnouncementStatus.PUBLISHED) {
      await notifySpaceMembers(current.spaceId, { type: 'ANNOUNCEMENT_PUBLISHED', title: announcement.title, message: announcement.content.slice(0, 180), metadata: { announcementId: announcement.id, spaceId: current.spaceId, navigation: '/community' } });
    }
    res.json({ announcement });
  } catch (error) {
    next(error);
  }
});

router.delete('/announcements/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = id ? await prisma.announcement.findUnique({ where: { id } }) : null;
    if (!current) return res.status(404).json({ error: { message: 'Announcement not found' } });
    if (!(await canUserPostAnnouncement(req.user!.userId, current.spaceId))) {
      return res.status(403).json({ error: { message: 'Only Leadership and Managers can delete announcements' } });
    }
    await prisma.announcement.delete({ where: { id: current.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const updatePollSchema = z.object({
  question: z.string().min(3).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED']).optional(),
});

router.patch('/polls/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = id ? await prisma.poll.findUnique({ where: { id }, include: { space: { select: { id: true, communityId: true } } } }) : null;
    if (!current) return res.status(404).json({ error: { message: 'Poll not found' } });
    if (!(await canUserManagePoll(req.user!.userId, current))) {
      return res.status(403).json({ error: { message: 'You do not have permission to edit this poll' } });
    }
    const values = updatePollSchema.parse(req.body);
    const poll = await prisma.poll.update({
      where: { id: current.id },
      data: {
        ...(values.question !== undefined ? { question: values.question } : {}),
        ...(values.status !== undefined ? { status: values.status as PollStatus } : {}),
        ...(values.expiresAt !== undefined ? { expiresAt: values.expiresAt ? new Date(values.expiresAt) : null } : {}),
      },
    });
    if (values.status === 'CLOSED') {
      await notifyPollMembers(
        { ...current, ...poll, space: current.space },
        { type: 'POLL_CLOSED', title: 'Community poll closed' },
      );
    }
    res.json({ poll });
  } catch (error) {
    next(error);
  }
});

router.delete('/polls/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = id ? await prisma.poll.findUnique({ where: { id }, include: { space: { select: { communityId: true } } } }) : null;
    if (!current) return res.status(404).json({ error: { message: 'Poll not found' } });
    if (!(await canUserManagePoll(req.user!.userId, current))) {
      return res.status(403).json({ error: { message: 'You do not have permission to delete this poll' } });
    }
    await prisma.poll.delete({ where: { id: current.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 8. GET /community/spaces/:id/announcements (List Announcements)
// -----------------------------------------------------------------------------
router.get('/spaces/:id/announcements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const hasAccess = await canUserAccessSpace(userId, spaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const announcements = await prisma.announcement.findMany({
      where: { spaceId, status: AnnouncementStatus.PUBLISHED, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        reads: { where: { userId }, select: { readAt: true } },
      },
    });

    res.json({ announcements: announcements.map(({ reads, ...announcement }) => ({ ...announcement, isRead: reads.length > 0, readAt: reads[0]?.readAt ?? null })) });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 9. GET /community/spaces/:id/messages (List Automated System Broadcasts)
// -----------------------------------------------------------------------------
router.get('/spaces/:id/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const spaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!spaceId) {
      return res.status(400).json({ error: { message: 'Missing space id' } });
    }

    const hasAccess = await canUserAccessSpace(userId, spaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const messages = await prisma.spaceMessage.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 10. GET /community/memberships/pending (Leadership lists pending employee applications)
// -----------------------------------------------------------------------------
router.get('/memberships/pending', requireLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pendingMemberships = await prisma.membership.findMany({
      where: {
        status: 'PENDING',
        role: { in: ['MANAGER', 'WORKFORCE'] },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, createdAt: true },
        },
        community: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ pendingMemberships });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 11. POST /community/memberships/:id/approve (Leadership approves employee)
// -----------------------------------------------------------------------------
router.post('/memberships/:id/approve', requireLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership not found' } });
    }

    // 1. Update membership status to APPROVED
    const updated = await prisma.membership.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { user: true, community: true },
    });

    // 2. Promote user's role to the approved role
    await prisma.user.update({
      where: { id: membership.userId },
      data: { role: membership.role },
    });

    // 3. Notify applicant
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'STAFF_APPLICATION_APPROVED',
        title: 'Staff Application Approved',
        message: `Your application for ${membership.role} role at Regency Salma has been approved. You now have operational access.`,
      },
    });

    res.json({
      success: true,
      message: `Approved ${membership.user.firstName || 'Employee'} as active ${membership.role}.`,
      membership: updated,
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 12. POST /community/memberships/:id/reject (Leadership rejects employee)
// -----------------------------------------------------------------------------
router.post('/memberships/:id/reject', requireLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership not found' } });
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'STAFF_APPLICATION_REJECTED',
        title: 'Staff Application Update',
        message: 'Your application for township staff access was not approved at this time.',
      },
    });

    res.json({
      success: true,
      message: 'Staff application rejected.',
      membership: updated,
    });
  } catch (error) {
    next(error);
  }
});


// -----------------------------------------------------------------------------
// GET /community/units (List all units for security)
// -----------------------------------------------------------------------------
router.get('/units', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    // ensure user is security/leadership/manager
    const mem = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED', role: { in: ['LEADERSHIP', 'MANAGER', 'WORKFORCE'] } }
    });
    if (!mem) return res.status(403).json({ error: { message: 'Not authorized' } });

    const units = await prisma.unit.findMany({
      where: { communityId: mem.communityId },
      select: {
        id: true,
        unitNumber: true,
        block: true,
        floor: true,
        
      },
      orderBy: { unitNumber: 'asc' }
    });

    res.json({ units });
  } catch(error) {
    next(error);
  }
});


// ----------------------------------------------------
// GET /community/hub
// ----------------------------------------------------
router.get('/hub', requireAuth, async (req: AuthRequest, res, _next) => {
  try {
    const userId = req.user!.userId;
    // Get user's active membership community
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'APPROVED' },
      include: { community: true }
    });

    if (!membership) {
      // Fallback to active residency
      const residency = await prisma.unitResidency.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { unit: { include: { community: true } } }
      });
      if (!residency) {
        return res.json({ success: true, community: null });
      }
      const community = residency.unit.community;
      
      const leadership = await prisma.membership.findMany({
        where: { communityId: community.id, role: 'LEADERSHIP', status: 'APPROVED' },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      return res.json({
        success: true,
        community,
        role: 'RESIDENT',
        leadership: leadership.map(l => ({ id: l.user.id, name: l.user.firstName ? `${l.user.firstName} ${l.user.lastName || ''}`.trim() : 'Leadership Member' }))
      });
    }

    const leadership = await prisma.membership.findMany({
      where: { communityId: membership.communityId, role: 'LEADERSHIP', status: 'APPROVED' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } }
    });

    res.json({
      success: true,
      community: membership.community,
      role: membership.role,
      leadership: leadership.map(l => ({ id: l.user.id, name: l.user.firstName ? `${l.user.firstName} ${l.user.lastName || ''}`.trim() : 'Leadership Member' }))
    });
  } catch (error) {
    _next(error);
  }
});

export default router;
