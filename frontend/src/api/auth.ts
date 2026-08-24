import { api } from './client';

export type UserRole = 'LEADERSHIP' | 'MANAGER' | 'WORKFORCE' | 'RESIDENT' | 'OWNER' | 'TENANT' | string;

export type OwnershipStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
export type ResidencyStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED';
export type ResidencyType = 'OWNER' | 'TENANT' | 'FAMILY_MEMBER';
export type EmployeeRole =
  | 'MANAGER'
  | 'SECURITY'
  | 'HOUSEKEEPING'
  | 'HOUSE_HELP'
  | 'MAINTENANCE'
  | 'ELECTRICIAN'
  | 'PLUMBER'
  | 'GARDENER'
  | 'DRIVER'
  | 'OTHER';

export interface MembershipInfo {
  id?: string;
  communityId: string;
  unitId?: string;
  role: UserRole;
  status?: string;
}

export interface UnitOwnershipInfo {
  id: string;
  unitId: string;
  unitNumber?: string;
  status: OwnershipStatus;
}

export interface UnitResidencyInfo {
  id: string;
  unitId: string;
  unitNumber?: string;
  relationshipType: ResidencyType;
  status: ResidencyStatus;
  verifiedById?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  unitNumber?: string;
  role?: UserRole;
  roles?: string[];
  isOnboarded?: boolean;
  isPendingApproval?: boolean;
  memberships?: MembershipInfo[];
  ownerships?: UnitOwnershipInfo[];
  residencies?: UnitResidencyInfo[];
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
  roles?: string[];
  memberships?: MembershipInfo[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export interface OwnerOnboardingPayload {
  floor?: string;
  flatNumber: string;
  livesHere?: boolean;
}

export interface ResidentOnboardingPayload {
  floor?: string;
  flatNumber: string;
  relationshipType?: 'TENANT' | 'FAMILY_MEMBER';
}

export interface EmployeeOnboardingPayload {
  role: EmployeeRole;
  department?: string;
  experience?: string;
  notes?: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });
    return res.data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    });
    return res.data;
  },

  onboardOwner: async (payload: OwnerOnboardingPayload): Promise<{ success: boolean; message: string; user: UserProfile }> => {
    const res = await api.post<{ success: boolean; message: string; user: UserProfile }>('/auth/onboarding/owner', payload);
    return res.data;
  },

  onboardResident: async (payload: ResidentOnboardingPayload): Promise<{ success: boolean; message: string; user: UserProfile }> => {
    const res = await api.post<{ success: boolean; message: string; user: UserProfile }>('/auth/onboarding/resident', payload);
    return res.data;
  },

  onboardEmployee: async (payload: EmployeeOnboardingPayload): Promise<{ success: boolean; status: string; message: string; user: UserProfile }> => {
    const res = await api.post<{ success: boolean; status: string; message: string; user: UserProfile }>('/auth/onboarding/employee', payload);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string; user?: UserProfile }> => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user?: UserProfile }>('/auth/refresh', { refreshToken });
    return res.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout', { refreshToken });
  },

  getMe: async (): Promise<UserProfile> => {
    const res = await api.get<UserProfile>('/auth/me');
    return res.data;
  },

  switchRole: async (role: string): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await api.patch<{ success: boolean; user: UserProfile }>('/auth/role', { role });
    return res.data;
  },
};
