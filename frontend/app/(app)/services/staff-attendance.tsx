import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { managerApi, AttendanceRecord, AttendanceSummary } from '../../../src/api/manager';

export default function StaffAttendanceScreen() {
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await managerApi.getAttendance();
      setRecords(res.records);
      setSummary(res.summary);
    } catch (err) {
      console.warn('Failed to load staff attendance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendance();
  };

  const getCategoryIcon = (category: string): { icon: React.ComponentProps<typeof Feather>['name']; bg: string; color: string } => {
    switch (category) {
      case 'SECURITY':
        return { icon: 'shield', bg: '#E8F5E9', color: '#2E7D32' };
      case 'PLUMBER':
        return { icon: 'droplet', bg: '#EDE7F6', color: '#512DA8' };
      case 'ELECTRICIAN':
        return { icon: 'zap', bg: '#FFF3E0', color: '#F57C00' };
      case 'CLEANER':
        return { icon: 'home', bg: '#E3F2FD', color: '#1976D2' };
      case 'GARDENER':
        return { icon: 'feather', bg: '#E8F5E9', color: '#388E3C' };
      default:
        return { icon: 'tool', bg: '#FBE9E7', color: '#D84315' };
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'PRESENT':
        return { bg: '#ECFDF5', color: '#059669', label: 'Present' };
      case 'HALF_DAY':
        return { bg: '#FEF3C7', color: '#D97706', label: 'Half Day' };
      case 'LEAVE':
        return { bg: '#EFF6FF', color: '#2563EB', label: 'On Leave' };
      case 'ABSENT':
        return { bg: '#FEE2E2', color: '#DC2626', label: 'Absent' };
      default:
        return { bg: '#F3F4F6', color: '#6B7280', label: 'Not marked' };
    }
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader
        variant="subscreen"
        title="Staff Attendance"
        onBackPress={() => smartBack(router, '/services')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <ScreenEntrance delay={50}>
          <View style={styles.subHeader}>
            <Text style={styles.subHeaderDate}>
              Today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            {summary && (
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{summary.present} / {summary.total} On Duty</Text>
              </View>
            )}
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={100}>
          {loading ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={64} borderRadius={18} />
              <Skeleton height={64} borderRadius={18} />
              <Skeleton height={64} borderRadius={18} />
            </View>
          ) : records.length > 0 ? (
            <View style={styles.card}>
              {records.map((staff, index) => {
                const iconMeta = getCategoryIcon(staff.category);
                const statusMeta = getStatusBadge(staff.status);

                return (
                  <View
                    key={staff.personnelId}
                    style={[styles.staffRow, index === records.length - 1 && styles.noBorder]}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: iconMeta.bg }]}>
                      <Feather name={iconMeta.icon} size={18} color={iconMeta.color} />
                    </View>

                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{staff.name}</Text>
                      <Text style={styles.staffCategory}>{staff.category}</Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>

                    {staff.checkIn && (
                      <Text style={styles.countText}>
                        {new Date(staff.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="users"
              title="No staff attendance logged"
              description="Today's attendance records will appear here once marked by management."
            />
          )}
        </ScreenEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  subHeaderDate: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  summaryBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
  },
  summaryBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#059669',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  staffCategory: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginRight: 10,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  countText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
