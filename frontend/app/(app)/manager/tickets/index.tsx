import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../../src/components/ui/Text';
import { PremiumPressable } from '../../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../src/theme';
import { managerApi, TicketItem } from '../../../../src/api/manager';
import { cardSystem } from '../../../../src/components/ui/cardSystem';

const STATUS_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'ASSIGNED', label: 'Assigned' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED_BY_WORKER', label: 'Completed' },
  { id: 'PENDING_RESIDENT_CONFIRMATION', label: 'Awaiting resident' },
  { id: 'CLOSED', label: 'Closed' },
];

export default function ManagerTicketsScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await managerApi.getTickets({
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: search.trim() || undefined,
      });
      setTickets(res.tickets);
    } catch (err) {
      console.warn('Failed to load tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'Urgent' };
      case 'HIGH':
        return { bg: '#FEF3C7', text: '#D97706', label: 'High' };
      case 'LOW':
        return { bg: '#F3F4F6', text: '#6B7280', label: 'Low' };
      default:
        return { bg: '#EFF6FF', text: '#2563EB', label: 'Medium' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { bg: '#FEF3C7', text: '#B45309', label: 'Open' };
      case 'ASSIGNED':
        return { bg: '#EFF6FF', text: '#1D4ED8', label: 'Assigned' };
      case 'IN_PROGRESS':
        return { bg: '#E0F2FE', text: '#0284C7', label: 'In Progress' };
      case 'COMPLETED_BY_WORKER':
        return { bg: '#ECFDF5', text: '#047857', label: 'Work completed' };
      case 'PENDING_RESIDENT_CONFIRMATION':
        return { bg: '#FFF7ED', text: '#C2410C', label: 'Awaiting resident' };
      case 'CLOSED':
        return { bg: '#F3F4F6', text: '#4B5563', label: 'Closed' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563', label: status };
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Ticket Management"
        onBackPress={() => smartBack(router, '/manager')}
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, resident, unit..."
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <PremiumPressable onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={theme.colors.textSecondary} />
            </PremiumPressable>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <PremiumPressable
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </PremiumPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Ticket List */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={130} borderRadius={18} />
            <Skeleton height={130} borderRadius={18} />
            <Skeleton height={130} borderRadius={18} />
          </View>
        ) : tickets.length > 0 ? (
          tickets.map((ticket, index) => {
            const pStyle = getPriorityStyle(ticket.priority);
            const sStyle = getStatusBadge(ticket.status);
            const latestTask = ticket.tasks && ticket.tasks[0];

            return (
              <ScreenEntrance key={ticket.id} delay={60 + index * 40}>
                <PremiumPressable
                  style={styles.ticketCard}
                  onPress={() => router.push(`/manager/tickets/${ticket.id}` as any)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryText}>{ticket.category}</Text>
                      </View>
                      <View style={[styles.priorityPill, { backgroundColor: pStyle.bg }]}>
                        <Text style={[styles.priorityText, { color: pStyle.text }]}>{pStyle.label}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sStyle.bg }]}>
                      <Text style={[styles.statusText, { color: sStyle.text }]}>{sStyle.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>

                  {/* Resident Info & Assigned Staff Info */}
                  <View style={styles.metaBox}>
                    <View style={styles.metaRow}>
                      <Feather name="user" size={13} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>
                        {ticket.resident?.firstName} {ticket.resident?.lastName || ''} (Unit {ticket.resident?.unitNumber || '9A'})
                      </Text>
                    </View>

                    {latestTask ? (
                      <View style={styles.assignedPersonnelRow}>
                        <Feather name="tool" size={13} color="#0284C7" />
                        <Text style={styles.assignedPersonnelText}>
                          Staff: {latestTask.assignedPersonnel?.name || 'Assigned Staff'} ({latestTask.assignedPersonnel?.category || 'Staff'})
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.unassignedRow}>
                        <Feather name="alert-triangle" size={13} color="#D97706" />
                        <Text style={styles.unassignedText}>Unassigned · Needs Personnel</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>
                      {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={styles.actionLink}>
                      <Text style={styles.actionLinkText}>Manage Workflow</Text>
                      <Feather name="chevron-right" size={16} color={theme.colors.primary} />
                    </View>
                  </View>
                </PremiumPressable>
              </ScreenEntrance>
            );
          })
        ) : (
          <EmptyState
            icon="inbox"
            title="No tickets found"
            description="There are no maintenance tickets matching the selected filter."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchContainer: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 10, paddingBottom: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: theme.colors.background,
  },
  tabs: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 98,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingTop: 14 },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  categoryPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.textPrimary,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  ticketTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  ticketDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  metaBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  assignedPersonnelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignedPersonnelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#0284C7',
  },
  unassignedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unassignedText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#D97706',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: 10,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionLinkText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.primary,
  },
});
