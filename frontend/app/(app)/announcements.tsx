import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { communityApi, CommunitySpaceItem } from '../../src/api/community';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Text } from '../../src/components/ui/Text';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';
import { useSession } from '../../src/store/auth';

type NoticeSpace = { type: 'LEADERSHIP_OPERATIONS' | 'OWNER_COMMUNITY' | 'RESIDENT_COMMUNITY'; label: string; description: string; icon: React.ComponentProps<typeof Feather>['name']; tint: string; color: string };

const SPACE_META: NoticeSpace[] = [
  { type: 'LEADERSHIP_OPERATIONS', label: 'Leadership', description: 'President, committee and management notices', icon: 'shield', tint: '#F3E8FF', color: '#7C3AED' },
  { type: 'OWNER_COMMUNITY', label: 'Owners', description: 'Property-owner notices and updates', icon: 'key', tint: '#FFF3D6', color: '#A16207' },
  { type: 'RESIDENT_COMMUNITY', label: 'Residents', description: 'Updates for residents and tenants', icon: 'home', tint: '#E8F5E9', color: theme.colors.primary },
];

function spaceMeta(space: CommunitySpaceItem) {
  return SPACE_META.find((meta) => meta.type === space.type);
}

export default function AnnouncementsScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const router = useRouter();
  const { hasLeadershipAccess } = useSession();
  const isLeadership = hasLeadershipAccess();
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const spacesQuery = useQuery({ queryKey: ['announcement-spaces'], queryFn: communityApi.getSpaces });
  const availableSpaces = useMemo(() => (spacesQuery.data?.spaces || []).filter((space) => Boolean(spaceMeta(space))), [spacesQuery.data]);
  const activeSpace = availableSpaces.find((space) => space.id === activeSpaceId) || availableSpaces[0];
  const activeMeta = activeSpace ? spaceMeta(activeSpace) : undefined;

  useEffect(() => {
    if (activeSpace && activeSpace.id !== activeSpaceId) setActiveSpaceId(activeSpace.id);
  }, [activeSpace, activeSpaceId]);

  const announcementsQuery = useQuery({
    queryKey: ['announcements', activeSpace?.id],
    queryFn: () => communityApi.getAnnouncements(activeSpace!.id),
    enabled: Boolean(activeSpace?.id),
  });
  const announcements = announcementsQuery.data?.announcements || [];

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Notice board" rightAction={isLeadership ? (
        <PremiumPressable style={styles.createBtn} onPress={() => router.push('/leadership/create-announcement')} scaleTo={0.94}>
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create</Text>
        </PremiumPressable>
      ) : undefined} />
      {spacesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View> : null}
      {!spacesQuery.isLoading && availableSpaces.length === 0 ? <EmptyState icon="lock" title="No notice spaces available" description="Your account does not currently have access to a notice space." /> : null}
      {activeSpace && activeMeta ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance + 16 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={styles.tabScroll} nestedScrollEnabled>
            {availableSpaces.map((space) => {
              const meta = spaceMeta(space)!;
              const selected = space.id === activeSpace.id;
              return <PremiumPressable key={space.id} style={[styles.tab, selected && { backgroundColor: meta.color }]} onPress={() => setActiveSpaceId(space.id)} accessibilityRole="tab" accessibilityState={{ selected }}><Feather name={meta.icon} size={15} color={selected ? '#FFFFFF' : meta.color} /><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{meta.label}</Text></PremiumPressable>;
            })}
          </ScrollView>
          <View style={[styles.spaceContext, { backgroundColor: activeMeta.tint }]}><Feather name={activeMeta.icon} size={17} color={activeMeta.color} /><Text style={[styles.spaceContextText, { color: activeMeta.color }]}>{activeMeta.description}</Text></View>
          {announcementsQuery.isLoading ? <View style={styles.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View> : null}
          {!announcementsQuery.isLoading && announcements.length === 0 ? <EmptyState icon="bell-off" title={`No ${activeMeta.label.toLowerCase()} notices yet`} description="Published notices for this space will appear here." /> : null}
          {announcements.map((announcement, index) => <ScreenEntrance key={announcement.id} delay={Math.min(70 + index * 55, 260)}><PremiumPressable style={styles.card} onPress={() => router.push(`/announcement/${announcement.id}`)}>
            <View style={styles.cardHeader}><View style={[styles.categoryPill, { backgroundColor: activeMeta.tint }]}><Text style={[styles.category, { color: activeMeta.color }]}>{announcement.category || 'GENERAL'}</Text></View><Text style={styles.date}>{new Date(announcement.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View>
            <Text style={styles.title}>{announcement.title}</Text><Text style={styles.body}>{announcement.content}</Text>
          </PremiumPressable>
            </ScreenEntrance>)}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background }, loader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 52 },
  tabScroll: { flexGrow: 0 }, tabRow: { paddingHorizontal: cardSystem.pagePadding, gap: 10 }, tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: 100, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, ...theme.shadows.card }, tabText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.textPrimary }, tabTextSelected: { color: '#FFFFFF' },
  spaceContext: { marginBottom: 14, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, spaceContextText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 18 },
  scrollContent: { paddingTop: 16, paddingHorizontal: cardSystem.pagePadding, gap: 14 }, card: { width: '100%', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, alignItems: 'flex-start', ...theme.shadows.card }, cardHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, categoryPill: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 }, category: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.4 }, date: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary }, title: { width: '100%', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 22, color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'left' }, body: { width: '100%', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, textAlign: 'left' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#FFFFFF' },
});
