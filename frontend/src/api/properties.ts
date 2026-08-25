import { api } from './client';
import { UnitResidencyInfo, ResidencyType, ResidencyStatus } from './auth';

export interface PropertyUnit {
  id: string;
  communityId: string;
  unitNumber: string;
  floor?: string;
  block?: string;
}

export interface UnitWithOwnershipStatus {
  id: string;
  unitNumber: string;
  hasOwner: boolean;
}

export interface UnitResidencyRecord {
  id: string;
  userId: string;
  unitId: string;
  status: ResidencyStatus;
  relationshipType: ResidencyType;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
  };
  verifiedBy?: {
    id: string;
    firstName: string;
    lastName?: string;
  } | null;
}

export interface MyPropertiesResponse {
  ownedUnits: {
    ownershipId: string;
    status: string;
    unit: PropertyUnit;
    currentResidents: UnitResidencyRecord[];
  }[];
  residentUnits: {
    residencyId: string;
    status: ResidencyStatus;
    relationshipType: ResidencyType;
    unit: PropertyUnit;
    owners: {
      id: string;
      status: string;
      user: {
        id: string;
        firstName: string;
        lastName?: string;
        phoneNumber?: string;
        email: string;
      };
    }[];
  }[];
}

export const propertiesApi = {
  getUnits: async (): Promise<{ units: UnitWithOwnershipStatus[] }> => {
    const res = await api.get<{ units: UnitWithOwnershipStatus[] }>('/properties/units');
    return res.data;
  },

  hasManager: async (): Promise<{ hasManager: boolean }> => {
    const res = await api.get<{ hasManager: boolean }>('/properties/has-manager');
    return res.data;
  },

  getMyProperties: async (): Promise<MyPropertiesResponse> => {
    const res = await api.get<MyPropertiesResponse>('/properties/my-properties');
    return res.data;
  },

  requestResidency: async (unitId: string, relationshipType: 'TENANT' | 'FAMILY_MEMBER' = 'TENANT'): Promise<{ success: boolean; residency: UnitResidencyInfo; message: string }> => {
    const res = await api.post<{ success: boolean; residency: UnitResidencyInfo; message: string }>(`/properties/units/${unitId}/residency-request`, { relationshipType });
    return res.data;
  },

  getUnitResidencies: async (unitId: string): Promise<{ residencies: UnitResidencyRecord[] }> => {
    const res = await api.get<{ residencies: UnitResidencyRecord[] }>(`/properties/units/${unitId}/residencies`);
    return res.data;
  },

  approveResidency: async (unitId: string, residencyId: string): Promise<{ success: boolean; message: string; residency: UnitResidencyRecord }> => {
    const res = await api.post<{ success: boolean; message: string; residency: UnitResidencyRecord }>(`/properties/units/${unitId}/residencies/${residencyId}/approve`);
    return res.data;
  },

  rejectResidency: async (unitId: string, residencyId: string): Promise<{ success: boolean; message: string; residency: UnitResidencyRecord }> => {
    const res = await api.post<{ success: boolean; message: string; residency: UnitResidencyRecord }>(`/properties/units/${unitId}/residencies/${residencyId}/reject`);
    return res.data;
  },

  updateResidencyAccess: async (
    unitId: string,
    residencyId: string,
    action: 'pause' | 'resume' | 'revoke',
  ): Promise<{ success: boolean; message: string; residency: UnitResidencyRecord }> => {
    const res = await api.patch<{ success: boolean; message: string; residency: UnitResidencyRecord }>(
      `/properties/units/${unitId}/residencies/${residencyId}/access`,
      { action },
    );
    return res.data;
  },
};
