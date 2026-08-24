import { api } from './client';

export type VisitorStatus = 'PENDING' | 'APPROVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'EXPIRED' | 'REJECTED' | 'REVOKED';
export type VisitorType = 'GUEST' | 'DELIVERY' | 'SERVICE' | 'CAB' | 'OTHER';

export interface VisitorItem {
  id: string;
  name: string;
  phone?: string | null;
  purpose?: string | null;
  vehicleNumber?: string | null;
  visitorType: VisitorType;
  status: VisitorStatus;
  otp?: string | null;
  isPreApproved: boolean;
  createdById: string;
  unitId?: string | null;
  communityId?: string | null;
  validFrom: string;
  validUntil?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  
  // New fields
  provider?: string | null;
  orderReference?: string | null;
  packageCount?: number | null;
  handoffRecipientType?: string | null;
  handoffRecipientName?: string | null;
  handoffTimestamp?: string | null;
  handoffActorId?: string | null;
  handoffProofReference?: string | null;

  createdAt: string;
  updatedAt: string;
  unit?: {
    id: string;
    unitNumber: string;
    block?: string;
    floor?: string;
  } | null;
  createdBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    unitNumber?: string | null;
  };
}

export interface CreateVisitorPayload {
  name: string;
  phone?: string;
  purpose?: string;
  vehicleNumber?: string;
  visitorType?: VisitorType;
  isPreApproved?: boolean;
  validFrom?: string;
  validUntil?: string;
  provider?: string;
  orderReference?: string;
  packageCount?: number;
}

export interface GateSummary {
  totalToday: number;
  pending: number;
  approved: number;
  checkedIn: number;
  checkedOut: number;
  expired: number;
}

export interface GateVisitorsResponse {
  summary: GateSummary;
  visitors: VisitorItem[];
  pending: VisitorItem[];
  approved: VisitorItem[];
  checkedIn: VisitorItem[];
}

export const visitorsApi = {
  createVisitor: async (payload: CreateVisitorPayload): Promise<{ visitor: VisitorItem }> => {
    const res = await api.post<{ visitor: VisitorItem }>('/visitors', payload);
    return res.data;
  },

  getMyVisitors: async (params?: { status?: VisitorStatus; type?: VisitorType }): Promise<{ visitors: VisitorItem[] }> => {
    const res = await api.get<{ visitors: VisitorItem[] }>('/visitors', { params });
    return res.data;
  },

  getGateHistory: async (): Promise<{ visitors: VisitorItem[] }> => {
    const res = await api.get<{ visitors: VisitorItem[] }>('/visitors/history');
    return res.data;
  },

  getVisitorAudit: async (id: string): Promise<{ visitor: VisitorItem, auditLogs: any[] }> => {
    const res = await api.get<{ visitor: VisitorItem, auditLogs: any[] }>(`/visitors/${id}/audit`);
    return res.data;
  },

  getGateVisitors: async (params?: { unitLabel?: string, communityId?: string }): Promise<GateVisitorsResponse> => {
    const res = await api.get<GateVisitorsResponse>('/visitors/gate', { params });
    return res.data;
  },

  approveVisitor: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/approve`);
    return res.data;
  },

  rejectVisitor: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/reject`);
    return res.data;
  },

  revokeVisitor: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/revoke`);
    return res.data;
  },

  checkInVisitor: async (id: string, otp?: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/check-in`, { otp });
    return res.data;
  },

  checkOutVisitor: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/check-out`);
    return res.data;
  },

  handoffDelivery: async (id: string, payload: { recipientType: string; recipientName?: string; proofReference?: string }): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/handoff`, payload);
    return res.data;
  },
};
