import { api } from './client';

export type ActivityType = 
  | 'VISITOR' 
  | 'GATE' 
  | 'DELIVERY' 
  | 'HOUSE_HELP' 
  | 'MAINTENANCE' 
  | 'ANNOUNCEMENT' 
  | 'SOS' 
  | 'ATTENDANCE' 
  | 'GENERAL';

export interface ActivityActor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  action?: string;
  title: string;
  description: string;
  actor: ActivityActor;
  unitNumber?: string | null;
  unitId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface BackendActivityItem {
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
  createdAt: string;
}

interface BackendActivityLogResponse {
  activities: BackendActivityItem[];
  cursor: string | null;
  hasMore: boolean;
}

function toActivityItem(item: BackendActivityItem): ActivityItem {
  const nameParts = item.actorName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || (item.actorRole === 'SYSTEM' ? 'System' : 'Unknown');

  return {
    id: item.id,
    type: item.type,
    action: item.action,
    title: item.title,
    description: item.description,
    actor: {
      id: item.actorId || `system:${item.id}`,
      firstName,
      lastName: nameParts.join(' '),
      role: item.actorRole || 'SYSTEM',
    },
    unitNumber: item.unitNumber,
    targetId: item.targetId,
    metadata: item.metadata,
    createdAt: item.createdAt,
  };
}

export interface ActivityLogResponse {
  items: ActivityItem[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface GetActivityLogParams {
  type?: ActivityType;
  cursor?: string;
  limit?: number;
}

export const activityLogApi = {
  getActivityLog: async (params: GetActivityLogParams = {}): Promise<ActivityLogResponse> => {
    const { type, cursor, limit = 20 } = params;
    const queryParams: Record<string, string | number> = { limit };
    if (type) queryParams.type = type;
    if (cursor) queryParams.cursor = cursor;
    
    const response = (await api.get<BackendActivityLogResponse>('/activity-log', { params: queryParams })).data;
    return {
      items: response.activities.map(toActivityItem),
      nextCursor: response.cursor,
      hasMore: response.hasMore,
    };
  },
};
