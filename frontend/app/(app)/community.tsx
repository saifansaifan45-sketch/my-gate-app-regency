import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState, useRef } from 'react';
import { Platform, View, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../src/components/ui/Text';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { CommunityCreateMenu } from '../../src/components/community/CommunityCreateMenu';
import { Card } from '../../src/components/ui/Card';
import { communityApi, CommunityAnnouncement, CommunityPoll, AnnouncementCategory } from '../../src/api/community';
import { useSession } from '../../src/store/auth';
import { theme } from '../../src/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_PADDING = 20;
const TAB_GAP = 8;
const TAB_WIDTH = (SCREEN_WIDTH - TAB_PADDING * 2 - TAB_GAP) / 2;

export default function CommunityScreen() {
  const { bottomClearance } = useScreenInsets(true);
  const { hasManagerAccess } = useSession();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'announcements' | 'polls'>('announcements');
  const [category, setCategory] = useState<AnnouncementCategory | undefined>();
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const spacesQuery = useQuery({ queryKey: ['community', 'spaces'], queryFn: communityApi.getSpaces });
  const announcementsQuery = useQuery({ queryKey: ['community', 'announcements', category], queryFn: () => communityApi.getAnnouncements(undefined, category) });
  const pollsQuery = useQuery({ queryKey: ['community', 'polls'], queryFn: () => communityApi.getPolls() });
  const defaultSpaceId = spacesQuery.data?.spaces[0]?.id;
  const isManagement = hasManagerAccess();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const switchTab = (tab: 'announcements' | 'polls') => {
    if (tab === activeTab) return;
    const toValue = tab === 'polls' ? 1 : 0;
    
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: false,
      damping: 18,
      stiffness: 200,
    }).start();

    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const changeCategory = (item: AnnouncementCategory | undefined) => {
    if (category === item) return;
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCategory(item);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_PADDING, TAB_PADDING + TAB_WIDTH + TAB_GAP],
  });

  const refreshCommunity = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['community', 'announcements'] }),
    queryClient.invalidateQueries({ queryKey: ['community', 'polls'] }),
  ]);

  const createPoll = async (payload: { question: string; options: string[] }) => {
    if (!defaultSpaceId) throw new Error('No community space is available.');
    await communityApi.createPoll(defaultSpaceId, payload);
    await refreshCommunity();
  };
  const createAnnouncement = async (payload: { title: string; description: string; category?: AnnouncementCategory; priority: 'NORMAL' | 'IMPORTANT' | 'URGENT'; status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; expiryDate?: string | null }) => {
    if (!defaultSpaceId) throw new Error('No community space is available.');
    await communityApi.postAnnouncementToSpace(defaultSpaceId, {
      title: payload.title,
      content: payload.description,
      category: payload.category,
      priority: payload.priority,
      status: payload.status,
      ...(payload.expiryDate ? { expiresAt: payload.expiryDate } : {}),
    });
    await refreshCommunity();
  };

  const announcementsContent = useMemo(() => {
    if (announcementsQuery.isLoading) return <Text style={styles.loading}>Loading community updates…</Text>;
    const announcements = announcementsQuery.data?.announcements ?? [];
    if (!announcements.length) return <EmptyState icon="bell" title="No community updates yet" description="Published notices from your community will appear here." />;
    return announcements.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} onRead={async () => { if (!announcement.isRead) { await communityApi.markAnnouncementRead(announcement.id); await refreshCommunity(); } }} />);
  }, [announcementsQuery.data?.announcements, announcementsQuery.isLoading]);

  const pollsContent = useMemo(() => {
    if (pollsQuery.isLoading) return <Text style={styles.loading}>Loading community polls…</Text>;
    const polls = pollsQuery.data?.polls ?? [];
    if (!polls.length) return <EmptyState icon="pie-chart" title="No active polls" description="Community polls will appear here when management opens one." />;
    return polls.map((poll) => (
      <PollCard key={poll.id} poll={poll} onVote={async (optionId) => { await communityApi.vote(poll.id, optionId); await refreshCommunity(); }} />
    ));
  }, [pollsQuery.data?.polls, pollsQuery.isLoading]);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tabroot"
        title="Community"
        rightAction={isManagement ? (
          <PremiumPressable style={styles.createBtn} onPress={() => setIsCreateMenuVisible(true)} activeOpacity={0.9}>
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create</Text>
          </PremiumPressable>
        ) : undefined}
      />

      <View style={styles.tabsWrapper}>
        <View style={styles.tabs}>
          <PremiumPressable
            style={styles.tab}
            onPress={() => switchTab('announcements')}
          >
            <Text style={[styles.tabText, activeTab === 'announcements' && styles.tabTextActive]}>
              Announcements
            </Text>
          </PremiumPressable>
          <PremiumPressable
            style={styles.tab}
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
        {activeTab === 'announcements' ? (
          <ScrollView contentContainerStyle={[styles.feed, { paddingBottom: bottomClearance }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {([undefined, 'GENERAL', 'MAINTENANCE', 'SECURITY', 'EVENT', 'EMERGENCY'] as const).map((item) => (
                <PremiumPressable 
                  key={item ?? 'ALL'} 
                  style={[styles.filterChip, category === item && styles.filterChipActive]} 
                  onPress={() => changeCategory(item)}
                >
                  <Text style={[styles.filterText, category === item && styles.filterTextActive]}>
                    {item ? item.charAt(0) + item.slice(1).toLowerCase() : 'All'}
                  </Text>
                </PremiumPressable>
              ))}
            </ScrollView>
            {announcementsContent}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.feed, { paddingBottom: bottomClearance }]}>
            {pollsContent}
          </ScrollView>
        )}
      </Animated.View>

      {isManagement ? <CommunityCreateMenu visible={isCreateMenuVisible} onClose={() => setIsCreateMenuVisible(false)} onCreatePoll={createPoll} onCreateAnnouncement={createAnnouncement} /> : null}
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
    width: TAB_WIDTH,
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
  loading: { fontFamily: 'PlusJakartaSans_500Medium', color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 36 },
  updateCard: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 97 },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.2, textTransform: 'uppercase' },
  time: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#9CA3AF' },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20, color: theme.colors.textPrimary, marginBottom: 6 },
  cardBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },
  readMore: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.primary, marginTop: 6 },
  pollOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pollOptionSelected: { borderColor: theme.colors.primary, backgroundColor: '#EEF8F1' },
  pollOptionText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textPrimary },
  pollCount: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 97, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
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
  const [expanded, setExpanded] = useState(false);
  const colors = announcement.priority === 'URGENT' ? { bg: '#FDEBEC', text: '#B42318' } : announcement.priority === 'IMPORTANT' ? { bg: '#FEF3D6', text: '#A46100' } : { bg: '#EAF6EE', text: '#1F7A45' };
  const open = async () => { setExpanded(true); await onRead(); };
  return <PremiumPressable onPress={open}><Card style={styles.updateCard}><View style={styles.updateTop}><View style={[styles.badge, { backgroundColor: colors.bg }]}><Text style={[styles.badgeText, { color: colors.text }]}>{announcement.category}</Text></View><Text style={styles.time}>{announcement.isRead ? relativeTime(announcement.createdAt) : 'New · ' + relativeTime(announcement.createdAt)}</Text></View><Text style={styles.cardTitle}>{announcement.title}</Text><Text style={styles.cardBody} numberOfLines={expanded ? undefined : 3}>{announcement.content}</Text>{!expanded && announcement.content.length > 140 ? <Text style={styles.readMore}>Tap to read more</Text> : null}</Card></PremiumPressable>;
}

function PollCard({ poll, onVote }: { poll: CommunityPoll; onVote: (optionId: string) => Promise<void> }) {
  const [voting, setVoting] = useState(false);
  const expired = poll.status !== 'ACTIVE' || (!!poll.expiresAt && new Date(poll.expiresAt) <= new Date());
  const vote = async (optionId: string) => { if (voting || poll.userHasVoted || expired) return; setVoting(true); try { await onVote(optionId); } finally { setVoting(false); } };
  return <Card style={styles.updateCard}><View style={styles.updateTop}><View style={[styles.badge, { backgroundColor: '#EAF0FF' }]}><Text style={[styles.badgeText, { color: '#3159A5' }]}>{expired ? 'CLOSED' : 'ACTIVE POLL'}</Text></View><Text style={styles.time}>{poll.userHasVoted ? 'Vote recorded' : 'Choose one'}</Text></View><Text style={styles.cardTitle}>{poll.question}</Text>{poll.options.map((option) => <PremiumPressable key={option.id} style={[styles.pollOption, poll.userVotedOptionId === option.id && styles.pollOptionSelected]} onPress={() => vote(option.id)} disabled={voting || poll.userHasVoted || expired}><Text style={styles.pollOptionText}>{option.text}</Text>{poll.userHasVoted || expired ? <Text style={styles.pollCount}>{option.voteCount} votes</Text> : <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />}</PremiumPressable>)}</Card>;
}