import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { activityLogApi, ActivityItem, ActivityType, ActivityLogResponse } from '../../src/api/activityLog';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Text } from '../../src/components/ui/Text';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

type FilterType = ActivityType | 'ALL';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'VISITOR', label: 'Visitors' },
  { id: 'GATE', label: 'Gate' },
  { id: 'DELIVERY', label: 'Deliveries' },
  { id: 'HOUSE_HELP', label: 'House Help' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
  { id: 'ANNOUNCEMENT', label: 'Announcements' },
  { id: 'SOS', label: 'SOS' },
  { id: 'ATTENDANCE', label: 'Attendance' },
];

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { icon: keyof typeof Feather.glyphMap; color: string; background: string }> = {
  VISITOR: { icon: 'user', color: '#143D2A', background: '#E8F5E9' },
  GATE: { icon: 'log-in', color: '#2563EB', background: '#EAF1FF' },
  DELIVERY: { icon: 'package', color: '#A16207', background: '#FFF3D6' },
  HOUSE_HELP: { icon: 'briefcase', color: '#7C3AED', background: '#F3E8FF' },
  MAINTENANCE: { icon: 'tool', color: '#DC2626', background: '#FEE2E2' },
  ANNOUNCEMENT: { icon: 'bell', color: '#4F46E5', background: '#EEF2FF' },
  SOS: { icon: 'alert-triangle', color: '#DC2626', background: '#FEE2E2' },
  ATTENDANCE: { icon: 'clock', color: '#0D9488', background: '#CCFBF1' },
  GENERAL: { icon: 'activity', color: '#6B7280', background: '#F3F4F6' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExactTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function getActorDisplayName(actor: ActivityItem['actor']): string {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function getRoleBadgeColor(role: string): string {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('manager') || roleLower.includes('leadership')) return '#143D2A';
  if (roleLower.includes('security') || roleLower.includes('guard')) return '#2563EB';
  if (roleLower.includes('maintenance') || roleLower.includes('technician')) return '#DC2626';
  if (roleLower.includes('house') || roleLower.includes('help')) return '#7C3AED';
  if (roleLower.includes('delivery')) return '#A16207';
  if (roleLower.includes('resident') || roleLower.includes('owner')) return '#0D9488';
  return '#6B7280';
}

const SKELETON_COUNT = 6;

export default function ActivityLogScreen() {
  const { top, bottomClearance } = useScreenInsets(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const scrollViewRef = useRef<ScrollView>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery<
    ActivityLogResponse,
    Error
  >({
    queryKey: ['activity-log', filter],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as string | undefined;
      return activityLogApi.getActivityLog({ type: filter === 'ALL' ? undefined : filter, cursor, limit: 20 });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000,
  });

  const activities = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoadingMore) {
      setIsLoadingMore(true);
      fetchNextPage().finally(() => setIsLoadingMore(false));
    }
  }, [hasNextPage, isFetchingNextPage, isLoadingMore, fetchNextPage]);

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
      const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
      if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 100) {
        loadMore();
      }
    },
    [loadMore]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderSkeleton = () => (
    <View style={{ gap: 12 }}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonIconBox} />
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonDetail} />
            <View style={styles.skeletonMeta} />
          </View>
          <View style={styles.skeletonTime} />
        </View>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyWrapper}>
      <EmptyState
        icon="activity"
        title="No activity found"
        description={
          filter === 'ALL'
            ? 'No activity has been recorded yet.'
            : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} activity found.`
        }
      />
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorWrapper}>
      <EmptyState
        icon="alert-triangle"
        title="Failed to load activity"
        description="Please check your connection and try again."
      />
      <PremiumPressable
        style={styles.retryButton}
        onPress={() => refetch()}
        accessibilityLabel="Retry loading activity"
      >
        <Text variant="label" style={styles.retryButtonText}>
          Try Again
        </Text>
      </PremiumPressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader variant="subscreen" title="Activity Log" />

      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetchingNextPage || isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[{ paddingBottom: bottomClearance + 16 }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <PremiumPressable
                key={item.id}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
                onPress={() => setFilter(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                  {item.label}
                </Text>
              </PremiumPressable>
            );
          })}
        </ScrollView>

        <View style={styles.listContent}>
          {isLoading ? (
            renderSkeleton()
          ) : isError ? (
            renderErrorState()
          ) : activities.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.list}>
              {activities.map((activity, index) => {
                const isLast = index === activities.length - 1;
                const config = ACTIVITY_TYPE_CONFIG[activity.type];
                const roleColor = getRoleBadgeColor(activity.actor.role);

                return (
                  <ScreenEntrance
                    key={activity.id}
                    delay={Math.min(60 + index * 30, 200)}
                    distance={8}
                  >
                    <View style={styles.cardWrapper} pointerEvents="box-none">
                      <View style={[styles.timelineWrapper]}>
                        {!isLast && (
                          <View style={styles.timelineLine} pointerEvents="none" />
                        )}
                        <View style={[styles.timelineDot, { backgroundColor: config.color }]} pointerEvents="none" />
                      </View>
                      <View style={[styles.card, { borderLeftColor: config.color }]}>
                        <View style={styles.cardHeader}>
                          <View style={[styles.iconBox, { backgroundColor: config.background }]}>
                            <Feather name={config.icon} size={18} color={config.color} />
                          </View>
                          <View style={styles.cardMain}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {activity.title}
                            </Text>
                            <Text style={styles.cardDescription} numberOfLines={2}>
                              {activity.description}
                            </Text>
                            <View style={styles.cardMeta}>
                              <View style={styles.actorRow}>
                                <Text style={styles.actorName} numberOfLines={1}>
                                  {getActorDisplayName(activity.actor)}
                                </Text>
                                <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
                                  <Text style={styles.roleBadgeText}>
                                    {activity.actor.role}
                                  </Text>
                                </View>
                              </View>
                              {activity.unitNumber && (
                                <View style={styles.unitRow}>
                                  <Feather name="home" size={12} color={theme.colors.textSecondary} />
                                  <Text style={styles.unitText}>Unit {activity.unitNumber}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        <View style={styles.cardFooter}>
                          <Text style={styles.timeRelative}>{formatRelativeTime(activity.createdAt)}</Text>
                          <Text style={styles.timeExact}>{formatExactTime(activity.createdAt)}</Text>
                        </View>
                      </View>
                    </View>
                  </ScreenEntrance>
                );
              })}
              {isFetchingNextPage && (
                <View style={styles.loadMoreIndicator}>
                  <Text style={styles.loadMoreText}>Loading more...</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  filterScroll: {
    marginTop: 8,
    marginBottom: 4,
  },
  filterRow: {
    paddingHorizontal: cardSystem.pagePadding,
    gap: 8,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#ECECE5',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 12,
  },
  list: {
    gap: 12,
  },
  cardWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineWrapper: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  timelineLine: {
    position: 'absolute',
    left: 9.5,
    top: 28,
    width: 1,
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
    marginTop: 18,
  },
  card: {
    flex: 1,
    minHeight: 84,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardMain: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textPrimary,
  },
  cardDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cardMeta: {
    marginTop: 8,
    gap: 4,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actorName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  roleBadge: {
    minHeight: 20,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unitText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  timeRelative: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: theme.colors.primary,
  },
  timeExact: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  emptyWrapper: {
    flex: 1,
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 40,
  },
  errorWrapper: {
    flex: 1,
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
  },
  retryButtonText: {
    color: '#FFFFFF',
  },
  loadMoreIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  skeletonCard: {
    minHeight: 84,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...theme.shadows.card,
  },
  skeletonIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
    gap: 6,
  },
  skeletonTitle: {
    height: 18,
    width: '60%',
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
  },
  skeletonDetail: {
    height: 16,
    width: '80%',
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
  },
  skeletonMeta: {
    height: 20,
    width: '50%',
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: 4,
  },
  skeletonTime: {
    width: 60,
    height: 14,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: 8,
  },
});
