import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Button } from '../../../src/components/ui/Button';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityApi, CommunityAnnouncement } from '../../../src/api/community';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { cardSystem } from '../../../src/components/ui/cardSystem';
import { smartBack } from '../../../src/navigation/history';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';


export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { top, bottomClearance } = useScreenInsets(true);
  
  const announcementId = Array.isArray(id) ? id[0] : id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['announcement', announcementId],
    queryFn: async () => {
      if (!announcementId) throw new Error('No ID provided');
      return communityApi.getAnnouncement(announcementId);
    },
    enabled: Boolean(announcementId),
  });

  const markReadMutation = useMutation({
    mutationFn: (aid: string) => communityApi.markAnnouncementRead(aid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', announcementId] });
      queryClient.invalidateQueries({ queryKey: ['homeDashboard'] });
    }
  });

  useEffect(() => {
    if (data?.announcement && data.announcement.isRead === false) {
      markReadMutation.mutate(announcementId as string);
    }
  }, [data?.announcement?.isRead, announcementId]);

  if (!announcementId) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <AppHeader variant="subscreen" title="Announcement" onBackPress={() => smartBack(router, '/announcements')} />
        <EmptyState icon="file-text" title="Not Found" description="The announcement ID is missing." />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <AppHeader variant="subscreen" title="Announcement" onBackPress={() => smartBack(router, '/announcements')} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (isError || !data?.announcement) {
    const errorMsg = (error as any)?.response?.data?.error?.message || 'Could not load announcement';
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <AppHeader variant="subscreen" title="Announcement" onBackPress={() => smartBack(router, '/announcements')} />
        <View style={styles.centerContainer}>
          <EmptyState 
            icon="alert-circle" 
            title="Unable to load" 
            description={errorMsg}
          />
          <Button label="Retry" variant="secondary" onPress={() => refetch()} style={{ marginTop: 24, width: 200 }} />
        </View>
      </View>
    );
  }

  const announcement = data.announcement;
  
  // Format dates
  const publishDate = new Date(announcement.createdAt);
  const expiryDate = announcement.expiresAt ? new Date(announcement.expiresAt) : null;
  const authorName = announcement.author 
    ? `${announcement.author.firstName || ''} ${announcement.author.lastName || ''}`.trim() || 'Leadership'
    : 'Leadership';

  // Priority styling
  let priorityBadgeStyle = styles.badgeNormal;
  let priorityTextStyle = styles.badgeTextNormal;
  
  if (announcement.priority === 'URGENT') {
    priorityBadgeStyle = styles.badgeUrgent;
    priorityTextStyle = styles.badgeTextUrgent;
  } else if (announcement.priority === 'IMPORTANT') {
    priorityBadgeStyle = styles.badgeImportant;
    priorityTextStyle = styles.badgeTextImportant;
  }

  // Category styling
  const categoryLabel = announcement.category ? announcement.category.charAt(0) + announcement.category.slice(1).toLowerCase() : 'Update';

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader variant="subscreen" title="Announcement" onBackPress={() => smartBack(router, '/announcements')} />
      
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenEntrance delay={0}>
          <View style={styles.metaRow}>
            <View style={styles.badges}>
              <View style={[styles.badge, priorityBadgeStyle]}>
                <Text style={priorityTextStyle}>{announcement.priority}</Text>
              </View>
              <View style={[styles.badge, styles.badgeCategory]}>
                <Text style={styles.badgeTextCategory}>{categoryLabel}</Text>
              </View>
            </View>
            <Text style={styles.dateText}>{publishDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</Text>
          </View>

          <Text style={styles.title}>{announcement.title}</Text>
          
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={16} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.authorRole}>{announcement.space?.name || 'Community'}</Text>
            </View>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={40}>
          <View style={styles.divider} />
          
          <Text style={styles.bodyContent}>
            {announcement.content}
          </Text>

          {expiryDate && (
            <View style={styles.expiryBox}>
              <Feather name="clock" size={14} color="#6B7280" />
              <Text style={styles.expiryText}>Valid until {expiryDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</Text>
            </View>
          )}
        </ScreenEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: cardSystem.pagePadding, paddingTop: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeNormal: { backgroundColor: '#F3F4F6' },
  badgeTextNormal: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#374151' },
  badgeImportant: { backgroundColor: '#FEF3C7' },
  badgeTextImportant: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#92400E' },
  badgeUrgent: { backgroundColor: '#FEE2E2' },
  badgeTextUrgent: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#B91C1C' },
  badgeCategory: { backgroundColor: '#E0F2FE' },
  badgeTextCategory: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#0369A1' },
  dateText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#6B7280' },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#111827', lineHeight: 32, marginBottom: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  authorName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#111827' },
  authorRole: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 24 },
  bodyContent: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: '#374151', lineHeight: 26 },
  expiryBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 32, backgroundColor: '#F9FAFB', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  expiryText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#6B7280' },
});
