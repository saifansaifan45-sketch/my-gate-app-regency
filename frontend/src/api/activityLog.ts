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
  title: string;
  description: string;
  actor: ActivityActor;
  unitNumber?: string | null;
  unitId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
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
    
    return (await api.get('/activity-log', { params: queryParams })).data;
  },
};