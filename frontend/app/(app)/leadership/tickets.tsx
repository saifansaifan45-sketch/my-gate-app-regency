import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { Text } from '../../../src/components/ui/Text';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { leadershipApi, LeadershipTicketItem } from '../../../src/api/leadership';
import { cardSystem } from '../../../src/components/ui/cardSystem';
import { theme } from '../../../src/theme';

const FILTERS = [
  { id: 'ALL', label: 'All tickets' },
  { id: 'UNRESOLVED', label: 'Not resolved' },
  { id: 'RESOLVED', label: 'Resolved' },
] as const;

function formatRaisedAt(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusMeta(ticket: LeadershipTicketItem) {
  if (ticket.resolved) {
    return { label: 'Resolved', color: '#047857', background: '#ECFDF5', icon: 'check-circle' as const };
  }

  if (ticket.status === 'CANCELLED') {
    return { label: 'Cancelled', color: '#B91C1C', background: '#FEF2F2', icon: 'x-circle' as const };
  }

  if (ticket.status === 'PENDING_RESIDENT_CONFIRMATION') {
    return { label: 'Awaiting confirmation', color: '#B45309', background: '#FFF7ED', icon: 'clock' as const };
  }

  return { label: 'Not resolved', color: '#1D4ED8', background: '#EFF6FF', icon: 'circle' as const };
}

export default function LeadershipTicketsScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const [tickets, setTickets] = useState<LeadershipTicketItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]['id']>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await leadershipApi.getTickets();
      setTickets(response.tickets);
    } catch (error) {
      setLoadError(true);
      console.warn('Failed to load leadership tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const refreshTickets = useCallback(() => {
    setRefreshing(true);
    void loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    if (activeFilter === 'RESOLVED') return tickets.filter((ticket) => ticket.resolved);
    if (activeFilter === 'UNRESOLVED') return tickets.filter((ticket) => !ticket.resolved);
    return tickets;
  }, [activeFilter, tickets]);

  const resolvedCount = tickets.filter((ticket) => ticket.resolved).length;

  return (
    <View style={styles.container}>
      <AppHeader variant="tabroot" title="Tickets" showNotification={false} />

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryEyebrow}>COMMUNITY OPERATIONS</Text>
          <Text style={styles.summaryTitle}>Ticket status</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{tickets.length}</Text>
          <Text style={styles.summaryLabel}>{resolvedCount} resolved</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter.id;
          return (
            <PremiumPressable
              key={filter.id}
              accessibilityRole="button"
              accessibilityLabel={`Filter tickets by ${filter.label}`}
              accessibilityState={{ selected }}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text>
            </PremiumPressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshTickets} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={styles.skeletonStack}>
            <Skeleton height={154} borderRadius={18} />
            <Skeleton height={154} borderRadius={18} />
          </View>
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Feather name="wifi-off" size={24} color="#B45309" />
            <Text style={styles.errorTitle}>Tickets could not be loaded</Text>
            <Text style={styles.errorDescription}>Check your connection and try again.</Text>
            <PremiumPressable style={styles.retryButton} onPress={() => void loadTickets()}>
              <Text style={styles.retryText}>Try again</Text>
            </PremiumPressable>
          </View>
        ) : filteredTickets.length === 0 ? (
          <EmptyState icon="file-text" title="No tickets in this view" description="Tickets raised by your community will appear here." />
        ) : (
          filteredTickets.map((ticket, index) => {
            const status = statusMeta(ticket);

            return (
              <ScreenEntrance key={ticket.id} delay={Math.min(40 + index * 35, 220)}>
                <View style={styles.ticketCard}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.category}>{ticket.category}</Text>
                    <View style={[styles.statusPill, { backgroundColor: status.background }]}>
                      <Feather name={status.icon} size={13} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketDescription} numberOfLines={3}>{ticket.description}</Text>

                  <View style={styles.raisedRow}>
                    <Feather name="calendar" size={14} color={theme.colors.textSecondary} />
                    <View>
                      <Text style={styles.raisedLabel}>Ticket raised</Text>
                      <Text style={styles.raisedValue}>{formatRaisedAt(ticket.raisedAt)}</Text>
                    </View>
                  </View>
                </View>
              </ScreenEntrance>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  summaryRow: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 2,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  summaryEyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.8, color: theme.colors.primary },
  summaryTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, letterSpacing: -0.5, color: theme.colors.textPrimary, marginTop: 3 },
  summaryMetric: { alignItems: 'flex-end' },
  summaryValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: theme.colors.textPrimary },
  summaryLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: theme.colors.textSecondary },
  filterRow: { paddingHorizontal: cardSystem.pagePadding, gap: 8, paddingBottom: 12 },
  filterChip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  filterTextSelected: { color: '#FFFFFF' },
  content: { paddingHorizontal: cardSystem.pagePadding, gap: 12 },
  skeletonStack: { gap: 12 },
  ticketCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  category: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10 },
  ticketTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, lineHeight: 23, color: theme.colors.textPrimary, marginBottom: 6 },
  ticketDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginBottom: 15 },
  raisedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  raisedLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: theme.colors.textSecondary, marginBottom: 2 },
  raisedValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textPrimary },
  errorCard: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 28, borderWidth: 1, borderColor: theme.colors.border },
  errorTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginTop: 12, marginBottom: 5 },
  errorDescription: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 },
  retryButton: { backgroundColor: theme.colors.primary, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#FFFFFF' },
});
