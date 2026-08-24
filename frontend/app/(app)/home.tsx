import { SERVICE_CATALOG } from '../../src/registry/services';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { QuickActionsEditorModal, QuickActionItem } from '../../src/components/quick-actions-editor-modal';
import { AddVisitorModal } from '../../src/components/add-visitor-modal';
import { EmergencySOSModal } from '../../src/components/emergency-sos-modal';
import { VisitorApproval } from '../../src/components/visitor-approval-card';
import { Text } from '../../src/components/ui/Text';
import { useSession } from '../../src/store/auth';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { useToast } from '../../src/store/toast';
import { useResidenceAuth } from '../../src/hooks/useResidenceAuth';
import { ResidenceGuardBanner } from '../../src/components/ui/ResidenceGuardBanner';
import { visitorsApi } from '../../src/api/visitors';
import { communityApi } from '../../src/api/community';
import { propertiesApi } from '../../src/api/properties';
import { TicketItem } from '../../src/api/manager';
import { getHomeDashboard, homeDashboardQueryKey } from '../../src/api/home-dashboard';
import { theme } from '../../src/theme';
import { homeLayout } from '../../src/components/home/homeSurface';

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
  PendingResidencyRequest,
  ResidencyApprovalCard,
} from '../../src/components/home';

const ACTIVE_TICKET_STATUSES = new Set<TicketItem['status']>([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED_BY_WORKER',
  'PENDING_RESIDENT_CONFIRMATION',
]);

const DEFAULT_VISIBLE_QUICK_ACTIONS = ['add-visitor', 'help-desk', 'announcements', 'maintenance'];

const createQuickActions = (role?: string): QuickActionItem[] =>
  SERVICE_CATALOG
    .filter((service) => service.availableRoles.includes(role || ''))
    .map((service) => ({
      id: service.id,
      icon: service.icon as QuickActionItem['icon'],
      label: service.label,
      bgColor: service.isEmergency ? '#FEE2E2' : '#E8F5E9',
      iconColor: service.isEmergency ? '#DC2626' : '#166534',
      visible: DEFAULT_VISIBLE_QUICK_ACTIONS.includes(service.id),
    }));

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
    hasOwnership,
    primaryResidency,
    primaryOwnership,
  } = useSession();

  const isManager = hasManagerAccess();
  const isLeadership = hasLeadershipAccess();
  const isResident = hasResidentAccess();
  const isOwner = hasOwnerAccess();
  const ownsAUnit = hasOwnership();

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
  const [visitorPassConfig, setVisitorPassConfig] = useState<{ visitorType: 'GUEST' | 'SERVICE' | 'CAB' | 'DELIVERY'; purpose: string; title: string; preApproved: boolean }>({ visitorType: 'GUEST', purpose: '', title: 'New Visitor Pass', preApproved: false });
  const [isEmergencySOSVisible, setIsEmergencySOSVisible] = useState(false);
  const [dismissedGateVisitorId, setDismissedGateVisitorId] = useState<string | null>(null);

  // Quick Action Preferences are stored per user so a hard refresh does not reset them.
  const quickActionsStorageKey = user?.id ? `quick-actions:${user.id}` : null;
  const [quickActionsList, setQuickActionsList] = useState<QuickActionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const defaults = createQuickActions(user?.role);

    if (!quickActionsStorageKey) {
      setQuickActionsList(defaults);
      return () => { cancelled = true; };
    }

    setQuickActionsList(defaults);
    AsyncStorage.getItem(quickActionsStorageKey)
      .then((stored) => {
        if (cancelled || !stored) return;

        try {
          const saved = JSON.parse(stored) as QuickActionItem[];
          if (!Array.isArray(saved)) return;

          const currentById = new Map(defaults.map((action) => [action.id, action]));
          const restored = saved
            .filter((action) => currentById.has(action.id))
            .map((action) => ({ ...currentById.get(action.id)!, visible: Boolean(action.visible) }));
          const savedIds = new Set(restored.map((action) => action.id));
          const merged = [...restored, ...defaults.filter((action) => !savedIds.has(action.id))];

          if (!cancelled && merged.length > 0) setQuickActionsList(merged);
        } catch {
          // Ignore malformed local settings and keep the safe defaults.
        }
      })
      .catch(() => {
        // Storage can be unavailable in restricted environments; defaults remain usable.
      });

    return () => { cancelled = true; };
  }, [quickActionsStorageKey, user?.role]);

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

  const { data: residencyRequests = [], refetch: refetchResidencyRequests } = useQuery({
    queryKey: ['pending-residency-requests', user?.id, user?.ownerships],
    queryFn: async (): Promise<PendingResidencyRequest[]> => {
      const ownerships = user?.ownerships || [];
      const results = await Promise.all(
        ownerships.map(async (ownership) => {
          const { residencies } = await propertiesApi.getUnitResidencies(ownership.unitId);
          return residencies
            .filter((residency) => residency.status === 'PENDING')
            .map((residency) => ({
              unitId: ownership.unitId,
              unitNumber: ownership.unitNumber || 'your home',
              residency,
            }));
        })
      );
      return results.flat();
    },
    enabled: Boolean(user?.id && ownsAUnit),
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
    await Promise.all([refetch(), refetchAnnouncements(), refetchResidencyRequests()]);
  };

  const [residencyActionInProgress, setResidencyActionInProgress] = useState<string | null>(null);

  const handleResidencyDecision = async (request: PendingResidencyRequest, decision: 'approve' | 'reject') => {
    setResidencyActionInProgress(request.residency.id);
    const applicantName = `${request.residency.user.firstName} ${request.residency.user.lastName || ''}`.trim();
    try {
      if (decision === 'approve') {
        await propertiesApi.approveResidency(request.unitId, request.residency.id);
      } else {
        await propertiesApi.rejectResidency(request.unitId, request.residency.id);
      }
      showToast({
        title: decision === 'approve' ? 'Residency approved' : 'Residency declined',
        message: decision === 'approve'
          ? `${applicantName} can now access Unit ${request.unitNumber}.`
          : `${applicantName}'s request has been declined.`,
        type: decision === 'approve' ? 'success' : 'info',
      });
      await queryClient.invalidateQueries({ queryKey: ['pending-residency-requests'] });
    } catch (error: any) {
      showToast({
        title: 'Action failed',
        message: error?.response?.data?.error?.message || 'We could not update this residency request. Please try again.',
        type: 'error',
      });
    } finally {
      setResidencyActionInProgress(null);
    }
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
      countColor: '#166534',
      onPress: () => router.push('/visitors'),
    },
    {
      key: 'deliveries',
      label: 'Deliveries',
      count: homeData?.deliveryCount === null || homeData?.deliveryCount === undefined ? 'N/A' : String(homeData.deliveryCount),
      subtitle: 'Today',
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
        if (action.id === 'add-visitor') {
          handleProtectedAction(() => {
            setVisitorPassConfig({ visitorType: 'GUEST', purpose: '', title: 'Approve Entries', preApproved: true });
            setIsAddVisitorVisible(true);
          });
        } else if (action.id === 'help-desk') {
          handleProtectedAction(() => router.push('/help-desk'));
        } else if (action.id === 'announcements') {
          router.push('/announcements');
        } else if (action.id === 'family') {
          handleProtectedAction(() => router.push('/family-members'));
        } else if (action.id === 'house-help') {
          handleProtectedAction(() => router.push({ pathname: '/services/raise-issue', params: { category: 'Custom', description: 'I need house help' } }));
        } else if (action.id === 'cab-alert') {
          handleProtectedAction(() => {
            setVisitorPassConfig({ visitorType: 'CAB', purpose: '', title: 'Approve Entries', preApproved: true });
            setIsAddVisitorVisible(true);
          });
        } else if (action.id === 'delivery') {
          handleProtectedAction(() => {
            setVisitorPassConfig({ visitorType: 'DELIVERY', purpose: '', title: 'Approve Entries', preApproved: true });
            setIsAddVisitorVisible(true);
          });
        } else if (action.id === 'sos') {
          setIsEmergencySOSVisible(true);
        } else if (action.id === 'activity-log') {
          router.push('/activity-log');
        } else {
          const service = SERVICE_CATALOG.find((entry) => entry.id === action.id);
          if (service) router.push(service.route);
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

          {ownsAUnit && (
            <ScreenEntrance animation="none">
              <ResidencyApprovalCard
                requests={residencyRequests}
                actionInProgress={residencyActionInProgress}
                onApprove={(request) => void handleResidencyDecision(request, 'approve')}
                onReject={(request) => void handleResidencyDecision(request, 'reject')}
                onReviewAll={() => router.push('/residency-requests')}
              />
            </ScreenEntrance>
          )}

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
              onAnnouncementPress={(ann) => router.push(`/announcement/${ann.id}`)}
              onCreateNotice={isLeadership ? () => router.push('/leadership/create-announcement') : undefined}
            />
          </ScreenEntrance>

          {/* Leadership Governance */}
          {isLeadership && (
            <ScreenEntrance animation="none">
              <View style={styles.leadershipSection}>
                <Text style={styles.leadershipSectionTitle}>Leadership</Text>
                <PremiumPressable
                  style={styles.leadershipCard}
                  onPress={() => router.push('/leadership')}
                  scaleTo={0.97}
                >
                  <View style={styles.leadershipIconBox}>
                    <Feather name="shield" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.leadershipInfo}>
                    <Text style={styles.leadershipCardTitle}>Governance Dashboard</Text>
                    <Text style={styles.leadershipCardDesc}>Approvals, staff management & community oversight</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#6B7280" />
                </PremiumPressable>
              </View>
            </ScreenEntrance>
          )}
        </ScreenEntrance>
      </ScrollView>

      {/* Quick Actions Editor Modal */}
      <QuickActionsEditorModal
        visible={isQuickActionsVisible}
        actions={quickActionsList}
        onClose={() => setIsQuickActionsVisible(false)}
        onSave={async (updated) => {
          setQuickActionsList(updated);
          setIsQuickActionsVisible(false);
          if (quickActionsStorageKey) {
            try {
              await AsyncStorage.setItem(quickActionsStorageKey, JSON.stringify(updated));
            } catch {
              showToast({
                title: 'Settings not saved',
                message: 'Quick Actions could not be saved on this device.',
                type: 'error',
              });
            }
          }
        }}
      />

      {/* Add Visitor Modal */}
      <AddVisitorModal
        visible={isAddVisitorVisible}
        onClose={() => setIsAddVisitorVisible(false)}
        initialType={visitorPassConfig.visitorType}
        initialPurpose={visitorPassConfig.purpose}
        initialPreApproved={visitorPassConfig.preApproved}
        title={visitorPassConfig.title}
        onSuccess={() => {
          setIsAddVisitorVisible(false);
          queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
          queryClient.invalidateQueries({ queryKey: ['my-visitors'] });
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
  leadershipSection: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
  },
  leadershipSectionTitle: {
    ...homeLayout.sectionTitle,
    marginBottom: homeLayout.headingSpacing,
  },
  leadershipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.06)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  leadershipIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#143D2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadershipInfo: {
    flex: 1,
  },
  leadershipCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  leadershipCardDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
});
