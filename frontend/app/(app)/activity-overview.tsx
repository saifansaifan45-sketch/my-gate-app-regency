import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { householdApi, HouseholdActivity } from '../../src/api/household';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Text } from '../../src/components/ui/Text';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

type Filter = 'ALL' | 'GUEST' | 'CAB' | 'DELIVERY' | 'SERVICE';
type DateRange = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All activity' }, { id: 'GUEST', label: 'Visitors' }, { id: 'CAB', label: 'Cabs' }, { id: 'DELIVERY', label: 'Deliveries' }, { id: 'SERVICE', label: 'Services' },
];

const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: 'ALL', label: 'All dates' }, { id: 'TODAY', label: 'Today' }, { id: 'WEEK', label: 'Past 7 days' }, { id: 'MONTH', label: 'Past 30 days' }, { id: 'CUSTOM', label: 'Custom' },
];

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());

const kindStyle = (kind: HouseholdActivity['kind']) => {
  if (kind === 'DELIVERY') return { icon: 'package' as const, color: '#A16207', background: '#FFF3D6' };
  if (kind === 'CAB') return { icon: 'map-pin' as const, color: '#2563EB', background: '#EAF1FF' };
  if (kind === 'SERVICE') return { icon: 'tool' as const, color: '#7C3AED', background: '#F3E8FF' };
  return { icon: 'user-check' as const, color: theme.colors.primary, background: '#E8F5E9' };
};

function timeLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return `${isToday ? 'Today' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ActivityOverviewScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [dateRange, setDateRange] = useState<DateRange>('ALL');
  const [startDate, setStartDate] = useState(dateKey(new Date()));
  const [endDate, setEndDate] = useState(dateKey(new Date()));
  const dateParams = useMemo(() => {
    const today = new Date();
    if (dateRange === 'TODAY') return { from: dateKey(today), to: dateKey(today) };
    if (dateRange === 'WEEK') { const from = new Date(today); from.setDate(today.getDate() - 6); return { from: dateKey(from), to: dateKey(today) }; }
    if (dateRange === 'MONTH') { const from = new Date(today); from.setDate(today.getDate() - 29); return { from: dateKey(from), to: dateKey(today) }; }
    if (dateRange === 'CUSTOM' && isDateKey(startDate) && isDateKey(endDate) && startDate <= endDate) return { from: startDate, to: endDate };
    return {};
  }, [dateRange, endDate, startDate]);
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['household-activity', dateParams.from || null, dateParams.to || null], queryFn: () => householdApi.getActivity(dateParams) });
  const activities = useMemo(() => (data?.activities || []).filter((activity) => filter === 'ALL' || activity.kind === filter), [data, filter]);

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Household activity" />
      <View style={styles.intro}>
        <View style={styles.introIcon}><Feather name="eye" size={19} color={theme.colors.primary} /></View>
        <View style={styles.introCopy}><Text style={styles.introTitle}>Shared activity for your home</Text><Text style={styles.introText}>Every household member can see visits, approvals, arrivals, and delivery handoffs.</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          return <PremiumPressable key={item.id} style={[styles.filter, selected && styles.filterSelected]} onPress={() => setFilter(item.id)} accessibilityRole="tab" accessibilityState={{ selected }}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text></PremiumPressable>;
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow} style={styles.dateScroll}>
        {DATE_RANGES.map((item) => {
          const selected = dateRange === item.id;
          return <PremiumPressable key={item.id} style={[styles.dateChip, selected && styles.dateChipSelected]} onPress={() => setDateRange(item.id)} accessibilityRole="tab" accessibilityState={{ selected }}><Feather name={item.id === 'CUSTOM' ? 'calendar' : 'clock'} size={13} color={selected ? '#FFFFFF' : theme.colors.textSecondary} /><Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>{item.label}</Text></PremiumPressable>;
        })}
      </ScrollView>
      {dateRange === 'CUSTOM' ? <View style={styles.customDates}>
        <View style={styles.dateInputWrap}><Text style={styles.dateInputLabel}>From</Text><TextInput style={styles.dateInput} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="none" maxLength={10} accessibilityLabel="Start date" /></View>
        <Feather name="arrow-right" size={16} color={theme.colors.textSecondary} />
        <View style={styles.dateInputWrap}><Text style={styles.dateInputLabel}>To</Text><TextInput style={styles.dateInput} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="none" maxLength={10} accessibilityLabel="End date" /></View>
      </View> : null}
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 16 }]} refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={theme.colors.primary} />}>
        {isLoading ? <View style={styles.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View> : null}
        {!isLoading && activities.length === 0 ? <EmptyState icon="activity" title="No activity found" description={dateRange === 'CUSTOM' && (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) ? 'Enter valid dates in YYYY-MM-DD format, with the start date before the end date.' : filter === 'ALL' ? 'No household activity was recorded for this date range.' : 'No matching household activity was recorded for this date range.'} /> : null}
        {activities.map((activity, index) => {
          const visual = kindStyle(activity.kind);
          return <ScreenEntrance key={activity.id} delay={Math.min(60 + index * 35, 240)}><View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: visual.background }]}><Feather name={visual.icon} size={18} color={visual.color} /></View>
            <View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.activityDetail}>{activity.detail}</Text></View>
            <Text style={styles.time}>{timeLabel(activity.createdAt)}</Text>
          </View></ScreenEntrance>;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  intro: { marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 16, flexDirection: 'row', backgroundColor: '#EDF6F0' }, introIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D6EBDD', marginRight: 12 }, introCopy: { flex: 1 }, introTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 }, introText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: '#52705F' },
  filterScroll: { flexGrow: 0, marginTop: 16 }, filterRow: { paddingHorizontal: 20, gap: 8 }, filter: { paddingHorizontal: 14, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#ECECE5' }, filterSelected: { backgroundColor: theme.colors.primary }, filterText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: theme.colors.textSecondary }, filterTextSelected: { color: '#FFFFFF' },
  dateScroll: { flexGrow: 0, marginTop: 10 }, dateRow: { paddingHorizontal: 20, gap: 8 }, dateChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F4F2EC', flexDirection: 'row', alignItems: 'center', gap: 5 }, dateChipSelected: { backgroundColor: '#365F4A' }, dateChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary }, dateChipTextSelected: { color: '#FFFFFF' }, customDates: { marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, ...theme.shadows.card }, dateInputWrap: { flex: 1 }, dateInputLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: theme.colors.textSecondary, marginBottom: 3 }, dateInput: { minHeight: 32, padding: 0, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: theme.colors.textPrimary },
  list: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 18, gap: 10 }, loader: { paddingVertical: 54, alignItems: 'center' }, row: { minHeight: 76, padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', ...theme.shadows.card }, iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, activityCopy: { flex: 1, paddingRight: 10 }, activityTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }, activityDetail: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary, marginTop: 2 }, time: { width: 66, textAlign: 'right', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary },
});
