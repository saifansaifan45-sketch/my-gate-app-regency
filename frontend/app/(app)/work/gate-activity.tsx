import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather, Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/theme';
import { api } from '../../../src/api/client';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';

export default function GateActivityLog() {
  const [unitFilter, setUnitFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(unitFilter), 500);
    return () => clearTimeout(timer);
  }, [unitFilter]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['gate-activity', debouncedFilter],
    queryFn: async () => {
      const res = await api.get('/visitors/gate/activity', { params: { unitLabel: debouncedFilter || undefined } });
      return res.data;
    }
  });

  const renderLog = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.actionText}>{item.action.replace(/_/g, ' ')}</Text>
          <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        {item.visitor && (
          <View style={styles.visitorInfo}>
            <Text style={styles.visitorName}>{item.visitor.visitorName || item.visitor.provider}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.visitor.type}</Text>
            </View>
            {item.visitor.unitNumber && (
              <Text style={styles.unitText}>Unit {item.visitor.unitNumber}</Text>
            )}
          </View>
        )}
        <Text style={styles.actorText}>By: {item.actor.firstName} {item.actor.lastName} ({item.actor.role})</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gate Activity Log</Text>
        <Text style={styles.headerSubtitle}>Recent check-ins, approvals & operations</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by unit (e.g. 7B)"
          placeholderTextColor={theme.colors.textSecondary}
          value={unitFilter}
          onChangeText={setUnitFilter}
          autoCapitalize="characters"
        />
        {unitFilter ? (
          <PremiumPressable onPress={() => setUnitFilter('')}>
            <Feather name="x" size={16} color={theme.colors.textSecondary} />
          </PremiumPressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={data?.logs || []}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Activity</Text>
              <Text style={styles.emptyDesc}>No recent gate activity found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#111827' },
  headerSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B7280', marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 20, marginBottom: 10, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#111827' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.primary },
  timeText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#6B7280' },
  visitorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  visitorName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#111827' },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#4B5563' },
  unitText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  actorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#6B7280', marginTop: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: '#374151' },
  emptyDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#6B7280' }
});
