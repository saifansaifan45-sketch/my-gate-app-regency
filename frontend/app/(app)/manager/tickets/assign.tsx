import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../../src/components/ui/Text';
import { PremiumPressable } from '../../../../src/components/ui/PremiumPressable';
import { Button } from '../../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { useScreenInsets } from '../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../src/theme';
import { managerApi, PersonnelItem, TicketItem } from '../../../../src/api/manager';
import { useToast } from '../../../../src/store/toast';
import { cardSystem } from '../../../../src/components/ui/cardSystem';

export default function AssignPersonnelScreen() {
  const { ticketId, category } = useLocalSearchParams<{ ticketId: string; category?: string }>();
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<TicketItem | null>(null);
  const [personnelList, setPersonnelList] = useState<PersonnelItem[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [ticketData, personnelData] = await Promise.all([
        managerApi.getTicket(ticketId),
        managerApi.getPersonnel(),
      ]);
      setTicket(ticketData);
      setPersonnelList(personnelData.personnel);

      // Auto-select first available matching technician if possible
      const matched = personnelData.personnel.find(
        (p) =>
          p.availabilityStatus === 'AVAILABLE' &&
          (category ? p.category.toLowerCase().includes(category.toLowerCase()) : true)
      );
      if (matched) setSelectedPersonnelId(matched.id);
    } catch (err) {
      console.warn('Failed to load assign data:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async () => {
    if (!ticketId || !selectedPersonnelId) {
      showToast({
        title: 'Selection Required',
        message: 'Please select a personnel to assign.',
        type: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      await managerApi.assignTask({
        ticketId,
        personnelId: selectedPersonnelId,
        remarks: remarks.trim() || undefined,
      });

      const assignedPerson = personnelList.find((p) => p.id === selectedPersonnelId);
      showToast({
        title: 'Team Assigned',
        message: `${assignedPerson?.name || 'Staff member'} has been assigned to resolve your issue.`,
        type: 'success',
      });
      router.replace(`/manager/tickets/${ticketId}` as any);
    } catch {
      showToast({
        title: 'Assignment Failed',
        message: 'Failed to assign personnel. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Assign Personnel"
        onBackPress={() => smartBack(router, '/manager/tickets')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket Context Card */}
        <ScreenEntrance delay={50}>
          <View style={styles.ticketContextCard}>
            <View style={styles.ticketCategoryPill}>
              <Text style={styles.ticketCategoryText}>{ticket?.category || category || 'Maintenance'}</Text>
            </View>
            <Text style={styles.ticketTitle}>{ticket?.title || 'Loading issue...'}</Text>
            <Text style={styles.ticketSub}>
              Unit {ticket?.resident?.unitNumber || '9A'} · Resident: {ticket?.resident?.firstName} {ticket?.resident?.lastName || ''}
            </Text>
          </View>
        </ScreenEntrance>

        {/* Personnel Selection Section */}
        <ScreenEntrance delay={100}>
          <Text style={styles.sectionTitle}>Select Maintenance Staff</Text>
          <Text style={styles.sectionSub}>Choose based on trade category and current active workload.</Text>

          {loading ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              <Skeleton height={74} borderRadius={16} />
              <Skeleton height={74} borderRadius={16} />
              <Skeleton height={74} borderRadius={16} />
            </View>
          ) : (() => {
            const availableWorkers = personnelList.filter(
              (p) => (p.employmentStatus === undefined || p.employmentStatus === 'ACTIVE') && p.availabilityStatus === 'AVAILABLE'
            );

            if (availableWorkers.length === 0) {
              return (
                <View style={styles.noWorkersCard}>
                  <Feather name="alert-circle" size={24} color="#D97706" style={{ marginBottom: 6 }} />
                  <Text style={styles.noWorkersTitle}>No Available Technicians On Duty</Text>
                  <Text style={styles.noWorkersDesc}>
                    Tasks can only be assigned to staff who are currently active and available on duty.
                  </Text>
                </View>
              );
            }

            return (
              <View style={styles.personnelList}>
                {availableWorkers.map((person) => {
                  const isSelected = selectedPersonnelId === person.id;
                  const isRecommended = category && person.category.toLowerCase().includes(category.toLowerCase());

                  return (
                    <PremiumPressable
                      key={person.id}
                      style={[styles.personnelTile, isSelected && styles.personnelTileSelected]}
                      onPress={() => setSelectedPersonnelId(person.id)}
                    >
                      <View style={styles.radioSlot}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </View>

                      <View style={styles.personnelDetails}>
                        <View style={styles.nameRow}>
                          <Text style={styles.personnelName}>{person.name}</Text>
                          {isRecommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedText}>Trade Match</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.personnelCategory}>
                          {person.category} · {person.activeTasksCount || 0} active tasks
                        </Text>
                      </View>

                      <View style={[styles.statusPill, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[styles.statusPillText, { color: '#059669' }]}>
                          Available
                        </Text>
                      </View>
                    </PremiumPressable>
                  );
                })}
              </View>
            );
          })()}
        </ScreenEntrance>

        {/* Manager Instructions / Remarks */}
        <ScreenEntrance delay={150}>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Instructions / Notes (Optional)</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Please bring pipe sealant & 1/2 inch connector..."
              placeholderTextColor={theme.colors.textSecondary}
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScreenEntrance>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          label="Confirm & Assign Task"
          variant="primary"
          onPress={handleAssign}
          loading={submitting}
          disabled={!selectedPersonnelId}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 10 },
  ticketContextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  ticketCategoryPill: {
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  ticketCategoryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: theme.colors.primary,
  },
  ticketTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  ticketSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 4,
    marginLeft: 4,
  },
  sectionSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    marginLeft: 4,
  },
  personnelList: { gap: 10 },
  personnelTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  personnelTileSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F7FDF9',
  },
  radioSlot: { marginRight: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  personnelDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  personnelName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  recommendedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  recommendedText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: theme.colors.primary,
  },
  personnelCategory: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 98,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
  },
  inputWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 90,
  },
  input: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
    padding: 0,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  noWorkersCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  noWorkersTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: '#92400E',
    marginBottom: 4,
  },
  noWorkersDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 17,
  },
});
