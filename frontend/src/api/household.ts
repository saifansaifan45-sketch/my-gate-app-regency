import { api } from './client';

export interface HouseholdMemberRecord {
  id: string;
  name: string;
  personType?: string | null;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

export interface HouseholdVehicleRecord {
  id: string;
  registrationNumber: string;
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER' | 'OTHER' | string | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  parkingCode?: string | null;
  parkingSlot?: string | null;
  status?: 'ACTIVE' | 'PAUSED' | 'REVOKED' | string;
  notes?: string | null;
}

export interface HouseholdPetRecord {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  color?: string | null;
}

export interface HouseholdRecords {
  members: HouseholdMemberRecord[];
  vehicles: HouseholdVehicleRecord[];
  pets: HouseholdPetRecord[];
  canManageAssets: boolean;
}

export interface HouseholdActivity {
  id: string;
  kind: 'GUEST' | 'DELIVERY' | 'CAB' | 'SERVICE' | 'OTHER' | string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface HelpDeskContact {
  manager: { name: string; phoneNumber?: string | null } | null;
}

export interface PermanentPassRecord {
  id: string;
  name: string;
  phone?: string | null;
  vehicleNumber?: string | null;
  purpose?: string | null;
  householdMemberId?: string | null;
  status: string;
  validFrom: string;
  validUntil: string;
  lastUsedAt?: string | null;
  useCount: number;
  createdAt: string;
}

export const householdApi = {
  getRecords: async (): Promise<HouseholdRecords> => (await api.get('/household')).data,
  addMember: async (payload: Omit<HouseholdMemberRecord, 'id'>) => (await api.post('/household/members', payload)).data.member as HouseholdMemberRecord,
  addVehicle: async (payload: Omit<HouseholdVehicleRecord, 'id'>) => (await api.post('/household/vehicles', payload)).data.vehicle as HouseholdVehicleRecord,
  addPet: async (payload: Omit<HouseholdPetRecord, 'id'>) => (await api.post('/household/pets', payload)).data.pet as HouseholdPetRecord,
  removeMember: async (id: string) => api.delete(`/household/members/${id}`),
  removeVehicle: async (id: string) => api.delete(`/household/vehicles/${id}`),
  removePet: async (id: string) => api.delete(`/household/pets/${id}`),
  updateMemberStatus: async (id: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED') => (await api.patch(`/household/members/${id}/status`, { status })).data.member as HouseholdMemberRecord,
  getActivity: async (params?: { from?: string; to?: string }): Promise<{ activities: HouseholdActivity[] }> => (await api.get('/household/activity', { params })).data,
  getHelpDeskContact: async (): Promise<HelpDeskContact> => (await api.get('/household/help-desk')).data,

  // Permanent passes
  getPermanentPasses: async (): Promise<{ passes: PermanentPassRecord[]; canManage: boolean }> => (await api.get('/household/permanent-passes')).data,
  createPermanentPass: async (payload: { name: string; phone?: string; vehicleNumber?: string; purpose?: string; householdMemberId?: string }) => (await api.post('/household/permanent-passes', payload)).data.pass as PermanentPassRecord,
  renewPermanentPass: async (id: string) => (await api.post(`/household/permanent-passes/${id}/renew`)).data.pass as PermanentPassRecord,
  updatePermanentPassStatus: async (id: string, status: 'ACTIVE' | 'PAUSED' | 'EXPIRED') => (await api.patch(`/household/permanent-passes/${id}/status`, { status })).data.pass as PermanentPassRecord,
  deletePermanentPass: async (id: string) => api.delete(`/household/permanent-passes/${id}`),
};
