import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { householdApi, HouseholdMemberRecord, HouseholdPetRecord, HouseholdVehicleRecord } from '../../src/api/household';
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
  const { bottomClearance } = useScreenInsets(false);
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
      await queryClient.invalidateQueries({ queryKey: ['household-records'] });
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
      setDeleteTarget(null);
    },
    onError: () => {
      showToast({ title: 'Could not remove record', message: 'Please try again.', type: 'error' });
      setDeleteTarget(null);
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
    <View style={styles.container}>
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
              <View style={styles.recordInfo}><Text style={styles.recordTitle}>{titleFor(item)}</Text><Text style={styles.recordDetail}>{detailFor(item)}</Text></View>
              {canManage ? <PremiumPressable onPress={() => setDeleteTarget({ type: activeTab, id: item.id, title: titleFor(item) })} style={styles.removeButton} accessibilityLabel={`Remove ${titleFor(item)}`}><Feather name="trash-2" size={17} color={theme.colors.error} /></PremiumPressable> : null}
            </View>
          </ScreenEntrance>
        ))}
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Add a {activeTab === 'members' ? 'family member' : activeTab.slice(0, -1)}</Text>
          <Text style={styles.sheetSubtitle}>{activeTab === 'vehicles' ? 'This lets security recognise an authorised vehicle.' : activeTab === 'pets' ? 'A simple record helps the community support every member of your household.' : `Relationships are recorded relative to ${residentName}, so every family record stays unambiguous.`}</Text>
          {activeTab === 'members' ? (
            <View style={styles.relationshipContext}>
              <Feather name="users" size={16} color={theme.colors.primary} />
              <Text style={styles.relationshipContextText}>{form.relationship.trim() ? `${form.relationship.trim()} of ${residentName}` : `For example: Father of ${residentName}`}</Text>
            </View>
          ) : null}
          {Object.keys(EMPTY_FORMS[activeTab]).map((key) => <View key={key} style={styles.field}><Text style={styles.fieldLabel}>{key === 'relationship' ? `Relationship to ${residentName} *` : fieldLabel(key)}</Text><TextInput style={styles.input} value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} placeholder={key === 'relationship' ? 'e.g. Father, Mother, Spouse' : undefined} placeholderTextColor={theme.colors.textSecondary} autoCapitalize={key === 'email' ? 'none' : key === 'registrationNumber' ? 'characters' : 'words'} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} /></View>)}
          <View style={styles.sheetActions}><Button label="Cancel" variant="outline" onPress={() => setFormVisible(false)} style={styles.cancelButton} /><Button label="Save record" onPress={submit} loading={addMutation.isPending} style={styles.saveButton} /></View>
        </View></View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>Remove record?</Text>
            <Text style={styles.deleteMessage}>Are you sure you want to remove "{deleteTarget?.title}"? This action cannot be undone.</Text>
            <View style={styles.deleteActions}>
              <Button label="Cancel" variant="outline" onPress={() => setDeleteTarget(null)} style={styles.cancelButton} />
              <Button
                label={removeMutation.isPending ? 'Removing...' : 'Remove'}
                onPress={() => { if (deleteTarget) removeMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id }); }}
                loading={removeMutation.isPending}
                style={styles.deleteConfirmBtn}
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
  container: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 16 },
  intro: { flexDirection: 'row', backgroundColor: '#EDF6F0', padding: 16, borderRadius: 16, marginBottom: 22 }, introIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#D6EBDD', justifyContent: 'center', alignItems: 'center', marginRight: 12 }, introCopy: { flex: 1 }, introTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 }, introText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, color: '#52705F' },
  tabScroll: { marginBottom: 28 },
  tabBar: { paddingHorizontal: cardSystem.pagePadding, gap: 10, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#ECECE5' }, tabSelected: { backgroundColor: theme.colors.primary, ...theme.shadows.card }, tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textSecondary }, tabTextSelected: { color: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary }, sectionMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }, addButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 4 }, addButtonDisabled: { backgroundColor: '#E7E7E1' }, addButtonText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', fontSize: 13 }, addButtonTextDisabled: { color: theme.colors.textSecondary }, loader: { paddingVertical: 48, alignItems: 'center' },
  recordRow: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, ...theme.shadows.card }, recordIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }, vehicleIcon: { backgroundColor: '#FFF3D6' }, petIcon: { backgroundColor: '#FCE7F3' }, recordInfo: { flex: 1 }, recordTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 3 }, recordDetail: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: theme.colors.textSecondary }, removeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.42)' }, sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }, handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 18 }, sheetTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 21, color: theme.colors.textPrimary, marginBottom: 5 }, sheetSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginBottom: 18 }, relationshipContext: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EDF6F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 }, relationshipContextText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.primary }, field: { marginBottom: 10 }, fieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 }, input: { minHeight: 50, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textPrimary }, sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 }, cancelButton: { flex: 1 }, saveButton: { flex: 1.3 },
  deleteModal: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 20, marginHorizontal: 20, marginTop: 'auto', marginBottom: 40, ...theme.shadows.floating }, deleteTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 6 }, deleteMessage: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary, marginBottom: 18 }, deleteActions: { flexDirection: 'row', gap: 10 }, deleteConfirmBtn: { flex: 1, backgroundColor: '#DC2626' },
});
