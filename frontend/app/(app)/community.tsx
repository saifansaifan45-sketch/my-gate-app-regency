import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Animated, Easing, useWindowDimensions, Alert, FlatList, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { CommunityCreateMenu } from '../../src/components/community/CommunityCreateMenu';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Card } from '../../src/components/ui/Card';
import { communityApi, CommunityAnnouncement, CommunityPoll, AnnouncementCategory, CreatePollPayload, CreateAnnouncementPayload } from '../../src/api/community';
import { useSession } from '../../src/store/auth';
import { theme } from '../../src/theme';

const TAB_PADDING = 20;
const TAB_GAP = 8;

export default function CommunityScreen() {
  const { bottomClearance } = useScreenInsets(true);
  const { width: screenWidth } = useWindowDimensions();
  const TAB_WIDTH = (screenWidth - TAB_PADDING * 2 - TAB_GAP) / 2;
  const { hasManagerAccess, hasApprovedMembership, hasOwnerAccess, hasResidentAccess, primaryResidency, primaryOwnership } = useSession();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'announcements' | 'polls'>('announcements');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory | undefined>();
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const spacesQuery = useQuery({ queryKey: ['community', 'spaces'], queryFn: communityApi.getSpaces });
  const announcementsQuery = useQuery({ queryKey: ['community', 'announcements', category], queryFn: () => communityApi.getAnnouncements(undefined, category) });
  const pollsQuery = useQuery({ queryKey: ['community', 'polls'], queryFn: () => communityApi.getPolls() });
  const defaultSpaceId = useMemo(() => {
    const spaces = spacesQuery.data?.spaces ?? [];
    const residentSpace = spaces.find((s) => s.type === 'RESIDENT_COMMUNITY');
    return residentSpace?.id || spaces[0]?.id;
  }, [spacesQuery.data?.spaces]);
  const isManagement = hasManagerAccess() || hasApprovedMembership('LEADERSHIP');
  const householdUnitId = primaryResidency?.unitId || primaryOwnership?.unitId;
  const canCreateHouseholdPoll = (hasOwnerAccess() || hasResidentAccess()) && Boolean(householdUnitId);
  const canCreateContent = isManagement || canCreateHouseholdPoll;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const switchTab = useCallback((tab: 'announcements' | 'polls') => {
    if (tab === activeTab) return;
    const toValue = tab === 'polls' ? 1 : 0;
    setIsTransitioning(true);

    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: Platform.OS !== 'web',
      damping: 18,
      stiffness: 200,
    }).start();

    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }, [activeTab, slideAnim, contentOpacity]);

  const changeCategory = useCallback((item: AnnouncementCategory | undefined) => {
    if (category === item) return;
    Animated.timing(contentOpacity, {
      toValue: 0.4,
      duration: 100,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCategory(item);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }, [category, contentOpacity]);

  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_PADDING, TAB_PADDING + TAB_WIDTH + TAB_GAP],
  });

  const refreshCommunity = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['community', 'announcements'] }),
    queryClient.invalidateQueries({ queryKey: ['community', 'polls'] }),
  ]);

  const createPoll = async (payload: CreatePollPayload) => {
    if (!defaultSpaceId) throw new Error('No community space is available.');
    await communityApi.createPoll(defaultSpaceId, payload);
    await refreshCommunity();
  };
  const createAnnouncement = async (payload: CreateAnnouncementPayload) => {
    await communityApi.createAnnouncement(payload);
    await refreshCommunity();
  };

  const uniqueAnnouncements = useMemo(() => {
    const announcements = announcementsQuery.data?.announcements ?? [];
    const seen = new Set<string>();
    return announcements.filter((a) => {
      const key = a.id || `${a.title}_${a.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [announcementsQuery.data?.announcements]);

  const polls = useMemo(() => pollsQuery.data?.polls ?? [], [pollsQuery.data?.polls]);

  const renderAnnouncement = useCallback(({ item: announcement }: { item: CommunityAnnouncement }) => (
    <AnnouncementCard
      announcement={announcement}
      onRead={async () => {
        if (!announcement.isRead) {
          await communityApi.markAnnouncementRead(announcement.id);
          await refreshCommunity();
        }
      }}
    />
  ), []);

  const renderPoll = useCallback(({ item: poll }: { item: CommunityPoll }) => (
    <PollCard
      poll={poll}
      isManagement={isManagement}
      onVote={async (optionId) => { await communityApi.vote(poll.id, optionId); await refreshCommunity(); }}
      onDelete={isManagement ? async () => { await communityApi.deletePoll(poll.id); await refreshCommunity(); } : undefined}
    />
  ), [isManagement]);

  const renderSkeletons = () => (
    <View style={{ gap: 14 }}>
      {[1, 2, 3].map((key) => (
        <View key={key} style={styles.skeletonCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Skeleton width={80} height={20} borderRadius={100} />
            <Skeleton width={60} height={14} borderRadius={6} />
          </View>
          <Skeleton width="80%" height={18} borderRadius={8} style={{ marginBottom: 8 }} />
          <Skeleton width="100%" height={14} borderRadius={6} style={{ marginBottom: 4 }} />
          <Skeleton width="60%" height={14} borderRadius={6} />
        </View>
      ))}
    </View>
  );

  const listHeader = activeTab === 'announcements' ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {([undefined, 'GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT', 'EMERGENCY'] as const).map((item) => (
        <PremiumPressable 
          key={item ?? 'ALL'} 
          style={[styles.filterChip, category === item && styles.filterChipActive]} 
          onPress={() => changeCategory(item)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.filterText, category === item && styles.filterTextActive]}>
            {item ? item.charAt(0) + item.slice(1).toLowerCase() : 'All'}
          </Text>
        </PremiumPressable>
      ))}
    </ScrollView>
  ) : null;

  return (      <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Community"
        rightAction={canCreateContent ? (
          <PremiumPressable style={styles.createBtn} onPress={() => setIsCreateMenuVisible(true)} activeOpacity={0.9}>
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create</Text>
          </PremiumPressable>
        ) : undefined}
      />

      <View style={styles.tabsWrapper}>
        <View style={styles.tabs}>
          <PremiumPressable
            style={[styles.tab, { width: TAB_WIDTH }]}
            onPress={() => switchTab('announcements')}
          >
            <Text style={[styles.tabText, activeTab === 'announcements' && styles.tabTextActive]}>
              Announcements
            </Text>
          </PremiumPressable>
          <PremiumPressable
            style={[styles.tab, { width: TAB_WIDTH }]}
            onPress={() => switchTab('polls')}
          >
            <Text style={[styles.tabText, activeTab === 'polls' && styles.tabTextActive]}>
              Polls
            </Text>
          </PremiumPressable>
        </View>
        <Animated.View style={[styles.tabIndicator, { width: TAB_WIDTH, transform: [{ translateX: indicatorTranslateX }] }]} />
      </View>

      <Animated.View style={[styles.feedOuter, { opacity: contentOpacity }]}>
        {!isTransitioning && activeTab === 'announcements' ? (
          announcementsQuery.isLoading ? (
            <View style={[styles.feed, { paddingBottom: bottomClearance }]}>{listHeader}{renderSkeletons()}</View>
          ) : uniqueAnnouncements.length === 0 ? (
            <View style={[styles.feed, { paddingBottom: bottomClearance }]}>
              {listHeader}
              <EmptyState icon="bell" title="No community updates yet" description="Published notices from your community will appear here." />
            </View>
          ) : (
            <FlatList
              data={uniqueAnnouncements}
              keyExtractor={(item) => item.id}
              renderItem={renderAnnouncement}
              contentContainerStyle={[styles.feed, { paddingBottom: bottomClearance }]}
              ListHeaderComponent={listHeader ?? undefined}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
            />
          )
        ) : !isTransitioning && activeTab === 'polls' ? (
          pollsQuery.isLoading ? (
            <View style={[styles.feed, { paddingBottom: bottomClearance }]}>{renderSkeletons()}</View>
          ) : polls.length === 0 ? (
            <View style={[styles.feed, { paddingBottom: bottomClearance }]}>
              <EmptyState icon="pie-chart" title="No active polls" description="Community polls will appear here when management opens one." />
            </View>
          ) : (
            <FlatList
              data={polls}
              keyExtractor={(item) => item.id}
              renderItem={renderPoll}
              contentContainerStyle={[styles.feed, { paddingBottom: bottomClearance }]}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
            />
          )
        ) : null}
      </Animated.View>

      {canCreateContent ? (
        <CommunityCreateMenu
          visible={isCreateMenuVisible}
          onClose={() => setIsCreateMenuVisible(false)}
          onCreatePoll={createPoll}
          onCreateAnnouncement={createAnnouncement}
          canChoosePollAudience={isManagement}
          canChooseAnnouncementAudience={isManagement}
          householdUnitId={householdUnitId}
          canCreateAnnouncement={isManagement}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: TAB_PADDING,
    gap: TAB_GAP,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabIndicator: {
    height: 2.5,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  tabTextActive: { color: theme.colors.primary },
  feedOuter: {
    flex: 1,
  },
  feed: { padding: 20, gap: 16 },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.05)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  loading: { fontFamily: 'PlusJakartaSans_500Medium', color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 36 },
  updateCard: {
    width: '100%',
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
  updateTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 97 },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.2, textTransform: 'uppercase' },
  time: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#9CA3AF' },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20, color: theme.colors.textPrimary, marginBottom: 6, flexShrink: 1 },
  cardBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary, flexShrink: 1 },
  readMore: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.primary, marginTop: 6 },
  pollAuthor: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -1, marginBottom: 12 },
  pollAuthorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: theme.colors.textSecondary },
  pollAudience: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#3159A5', marginBottom: 10 },
  pollOptions: { gap: 10 },
  pollOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pollOptionSelected: { borderColor: theme.colors.primary, backgroundColor: '#EEF8F1' },
  pollOptionText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textPrimary },
  pollCount: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  pollTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn: { padding: 6, borderRadius: 100, backgroundColor: '#FDEBEC' },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 97, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterChipActive: { backgroundColor: '#EEF8F1', borderColor: theme.colors.primary },
  filterText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  filterTextActive: { color: theme.colors.primary },
});

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function AnnouncementCard({ announcement, onRead }: { announcement: CommunityAnnouncement; onRead: () => Promise<void> }) {
  const colors = announcement.priority === 'URGENT' ? { bg: '#FDEBEC', text: '#B42318' } : announcement.priority === 'IMPORTANT' ? { bg: '#FEF3D6', text: '#A46100' } : { bg: '#EAF6EE', text: '#1F7A45' };
  const router = useRouter();
  const open = async () => {
    if (!announcement.isRead) {
      await onRead();
    }
    router.push(`/announcement/${announcement.id}`);
  };
  return (
    <PremiumPressable onPress={open}>
      <Card style={styles.updateCard}>
        <View style={styles.updateTop}>
          <View style={[styles.badge, { backgroundColor: colors.bg, flexShrink: 1 }]}>
            <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>{announcement.category}</Text>
          </View>
          <Text style={[styles.time, { flexShrink: 0, marginLeft: 8 }]}>{announcement.isRead ? relativeTime(announcement.createdAt) : 'New · ' + relativeTime(announcement.createdAt)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{announcement.title}</Text>
        <Text style={styles.cardBody} numberOfLines={3}>{announcement.content}</Text>
        {announcement.content.length > 140 ? <Text style={styles.readMore}>Tap to read more</Text> : null}
      </Card>
    </PremiumPressable>
  );
}

function PollCard({ poll, onVote, onDelete, isManagement }: { poll: CommunityPoll; onVote: (optionId: string) => Promise<void>; onDelete?: () => Promise<void>; isManagement?: boolean }) {
  const [voting, setVoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expired = poll.status !== 'ACTIVE' || (!!poll.expiresAt && new Date(poll.expiresAt) <= new Date());
  const vote = async (optionId: string) => { if (voting || poll.userHasVoted || expired) return; setVoting(true); try { await onVote(optionId); } finally { setVoting(false); } };
  const handleDelete = () => { if (deleting || !onDelete) return; Alert.alert('Delete Poll', 'Are you sure you want to delete this poll?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { setDeleting(true); try { await onDelete(); } finally { setDeleting(false); } } }]); };
  const authorName = `${poll.author?.firstName || ''} ${poll.author?.lastName || ''}`.trim() || 'Community member';
  const authorRole = poll.author?.role ? poll.author.role.charAt(0) + poll.author.role.slice(1).toLowerCase() : 'Member';
  const audienceLabel = (poll.audiences?.length ? poll.audiences : [poll.audience]).map((audience) => audience === 'HOUSEHOLD' ? 'Your residence' : audience.charAt(0) + audience.slice(1).toLowerCase()).join(', ');
  
  return (
    <Card style={styles.updateCard}>
      <View style={styles.updateTop}>
        <View style={[styles.badge, { backgroundColor: '#EAF0FF', flexShrink: 1 }]}>
          <Text style={[styles.badgeText, { color: '#3159A5' }]} numberOfLines={1}>{expired ? 'CLOSED' : 'ACTIVE POLL'}</Text>
        </View>
        <View style={[styles.pollTopRight, { flexShrink: 0, marginLeft: 8 }]}>
          {isManagement && onDelete ? <PremiumPressable style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}><Feather name="trash-2" size={14} color="#B42318" /></PremiumPressable> : null}
          <Text style={styles.time}>{poll.userHasVoted ? 'Vote recorded' : 'Choose one'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>{poll.question}</Text>
      
      <View style={styles.pollAuthor}>
        <Feather name="user" size={13} color={theme.colors.textSecondary} />
        <Text style={[styles.pollAuthorText, { flexShrink: 1 }]} numberOfLines={1}>Posted by {authorName} · {authorRole}</Text>
      </View>
      
      <Text style={[styles.pollAudience, { flexShrink: 1 }]} numberOfLines={1}>Visible to {audienceLabel}</Text>
      
      <View style={styles.pollOptions}>
        {poll.options.map((option) => (
          <PremiumPressable key={option.id} style={[styles.pollOption, poll.userVotedOptionId === option.id && styles.pollOptionSelected]} onPress={() => vote(option.id)} disabled={voting || poll.userHasVoted || expired}>
            <Text style={[styles.pollOptionText, { flexShrink: 1 }]}>{option.text}</Text>
            {poll.userHasVoted || expired ? <Text style={[styles.pollCount, { flexShrink: 0, marginLeft: 8 }]}>{option.voteCount} votes</Text> : <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} style={{ flexShrink: 0, marginLeft: 8 }} />}
          </PremiumPressable>
        ))}
      </View>
    </Card>
  );
}
