import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { Button } from '../../../src/components/ui/Button';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { managerApi, AttendanceRecord, AttendanceStatus } from '../../../src/api/manager';
import { useToast } from '../../../src/store/toast';

export default function AttendanceScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const formatLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected Personnel for Attendance Modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('PRESENT');
  const [modalRemarks, setModalRemarks] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await managerApi.getAttendance(date);
      setRecords(res.records);
      setSummary(res.summary);
    } catch (err) {
      console.warn('Failed to load attendance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendance();
  };

  const openAttendanceModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setSelectedStatus(record.status || 'PRESENT');
    setModalRemarks(record.remarks || '');
  };

  const handleSaveAttendance = async () => {
    if (!selectedRecord) return;
    setSavingStatus(true);

    try {
      await managerApi.markAttendance(selectedRecord.personnelId, {
        date,
        status: selectedStatus,
        remarks: modalRemarks.trim(),
      });

      // Optimistic update
      setRecords((prev) =>
        prev.map((r) =>
          r.personnelId === selectedRecord.personnelId
            ? { ...r, status: selectedStatus, remarks: modalRemarks.trim() }
            : r
        )
      );

      showToast({
        title: 'Attendance Recorded',
        message: `${selectedRecord.name} marked as ${selectedStatus.replace('_', ' ').toLowerCase()}.`,
        type: 'success',
      });

      setSelectedRecord(null);
      fetchAttendance();
    } catch {
      showToast({
        title: 'Update Failed',
        message: 'Could not record attendance. Please try again.',
        type: 'error',
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleExportXlsx = async () => {
    try {
      const { url } = await managerApi.exportAttendance(date);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
      showToast({
        title: 'Attendance Exported',
        message: `Exported attendance sheet for ${date} (.xlsx).`,
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Export Failed',
        message: 'Unable to download attendance file.',
        type: 'error',
      });
    }
  };

  const handleBatchMarkPresent = async () => {
    setImporting(true);
    try {
      const batchRecords = records.map((r) => ({
        personnelId: r.personnelId,
        date,
        status: 'PRESENT' as AttendanceStatus,
        remarks: 'All staff check-in verified',
      }));

      await managerApi.importAttendance(batchRecords);
      showToast({
        title: 'All Marked Present',
        message: `Updated attendance for ${records.length} personnel.`,
        type: 'success',
      });
      setShowImportModal(false);
      fetchAttendance();
    } catch {
      showToast({
        title: 'Batch Update Failed',
        message: 'Could not complete batch update.',
        type: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const changeDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(formatLocalDate(d));
  };

  const isToday = date === formatLocalDate(new Date());

  const getStatusBadge = (status: AttendanceStatus | null) => {
    switch (status) {
      case 'PRESENT':
        return { bg: '#ECFDF5', text: '#059669', label: 'Present', dotColor: '#10B981' };
      case 'ABSENT':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'Absent', dotColor: '#EF4444' };
      case 'LEAVE':
        return { bg: '#FEF3C7', text: '#D97706', label: 'On Leave', dotColor: '#F59E0B' };
      case 'HALF_DAY':
        return { bg: '#EFF6FF', text: '#2563EB', label: 'Half Day', dotColor: '#3B82F6' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: 'Not marked', dotColor: '#9CA3AF' };
    }
  };

  const confirmBatchMarkPresent = () => {
    Alert.alert(
      'Mark everyone present?',
      `This will set PRESENT for all ${records.length} personnel on ${date}. Existing attendance entries will be overwritten.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark present', onPress: handleBatchMarkPresent },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Workforce Attendance"
        onBackPress={() => smartBack(router, '/manager')}
        rightAction={
          <View style={styles.headerActionRow}>
            <PremiumPressable
              style={styles.headerIconBtn}
              onPress={handleExportXlsx}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="download" size={18} color={theme.colors.textPrimary} />
            </PremiumPressable>
          </View>
        }
      />

      {/* Date Switcher Bar */}
      <View style={styles.dateBar}>
        <PremiumPressable style={styles.arrowBtn} onPress={() => changeDay(-1)}>
          <Feather name="chevron-left" size={20} color={theme.colors.textPrimary} />
        </PremiumPressable>

        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>
            {isToday ? 'Today, ' : ''}
            {new Date(date + 'T00:00:00').toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        <PremiumPressable style={styles.arrowBtn} onPress={() => changeDay(1)}>
          <Feather name="chevron-right" size={20} color={theme.colors.textPrimary} />
        </PremiumPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Attendance Summary Grid */}
        <ScreenEntrance delay={50}>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
              <Text style={styles.summaryLabel}>Present Today</Text>
              <Text style={[styles.summaryVal, { color: '#047857' }]}>{summary?.present || 0}</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
              <Text style={styles.summaryLabel}>On Leave</Text>
              <Text style={[styles.summaryVal, { color: '#D97706' }]}>{summary?.leave || 0}</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
              <Text style={styles.summaryLabel}>Absent</Text>
              <Text style={[styles.summaryVal, { color: '#DC2626' }]}>{summary?.absent || 0}</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: '#F3F8F5', borderColor: '#E2ECE6' }]}>
              <Text style={styles.summaryLabel}>Total Workforce</Text>
              <Text style={[styles.summaryVal, { color: '#143D2A' }]}>{summary?.total || records.length || 0}</Text>
            </View>
          </View>
        </ScreenEntrance>

        {/* Action Row */}
        <ScreenEntrance delay={80}>
          <View style={styles.toolsRow}>
            <Text style={styles.sectionTitle}>Team Attendance ({records.length})</Text>
            <TouchableOpacity
              style={styles.batchBtn}
              onPress={() => setShowImportModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="check-square" size={14} color={theme.colors.primary} />
              <Text style={styles.batchBtnText}>Batch Actions</Text>
            </TouchableOpacity>
          </View>
        </ScreenEntrance>

        {/* Personnel Attendance Cards */}
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={94} borderRadius={18} />
            <Skeleton height={94} borderRadius={18} />
            <Skeleton height={94} borderRadius={18} />
          </View>
        ) : records.length > 0 ? (
          records.map((person, index) => {
            const statusMeta = getStatusBadge(person.status);

            return (
              <ScreenEntrance key={person.personnelId} delay={100 + index * 40}>
                <PremiumPressable
                  style={styles.rosterCard}
                  onPress={() => openAttendanceModal(person)}
                  scaleTo={0.98}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{person.name.charAt(0)}</Text>
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <View style={styles.tradeRow}>
                        <Text style={styles.personTrade}>{person.category}</Text>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.shiftLabel}>Morning Shift</Text>
                      </View>
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusMeta.dotColor }]} />
                      <Text style={[styles.statusPillText, { color: statusMeta.text }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  {person.remarks ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteLabel}>Note: </Text>
                      <Text style={styles.noteText} numberOfLines={1}>{person.remarks}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooterRow}>
                    <Text style={styles.timingText}>
                      {person.checkIn
                        ? `Check-in: ${new Date(person.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'No punch-in record'}
                    </Text>
                    <View style={styles.editPrompt}>
                      <Text style={styles.editPromptText}>Change</Text>
                      <Feather name="chevron-right" size={14} color={theme.colors.textSecondary} />
                    </View>
                  </View>
                </PremiumPressable>
              </ScreenEntrance>
            );
          })
        ) : (
          <EmptyState
            icon="users"
            title="No personnel found"
            description="Add staff members under Personnel management to start tracking attendance."
          />
        )}
      </ScrollView>

      {/* Attendance Selector Modal */}
      <Modal
        visible={Boolean(selectedRecord)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Mark Attendance</Text>
                <Text style={styles.modalSub}>{selectedRecord?.name} · {selectedRecord?.category}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedRecord(null)}
              >
                <Feather name="x" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Primary Status Options */}
            <Text style={styles.fieldLabel}>Select Daily Status</Text>
            <View style={styles.statusOptionGrid}>
              <TouchableOpacity
                style={[
                  styles.statusOptionBtn,
                  selectedStatus === 'PRESENT' && styles.statusOptionBtnSelectedPresent,
                ]}
                onPress={() => setSelectedStatus('PRESENT')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.statusOptionText, selectedStatus === 'PRESENT' && { color: '#047857', fontWeight: '700' }]}>
                  Present
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOptionBtn,
                  selectedStatus === 'LEAVE' && styles.statusOptionBtnSelectedLeave,
                ]}
                onPress={() => setSelectedStatus('LEAVE')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusOptionText, selectedStatus === 'LEAVE' && { color: '#D97706', fontWeight: '700' }]}>
                  On Leave
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOptionBtn,
                  selectedStatus === 'ABSENT' && styles.statusOptionBtnSelectedAbsent,
                ]}
                onPress={() => setSelectedStatus('ABSENT')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.statusOptionText, selectedStatus === 'ABSENT' && { color: '#DC2626', fontWeight: '700' }]}>
                  Absent
                </Text>
              </TouchableOpacity>
            </View>

            {/* Advanced Option: Half Day */}
            <TouchableOpacity
              style={[
                styles.halfDayOption,
                selectedStatus === 'HALF_DAY' && styles.halfDayOptionSelected,
              ]}
              onPress={() => setSelectedStatus('HALF_DAY')}
            >
              <Feather name="clock" size={16} color={selectedStatus === 'HALF_DAY' ? '#2563EB' : theme.colors.textSecondary} />
              <Text style={[styles.halfDayText, selectedStatus === 'HALF_DAY' && { color: '#2563EB', fontWeight: '700' }]}>
                Half Day (Partial Shift)
              </Text>
            </TouchableOpacity>

            {/* Note Input */}
            <Text style={styles.fieldLabel}>Manager Shift Note (Optional)</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder="e.g. On time for morning shift, approved sick leave..."
              value={modalRemarks}
              onChangeText={setModalRemarks}
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={120}
            />

            <Button
              label={savingStatus ? 'Updating...' : 'Confirm Attendance'}
              onPress={handleSaveAttendance}
              loading={savingStatus}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      {/* Batch Import/Mark Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Batch Attendance Actions</Text>
                <Text style={styles.modalSub}>Perform collective roster operations</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowImportModal(false)}
              >
                <Feather name="x" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.importDesc}>
              Quickly mark all active workforce personnel present for today or download the complete attendance spreadsheet.
            </Text>

            <TouchableOpacity
              style={styles.batchActionCard}
              onPress={confirmBatchMarkPresent}
              disabled={importing}
            >
              <View style={[styles.batchIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="check-circle" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.batchActionTitle}>Mark All Active Staff Present</Text>
                <Text style={styles.batchActionSub}>Sets PRESENT for all {records.length} roster members</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.batchActionCard}
              onPress={() => {
                setShowImportModal(false);
                handleExportXlsx();
              }}
            >
              <View style={[styles.batchIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="download" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.batchActionTitle}>Export Attendance (.xlsx)</Text>
                <Text style={styles.batchActionSub}>Compatible with Microsoft Excel & Google Sheets</Text>
              </View>
            </TouchableOpacity>

            <Button
              label="Close"
              variant="secondary"
              onPress={() => setShowImportModal(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateLabelWrap: { alignItems: 'center' },
  dateLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  content: { padding: 20, paddingBottom: 60 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  summaryVal: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 98,
  },
  batchBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.primary,
  },
  rosterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    marginBottom: 12,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: theme.colors.primary,
  },
  cardInfo: { flex: 1 },
  personName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personTrade: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  bullet: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  shiftLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#6B7280',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
  },
  noteBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noteLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  noteText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11.5,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  timingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  editPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  editPromptText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    color: theme.colors.textPrimary,
  },
  modalSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  statusOptionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statusOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  statusOptionBtnSelectedPresent: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  statusOptionBtnSelectedLeave: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  statusOptionBtnSelectedAbsent: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  statusOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  halfDayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  halfDayOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  halfDayText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  remarksInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  importDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  batchActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 10,
  },
  batchIconBox: {
    width: 40,
    height: 40,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batchActionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  batchActionSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
