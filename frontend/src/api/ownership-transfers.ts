import { api } from './client';

export const ownershipTransfersApi = {
  list: () => api.get('/ownership-transfers').then((r) => r.data as { transfers: OwnershipTransfer[] }),
  propose: (unitId: string, toUserEmail: string, effectiveDate: string, documentReference?: string) => api.post('/ownership-transfers', { unitId, toUserEmail, effectiveDate, documentReference }).then((r) => r.data),
  accept: (id: string) => api.post(`/ownership-transfers/${id}/accept`, { accepted: true }).then((r) => r.data),
  complete: (id: string) => api.post(`/ownership-transfers/${id}/complete`).then((r) => r.data),
  cancel: (id: string) => api.post(`/ownership-transfers/${id}/cancel`).then((r) => r.data),
};

export interface OwnershipTransfer {
  id: string; unitId: string; fromOwnerId: string; toOwnerId: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  clauseText: string; proposedAt: string; acceptedAt?: string | null; completedAt?: string | null; effectiveAt: string; documentReference?: string | null;
  unit?: { unitNumber: string };
  fromOwner?: { email?: string | null; firstName?: string | null; lastName?: string | null };
  toOwner?: { email?: string | null; firstName?: string | null; lastName?: string | null };
}
