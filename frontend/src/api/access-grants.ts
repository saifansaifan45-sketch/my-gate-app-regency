import { api } from './client';

export type AccessType = 'MASTER_ACCESS' | 'DELEGATE';
export interface AccessGrant {
  id: string;
  userId: string;
  unitId: string;
  accessType: AccessType;
  permissions: Record<string, boolean> | null;
  status: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
}

export const accessGrantsApi = {
  list: async (unitId?: string): Promise<{ grants: AccessGrant[]; canManage: boolean }> =>
    (await api.get('/access-grants', { params: unitId ? { unitId } : undefined })).data,
  grant: async (payload: { email: string; unitId?: string; accessType: AccessType }) =>
    (await api.post<{ grant: AccessGrant }>('/access-grants', payload)).data.grant,
  revoke: async (id: string) =>
    (await api.post<{ success: boolean; grant: AccessGrant }>(`/access-grants/${id}/revoke`)).data,
};
