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
  otpFailedAttempts?: number;
  /** Indicates that this pass needs manual OTP verification; never contains the OTP itself. */
  requiresOtp?: boolean;
  isPreApproved: boolean;
  createdById: string;
  unitId?: string | null;
  communityId?: string | null;
  hostUserId?: string | null;
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
  handoffSuggestionType?: string | null;
  handoffSuggestionName?: string | null;

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
  hostUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
  } | null;
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

export interface CreateUnannouncedArrivalPayload extends CreateVisitorPayload {
  unitId?: string;
  hostUserId?: string;
}

export interface GateUnit {
  id: string;
  unitNumber: string;
  block?: string | null;
  floor?: string | null;
}

export interface GateHost {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
}

const ACTIVE_VISITOR_STATUSES: VisitorStatus[] = ['PENDING', 'APPROVED', 'CHECKED_IN'];

/** Keep dashboard metrics and the visitor list aligned on what is active today. */
export const isActiveVisitor = (visitor: VisitorItem) =>
  ACTIVE_VISITOR_STATUSES.includes(visitor.status);

export const isVisitorToday = (visitor: VisitorItem, now = new Date()) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
  const validFrom = new Date(visitor.validFrom || visitor.createdAt).getTime();
  const validUntil = visitor.validUntil ? new Date(visitor.validUntil).getTime() : endOfToday;

  return validFrom <= endOfToday && validUntil >= startOfToday;
};

export const isGuestVisitor = (visitor: VisitorItem) =>
  visitor.visitorType === 'GUEST';

export const requiresOtpCheck = (visitor: VisitorItem) =>
  visitor.visitorType === 'GUEST';

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
  /** Legacy queue consumers may still read the aggregate list; Gate Operations uses the grouped lists below. */
  visitors?: VisitorItem[];
  pending: VisitorItem[];
  approved: VisitorItem[];
  checkedIn: VisitorItem[];
}

export const visitorsApi = {
  createVisitor: async (payload: CreateVisitorPayload): Promise<{ visitor: VisitorItem }> => {
    const res = await api.post<{ visitor: VisitorItem }>('/visitors', payload);
    return res.data;
  },

  createManagerInvite: async (payload: CreateVisitorPayload): Promise<{ visitor: VisitorItem }> => {
    const res = await api.post<{ visitor: VisitorItem }>('/visitors/manager-invite', payload);
    return res.data;
  },

  recordUnannouncedArrival: async (payload: CreateUnannouncedArrivalPayload): Promise<{ success: boolean; deduped?: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; deduped?: boolean; visitor: VisitorItem }>('/visitors/unannounced', payload);
    return res.data;
  },

  getGateUnits: async (): Promise<{ units: GateUnit[] }> => {
    const res = await api.get<{ units: GateUnit[] }>('/community/units');
    return res.data;
  },

  getGateHosts: async (): Promise<{ hosts: GateHost[] }> => {
    const res = await api.get<{ hosts: GateHost[] }>('/visitors/gate-hosts');
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

  approveHostedArrival: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/host-approve`);
    return res.data;
  },

  rejectHostedArrival: async (id: string): Promise<{ success: boolean; visitor: VisitorItem }> => {
    const res = await api.post<{ success: boolean; visitor: VisitorItem }>(`/visitors/${id}/host-reject`);
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

  reconcileVisitors: async (communityId?: string): Promise<{ success: boolean; expired: number; autoCheckedOut: number }> => {
    const res = await api.post<{ success: boolean; expired: number; autoCheckedOut: number }>('/visitors/reconcile', { communityId });
    return res.data;
  },
};
