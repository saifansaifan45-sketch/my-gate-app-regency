import { SERVICE_CATALOG } from '../../src/registry/services';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { QuickActionsEditorModal, QuickActionItem } from '../../src/components/quick-actions-editor-modal';
import { AddVisitorModal } from '../../src/components/add-visitor-modal';
import { EmergencySOSModal } from '../../src/components/emergency-sos-modal';
import { VisitorApproval } from '../../src/components/visitor-approval-card';
import { useSession } from '../../src/store/auth';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useToast } from '../../src/store/toast';
import { useResidenceAuth } from '../../src/hooks/useResidenceAuth';
import { ResidenceGuardBanner } from '../../src/components/ui/ResidenceGuardBanner';
import { visitorsApi } from '../../src/api/visitors';
import { communityApi } from '../../src/api/community';
import { TicketItem } from '../../src/api/manager';
import { getHomeDashboard, homeDashboardQueryKey } from '../../src/api/home-dashboard';
import { theme } from '../../src/theme';

// Modular Home Components
import {
  TimeBasedBackground,
  getTimePeriod,
  getHeroSurfaceColor,
  HeroHeader,
  PropertySelector,
  GlanceMetrics,
  GlanceCardItem,
  GateStatusCard,
  QuickActions,
  ActionItemConfig,
  MyRequests,
  CommunityUpdates,
} from '../../src/components/home';

const ACTIVE_TICKET_STATUSES = new Set<TicketItem['status']>([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED_BY_WORKER',
  'PENDING_RESIDENT_CONFIRMATION',
]);

export default function HomeScreen() {
  const router = useRouter();
  const { canPerformResidentAction, reasonMessage } = useResidenceAuth();
  const insets = useSafeAreaInsets();
  const { bottomClearance } = useScreenInsets(true);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const handleProtectedAction = (action: () => void) => {
    if (!canPerformResidentAction) {
      showToast({
        title: 'Residence Link Required',
        message: reasonMessage || 'Verify your account and link an active residence to continue.',
        type: 'error',
      });
      return;
    }
    action();
  };
  const {
    user,
     hasLeadershipAccess,
    hasManagerAccess,
    hasResidentAccess,
    hasOwnerAccess,
    primaryResidency,
    primaryOwnership,
  } = useSession();

  const isManager = hasManagerAccess();
  const isLeadership = hasLeadershipAccess();
  const isResident = hasResidentAccess();
  const isOwner = hasOwnerAccess();

  // Redirect pure operational accounts to their dedicated workspace
  useEffect(() => {
    if (isLeadership && !isResident && !isOwner) {
      router.replace('/(app)/leadership');
    } else if (isManager && !isResident && !isOwner) {
      router.replace('/(app)/manager');
    }
  }, [isLeadership, isManager, isResident, isOwner, router]);

  // Dynamic user data
  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
    : 'Resident';

  const unitNumber =
    primaryResidency?.unitNumber ||
    primaryOwnership?.unitNumber ||
    user?.unitNumber ||
    '';

  // The hero follows the device's local time and refreshes on each minute boundary.
  const [currentPeriod, setCurrentPeriod] = useState(getTimePeriod());
  const heroSurfaceColor = getHeroSurfaceColor(currentPeriod);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPeriod(getTimePeriod());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Modal states
  const [isQuickActionsVisible, setIsQuickActionsVisible] = useState(false);
  const [isAddVisitorVisible, setIsAddVisitorVisible] = useState(false);
  const [visitorPassConfig, setVisitorPassConfig] = useState<{ visitorType: 'GUEST' | 'SERVICE'; purpose: string; title: string; preApproved: boolean }>({ visitorType: 'GUEST', purpose: '', title: 'New Visitor Pass', preApproved: false });
  const [isEmergencySOSVisible, setIsEmergencySOSVisible] = useState(false);
  const [dismissedGateVisitorId, setDismissedGateVisitorId] = useState<string | null>(null);

  // Quick Action Preferences
  const [quickActionsList, setQuickActionsList] = useState<QuickActionItem[]>(
    SERVICE_CATALOG.filter((s: any) => s.availableRoles.includes(user?.role || '')).map(s => ({
      id: s.id,
      icon: s.icon as any,
      label: s.label,
      bgColor: s.isEmergency ? '#FEE2E2' : '#E8F5E9',
      iconColor: s.isEmergency ? '#DC2626' : '#166534',
      visible: true
    }))
  );

  const { data: homeData, isLoading: isHomeLoading, isFetching: isHomeFetching, refetch } = useQuery({
    queryKey: homeDashboardQueryKey,
    queryFn: () => getHomeDashboard(isManager || isLeadership),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const { data: announcementsData, isLoading: isAnnouncementsLoading, refetch: refetchAnnouncements } = useQuery({
    queryKey: ['community', 'announcements'],
    queryFn: () => communityApi.getAnnouncements(),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const announcements = announcementsData?.announcements || [];

  const activeTickets = (homeData?.tickets || []).filter(
    (ticket) => !ticket.deletedAt && ACTIVE_TICKET_STATUSES.has(ticket.status)
  );
  const gateVisitor: VisitorApproval | null = homeData?.pendingGateVisitor && homeData.pendingGateVisitor.id !== dismissedGateVisitorId
    ? {
        id: homeData.pendingGateVisitor.id,
        name: homeData.pendingGateVisitor.name,
        type: homeData.pendingGateVisitor.visitorType === 'DELIVERY' ? 'Delivery Agent' : 'Guest Visit',
        time: new Date(homeData.pendingGateVisitor.validFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        otp: homeData.pendingGateVisitor.otp || 'N/A',
      }
    : null;

  const onRefresh = async () => {
    await Promise.all([refetch(), refetchAnnouncements()]);
  };

  // Gate Approval Actions
  const handleGateApprove = async (id: string) => {
    try {
      await visitorsApi.approveVisitor(id);
      showToast({
        title: 'Gate Entry Approved',
        message: 'Security gate has verified visitor for entry.',
        type: 'success',
      });
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
    } catch {
      showToast({
        title: 'Action Failed',
        message: 'Could not approve visitor.',
        type: 'error',
      });
    }
  };

  const handleGateReject = async (id: string) => {
    try {
      await visitorsApi.rejectVisitor(id);
      showToast({
        title: 'Entry Declined',
        message: 'Visitor turned away at security gate.',
        type: 'info',
      });
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
    } catch {
      showToast({
        title: 'Action Failed',
        message: 'Could not reject visitor.',
        type: 'error',
      });
    }
  };

  // Metrics Data matching visual reference
  const metricsCards: GlanceCardItem[] = [
    {
      key: 'visitors',
      label: 'Visitors',
      count: homeData?.visitorCount === null || homeData?.visitorCount === undefined ? 'N/A' : String(homeData.visitorCount),
      subtitle: 'Today',
      icon: 'users',
      iconColor: '#166534',
      iconBgColor: '#DCFCE7',
      countColor: '#166534',
      onPress: () => router.push('/visitors'),
    },
    {
      key: 'deliveries',
      label: 'Deliveries',
      count: homeData?.deliveryCount === null || homeData?.deliveryCount === undefined ? 'N/A' : String(homeData.deliveryCount),
      subtitle: 'Today',
      icon: 'package',
      iconColor: '#D97706',
      iconBgColor: '#FEF3C7',
      countColor: '#D97706',
      onPress: () => router.push('/visitors'),
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      count: !homeData || homeData.requestsError ? 'N/A' : String(activeTickets.length),
      subtitle: activeTickets.some((ticket) => ticket.status === 'PENDING_RESIDENT_CONFIRMATION')
        ? 'Needs review'
        : activeTickets.some((ticket) => ticket.status === 'COMPLETED_BY_WORKER')
        ? 'Work completed'
        : activeTickets.some((ticket) => ticket.status === 'IN_PROGRESS')
        ? 'In progress'
        : activeTickets.some((ticket) => ticket.status === 'ASSIGNED')
        ? 'Assigned'
        : 'Open',
      icon: 'tool',
      iconColor: '#2563EB',
      iconBgColor: '#DBEAFE',
      countColor: '#2563EB',
      onPress: () => router.push('/services/maintenance'),
    },
  ];

  // Quick Action Buttons mapping
  const activeQuickActions: ActionItemConfig[] = quickActionsList
    .filter((a) => a.visible)
    .map((action) => ({
      id: action.id,
      label: action.label,
      icon: (action.icon === 'user' ? 'user-plus' : action.icon) as ActionItemConfig['icon'],
      iconColor: action.iconColor,
      iconBgColor: action.bgColor,
      onPress: () => {
        if (action.id === '1') {
          handleProtectedAction(() => {
            setVisitorPassConfig({ visitorType: 'GUEST', purpose: '', title: 'Pre-approve Visitor', preApproved: true });
            setIsAddVisitorVisible(true);
          });
        } else if (action.id === '2') {
          handleProtectedAction(() => router.push('/help-desk'));
        } else if (action.id === '3') {
          router.push('/announcements');
        } else if (action.id === '4') {
          handleProtectedAction(() => router.push('/family-members'));
        } else if (action.id === '5') {
          handleProtectedAction(() => {
            setVisitorPassConfig({ visitorType: 'SERVICE', purpose: 'House Help', title: 'House Help Entry Pass', preApproved: true });
            setIsAddVisitorVisible(true);
          });
        } else if (action.id === '6') {
          setIsEmergencySOSVisible(true);
        } else if (action.id === '7') {
          router.push('/activity-log');
        }
      },
    }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={isHomeFetching && !isHomeLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Dynamic Hero Header Section */}
        <View style={[styles.heroWrapper, { backgroundColor: heroSurfaceColor }]}>
          <TimeBasedBackground currentPeriod={currentPeriod} />

          <ScreenEntrance delay={50}>
            <HeroHeader
              displayName={displayName}
              period={currentPeriod}
              topInset={insets.top}
              onNotificationPress={() => router.push('/notifications')}
              onProfilePress={() => router.push('/profile')}
            />
          </ScreenEntrance>

          <ScreenEntrance delay={110} animation="fade">
            <PropertySelector
              unitNumber={unitNumber}
              onPress={() => router.push('/my-home')}
            />
          </ScreenEntrance>
        </View>

        {/* Body Sections */}
        <ScreenEntrance delay={125} distance={28} style={[styles.bodyWrapper, { paddingBottom: bottomClearance + 20 }]}>
          <ResidenceGuardBanner />

          {/* At a glance */}
          <ScreenEntrance animation="none">
            <GlanceMetrics
              cards={metricsCards}
              onViewAllPress={() => router.push('/visitors')}
            />
          </ScreenEntrance>

          {/* Gate Status Card */}
          <ScreenEntrance animation="none">
            <GateStatusCard
              pendingVisitor={gateVisitor}
              onApprove={handleGateApprove}
              onReject={handleGateReject}
              onDismiss={() => setDismissedGateVisitorId(gateVisitor?.id || null)}
              onViewActivityPress={() => router.push('/visitors')}
            />
          </ScreenEntrance>

          {/* Quick Actions */}
          <ScreenEntrance animation="none">
            <QuickActions
              actions={activeQuickActions}
              onEditPress={() => setIsQuickActionsVisible(true)}
            />
          </ScreenEntrance>

          {/* My Requests */}
          <ScreenEntrance animation="none">
            <MyRequests
              requests={activeTickets}
              loading={isHomeLoading}
              error={homeData?.requestsError ?? false}
              onPress={() => router.push('/services/maintenance')}
            />
          </ScreenEntrance>

          {/* Community Updates / Announcements */}
          <ScreenEntrance animation="none">
            <CommunityUpdates
              announcements={announcements}
              loading={isAnnouncementsLoading}
              onViewAllPress={() => router.push('/announcements')}
              onAnnouncementPress={() => router.push('/announcements')}
            />
          </ScreenEntrance>
        </ScreenEntrance>
      </ScrollView>

      {/* Quick Actions Editor Modal */}
      <QuickActionsEditorModal
        visible={isQuickActionsVisible}
        actions={quickActionsList}
        onClose={() => setIsQuickActionsVisible(false)}
        onSave={(updated) => {
          setQuickActionsList(updated);
          setIsQuickActionsVisible(false);
        }}
      />

      {/* Add Visitor Modal */}
      <AddVisitorModal
        visible={isAddVisitorVisible}
        onClose={() => setIsAddVisitorVisible(false)}
        initialVisitorType={visitorPassConfig.visitorType}
        initialPurpose={visitorPassConfig.purpose}
        initialPreApproved={visitorPassConfig.preApproved}
        title={visitorPassConfig.title}
        onSuccess={() => {
          setIsAddVisitorVisible(false);
        }}
      />
      <EmergencySOSModal visible={isEmergencySOSVisible} onClose={() => setIsEmergencySOSVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  heroWrapper: {
    position: 'relative',
    minHeight: 250,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  bodyWrapper: {
    marginTop: -30,
    paddingTop: 34,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 8,
  },
});
