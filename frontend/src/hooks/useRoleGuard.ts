import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useSession } from '../store/auth';

export function useRoleGuard() {
  const router = useRouter();
  const segments = useSegments();
  const {
    hasManagerAccess,
    hasResidentAccess,
    hasOwnerAccess,
    hasApprovedMembership,
  } = useSession();

  useEffect(() => {
    if (segments[0] !== '(app)') return;

    const route = segments.join('/');

    // Profile is a shared account screen every role can open.
    const isSharedProfileRoute = route === '(app)/profile';
    const isManagerRoute = route.includes('/manager');
    const isLeadershipRoute = route.includes('/leadership');
    const isWorkforceRoute = route.includes('/work');
    const isResidentRoute = !isSharedProfileRoute && !isManagerRoute && !isLeadershipRoute && !isWorkforceRoute;

    // Specifically Resident-Only Routes
    const isResidentOnlyRoute = route.includes('/services/maintenance') || route.includes('/services/raise-issue') || route.includes('/my-home');

    const isLeadershipMember = hasApprovedMembership('LEADERSHIP');
    const isManagerMember = hasManagerAccess();
    const isPureOps = (isManagerMember || isLeadershipMember) && !hasResidentAccess() && !hasOwnerAccess();
    const isResidentOrOwner = (hasResidentAccess() || hasOwnerAccess()) && !isManagerMember && !isLeadershipMember;
    const isPureWorkforce = hasApprovedMembership('WORKFORCE') && !isManagerMember && !isLeadershipMember;
    
    // Q1: Can manager accidentally access resident routes?
    if (isPureOps && (isResidentRoute || isWorkforceRoute)) {
      if (isLeadershipMember) {
        router.replace('/(app)/leadership');
      } else {
        router.replace('/(app)/manager');
      }
      return;
    }

    // Q2: Can resident access manager routes?
    if (isResidentOrOwner && (isManagerRoute || isLeadershipRoute || isWorkforceRoute)) {
      router.replace('/(app)/home');
      return;
    }
    
    // Q3: Can workforce access resident or manager routes?
    if (isPureWorkforce && !isWorkforceRoute) {
      router.replace('/(app)/work');
      return;
    }
    
    // Q4: Can non-workforce access workforce routes?
    if (isWorkforceRoute && !hasApprovedMembership('WORKFORCE')) {
      router.replace('/(app)/home');
      return;
    }
    
    // Q5: Restrict resident-only features (maintenance, raise-issue, my-home) to residents & owners
    if (isResidentOnlyRoute && !hasResidentAccess() && !hasOwnerAccess()) {
       router.replace('/(app)/home');
       return;
    }

    // Enforce strict access to Manager/Leadership routes
    if (isManagerRoute && !isManagerMember && !isLeadershipMember) {
        router.replace('/(app)/home');
        return;
    }
    if (isLeadershipRoute && !isLeadershipMember) {
        router.replace('/(app)/home');
        return;
    }

  }, [segments, hasManagerAccess, hasResidentAccess, hasOwnerAccess, hasApprovedMembership, router]);
}
