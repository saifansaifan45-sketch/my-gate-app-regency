import { api } from './client';

export interface LeadershipStats {
  activeManagers: number;
  activeWorkforce: number;
  pendingManagers: number;
  pendingWorkforce: number;
  totalPersonnel: number;
  activeTickets: number;
  workforceBreakdown: {
    security: number;
    maintenance: number;
    housekeeping: number;
    other: number;
  };
}

export interface RecentApprovalItem {
  id: string;
  role: string;
  userName: string;
  email: string;
  phone?: string;
  approvedAt: string;
}

export interface RecentAnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  authorName: string;
  createdAt: string;
}

export interface LeadershipOverviewResponse {
  stats: LeadershipStats;
  recentApprovals: RecentApprovalItem[];
  recentAnnouncements: RecentAnnouncementItem[];
}

export interface PendingManagerItem {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    createdAt: string;
  };
  community: {
    id: string;
    name: string;
  };
}

export const leadershipApi = {
  getOverview: async (): Promise<LeadershipOverviewResponse> => {
    const res = await api.get('/leadership/overview');
    return res.data;
  },

  getPendingManagers: async (): Promise<{ pendingManagers: PendingManagerItem[] }> => {
    const res = await api.get('/leadership/managers/pending');
    return res.data;
  },

  approveManager: async (membershipId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/leadership/managers/${membershipId}/approve`);
    return res.data;
  },

  rejectManager: async (membershipId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/leadership/managers/${membershipId}/reject`);
    return res.data;
  },
};
