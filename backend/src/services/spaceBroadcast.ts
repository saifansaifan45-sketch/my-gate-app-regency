import { prisma } from '../prisma';
import { SpaceType, SpaceMessageType } from '@prisma/client';

export async function broadcastTicketCreated(ticket: {
  id: string;
  category: string;
  title: string;
  priority: string;
  unitId?: string | null;
  communityId?: string | null;
  unitNumber?: string;
  residentName?: string;
}) {
  try {
    let communityId = ticket.communityId;
    if (!communityId) {
      const defaultComm = await prisma.community.findFirst();
      communityId = defaultComm?.id || null;
    }

    if (!communityId) return;

    // Find Leadership Operations spaces in this community
    const targetSpaces = await prisma.space.findMany({
      where: {
        communityId,
        type: { in: [SpaceType.LEADERSHIP_OPERATIONS, SpaceType.RESIDENT_COMMUNITY] },
      },
    });

    for (const space of targetSpaces) {
      await prisma.spaceMessage.create({
        data: {
          spaceId: space.id,
          type: SpaceMessageType.TICKET_CREATED,
          title: `New Maintenance Request: ${ticket.title}`,
          content: `${ticket.residentName || 'Resident'} from Unit ${ticket.unitNumber || 'assigned'} reported a ${ticket.priority} priority ${ticket.category} issue.`,
          metadata: {
            ticketId: ticket.id,
            category: ticket.category,
            priority: ticket.priority,
            unitNumber: ticket.unitNumber,
          },
        },
      });
    }
  } catch (error) {
    console.error('Failed to broadcast ticket creation to spaces:', error);
  }
}

export async function broadcastTicketAssigned(ticketId: string, personnelName: string, category: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { unit: true },
    });

    if (!ticket || !ticket.communityId) return;

    const targetSpaces = await prisma.space.findMany({
      where: {
        communityId: ticket.communityId,
        type: SpaceType.LEADERSHIP_OPERATIONS,
      },
    });

    for (const space of targetSpaces) {
      await prisma.spaceMessage.create({
        data: {
          spaceId: space.id,
          type: SpaceMessageType.TICKET_ASSIGNED,
          title: `Technician Assigned: ${personnelName}`,
          content: `${personnelName} (${category}) has been dispatched to resolve "${ticket.title}" for Unit ${ticket.unit?.unitNumber || 'Unit'}.`,
          metadata: {
            ticketId: ticket.id,
            personnelName,
            category,
          },
        },
      });
    }
  } catch (error) {
    console.error('Failed to broadcast ticket assignment to spaces:', error);
  }
}

export async function broadcastEmergencyAlert(communityId: string, title: string, content: string, metadata?: any) {
  try {
    const emergencySpaces = await prisma.space.findMany({
      where: {
        communityId,
        type: SpaceType.EMERGENCY,
      },
    });

    for (const space of emergencySpaces) {
      await prisma.spaceMessage.create({
        data: {
          spaceId: space.id,
          type: SpaceMessageType.EMERGENCY_ALERT,
          title,
          content,
          metadata: metadata || null,
        },
      });
    }
  } catch (error) {
    console.error('Failed to broadcast emergency alert:', error);
  }
}
