import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '../src/store/auth';
import { theme } from '../src/theme';

export default function Index() {
  const {
    isLoading,
    isAuthenticated,
    isOnboarded,
    isPendingApproval,
    hasLeadershipAccess,
    hasManagerAccess,
    hasWorkforceAccess,
  } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 1. Not onboarded yet
  if (!isOnboarded() && !isPendingApproval()) {
    return <Redirect href="/(auth)/onboarding/relationship" />;
  }

  // 2. Pending Approval
  if (isPendingApproval()) {
    return <Redirect href="/(auth)/onboarding/relationship" />;
  }

  // 3. Operational Roles (Decoupled from resident experience)
  if (hasLeadershipAccess()) {
    return <Redirect href="/(app)/leadership" />;
  }

  if (hasManagerAccess()) {
    return <Redirect href="/(app)/manager" />;
  }

  if (hasWorkforceAccess()) {
    return <Redirect href="/(app)/work" />;
  }

  // 4. Resident / Owner experience
  return <Redirect href="/(app)/home" />;
}
