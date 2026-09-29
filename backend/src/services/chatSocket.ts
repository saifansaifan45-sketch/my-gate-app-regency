import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '../prisma';
import { verifyAccessToken } from '../utils/jwt';
import { ChatChannelType, Role } from '@prisma/client';
import { parse as parseUrl } from 'url';

export interface ChannelAccessResult {
  authorized: boolean;
  channelType?: ChatChannelType;
  communityId?: string;
  unitId?: string;
}

export async function canUserAccessChannel(userId: string, channelId: string): Promise<ChannelAccessResult> {
  if (!channelId || typeof channelId !== 'string') {
    return { authorized: false };
  }

  // 1. UNIT Channel: "unit:<unitId>"
  if (channelId.startsWith('unit:')) {
    const unitId = channelId.replace('unit:', '').trim();
    if (!unitId) return { authorized: false };

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, communityId: true },
    });
    if (!unit) return { authorized: false };

    // Check if user has active residency in this unit
    const activeResidency = await prisma.unitResidency.findFirst({
      where: { userId, unitId, status: 'ACTIVE' },
    });
    if (activeResidency) {
      return { authorized: true, channelType: ChatChannelType.UNIT, communityId: unit.communityId, unitId: unit.id };
    }

    // Check if user has active ownership of this unit
    const activeOwnership = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: 'ACTIVE' },
    });
    if (activeOwnership) {
      return { authorized: true, channelType: ChatChannelType.UNIT, communityId: unit.communityId, unitId: unit.id };
    }

    // Check approved membership tied to this unit
    const unitMembership = await prisma.membership.findFirst({
      where: { userId, unitId, status: 'APPROVED' },
    });
    if (unitMembership) {
      return { authorized: true, channelType: ChatChannelType.UNIT, communityId: unit.communityId, unitId: unit.id };
    }

    // Check if user is Leadership or Manager in this community
    const leadershipOrManager = await prisma.membership.findFirst({
      where: {
        userId,
        communityId: unit.communityId,
        role: { in: [Role.LEADERSHIP, Role.MANAGER] },
        status: 'APPROVED',
      },
    });
    if (leadershipOrManager) {
      return { authorized: true, channelType: ChatChannelType.UNIT, communityId: unit.communityId, unitId: unit.id };
    }

    return { authorized: false };
  }

  // 2. OWNERS Channel: "channel:owners" or "channel:owners:<communityId>"
  if (channelId === 'channel:owners' || channelId.startsWith('channel:owners:')) {
    const targetCommunityId = channelId.startsWith('channel:owners:')
      ? channelId.replace('channel:owners:', '').trim()
      : undefined;

    // Check if user is approved OWNER in the community
    const ownerMembership = await prisma.membership.findFirst({
      where: {
        userId,
        ...(targetCommunityId ? { communityId: targetCommunityId } : {}),
        role: { in: [Role.OWNER, Role.LEADERSHIP] },
        status: 'APPROVED',
      },
    });
    if (ownerMembership) {
      return {
        authorized: true,
        channelType: ChatChannelType.OWNERS,
        communityId: ownerMembership.communityId,
      };
    }

    // Check active unit ownership
    const unitOwnership = await prisma.unitOwnership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ...(targetCommunityId ? { unit: { communityId: targetCommunityId } } : {}),
      },
      include: { unit: { select: { communityId: true } } },
    });
    if (unitOwnership) {
      return {
        authorized: true,
        channelType: ChatChannelType.OWNERS,
        communityId: unitOwnership.unit.communityId,
      };
    }

    return { authorized: false };
  }

  // 3. LEADERSHIP & MANAGEMENT Channel: "channel:leadership_management" or "channel:leadership_management:<communityId>"
  if (
    channelId === 'channel:leadership_management' ||
    channelId.startsWith('channel:leadership_management:')
  ) {
    const targetCommunityId = channelId.startsWith('channel:leadership_management:')
      ? channelId.replace('channel:leadership_management:', '').trim()
      : undefined;

    const leaderOrManager = await prisma.membership.findFirst({
      where: {
        userId,
        ...(targetCommunityId ? { communityId: targetCommunityId } : {}),
        role: { in: [Role.LEADERSHIP, Role.MANAGER] },
        status: 'APPROVED',
      },
    });
    if (leaderOrManager) {
      return {
        authorized: true,
        channelType: ChatChannelType.LEADERSHIP_MANAGEMENT,
        communityId: leaderOrManager.communityId,
      };
    }

    return { authorized: false };
  }

  return { authorized: false };
}

// In-memory channel subscription maps
const channelSubscribers = new Map<string, Set<WebSocket>>();
const userSockets = new Map<string, Set<WebSocket>>();
const socketContext = new Map<WebSocket, { userId: string; channels: Set<string> }>();

export function broadcastToChannel(channelId: string, payload: any) {
  const subscribers = channelSubscribers.get(channelId);
  if (!subscribers || subscribers.size === 0) return;

  const data = JSON.stringify(payload);
  for (const socket of subscribers) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

export function sendToUser(userId: string, payload: any) {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;

  const data = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

export function sendToUsers(userIds: string[], payload: any) {
  for (const userId of userIds) {
    sendToUser(userId, payload);
  }
}

export function setupChatWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parseUrl(request.url || '', true);

    if (pathname === '/chat' || pathname === '/ws/chat' || pathname === '/' || pathname?.startsWith('/chat')) {
      // Handshake authentication
      let token: string | undefined;

      // 1. Check query parameter ?token=...
      if (typeof query.token === 'string') {
        token = query.token;
      }
      // 2. Check Authorization header
      if (!token && request.headers.authorization) {
        const parts = request.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }
      // 3. Check Sec-WebSocket-Protocol
      if (!token && request.headers['sec-websocket-protocol']) {
        const protocols = request.headers['sec-websocket-protocol'].split(',').map((p) => p.trim());
        token = protocols[0];
      }

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const payload = verifyAccessToken(token);
        if (!payload || !payload.userId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request, payload.userId);
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }
  });

  wss.on('connection', (ws: WebSocket, _req: any, userId: string) => {
    const channels = new Set<string>();
    socketContext.set(ws, { userId, channels });

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(ws);

    ws.send(JSON.stringify({ type: 'AUTHENTICATED', userId }));

    ws.on('message', async (data) => {
      try {
        const raw = data.toString();
        const msg = JSON.parse(raw);

        switch (msg.type) {
          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
          }

          case 'JOIN': {
            const channelId = msg.channelId;
            const auth = await canUserAccessChannel(userId, channelId);
            if (!auth.authorized) {
              ws.send(JSON.stringify({ type: 'ERROR', channelId, message: 'Not authorized for this channel' }));
              return;
            }

            if (!channelSubscribers.has(channelId)) {
              channelSubscribers.set(channelId, new Set());
            }
            channelSubscribers.get(channelId)!.add(ws);
            channels.add(channelId);

            ws.send(JSON.stringify({ type: 'JOINED', channelId }));
            break;
          }

          case 'LEAVE': {
            const channelId = msg.channelId;
            if (channelSubscribers.has(channelId)) {
              channelSubscribers.get(channelId)!.delete(ws);
            }
            channels.delete(channelId);
            ws.send(JSON.stringify({ type: 'LEFT', channelId }));
            break;
          }

          case 'SEND': {
            const { channelId, content, attachmentUrl, tempId } = msg;
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Message content cannot be empty' }));
              return;
            }

            const auth = await canUserAccessChannel(userId, channelId);
            if (!auth.authorized || !auth.communityId || !auth.channelType) {
              ws.send(JSON.stringify({ type: 'ERROR', channelId, message: 'Not authorized for this channel' }));
              return;
            }

            const chatMsg = await prisma.chatMessage.create({
              data: {
                communityId: auth.communityId,
                channelType: auth.channelType,
                channelId,
                unitId: auth.unitId || null,
                senderId: userId,
                content: content.trim(),
                attachmentUrl: attachmentUrl || null,
              },
              include: {
                sender: {
                  select: { id: true, firstName: true, lastName: true, unitNumber: true, role: true },
                },
              },
            });

            broadcastToChannel(channelId, { type: 'MESSAGE', message: { ...chatMsg, tempId } });
            break;
          }

          default: {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unknown message type' }));
          }
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'ERROR', message: err?.message || 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      for (const ch of channels) {
        if (channelSubscribers.has(ch)) {
          channelSubscribers.get(ch)!.delete(ws);
        }
      }
      if (userSockets.has(userId)) {
        userSockets.get(userId)!.delete(ws);
        if (userSockets.get(userId)!.size === 0) {
          userSockets.delete(userId);
        }
      }
      socketContext.delete(ws);
    });

    ws.on('error', () => {
      for (const ch of channels) {
        if (channelSubscribers.has(ch)) {
          channelSubscribers.get(ch)!.delete(ws);
        }
      }
      if (userSockets.has(userId)) {
        userSockets.get(userId)!.delete(ws);
        if (userSockets.get(userId)!.size === 0) {
          userSockets.delete(userId);
        }
      }
      socketContext.delete(ws);
    });
  });

  return wss;
}
