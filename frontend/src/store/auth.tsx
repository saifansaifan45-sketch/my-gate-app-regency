import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  authApi,
  LoginPayload,
  RegisterPayload,
  UserProfile,
  UnitOwnershipInfo,
  UnitResidencyInfo,
  OwnerOnboardingPayload,
  ResidentOnboardingPayload,
  EmployeeOnboardingPayload,
} from '../api/auth';
import { storage } from '../api/storage';
import { setAccessToken, setOnAuthFailure, setOnResidenceAuthFailure } from '../api/client';
import { useToast } from './toast';

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload, options?: { navigate?: boolean }) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  onboardOwner: (payload: OwnerOnboardingPayload) => Promise<void>;
  onboardResident: (payload: ResidentOnboardingPayload) => Promise<void>;
  onboardEmployee: (payload: EmployeeOnboardingPayload) => Promise<{ status: string }>;
  switchRole: (role: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Relationship & Capability Helpers
  hasApprovedMembership: (role: string) => boolean;
  hasLeadershipAccess: () => boolean;
  hasManagerAccess: () => boolean;
  hasWorkforceAccess: () => boolean;
  hasResidentAccess: () => boolean;
  hasOwnerAccess: () => boolean;
  isPendingApproval: () => boolean;
  isEmployee: () => boolean;
  isOnboarded: () => boolean;
  hasActiveResidency: (unitId?: string) => boolean;
  hasOwnership: (unitId?: string) => boolean;
  ownsUnit: (unitId: string) => boolean;
  hasRole: (role: string) => boolean;
  primaryResidency: UnitResidencyInfo | null;
  primaryOwnership: UnitOwnershipInfo | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = !!user && !!accessToken;

  const updateTokensAndUser = useCallback((newAccessToken: string, newRefreshToken: string, newUser: UserProfile) => {
    setAccessToken(newAccessToken);
    setAccessTokenState(newAccessToken);
    setUser(newUser);
    storage.saveRefreshToken(newRefreshToken);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const storedRefreshToken = await storage.getRefreshToken();
      if (storedRefreshToken) {
        await authApi.logout(storedRefreshToken).catch(() => {});
      }
    } catch {
      // Ignore logout backend errors on client teardown
    } finally {
      setAccessToken(null);
      setAccessTokenState(null);
      setUser(null);
      await storage.removeRefreshToken();
      router.replace('/(auth)/login');
    }
  }, [router]);

  const { showToast } = useToast();

  // Register auth failure handlers from axios client
  useEffect(() => {
    setOnAuthFailure(() => {
      setAccessToken(null);
      setAccessTokenState(null);
      setUser(null);
      router.replace('/(auth)/login');
    });

    setOnResidenceAuthFailure((message) => {
      showToast({
        title: 'Residence Access Required',
        message: message || 'Verify your account and link an active residence to continue.',
        type: 'error',
      });
    });
  }, [router, showToast]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('Profile refresh failed:', err);
    }
  }, []);

  // Initial session hydration on app launch
  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const storedRefreshToken = await storage.getRefreshToken();
        if (!storedRefreshToken) {
          if (isMounted) setIsLoading(false);
          return;
        }

        // Refresh access token
        const tokens = await authApi.refresh(storedRefreshToken);
        setAccessToken(tokens.accessToken);
        if (tokens.refreshToken) {
          await storage.saveRefreshToken(tokens.refreshToken);
        }

        // Fetch current user profile with memberships, ownerships, residencies
        const profile = await authApi.getMe();

        if (isMounted) {
          setAccessTokenState(tokens.accessToken);
          setUser(profile);
        }
      } catch (err) {
        console.warn('Session hydration failed:', err);
        await storage.removeRefreshToken();
        setAccessToken(null);
        if (isMounted) {
          setAccessTokenState(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload: LoginPayload, options?: { navigate?: boolean }) => {
    const data = await authApi.login(payload);
    updateTokensAndUser(data.accessToken, data.refreshToken, data.user);
    if (options?.navigate !== false) {
      if (data.user.isOnboarded === false && !data.user.isPendingApproval) {
        router.replace('/(auth)/onboarding/relationship');
      } else {
        router.replace('/(app)/home');
      }
    }
  };

  const register = async (payload: RegisterPayload) => {
    const data = await authApi.register(payload);
    updateTokensAndUser(data.accessToken, data.refreshToken, data.user);
    router.replace('/(auth)/onboarding/relationship');
  };

  const onboardOwner = async (payload: OwnerOnboardingPayload) => {
    const res = await authApi.onboardOwner(payload);
    setUser(res.user);
    router.replace('/(app)/home');
  };

  const onboardResident = async (payload: ResidentOnboardingPayload) => {
    const res = await authApi.onboardResident(payload);
    setUser(res.user);
    router.replace('/(app)/home');
  };

  const onboardEmployee = async (payload: EmployeeOnboardingPayload) => {
    const res = await authApi.onboardEmployee(payload);
    setUser(res.user);
    return { status: res.status };
  };

  const switchRole = async (role: string) => {
    const res = await authApi.switchRole(role);
    setUser(res.user);
  };

  // Capability Helpers — Derived strictly from database relationships
  const hasApprovedMembership = useCallback(
    (role: string): boolean => {
      if (!user?.memberships) return false;
      return user.memberships.some((m) => m.role === role && m.status === 'APPROVED');
    },
    [user]
  );

  const hasResidentAccess = useCallback((): boolean => {
    if (!user?.residencies) return false;
    return user.residencies.some((r) => r.status === 'ACTIVE');
  }, [user]);

  const hasOwnerAccess = useCallback((): boolean => {
    if (!user?.ownerships) return false;
    return user.ownerships.some((o) => o.status === 'ACTIVE');
  }, [user]);

  const hasLeadershipAccess = useCallback((): boolean => {
    if (!user) return false;
    const hasLeadershipMembership = hasApprovedMembership('LEADERSHIP');
    const isLeadershipRole =
      user.role === 'LEADERSHIP' ||
      (Array.isArray(user.roles) && user.roles.includes('LEADERSHIP'));
    return hasLeadershipMembership || isLeadershipRole;
  }, [user, hasApprovedMembership]);

  const hasManagerAccess = useCallback((): boolean => {
    if (!user) return false;
    return (
      hasApprovedMembership('MANAGER') ||
      user.role === 'MANAGER' ||
      (Array.isArray(user.roles) && user.roles.includes('MANAGER'))
    );
  }, [user, hasApprovedMembership]);

  const hasWorkforceAccess = useCallback((): boolean => {
    if (!user) return false;
    return (
      hasApprovedMembership('WORKFORCE') ||
      hasApprovedMembership('MANAGER') ||
      hasApprovedMembership('LEADERSHIP') ||
      user.role === 'WORKFORCE' ||
      user.role === 'MANAGER' ||
      user.role === 'LEADERSHIP' ||
      (Array.isArray(user.roles) &&
        (user.roles.includes('WORKFORCE') ||
          user.roles.includes('MANAGER') ||
          user.roles.includes('LEADERSHIP')))
    );
  }, [user, hasApprovedMembership]);

  const isPendingApproval = useCallback((): boolean => {
    if (!user) return false;
    if (user.isPendingApproval) return true;
    return user.memberships?.some((m) => m.status === 'PENDING') ?? false;
  }, [user]);

  const isEmployee = useCallback((): boolean => {
    if (!user?.memberships) return false;
    return user.memberships.some((m) => (m.role === 'MANAGER' || m.role === 'WORKFORCE') && m.status === 'APPROVED');
  }, [user]);

  const isOnboarded = useCallback((): boolean => {
    return user?.isOnboarded === true;
  }, [user]);

  const hasActiveResidency = useCallback(
    (unitId?: string): boolean => {
      if (!user?.residencies) return false;
      return user.residencies.some(
        (r) => r.status === 'ACTIVE' && (!unitId || r.unitId === unitId || r.unitNumber === unitId)
      );
    },
    [user]
  );

  const hasOwnership = useCallback(
    (unitId?: string): boolean => {
      if (!user?.ownerships) return false;
      return user.ownerships.some(
        (o) => o.status === 'ACTIVE' && (!unitId || o.unitId === unitId || o.unitNumber === unitId)
      );
    },
    [user]
  );

  const ownsUnit = useCallback(
    (unitId: string): boolean => {
      return hasOwnership(unitId);
    },
    [hasOwnership]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user?.memberships) return false;
      return user.memberships.some((m) => m.role === role && m.status === 'APPROVED');
    },
    [user]
  );

  const primaryResidency = useMemo(() => {
    if (!user?.residencies || user.residencies.length === 0) return null;
    return user.residencies.find((r) => r.status === 'ACTIVE') || user.residencies[0] || null;
  }, [user]);

  const primaryOwnership = useMemo(() => {
    if (!user?.ownerships || user.ownerships.length === 0) return null;
    return user.ownerships.find((o) => o.status === 'ACTIVE') || user.ownerships[0] || null;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated,
        login,
        register,
        onboardOwner,
        onboardResident,
        onboardEmployee,
        switchRole,
        logout: handleLogout,
        refreshProfile,
        hasApprovedMembership,
        hasLeadershipAccess,
        hasManagerAccess,
        hasWorkforceAccess,
        hasResidentAccess,
        hasOwnerAccess,
        isPendingApproval,
        isEmployee,
        isOnboarded,
        hasActiveResidency,
        hasOwnership,
        ownsUnit,
        hasRole,
        primaryResidency,
        primaryOwnership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within an AuthProvider');
  }
  return context;
}
