import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { householdApi, HouseholdMemberRecord, HouseholdPetRecord, HouseholdVehicleRecord, PermanentPassRecord } from '../../src/api/household';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { Text } from '../../src/components/ui/Text';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { smartBack } from '../../src/navigation/history';
import { useToast } from '../../src/store/toast';
import { useSession } from '../../src/store/auth';
import { theme } from '../../src/theme';
import { cardSystem } from '../../src/components/ui/cardSystem';

type RecordTab = 'members' | 'vehicles' | 'pets';
type FormValues = Record<string, string>;

const TABS: { id: RecordTab; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'members', label: 'Family', icon: 'users' },
  { id: 'vehicles', label: 'Vehicles', icon: 'truck' },
  { id: 'pets', label: 'Pets', icon: 'heart' },
];

const EMPTY_FORMS: Record<RecordTab, FormValues> = {
  members: { name: '', relationship: '', phone: '', email: '' },
  vehicles: { registrationNumber: '', make: '', model: '', color: '' },
  pets: { name: '', species: '', breed: '', color: '' },
};

const RECORD_ICONS: Record<RecordTab, React.ComponentProps<typeof Feather>['name']> = {
  members: 'user', vehicles: 'truck', pets: 'heart',
};

const TAB_LABELS: Record<RecordTab, string> = {
  members: 'family members', vehicles: 'vehicles', pets: 'pets',
};

export default function FamilyMembersScreen() {
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RecordTab>('members');
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORMS.members);
  const [deleteTarget, setDeleteTarget] = useState<{ type: RecordTab; id: string; title: string } | null>(null);
  const recordsQuery = useQuery({ queryKey: ['household-records'], queryFn: householdApi.getRecords });
  const records = recordsQuery.data;
  const canManage = records?.canManageAssets ?? false;
  const residentName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'you';

  // Permanent passes
  const passesQuery = useQuery({ queryKey: ['permanent-passes'], queryFn: householdApi.getPermanentPasses });
  const passes = passesQuery.data?.passes ?? [];
  const passesCanManage = passesQuery.data?.canManage ?? false;
  const [passFormVisible, setPassFormVisible] = useState(false);
  const [passForm, setPassForm] = useState({ name: '', phone: '', vehicleNumber: '' });
  const [renewTarget, setRenewTarget] = useState<string | null>(null);
  const [deletePassTarget, setDeletePassTarget] = useState<{ id: string; name: string } | null>(null);

  const createPassMutation = useMutation({
    mutationFn: () => householdApi.createPermanentPass({ name: passForm.name, phone: passForm.phone || undefined, vehicleNumber: passForm.vehicleNumber || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['permanent-passes'] });
      setPassFormVisible(false);
      setPassForm({ name: '', phone: '', vehicleNumber: '' });
      showToast({ title: 'Pass issued', message: 'A 28-day permanent pass has been created. No OTP required at the gate.', type: 'success' });
    },
    onError: () => showToast({ title: 'Could not create pass', message: 'Please check the details and try again.', type: 'error' }),
  });

  const renewPassMutation = useMutation({
    mutationFn: (id: string) => householdApi.renewPermanentPass(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['permanent-passes'] });
      setRenewTarget(null);
      showToast({ title: 'Pass renewed', message: 'The pass has been extended for another 28 days.', type: 'success' });
    },
    onError: () => showToast({ title: 'Could not renew pass', message: 'Please try again.', type: 'error' }),
  });

  const deletePassMutation = useMutation({
    mutationFn: (id: string) => householdApi.deletePermanentPass(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['permanent-passes'] });
      setDeletePassTarget(null);
      showToast({ title: 'Pass removed', message: 'The permanent pass has been deleted.', type: 'success' });
    },
    onError: () => showToast({ title: 'Could not remove pass', message: 'Please try again.', type: 'error' }),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === 'members') {
        return householdApi.addMember({
          name: form.name || '',
          relationship: form.relationship || '',
          phone: form.phone || undefined,
          email: form.email || undefined,
        });
      }
      if (activeTab === 'vehicles') return householdApi.addVehicle(form as Omit<HouseholdVehicleRecord, 'id'>);
      return householdApi.addPet(form as Omit<HouseholdPetRecord, 'id'>);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['household-records'] }),
        queryClient.invalidateQueries({ queryKey: ['unit-residencies'] }),
      ]);
      setFormVisible(false);
      showToast({ title: 'Household record added', message: 'Security can now identify this entry for your home.', type: 'success' });
    },
    onError: () => showToast({ title: 'Could not save record', message: 'Please check the details and try again.', type: 'error' }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ type, id }: { type: RecordTab; id: string }) => {
      if (type === 'members') return householdApi.removeMember(id);
      if (type === 'vehicles') return householdApi.removeVehicle(id);
      return householdApi.removePet(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-records'] });
      queryClient.invalidateQueries({ queryKey: ['unit-residencies'] });
      setDeleteTarget(null);
    },
    onError: () => {
      showToast({ title: 'Could not remove record', message: 'Please try again.', type: 'error' });
      setDeleteTarget(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' | 'REVOKED' }) =>
      householdApi.updateMemberStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-records'] });
      showToast({ title: 'Status updated', message: 'Family member status has been changed.', type: 'success' });
    },
    onError: () => {
      showToast({ title: 'Could not update status', message: 'Please try again.', type: 'error' });
    },
  });

  const itemCount = useMemo(() => records?.[activeTab]?.length ?? 0, [activeTab, records]);
  const openForm = () => {
    if (!canManage) {
      showToast({ title: 'Owner access required', message: 'Only the active property owner can update household records.', type: 'error' });
      return;
    }
    setForm(EMPTY_FORMS[activeTab]);
    setFormVisible(true);
  };
  const submit = () => {
    const primary = activeTab === 'vehicles' ? form.registrationNumber : form.name;
    const secondary = activeTab === 'members' ? form.relationship : activeTab === 'pets' ? form.species : activeTab === 'vehicles' ? form.make : '';
    if (!primary?.trim() || !secondary?.trim()) {
      showToast({ title: 'Add the required details', message: 'Complete the required household information to continue.', type: 'error' });
      return;
    }
    addMutation.mutate();
  };

  const detailFor = (item: HouseholdMemberRecord | HouseholdVehicleRecord | HouseholdPetRecord) => {
    if (activeTab === 'members') {
      const member = item as HouseholdMemberRecord;
      const relationshipOwner = [member.createdBy?.firstName, member.createdBy?.lastName].filter(Boolean).join(' ');
      return relationshipOwner ? `${member.relationship} of ${relationshipOwner}` : member.relationship;
    }
    if (activeTab === 'vehicles') {
      const vehicle = item as HouseholdVehicleRecord;
      return [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' · ') || 'Vehicle enrolled for gate recognition';
    }
    const pet = item as HouseholdPetRecord;
    return [pet.species, pet.breed, pet.color].filter(Boolean).join(' · ');
  };
  const titleFor = (item: HouseholdMemberRecord | HouseholdVehicleRecord | HouseholdPetRecord) =>
    activeTab === 'vehicles' ? (item as HouseholdVehicleRecord).registrationNumber : (item as HouseholdMemberRecord | HouseholdPetRecord).name;

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader title="Family records" variant="subscreen" onBackPress={() => smartBack(router, '/profile')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 16 }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance delay={40}>
          <View style={styles.intro}>
            <View style={styles.introIcon}><Feather name="shield" size={20} color={theme.colors.primary} /></View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Your household, clearly recorded</Text>
              <Text style={styles.introText}>Keep family members, registered vehicles, and pets ready for the gate team.</Text>
            </View>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={80}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar} style={styles.tabScroll}>
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <PremiumPressable key={tab.id} style={[styles.tab, selected && styles.tabSelected]} onPress={() => setActiveTab(tab.id)} accessibilityRole="tab" accessibilityState={{ selected }}>
                  <Feather name={tab.icon} size={16} color={selected ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
                </PremiumPressable>
              );
            })}
          </ScrollView>
        </ScreenEntrance>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{activeTab === 'members' ? 'People at home' : activeTab === 'vehicles' ? 'Registered vehicles' : 'Registered pets'}</Text>
            <Text style={styles.sectionMeta}>{itemCount} {itemCount === 1 ? 'record' : 'records'}</Text>
          </View>
          <PremiumPressable style={[styles.addButton, !canManage && styles.addButtonDisabled]} onPress={openForm} accessibilityRole="button" accessibilityLabel={`Add ${activeTab === 'members' ? 'family member' : activeTab.slice(0, -1)}`}>
            <Feather name="plus" size={17} color={canManage ? '#FFFFFF' : theme.colors.textSecondary} />
            <Text style={[styles.addButtonText, !canManage && styles.addButtonTextDisabled]}>Add</Text>
          </PremiumPressable>
        </View>

        {recordsQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} /></View> : null}
        {recordsQuery.isError ? <EmptyState icon="alert-circle" title="Unable to load household records" description="Pull down to try again." /> : null}
        {!recordsQuery.isLoading && !recordsQuery.isError && itemCount === 0 ? (
          <EmptyState icon={RECORD_ICONS[activeTab]} title={`No ${TAB_LABELS[activeTab]} recorded yet`} description={canManage ? `Add ${activeTab === 'members' ? 'the people living with you' : activeTab === 'vehicles' ? 'a household vehicle for smooth gate entry' : 'a pet so the community has the right record'}.` : 'Your property owner can add and update household records.'} />
        ) : null}
        {!recordsQuery.isLoading && records?.[activeTab]?.map((item) => (
          <ScreenEntrance key={item.id} delay={110}>
            <View style={styles.recordRow}>
              <View style={[styles.recordIcon, activeTab === 'vehicles' && styles.vehicleIcon, activeTab === 'pets' && styles.petIcon]}><Feather name={RECORD_ICONS[activeTab]} size={19} color={activeTab === 'vehicles' ? '#A16207' : activeTab === 'pets' ? '#BE185D' : theme.colors.primary} /></View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>{titleFor(item)}</Text>
                <Text style={styles.recordDetail}>{detailFor(item)}</Text>
                {activeTab === 'members' && (item as HouseholdMemberRecord).status && (item as HouseholdMemberRecord).status !== 'ACTIVE' && (
                  <View style={[styles.statusBadge, (item as HouseholdMemberRecord).status === 'PAUSED' ? styles.statusPaused : styles.statusRevoked]}>
                    <Text style={[styles.statusBadgeText, (item as HouseholdMemberRecord).status === 'PAUSED' ? styles.statusPausedText : styles.statusRevokedText]}>
                      {(item as HouseholdMemberRecord).status}
                    </Text>
                  </View>
                )}
              </View>
              {canManage && activeTab === 'members' && (
                <View style={styles.actionButtons}>
                  {(item as HouseholdMemberRecord).relationship !== 'OWNER' && (
                    <>
                      {(item as HouseholdMemberRecord).status === 'ACTIVE' ? (
                        <PremiumPressable
                          onPress={() => statusMutation.mutate({ id: item.id, status: 'PAUSED' })}
                          style={styles.actionButton}
                          accessibilityLabel={`Pause ${titleFor(item)}`}
                        >
                          <Feather name="pause" size={16} color="#D97706" />
                        </PremiumPressable>
                      ) : (item as HouseholdMemberRecord).status === 'PAUSED' ? (
                        <PremiumPressable
                          onPress={() => statusMutation.mutate({ id: item.id, status: 'ACTIVE' })}
                          style={styles.actionButton}
                          accessibilityLabel={`Resume ${titleFor(item)}`}
                        >
                          <Feather name="play" size={16} color="#059669" />
                        </PremiumPressable>
                      ) : null}
                      <PremiumPressable
                        onPress={() => statusMutation.mutate({ id: item.id, status: 'REVOKED' })}
                        style={styles.actionButton}
                        accessibilityLabel={`Revoke ${titleFor(item)}`}
                      >
                        <Feather name="x-circle" size={16} color="#DC2626" />
                      </PremiumPressable>
                    </>
                  )}
                  <PremiumPressable
                    onPress={() => setDeleteTarget({ type: activeTab, id: item.id, title: titleFor(item) })}
                    style={styles.actionButton}
                    accessibilityLabel={`Remove ${titleFor(item)}`}
                  >
                    <Feather name="trash-2" size={16} color="#DC2626" />
                  </PremiumPressable>
                </View>
              )}
              {canManage && activeTab !== 'members' && (
                <PremiumPressable onPress={() => setDeleteTarget({ type: activeTab, id: item.id, title: titleFor(item) })} style={styles.removeButton} accessibilityLabel={`Remove ${titleFor(item)}`}><Feather name="trash-2" size={17} color={theme.colors.error} /></PremiumPressable>
              )}
            </View>
          </ScreenEntrance>
        ))}

        {/* ── Permanent Passes (28-day gate access, no OTP) ── */}
        {activeTab === 'members' && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Gate passes</Text>
                <Text style={styles.sectionMeta}>{passes.length} {passes.length === 1 ? 'pass' : 'passes'} · 28-day validity, no OTP</Text>
              </View>
              {passesCanManage && (
                <PremiumPressable style={styles.addButton} onPress={() => { setPassForm({ name: '', phone: '', vehicleNumber: '' }); setPassFormVisible(true); }} accessibilityRole="button" accessibilityLabel="Issue a permanent pass">
                  <Feather name="plus" size={17} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Issue</Text>
                </PremiumPressable>
              )}
            </View>
            {passesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={theme.colors.primary} /></View> : null}
            {!passesQuery.isLoading && passes.length === 0 && (
              <EmptyState icon="key" title="No permanent passes" description={passesCanManage ? 'Issue a pass so family members can enter without OTP.' : 'The property owner can issue permanent gate passes.'} />
            )}
            {passes.map((pass) => {
              const isExpired = pass.status === 'EXPIRED' || new Date(pass.validUntil) < new Date();
              const isPaused = pass.status === 'PAUSED';
              const daysLeft = Math.max(0, Math.ceil((new Date(pass.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <ScreenEntrance key={pass.id} delay={110}>
                  <View style={styles.recordRow}>
                    <View style={[styles.recordIcon, { backgroundColor: isExpired ? '#FEE2E2' : isPaused ? '#FEF3C7' : '#E8F5E9' }]}>
                      <Feather name="key" size={19} color={isExpired ? '#DC2626' : isPaused ? '#D97706' : theme.colors.primary} />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordTitle}>{pass.name}</Text>
                      <Text style={styles.recordDetail}>
                        {pass.vehicleNumber ? `${pass.vehicleNumber} · ` : ''}{daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}{pass.useCount > 0 ? ` · Used ${pass.useCount}x` : ''}
                      </Text>
                      {isExpired && (
                        <View style={[styles.statusBadge, styles.statusRevoked]}>
                          <Text style={[styles.statusBadgeText, styles.statusRevokedText]}>EXPIRED</Text>
                        </View>
                      )}
                      {isPaused && (
                        <View style={[styles.statusBadge, styles.statusPaused]}>
                          <Text style={[styles.statusBadgeText, styles.statusPausedText]}>PAUSED</Text>
                        </View>
                      )}
                    </View>
                    {passesCanManage && (
                      <View style={styles.actionButtons}>
                        {(isExpired || isPaused) && (
                          <PremiumPressable
                            onPress={() => setRenewTarget(pass.id)}
                            style={styles.actionButton}
                            accessibilityLabel={`Renew pass for ${pass.name}`}
                          >
                            <Feather name="refresh-cw" size={16} color="#059669" />
                          </PremiumPressable>
                        )}
                        {!isExpired && !isPaused && (
                          <PremiumPressable
                            onPress={() => householdApi.updatePermanentPassStatus(pass.id, 'PAUSED').then(() => queryClient.invalidateQueries({ queryKey: ['permanent-passes'] }))}
                            style={styles.actionButton}
                            accessibilityLabel={`Pause pass for ${pass.name}`}
                          >
                            <Feather name="pause" size={16} color="#D97706" />
                          </PremiumPressable>
                        )}
                        <PremiumPressable
                          onPress={() => setDeletePassTarget({ id: pass.id, name: pass.name })}
                          style={styles.actionButton}
                          accessibilityLabel={`Remove pass for ${pass.name}`}
                        >
                          <Feather name="trash-2" size={16} color="#DC2626" />
                        </PremiumPressable>
                      </View>
                    )}
                  </View>
                </ScreenEntrance>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* ── Issue Pass Modal ── */}
      <Modal visible={passFormVisible} transparent animationType="fade" onRequestClose={() => setPassFormVisible(false)} statusBarTranslucent>
        <View style={[styles.modalOverlay, { paddingTop: Math.max(top, 16), paddingBottom: Math.max(bottomClearance + 16, 24) }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPassFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
            <View style={styles.dialogCard}>
              <View style={styles.dialogHeader}>
                <View style={styles.dialogHeaderCopy}>
                  <Text style={styles.dialogTitle}>Issue a Gate Pass</Text>
                  <Text style={styles.dialogSubtitle}>28-day validity · Entry without OTP or pre-approval</Text>
                </View>
                <PremiumPressable
                  style={styles.dialogCloseBtn}
                  onPress={() => setPassFormVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.dialogBody} contentContainerStyle={styles.dialogBodyContent}>
                <View style={styles.passInfoPill}>
                  <View style={styles.passInfoIcon}>
                    <Feather name="shield" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.passInfoText}>
                    This pass enables continuous access for trusted household members for 28 days without one-time codes.
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Name <Text style={styles.requiredStar}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={passForm.name}
                    onChangeText={(v) => setPassForm((c) => ({ ...c, name: v }))}
                    placeholder="e.g. Amina Bello"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Phone number</Text>
                  <TextInput
                    style={styles.input}
                    value={passForm.phone}
                    onChangeText={(v) => setPassForm((c) => ({ ...c, phone: v }))}
                    placeholder="Optional (e.g. +234 800 000 0000)"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Vehicle number</Text>
                  <TextInput
                    style={styles.input}
                    value={passForm.vehicleNumber}
                    onChangeText={(v) => setPassForm((c) => ({ ...c, vehicleNumber: v.toUpperCase() }))}
                    placeholder="Optional (e.g. ABC-123XY)"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="characters"
                  />
                </View>
              </ScrollView>

              <View style={styles.dialogFooter}>
                <Button label="Cancel" variant="outline" onPress={() => setPassFormVisible(false)} style={styles.footerBtnCancel} />
                <Button
                  label="Issue Pass"
                  icon="shield"
                  onPress={() => {
                    if (!passForm.name.trim()) {
                      showToast({ title: 'Name required', message: 'Enter the family member name.', type: 'warning' });
                      return;
                    }
                    createPassMutation.mutate();
                  }}
                  loading={createPassMutation.isPending}
                  style={styles.footerBtnSubmit}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Renew Confirmation Modal ── */}
      <Modal visible={Boolean(renewTarget)} transparent animationType="fade" onRequestClose={() => setRenewTarget(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRenewTarget(null)} />
          <View style={styles.confirmDialogCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#E8F5E9' }]}>
              <Feather name="refresh-cw" size={24} color="#059669" />
            </View>
            <Text style={styles.confirmTitle}>Renew Gate Pass?</Text>
            <Text style={styles.confirmMessage}>This will reset the pass for another 28 days of seamless gate access from today.</Text>
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="outline" onPress={() => setRenewTarget(null)} style={styles.confirmBtnCancel} />
              <Button
                label="Renew Pass"
                onPress={() => { if (renewTarget) renewPassMutation.mutate(renewTarget); }}
                loading={renewPassMutation.isPending}
                style={[styles.confirmBtnSubmit, { backgroundColor: '#059669' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Pass Confirmation Modal ── */}
      <Modal visible={Boolean(deletePassTarget)} transparent animationType="fade" onRequestClose={() => setDeletePassTarget(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeletePassTarget(null)} />
          <View style={styles.confirmDialogCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="trash-2" size={24} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Remove Gate Pass?</Text>
            <Text style={styles.confirmMessage}>
              {deletePassTarget ? `Remove the permanent pass for ${deletePassTarget.name}? They will need OTP or pre-approval for future entries.` : ''}
            </Text>
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeletePassTarget(null)} style={styles.confirmBtnCancel} />
              <Button
                label="Remove"
                onPress={() => { if (deletePassTarget) deletePassMutation.mutate(deletePassTarget.id); }}
                loading={deletePassMutation.isPending}
                style={[styles.confirmBtnSubmit, { backgroundColor: '#DC2626' }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Record Modal (Members / Vehicles / Pets) ── */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)} statusBarTranslucent>
        <View style={[styles.modalOverlay, { paddingTop: Math.max(top, 16), paddingBottom: Math.max(bottomClearance + 16, 24) }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
            <View style={styles.dialogCard}>
              <View style={styles.dialogHeader}>
                <View style={styles.dialogHeaderCopy}>
                  <Text style={styles.dialogTitle}>Add a {activeTab === 'members' ? 'Family Member' : activeTab === 'vehicles' ? 'Vehicle' : 'Pet'}</Text>
                  <Text style={styles.dialogSubtitle}>
                    {activeTab === 'vehicles'
                      ? 'Register your vehicle for automated gate recognition'
                      : activeTab === 'pets'
                      ? 'Keep your household records up to date'
                      : `Relationships recorded relative to ${residentName}`}
                  </Text>
                </View>
                <PremiumPressable
                  style={styles.dialogCloseBtn}
                  onPress={() => setFormVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </PremiumPressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.dialogBody} contentContainerStyle={styles.dialogBodyContent}>
                {activeTab === 'members' ? (
                  <View style={styles.relationshipContext}>
                    <Feather name="users" size={16} color={theme.colors.primary} />
                    <Text style={styles.relationshipContextText}>
                      {form.relationship.trim() ? `${form.relationship.trim()} of ${residentName}` : `e.g. Father of ${residentName}`}
                    </Text>
                  </View>
                ) : null}

                {Object.keys(EMPTY_FORMS[activeTab]).map((key) => (
                  <View key={key} style={styles.field}>
                    <Text style={styles.fieldLabel}>
                      {key === 'relationship' ? `Relationship to ${residentName} *` : fieldLabel(key)}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={form[key]}
                      onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
                      placeholder={key === 'relationship' ? 'e.g. Father, Mother, Spouse' : undefined}
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize={key === 'email' ? 'none' : key === 'registrationNumber' ? 'characters' : 'words'}
                      keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={styles.dialogFooter}>
                <Button label="Cancel" variant="outline" onPress={() => setFormVisible(false)} style={styles.footerBtnCancel} />
                <Button label="Save Record" onPress={submit} loading={addMutation.isPending} style={styles.footerBtnSubmit} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Delete Record Confirmation Modal ── */}
      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeleteTarget(null)} />
          <View style={styles.confirmDialogCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="trash-2" size={24} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Remove {deleteTarget?.type === 'members' ? 'Family Member' : deleteTarget?.type === 'vehicles' ? 'Vehicle' : 'Pet'}?</Text>
            <Text style={styles.confirmMessage}>
              {deleteTarget ? `Are you sure you want to remove ${deleteTarget.title}? Security gate records will be updated immediately.` : ''}
            </Text>
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleteTarget(null)} style={styles.confirmBtnCancel} />
              <Button
                label={removeMutation.isPending ? 'Removing...' : 'Remove'}
                onPress={() => { if (deleteTarget) removeMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id }); }}
                loading={removeMutation.isPending}
                style={[styles.confirmBtnSubmit, { backgroundColor: '#DC2626' }]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = { name: 'Name *', relationship: 'Relationship *', phone: 'Phone number', email: 'Email address', registrationNumber: 'Registration number *', make: 'Make *', model: 'Model', color: 'Colour', species: 'Pet type *', breed: 'Breed' };
  return labels[key];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 16 },
  intro: { flexDirection: 'row', backgroundColor: '#EDF6F0', padding: 16, borderRadius: 16, marginBottom: 22 },
  introIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#D6EBDD', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  introCopy: { flex: 1 },
  introTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 },
  introText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, color: '#52705F' },
  tabScroll: { marginBottom: 28 },
  tabBar: { paddingHorizontal: cardSystem.pagePadding, gap: 10, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#ECECE5' },
  tabSelected: { backgroundColor: theme.colors.primary, ...theme.shadows.card },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textSecondary },
  tabTextSelected: { color: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary },
  sectionMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  addButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 100, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonDisabled: { backgroundColor: '#E7E7E1' },
  addButtonText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', fontSize: 13 },
  addButtonTextDisabled: { color: theme.colors.textSecondary },
  loader: { paddingVertical: 48, alignItems: 'center' },
  recordRow: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, ...theme.shadows.card },
  recordIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  vehicleIcon: { backgroundColor: '#FFF3D6' },
  petIcon: { backgroundColor: '#FCE7F3' },
  recordInfo: { flex: 1 },
  recordTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 },
  recordDetail: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 98, marginTop: 4 },
  statusPaused: { backgroundColor: '#FEF3C7' },
  statusRevoked: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10 },
  statusPausedText: { color: '#92400E' },
  statusRevokedText: { color: '#DC2626' },
  actionButtons: { flexDirection: 'row', gap: 4 },
  actionButton: { width: 34, height: 34, borderRadius: 100, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  removeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  // Standard Centered Modal Design (matching AddVisitorModal / Impeccable system)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  keyboardView: {
    width: '100%',
    maxWidth: 500,
  },
  dialogCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    maxHeight: 620,
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dialogHeaderCopy: {
    flex: 1,
    paddingRight: 10,
  },
  dialogTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  dialogSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  dialogCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBody: {
    maxHeight: 400,
  },
  dialogBodyContent: {
    paddingVertical: 4,
  },
  passInfoPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EDF6F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 10,
  },
  passInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#D6EBDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  passInfoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    lineHeight: 18,
    color: '#2D5A43',
  },
  relationshipContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDF6F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  relationshipContextText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.primary,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: '#DC2626',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerBtnCancel: {
    flex: 1,
  },
  footerBtnSubmit: {
    flex: 1.4,
  },

  // Confirmation Alert Dialog Cards
  confirmDialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  confirmIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmMessage: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1,
  },
  confirmBtnSubmit: {
    flex: 1.2,
  },
});
