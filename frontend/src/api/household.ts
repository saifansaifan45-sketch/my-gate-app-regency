import { api } from './client';

export interface HouseholdMemberRecord {
  id: string;
  name: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

export interface HouseholdVehicleRecord {
  id: string;
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
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

export const householdApi = {
  getRecords: async (): Promise<HouseholdRecords> => (await api.get('/household')).data,
  addMember: async (payload: Omit<HouseholdMemberRecord, 'id'>) => (await api.post('/household/members', payload)).data.member as HouseholdMemberRecord,
  addVehicle: async (payload: Omit<HouseholdVehicleRecord, 'id'>) => (await api.post('/household/vehicles', payload)).data.vehicle as HouseholdVehicleRecord,
  addPet: async (payload: Omit<HouseholdPetRecord, 'id'>) => (await api.post('/household/pets', payload)).data.pet as HouseholdPetRecord,
  removeMember: async (id: string) => api.delete(`/household/members/${id}`),
  removeVehicle: async (id: string) => api.delete(`/household/vehicles/${id}`),
  removePet: async (id: string) => api.delete(`/household/pets/${id}`),
  getActivity: async (params?: { from?: string; to?: string }): Promise<{ activities: HouseholdActivity[] }> => (await api.get('/household/activity', { params })).data,
  getHelpDeskContact: async (): Promise<HelpDeskContact> => (await api.get('/household/help-desk')).data,
};
