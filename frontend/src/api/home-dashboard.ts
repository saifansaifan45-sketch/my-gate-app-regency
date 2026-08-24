import { communityApi, CommunityAnnouncement } from './community';
import { TicketItem } from './manager';
import { managerApi } from './manager';
import { ticketsApi } from './tickets';
import { VisitorItem, visitorsApi } from './visitors';

export const homeDashboardQueryKey = ['home-dashboard'] as const;

export interface HomeAnnouncement {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  attachmentUrl?: string | null;
}

export interface HomeDashboardData {
  tickets: TicketItem[];
  visitorCount: number | null;
  deliveryCount: number | null;
  staffCount: number | null;
  pendingGateVisitor: VisitorItem | null;
  announcements: HomeAnnouncement[];
  requestsError: boolean;
  communityError: boolean;
}

const isActiveVisitor = (visitor: VisitorItem) =>
  visitor.status === 'PENDING' || visitor.status === 'APPROVED' || visitor.status === 'CHECKED_IN';

/**
 * A single server snapshot for the resident Home screen. Mutations invalidate
 * this key, so every visible Home card reads the same post-mutation state.
 */
export const getHomeDashboard = async (includeStaff = false): Promise<HomeDashboardData> => {
  const requests = [ticketsApi.getMyTickets(), visitorsApi.getMyVisitors(), communityApi.getSpaces()] as const;
  const results = await Promise.allSettled([
    ...requests,
    includeStaff ? managerApi.getAttendance() : Promise.resolve(null),
  ]);

  const [ticketsRes, visitorsRes, spacesRes, attendanceRes] = results;

  const tickets = ticketsRes.status === 'fulfilled' ? ticketsRes.value.tickets : [];
  const visitors = visitorsRes.status === 'fulfilled' ? visitorsRes.value.visitors.filter(isActiveVisitor) : [];
  const guestVisits = visitors.filter((visitor) => visitor.visitorType !== 'DELIVERY');
  const deliveryVisits = visitors.filter((visitor) => visitor.visitorType === 'DELIVERY');

  let announcements: HomeAnnouncement[] = [];
  let communityError: boolean;

  if (spacesRes.status === 'fulfilled') {
    const announcementResponses = await Promise.allSettled(
      spacesRes.value.spaces.map((space) => communityApi.getAnnouncements(space.id))
    );
    const accessibleResponses = announcementResponses.filter(
      (result): result is PromiseFulfilledResult<{ announcements: CommunityAnnouncement[] }> => result.status === 'fulfilled'
    );

    communityError = announcementResponses.length > 0 && accessibleResponses.length === 0;
    announcements = accessibleResponses
      .flatMap((result) => result.value.announcements)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        category: announcement.category,
        createdAt: announcement.createdAt,
        attachmentUrl: announcement.attachmentUrl || null,
      }));
  } else {
    communityError = true;
  }

  return {
    tickets,
    visitorCount: visitorsRes.status === 'fulfilled' ? guestVisits.length : null,
    deliveryCount: visitorsRes.status === 'fulfilled' ? deliveryVisits.length : null,
    staffCount: attendanceRes.status === 'fulfilled' && attendanceRes.value ? attendanceRes.value.summary.present : null,
    pendingGateVisitor: visitors.find((visitor) => visitor.status === 'PENDING') || null,
    announcements,
    requestsError: ticketsRes.status !== 'fulfilled',
    communityError,
  };
};
