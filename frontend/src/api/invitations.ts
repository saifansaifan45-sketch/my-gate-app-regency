import { api } from './client';

export type InvitationRole = 'TENANT' | 'CO_OWNER' | 'FAMILY_MEMBER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface Invitation {
  id: string;
  email: string;
  name: string | null;
  role: InvitationRole;
  status: InvitationStatus;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  unit?: { unitNumber: string } | null;
  invitedBy?: { firstName: string | null; lastName: string | null } | null;
}

export interface CreateInvitationPayload {
  email: string;
  name?: string;
  role: InvitationRole;
  unitId?: string;
  message?: string;
}

export interface InvitationAcceptPayload {
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface InvitationPreview {
  email: string;
  name: string | null;
  role: InvitationRole;
  unitNumber: string;
  block: string | null;
  communityName: string;
  inviterName: string;
  message: string | null;
  expiresAt: string;
}

export const invitationsApi = {
  /** Create a new invitation (owner/co-owner only) */
  create: async (payload: CreateInvitationPayload): Promise<{ invitation: Invitation }> => {
    const res = await api.post<{ invitation: Invitation }>('/invitations', payload);
    return res.data;
  },

  /** List all invitations for the user's units */
  list: async (): Promise<{ invitations: Invitation[] }> => {
    const res = await api.get<{ invitations: Invitation[] }>('/invitations');
    return res.data;
  },

  /** Revoke a pending invitation */
  revoke: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post<{ success: boolean; message: string }>(`/invitations/${id}/revoke`);
    return res.data;
  },

  /** Get invitation details by token (for accept screen) */
  getByToken: async (token: string): Promise<{ invitation: InvitationPreview }> => {
    const res = await api.get<{ invitation: InvitationPreview }>(`/invitations/accept/${token}`);
    return res.data;
  },

  /** Accept invitation and create account */
  accept: async (token: string, payload: InvitationAcceptPayload): Promise<{
    success: boolean;
    message: string;
    user: { id: string; email: string; firstName: string | null; lastName: string | null };
    tokens: { accessToken: string; refreshToken: string };
  }> => {
    const res = await api.post(`/invitations/accept/${token}`, payload);
    return res.data;
  },
};
