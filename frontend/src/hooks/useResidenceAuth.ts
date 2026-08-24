import { useMemo } from 'react';
import { useSession } from '../store/auth';

export type AuthorizationState =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'UNVERIFIED'
  | 'NO_ACTIVE_RESIDENCE'
  | 'AUTHORIZED';

export interface ResidenceAuthStatus {
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  hasActiveResidence: boolean;
  canPerformResidentAction: boolean;
  authorizationState: AuthorizationState;
  reasonMessage: string | null;
}

export function useResidenceAuth(): ResidenceAuthStatus {
  const session = useSession();

  return useMemo(() => {
    const isLoading = session.isLoading;
    const isAuthenticated = session.isAuthenticated;
    const user = session.user;

    const isVerified = Boolean(user && user.isOnboarded === true && !user.isPendingApproval);
    const hasActiveResidence = Boolean(
      session.hasResidentAccess() || session.hasOwnerAccess() || session.hasManagerAccess()
    );

    const canPerformResidentAction = isAuthenticated && isVerified && hasActiveResidence;

    let authorizationState: AuthorizationState = 'AUTHORIZED';
    let reasonMessage: string | null = null;

    if (isLoading) {
      authorizationState = 'LOADING';
    } else if (!isAuthenticated) {
      authorizationState = 'UNAUTHENTICATED';
      reasonMessage = 'Sign in to access your residence account.';
    } else if (!isVerified) {
      authorizationState = 'UNVERIFIED';
      reasonMessage = 'Verify your account and link an active residence to continue.';
    } else if (!hasActiveResidence) {
      authorizationState = 'NO_ACTIVE_RESIDENCE';
      reasonMessage = 'Verify your account and link an active residence to continue.';
    }

    return {
      isLoading,
      isAuthenticated,
      isVerified,
      hasActiveResidence,
      canPerformResidentAction,
      authorizationState,
      reasonMessage,
    };
  }, [session]);
}
