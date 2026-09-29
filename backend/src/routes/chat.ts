import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { canUserAccessChannel, broadcastToChannel } from '../services/chatSocket';
import { notifyUsers } from '../services/notificationService';
import { ChatChannelType, Role } from '@prisma/client';

const router = Router();

router.use(requireAuth);

// -----------------------------------------------------------------------------
// 1. GET /chat/channels
// List all chat channels accessible to the authenticated user
// -----------------------------------------------------------------------------
router.get('/channels', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Fetch user details with active memberships, ownerships, and residencies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { where: { status: 'APPROVED' }, include: { community: true } },
        ownerships: { where: { status: 'ACTIVE' }, include: { unit: { include: { community: true } } } },
        residencies: { where: { status: 'ACTIVE' }, include: { unit: { include: { community: true } } } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    const channels: Array<{
      channelId: string;
      channelType: ChatChannelType;
      name: string;
      description?: string | undefined;
      communityId: string;
      communityName?: string | undefined;
      unitId?: string | undefined;
      unitNumber?: string | undefined;
      lastMessage?: any;
    }> = [];

    const addedChannelIds = new Set<string>();

    // 1. Unit Channels
    const userUnits = new Map<string, { id: string; unitNumber: string; communityId: string; communityName: string }>();

    user.ownerships.forEach((o) => {
      userUnits.set(o.unit.id, {
        id: o.unit.id,
        unitNumber: o.unit.unitNumber,
        communityId: o.unit.communityId,
        communityName: o.unit.community.name,
      });
    });

    user.residencies.forEach((r) => {
      userUnits.set(r.unit.id, {
        id: r.unit.id,
        unitNumber: r.unit.unitNumber,
        communityId: r.unit.communityId,
        communityName: r.unit.community.name,
      });
    });

    for (const unit of userUnits.values()) {
      const channelId = `unit:${unit.id}`;
      if (!addedChannelIds.has(channelId)) {
        addedChannelIds.add(channelId);
        channels.push({
          channelId,
          channelType: ChatChannelType.UNIT,
          name: `Unit ${unit.unitNumber}`,
          description: `Private household chat for Unit ${unit.unitNumber}`,
          communityId: unit.communityId,
          communityName: unit.communityName,
          unitId: unit.id,
          unitNumber: unit.unitNumber,
        });
      }
    }

    // 2. Owners Channel
    const isOwner =
      user.memberships.some((m) => m.role === Role.OWNER || m.role === Role.LEADERSHIP) ||
      user.ownerships.length > 0;

    if (isOwner) {
      const communityIds = new Set<string>();
      user.memberships.forEach((m) => communityIds.add(m.communityId));
      user.ownerships.forEach((o) => communityIds.add(o.unit.communityId));

      for (const communityId of communityIds) {
        const comm = await prisma.community.findUnique({ where: { id: communityId } });
        const channelId = `channel:owners:${communityId}`;
        if (!addedChannelIds.has(channelId)) {
          addedChannelIds.add(channelId);
          channels.push({
            channelId,
            channelType: ChatChannelType.OWNERS,
            name: 'Owners Forum',
            description: 'Exclusive communication channel for property owners',
            communityId,
            communityName: comm?.name,
          });
        }
      }
    }

    // 3. Leadership & Management Channel
    const isLeadershipOrManager = user.memberships.some(
      (m) => m.role === Role.LEADERSHIP || m.role === Role.MANAGER
    );

    if (isLeadershipOrManager) {
      const leadCommunityIds = user.memberships
        .filter((m) => m.role === Role.LEADERSHIP || m.role === Role.MANAGER)
        .map((m) => m.communityId);

      for (const communityId of leadCommunityIds) {
        const comm = await prisma.community.findUnique({ where: { id: communityId } });
        const channelId = `channel:leadership_management:${communityId}`;
        if (!addedChannelIds.has(channelId)) {
          addedChannelIds.add(channelId);
          channels.push({
            channelId,
            channelType: ChatChannelType.LEADERSHIP_MANAGEMENT,
            name: 'Leadership & Management',
            description: 'Internal operations channel for leadership & managers',
            communityId,
            communityName: comm?.name,
          });
        }
      }
    }

    // Attach latest message for each channel
    const channelsWithLastMessage = await Promise.all(
      channels.map(async (ch) => {
        const lastMsg = await prisma.chatMessage.findFirst({
          where: { channelId: ch.channelId },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        });
        return { ...ch, lastMessage: lastMsg || null };
      })
    );

    res.json({ channels: channelsWithLastMessage });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 2. GET /chat/messages
// Fetch message history for a channel with authorization verification
// -----------------------------------------------------------------------------
const getMessagesSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

router.get('/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { channelId, limit, before } = getMessagesSchema.parse(req.query);

    const auth = await canUserAccessChannel(userId, channelId);
    if (!auth.authorized) {
      return res.status(403).json({ error: { message: 'Access denied to this chat channel' } });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        channelId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, unitNumber: true, role: true },
        },
      },
    });

    res.json({
      channelId,
      messages,
      count: messages.length,
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------------------------------------
// 3. POST /chat/messages
// Send a message via REST (and broadcast to WebSocket subscribers)
// -----------------------------------------------------------------------------
const postMessageSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  content: z.string().trim().min(1, 'Message content cannot be empty').max(4000),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
  tempId: z.string().optional(),
});

router.post('/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { channelId, content, attachmentUrl, tempId } = postMessageSchema.parse(req.body);

    const auth = await canUserAccessChannel(userId, channelId);
    if (!auth.authorized || !auth.communityId || !auth.channelType) {
      return res.status(403).json({ error: { message: 'Access denied to this chat channel' } });
    }

    let replayed = false;
    let chatMessage: { id: string; content: string; sender: { firstName: string | null }; [key: string]: unknown } | undefined;
    if (tempId) {
      const key = `chat:${userId}:${tempId}`;
      const prior = await prisma.idempotencyKey.findUnique({ where: { key } });
      if (prior?.response) {
        replayed = true;
        chatMessage = (prior.response as { message: typeof chatMessage }).message;
      } else if (prior) {
        return res.status(409).json({ error: { message: 'This message is already being sent. Please wait.' } });
      } else {
        try {
          await prisma.idempotencyKey.create({ data: { key, endpoint: '/chat/messages', userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        } catch (error: any) {
          if (error?.code === 'P2002') return res.status(409).json({ error: { message: 'This message is already being sent. Please wait.' } });
          throw error;
        }
        chatMessage = await prisma.chatMessage.create({
          data: { communityId: auth.communityId, channelType: auth.channelType, channelId, unitId: auth.unitId || null, senderId: userId, content, attachmentUrl: attachmentUrl || null },
          include: { sender: { select: { id: true, firstName: true, lastName: true, unitNumber: true, role: true } } },
        });
        await prisma.idempotencyKey.update({ where: { key }, data: { response: JSON.parse(JSON.stringify({ message: chatMessage })) } });
      }
    } else {
      chatMessage = await prisma.chatMessage.create({
        data: { communityId: auth.communityId, channelType: auth.channelType, channelId, unitId: auth.unitId || null, senderId: userId, content, attachmentUrl: attachmentUrl || null },
        include: { sender: { select: { id: true, firstName: true, lastName: true, unitNumber: true, role: true } } },
      });
    }

    if (!chatMessage) return res.status(500).json({ error: { message: 'Unable to create message' } });

    // Broadcast to WebSocket subscribers in this channel
    if (!replayed) broadcastToChannel(channelId, { type: 'MESSAGE', message: { ...chatMessage, tempId } });

    // Asynchronously dispatch push/alert notifications to channel recipients (excluding sender)
    if (!replayed) (async () => {
      try {
        const communityId = auth.communityId;
        let recipientIds: string[] = [];
        if (auth.unitId) {
          const [residencies, ownerships] = await Promise.all([
            prisma.unitResidency.findMany({ where: { unitId: auth.unitId, status: 'ACTIVE' }, select: { userId: true } }),
            prisma.unitOwnership.findMany({ where: { unitId: auth.unitId, status: 'ACTIVE' }, select: { userId: true } }),
          ]);
          recipientIds = [...new Set([...residencies.map((r) => r.userId), ...ownerships.map((o) => o.userId)])];
        } else if (auth.channelType === ChatChannelType.OWNERS && communityId) {
          const owners = await prisma.membership.findMany({
            where: { communityId, role: Role.OWNER, status: 'APPROVED' },
            select: { userId: true },
          });
          recipientIds = owners.map((o) => o.userId);
        } else if (auth.channelType === ChatChannelType.LEADERSHIP_MANAGEMENT && communityId) {
          const leaders = await prisma.membership.findMany({
            where: { communityId, role: { in: [Role.LEADERSHIP, Role.MANAGER] }, status: 'APPROVED' },
            select: { userId: true },
          });
          recipientIds = leaders.map((l) => l.userId);
        }

        const filteredRecipients = recipientIds.filter((id) => id !== userId);
        if (filteredRecipients.length > 0) {
          await notifyUsers(
            filteredRecipients,
            {
              type: 'CHAT_MESSAGE',
              title: `${chatMessage.sender.firstName || 'Resident'}: New message`,
              message: content.slice(0, 120),
              metadata: { channelId, messageId: chatMessage.id, senderId: userId },
            },
            // Persist this event as well as sending the live alert. Otherwise it
            // disappears from the Notifications screen as soon as the banner is
            // dismissed.
            { persist: true, sendWebSocket: false }
          );
        }
      } catch (err) {
        console.error('Error triggering chat notifications:', err);
      }
    })();

    res.status(201).json({
      success: true,
      message: { ...chatMessage, tempId },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
