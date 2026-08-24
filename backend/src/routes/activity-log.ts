import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Role, OwnershipStatus, ResidencyStatus } from '@prisma/client';

const router = Router();
router.use(requireAuth);

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

type ActivityType = 'VISITOR' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'GATE' | 'DELIVERY' | 'HOUSE_HELP' | 'SOS' | 'ATTENDANCE' | 'GENERAL';

interface ActivityItem {
  id: string;
  type: ActivityType;
  action: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  actorId: string | null;
  unitNumber: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface ActivityCursor {
  createdAt: Date;
  id: string;
}

function decodeCursor(value: string | null): ActivityCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    // Cursors are opaque to clients. An invalid/legacy cursor starts a fresh page
    // rather than being passed into unrelated Prisma tables.
    return null;
  }
}

function encodeCursor(activity: ActivityItem): string {
  return Buffer.from(JSON.stringify({ createdAt: activity.createdAt.toISOString(), id: activity.id })).toString('base64url');
}

function applyCursor<T extends Record<string, unknown>>(where: T, cursor: ActivityCursor | null): T & Record<string, unknown> {
  if (!cursor) return where;
  return {
    AND: [
      where,
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ],
  } as unknown as T & Record<string, unknown>;
}

function personName(person?: { firstName: string | null; lastName: string | null } | null): string {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'Unknown';
}

// Map AuditLog visitor actions to activity types and labels
function mapVisitorAuditAction(action: string): { type: ActivityType; label: string } {
  const map: Record<string, { type: ActivityType; label: string }> = {
    VISITOR_CREATED: { type: 'VISITOR', label: 'Visitor Added' },
    VISITOR_APPROVED: { type: 'VISITOR', label: 'Visitor Approved' },
    VISITOR_REJECTED: { type: 'VISITOR', label: 'Visitor Rejected' },
    VISITOR_REVOKED: { type: 'VISITOR', label: 'Visitor Pass Revoked' },
    VISITOR_CHECK_IN: { type: 'GATE', label: 'Visitor Checked In' },
    VISITOR_CHECK_OUT: { type: 'GATE', label: 'Visitor Checked Out' },
    VISITOR_UNANNOUNCED_ARRIVAL: { type: 'GATE', label: 'Unannounced Arrival' },
    DELIVERY_HANDOFF: { type: 'DELIVERY', label: 'Delivery Handed Off' },
    DELIVERY_CHECKOUT_EXCEPTION: { type: 'DELIVERY', label: 'Delivery Checkout Exception' },
    VISITOR_HANDOFF_SUGGESTED: { type: 'DELIVERY', label: 'Handoff Suggested' },
  };
  return map[action] || { type: 'GENERAL', label: action.replace(/_/g, ' ').toLowerCase() };
}

// Map Notification types to activity types and labels
function mapNotificationType(type: string): { type: ActivityType; label: string } | null {
  const map: Record<string, { type: ActivityType; label: string }> = {
    VISITOR_PASS_CREATED: { type: 'VISITOR', label: 'Visitor Pass Created' },
    VISITOR_ARRIVAL: { type: 'GATE', label: 'Visitor Arrival' },
    UNANNOUNCED_ARRIVAL: { type: 'GATE', label: 'Unannounced Arrival Alert' },
    DELIVERY_HANDOFF: { type: 'DELIVERY', label: 'Delivery Handed Off' },
    NEW_TICKET: { type: 'MAINTENANCE', label: 'New Maintenance Request' },
    TICKET_ACCEPTED: { type: 'MAINTENANCE', label: 'Ticket Accepted' },
    TICKET_OPEN: { type: 'MAINTENANCE', label: 'Ticket Opened' },
    TICKET_ASSIGNED: { type: 'MAINTENANCE', label: 'Ticket Assigned' },
    TICKET_IN_PROGRESS: { type: 'MAINTENANCE', label: 'Ticket In Progress' },
    TICKET_COMPLETED_BY_WORKER: { type: 'MAINTENANCE', label: 'Work Completed by Worker' },
    TICKET_PENDING_RESIDENT_CONFIRMATION: { type: 'MAINTENANCE', label: 'Awaiting Resident Confirmation' },
    TICKET_CLOSED: { type: 'MAINTENANCE', label: 'Ticket Closed' },
    TICKET_REOPENED: { type: 'MAINTENANCE', label: 'Ticket Reopened' },
    TICKET_CANCELLED: { type: 'MAINTENANCE', label: 'Ticket Cancelled' },
    TASK_ASSIGNED: { type: 'MAINTENANCE', label: 'Task Assigned' },
    NEW_TASK_ASSIGNED: { type: 'MAINTENANCE', label: 'New Task Assigned' },
    WORK_STARTED: { type: 'MAINTENANCE', label: 'Work Started' },
    WORK_COMPLETED: { type: 'MAINTENANCE', label: 'Work Completed' },
    TICKET_VERIFICATION_REQUEST: { type: 'MAINTENANCE', label: 'Verification Requested' },
    ANNOUNCEMENT_PUBLISHED: { type: 'ANNOUNCEMENT', label: 'Announcement Published' },
    EMERGENCY_SOS: { type: 'SOS', label: 'Emergency SOS' },
    ROLE_PROMOTED: { type: 'GENERAL', label: 'Role Promoted' },
    ROLE_REVOKED: { type: 'GENERAL', label: 'Role Revoked' },
    WORKFORCE_APPROVED: { type: 'GENERAL', label: 'Workforce Approved' },
    WORKFORCE_REJECTED: { type: 'GENERAL', label: 'Workforce Rejected' },
    EMPLOYMENT_TERMINATED: { type: 'GENERAL', label: 'Employment Terminated' },
    EMPLOYMENT_SUSPENDED: { type: 'GENERAL', label: 'Employment Suspended' },
    RESIDENCY_APPROVED: { type: 'GENERAL', label: 'Residency Approved' },
    RESIDENCY_REJECTED: { type: 'GENERAL', label: 'Residency Rejected' },
  };
  return map[type] || null;
}

// Map PersonnelActivity types to activity types and labels
function mapPersonnelActivityType(type: string): { type: ActivityType; label: string } {
  const map: Record<string, { type: ActivityType; label: string }> = {
    TASK_COMPLETED: { type: 'MAINTENANCE', label: 'Task Completed' },
    TASK_FAILED: { type: 'MAINTENANCE', label: 'Task Failed' },
    ATTENDANCE_MARKED: { type: 'ATTENDANCE', label: 'Attendance Marked' },
    LEAVE_REQUESTED: { type: 'ATTENDANCE', label: 'Leave Requested' },
    OVERTIME_LOGGED: { type: 'ATTENDANCE', label: 'Overtime Logged' },
  };
  return map[type] || { type: 'GENERAL', label: type.replace(/_/g, ' ').toLowerCase() };
}

// Determine user's community IDs and role scope
async function getUserScope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      memberships: {
        where: { status: 'APPROVED' },
        select: { communityId: true, role: true, unitId: true },
      },
      residencies: {
        where: { status: ResidencyStatus.ACTIVE },
        select: { unitId: true, unit: { select: { id: true, communityId: true, unitNumber: true } } },
      },
      ownerships: {
        where: { status: OwnershipStatus.ACTIVE },
        select: { unitId: true, unit: { select: { id: true, communityId: true, unitNumber: true } } },
      },
    },
  });

  if (!user) return null;

  const communityIds = [...new Set(user.memberships.map((m) => m.communityId))];
  const hasManagerRole = user.memberships.some((m) => m.role === Role.MANAGER);
  const hasLeadershipRole = user.memberships.some((m) => m.role === Role.LEADERSHIP);
  const hasSecurityRole = user.memberships.some((m) => m.role === Role.WORKFORCE);

  let scope: 'RESIDENT' | 'SECURITY' | 'MANAGER' | 'LEADERSHIP' = 'RESIDENT';
  if (hasLeadershipRole) scope = 'LEADERSHIP';
  else if (hasManagerRole) scope = 'MANAGER';
  else if (hasSecurityRole) scope = 'SECURITY';

  const activeUnit = user.residencies[0]?.unit || user.ownerships[0]?.unit || null;

  return {
    userId,
    scope,
    communityIds,
    activeUnit,
    unitIds: [
      ...user.residencies.map((r) => r.unitId),
      ...user.ownerships.map((o) => o.unitId),
    ],
  };
}

// ----------------------------------------------------
// GET /activity-log
// ----------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userScope = await getUserScope(userId);
    if (!userScope) {
      return res.status(401).json({ error: { message: 'User not found' } });
    }

    const typeFilter = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : null;
    const cursor = decodeCursor(typeof req.query.cursor === 'string' ? req.query.cursor : null);
    const requestedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : DEFAULT_PAGE_LIMIT;
    const pageLimit = Number.isInteger(requestedLimit)
      ? Math.min(MAX_PAGE_LIMIT, Math.max(1, requestedLimit))
      : DEFAULT_PAGE_LIMIT;

    const activities: ActivityItem[] = [];

    // ----------------------------------------------------------
    // 1. AuditLog entries (visitor events)
    // ----------------------------------------------------------
    if (userScope.communityIds.length > 0) {
      const auditWhere: any = {
        communityId: { in: userScope.communityIds },
        action: {
          in: [
            'VISITOR_CREATED', 'VISITOR_APPROVED', 'VISITOR_REJECTED', 'VISITOR_REVOKED',
            'VISITOR_CHECK_IN', 'VISITOR_CHECK_OUT', 'VISITOR_UNANNOUNCED_ARRIVAL',
            'DELIVERY_HANDOFF', 'DELIVERY_CHECKOUT_EXCEPTION', 'VISITOR_HANDOFF_SUGGESTED',
          ],
        },
      };

      // Residents: only audit logs for their unit's visitors
      if (userScope.scope === 'RESIDENT') {
        const unitVisitors = await prisma.visitor.findMany({
          where: { unitId: { in: userScope.unitIds } },
          select: { id: true },
        });
        const visitorIds = unitVisitors.map((v) => v.id);
        if (visitorIds.length === 0) {
          // No visitors for this resident, skip audit log query for them
          auditWhere.id = '__none__';
        } else {
          // Prisma JSON path filters do not consistently support `in` across
          // providers. Build explicit equality predicates instead.
          auditWhere.OR = visitorIds.map((visitorId) => ({ metadata: { path: ['visitorId'], equals: visitorId } }));
        }
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: applyCursor(auditWhere, cursor),
        orderBy: { createdAt: 'desc' },
        take: pageLimit * 2,
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      });

      // Look up visitors mentioned in audit logs for metadata enrichment
      const visitorIdsFromLogs = auditLogs
        .map((log) => {
          const meta = (log.metadata || {}) as Record<string, unknown>;
          return typeof meta.visitorId === 'string' ? meta.visitorId : null;
        })
        .filter(Boolean) as string[];

      const visitorMap = new Map<string, { name: string; visitorType: string; unitNumber: string | null }>();
      if (visitorIdsFromLogs.length > 0) {
        const visitors = await prisma.visitor.findMany({
          where: { id: { in: visitorIdsFromLogs } },
          include: { unit: { select: { unitNumber: true } } },
        });
        for (const v of visitors) {
          visitorMap.set(v.id, { name: v.name, visitorType: v.visitorType, unitNumber: v.unit?.unitNumber || null });
        }
      }

      for (const log of auditLogs) {
        const meta = (log.metadata || {}) as Record<string, unknown>;
        const visitorId = typeof meta.visitorId === 'string' ? meta.visitorId : null;
        const visitor = visitorId ? visitorMap.get(visitorId) : null;
        const { type, label } = mapVisitorAuditAction(log.action);

        activities.push({
          id: log.id,
          type,
          action: log.action,
          title: label,
          description: visitor
            ? `${visitor.name} (${visitor.visitorType}) - ${label}`
            : label,
          actorName: personName(log.actor),
          actorRole: log.actor?.role || 'UNKNOWN',
          actorId: log.actorId,
          unitNumber: visitor?.unitNumber || null,
          targetId: visitorId,
          metadata: { visitorId, ...meta },
          createdAt: log.createdAt,
        });
      }
    }

    // ----------------------------------------------------------
    // 2. Notifications (ticket events, role changes, announcements, SOS, etc.)
    // ----------------------------------------------------------
    {
      const notifWhere: any = { userId };

      if (typeFilter === 'MAINTENANCE') {
        notifWhere.type = { in: ['NEW_TICKET', 'TICKET_ACCEPTED', 'TICKET_ASSIGNED', 'TICKET_IN_PROGRESS', 'TICKET_COMPLETED_BY_WORKER', 'TICKET_PENDING_RESIDENT_CONFIRMATION', 'TICKET_CLOSED', 'TICKET_REOPENED', 'TICKET_CANCELLED', 'TASK_ASSIGNED', 'NEW_TASK_ASSIGNED', 'WORK_STARTED', 'WORK_COMPLETED', 'TICKET_VERIFICATION_REQUEST'] };
      } else if (typeFilter === 'VISITOR') {
        notifWhere.type = { in: ['VISITOR_PASS_CREATED'] };
      } else if (typeFilter === 'GATE') {
        notifWhere.type = { in: ['VISITOR_ARRIVAL', 'UNANNOUNCED_ARRIVAL'] };
      } else if (typeFilter === 'DELIVERY') {
        notifWhere.type = { in: ['DELIVERY_HANDOFF'] };
      } else if (typeFilter === 'ANNOUNCEMENT') {
        notifWhere.type = { in: ['ANNOUNCEMENT_PUBLISHED'] };
      } else if (typeFilter === 'SOS') {
        notifWhere.type = { in: ['EMERGENCY_SOS'] };
      } else if (typeFilter === 'HOUSE_HELP' || typeFilter === 'ATTENDANCE') {
        notifWhere.type = { in: ['__NO_ACTIVITY_FOR_FILTER__'] };
      } else if (typeFilter === 'GENERAL') {
        notifWhere.type = { in: ['ROLE_PROMOTED', 'ROLE_REVOKED', 'WORKFORCE_APPROVED', 'WORKFORCE_REJECTED', 'EMPLOYMENT_TERMINATED', 'EMPLOYMENT_SUSPENDED', 'RESIDENCY_APPROVED', 'RESIDENCY_REJECTED'] };
      } else if (typeFilter) {
        notifWhere.type = { in: ['__NO_ACTIVITY_FOR_FILTER__'] };
      }

      const notifications = await prisma.notification.findMany({
        where: applyCursor(notifWhere, cursor),
        orderBy: { createdAt: 'desc' },
        take: pageLimit * 2,
      });

      for (const notif of notifications) {
        const mapped = mapNotificationType(notif.type);
        if (!mapped) continue;
        const meta = (notif.metadata || {}) as Record<string, unknown>;

        // For ticket notifications, try to get unit info
        let unitNumber: string | null = null;
        if (meta.ticketId && typeof meta.ticketId === 'string') {
          const ticket = await prisma.ticket.findUnique({
            where: { id: meta.ticketId },
            select: { unit: { select: { unitNumber: true } } },
          });
          unitNumber = ticket?.unit?.unitNumber || null;
        }

        activities.push({
          id: `notif-${notif.id}`,
          type: mapped.type,
          action: notif.type,
          title: notif.title,
          description: notif.message,
          actorName: 'System',
          actorRole: 'SYSTEM',
          actorId: null,
          unitNumber,
          targetId: meta.ticketId ? String(meta.ticketId) : null,
          metadata: meta,
          createdAt: notif.createdAt,
        });
      }
    }

    // ----------------------------------------------------------
    // 3. PersonnelActivity (attendance, tasks) — managers & leadership only
    // ----------------------------------------------------------
    if ((userScope.scope === 'MANAGER' || userScope.scope === 'LEADERSHIP') && userScope.communityIds.length > 0) {
      const personnelActivityWhere: any = {
        personnel: { communityId: { in: userScope.communityIds } },
      };
      if (typeFilter === 'ATTENDANCE') {
        personnelActivityWhere.type = { in: ['ATTENDANCE_MARKED', 'LEAVE_REQUESTED', 'OVERTIME_LOGGED'] };
      } else if (typeFilter === 'MAINTENANCE') {
        personnelActivityWhere.type = { in: ['TASK_COMPLETED', 'TASK_FAILED'] };
      }

      const personnelActivities = await prisma.personnelActivity.findMany({
        where: applyCursor(personnelActivityWhere, cursor),
        orderBy: { createdAt: 'desc' },
        take: pageLimit * 2,
        include: {
          personnel: { select: { name: true, category: true, userId: true } },
        },
      });

      for (const pa of personnelActivities) {
        const { type, label } = mapPersonnelActivityType(pa.type);
        activities.push({
          id: pa.id,
          type,
          action: pa.type,
          title: label,
          description: pa.description,
          actorName: pa.personnel.name,
          actorRole: 'WORKFORCE',
          actorId: pa.personnel.userId,
          unitNumber: null,
          targetId: pa.referenceId,
          metadata: { personnelId: pa.personnelId, category: pa.personnel.category },
          createdAt: pa.createdAt,
        });
      }
    }

    // ----------------------------------------------------------
    // 4. Announcements — managers & leadership see created; residents see published
    // ----------------------------------------------------------
    if (userScope.communityIds.length > 0) {
      let announcementWhere: any = { communityId: { in: userScope.communityIds } };

      if (userScope.scope === 'RESIDENT') {
        announcementWhere.status = 'PUBLISHED';
      }
      if (typeFilter === 'ANNOUNCEMENT') {
        // Already filtered to ANNOUNCEMENT type by nature
      } else if (typeFilter) {
        // Skip announcements if filtering for a non-announcement type
        announcementWhere = null;
      }

      if (announcementWhere) {
        const announcements = await prisma.announcement.findMany({
          where: applyCursor(announcementWhere, cursor),
          orderBy: { createdAt: 'desc' },
          take: pageLimit * 2,
          include: { author: { select: { firstName: true, lastName: true, role: true } } },
        });

        for (const ann of announcements) {
          activities.push({
            id: `ann-${ann.id}`,
            type: 'ANNOUNCEMENT',
            action: 'ANNOUNCEMENT_CREATED',
            title: ann.title,
            description: ann.content.slice(0, 200),
            actorName: personName(ann.author),
            actorRole: ann.author?.role || 'UNKNOWN',
            actorId: ann.authorId,
            unitNumber: null,
            targetId: ann.id,
            metadata: { category: ann.category, priority: ann.priority, status: ann.status },
            createdAt: ann.createdAt,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // 5. Tickets — managers/leadership see community-wide; residents see own
    // ----------------------------------------------------------
    if (!typeFilter || typeFilter === 'MAINTENANCE') {
      let ticketWhere: any = {};
      if (userScope.scope === 'RESIDENT') {
        ticketWhere = { residentId: userId, deletedAt: null };
      } else if ((userScope.scope === 'MANAGER' || userScope.scope === 'LEADERSHIP') && userScope.communityIds.length > 0) {
        ticketWhere = { communityId: { in: userScope.communityIds }, deletedAt: null };
      } else {
        ticketWhere = null;
      }

      if (ticketWhere) {
        const tickets = await prisma.ticket.findMany({
          where: applyCursor(ticketWhere, cursor),
          orderBy: { createdAt: 'desc' },
          take: pageLimit * 2,
          include: {
            resident: { select: { firstName: true, lastName: true, unitNumber: true, role: true } },
            unit: { select: { unitNumber: true } },
          },
        });

        for (const ticket of tickets) {
          const unitNum = ticket.unit?.unitNumber || ticket.resident?.unitNumber || null;
          activities.push({
            id: `ticket-${ticket.id}`,
            type: 'MAINTENANCE',
            action: `TICKET_${ticket.status}`,
            title: ticket.title,
            description: `${ticket.category} - ${ticket.title}`,
            actorName: personName(ticket.resident),
            actorRole: ticket.resident?.role || 'RESIDENT',
            actorId: ticket.residentId,
            unitNumber: unitNum,
            targetId: ticket.id,
            metadata: { category: ticket.category, priority: ticket.priority, status: ticket.status },
            createdAt: ticket.createdAt,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // 6. Attendance — managers/leadership see community-wide
    // ----------------------------------------------------------
    if ((userScope.scope === 'MANAGER' || userScope.scope === 'LEADERSHIP') && (!typeFilter || typeFilter === 'ATTENDANCE')) {
      const attendanceWhere: any = {
        personnel: { communityId: { in: userScope.communityIds } },
      };

      const attendances = await prisma.attendance.findMany({
        where: applyCursor(attendanceWhere, cursor),
        orderBy: { createdAt: 'desc' },
        take: pageLimit * 2,
        include: {
          personnel: { select: { name: true, category: true, userId: true } },
        },
      });

      for (const att of attendances) {
        activities.push({
          id: `att-${att.id}`,
          type: 'ATTENDANCE',
          action: 'ATTENDANCE_MARKED',
          title: `Attendance: ${att.personnel.name}`,
          description: `${att.personnel.name} marked as ${att.status}`,
          actorName: att.personnel.name,
          actorRole: 'WORKFORCE',
          actorId: att.personnel.userId,
          unitNumber: null,
          targetId: att.id,
          metadata: { status: att.status, category: att.personnel.category, checkIn: att.checkIn, checkOut: att.checkOut },
          createdAt: att.createdAt,
        });
      }
    }

    // ----------------------------------------------------------
    // Sort, deduplicate, paginate
    // ----------------------------------------------------------
    // Deduplicate by id
    const seen = new Set<string>();
    const uniqueActivities = activities.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    // Sort descending by createdAt
    uniqueActivities.sort((a, b) => {
      const byDate = b.createdAt.getTime() - a.createdAt.getTime();
      return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
    });

    // Filter by type if specified
    const filtered = typeFilter
      ? uniqueActivities.filter((a) => a.type === typeFilter)
      : uniqueActivities;

    // Cursor-based pagination: take one extra to determine hasMore
    const paginated = filtered.slice(0, pageLimit + 1);
    const hasMore = paginated.length > pageLimit;
    const activitiesToReturn = hasMore ? paginated.slice(0, pageLimit) : paginated;

    // Cursor encodes the last item's timestamp and id so it remains valid
    // across the different tables merged into this feed.
    const lastActivity = activitiesToReturn[activitiesToReturn.length - 1];
    const nextCursor = hasMore && lastActivity
      ? encodeCursor(lastActivity)
      : null;

    // Sanitize: remove phone numbers, OTPs
    const sanitized = activitiesToReturn.map((a) => ({
      id: a.id,
      type: a.type,
      action: a.action,
      title: a.title,
      description: a.description,
      actorName: a.actorName,
      actorRole: a.actorRole,
      actorId: a.actorId,
      unitNumber: a.unitNumber,
      targetId: a.targetId,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    }));

    res.json({
      activities: sanitized,
      cursor: nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Activity log error:', error);
    next(error);
  }
});

export default router;
