import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { canUserAccessChannel } from '../services/chatAuth';

const router = Router();
router.use(requireAuth);

// In-memory message store for V0.0.1 — no new migration, preserves 34-table schema
// Key: channelId, Value: messages[]
interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}
const messageStore = new Map<string, ChatMessage[]>();

// GET /chat/channels — list channels accessible to user
router.get('/channels', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { where: { status: 'APPROVED' }, include: { community: true } },
        ownerships: { where: { status: 'ACTIVE' }, include: { unit: { include: { community: true } } } },
        residencies: { where: { status: 'ACTIVE' }, include: { unit: { include: { community: true } } } },
      },
    });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const channels: Array<{ channelId: string; name: string; communityId: string; communityName?: string }> = [];
    const seen = new Set<string>();

    const unitMap = new Map<string, { id: string; unitNumber: string; communityId: string; communityName: string }>();
    user.ownerships.forEach((o) => unitMap.set(o.unit.id, { id: o.unit.id, unitNumber: o.unit.unitNumber, communityId: o.unit.communityId, communityName: o.unit.community.name }));
    user.residencies.forEach((r) => unitMap.set(r.unit.id, { id: r.unit.id, unitNumber: r.unit.unitNumber, communityId: r.unit.communityId, communityName: r.unit.community.name }));
    for (const u of unitMap.values()) {
      const cid = `unit:${u.id}`;
      if (!seen.has(cid)) {
        seen.add(cid);
        channels.push({ channelId: cid, name: `Unit ${u.unitNumber}`, communityId: u.communityId, communityName: u.communityName });
      }
    }

    const communities = new Set<string>();
    user.memberships.forEach((m) => communities.add(m.communityId));
    user.ownerships.forEach((o) => communities.add(o.unit.communityId));
    for (const communityId of communities) {
      const cid = `community:${communityId}`;
      if (!seen.has(cid)) {
        seen.add(cid);
        const comm = await prisma.community.findUnique({ where: { id: communityId } });
        channels.push({ channelId: cid, name: comm?.name || 'Community', communityId });
      }
    }

    // Owners channel
    const isOwner = user.memberships.some((m) => m.role === 'OWNER' || m.role === 'LEADERSHIP') || user.ownerships.length > 0;
    if (isOwner) {
      for (const communityId of communities) {
        const cid = `channel:owners:${communityId}`;
        if (!seen.has(cid)) {
          seen.add(cid);
          const comm = await prisma.community.findUnique({ where: { id: communityId } });
          if (comm?.name) {
            channels.push({ channelId: cid, name: 'Owners Forum', communityId, communityName: comm.name });
          } else {
            channels.push({ channelId: cid, name: 'Owners Forum', communityId });
          }
        }
      }
    }

    res.json({ channels });
  } catch (e) { next(e); }
});

// GET /chat/channels/:channelId/messages — header auth, not query
router.get('/channels/:channelId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const channelId = decodeURIComponent(req.params.channelId as string);
    const access = await canUserAccessChannel(userId, channelId);
    if (!access.authorized) return res.status(404).json({ error: { message: 'Channel not found' } });
    const messages = messageStore.get(channelId) || [];
    res.json({ messages });
  } catch (e) { next(e); }
});

const sendSchema = z.object({ content: z.string().trim().min(1, 'Content is required').max(2000) });

// POST /chat/channels/:channelId/messages — header auth, PAUSED/REVOKED denied via canUserAccessChannel (checks ACTIVE/APPROVED)
router.post('/channels/:channelId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const channelId = decodeURIComponent(req.params.channelId as string);
    const access = await canUserAccessChannel(userId, channelId);
    if (!access.authorized) return res.status(404).json({ error: { message: 'Channel not found' } });
    const { content } = sendSchema.parse(req.body);
    const msg: ChatMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, channelId, authorId: userId, content, createdAt: new Date().toISOString() };
    const list = messageStore.get(channelId) || [];
    list.push(msg);
    messageStore.set(channelId, list);
    res.status(201).json({ message: msg });
  } catch (e) { next(e); }
});

export default router;

// Export for tests to clear store
export function __clearChatStore() { messageStore.clear(); }
