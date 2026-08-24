import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Modal, Alert, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../../src/components/ui/Text';
import { PremiumPressable } from '../../../../src/components/ui/PremiumPressable';
import { Button } from '../../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../../src/components/ui/AppHeader';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { useScreenInsets } from '../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../src/theme';
import { managerApi, PersonnelItem, PersonnelCategory, AvailabilityStatus } from '../../../../src/api/manager';
import { cardSystem } from '../../../../src/components/ui/cardSystem';

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'ALL', label: 'All Staff' },
  { id: 'PLUMBER', label: 'Plumbers' },
  { id: 'ELECTRICIAN', label: 'Electricians' },
  { id: 'CLEANER', label: 'Cleaners' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'GARDENER', label: 'Gardeners' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
];

export default function PersonnelListScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Personnel Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState<PersonnelCategory>('PLUMBER');
  const [adding, setAdding] = useState(false);

  const fetchPersonnel = useCallback(async () => {
    try {
      const res = await managerApi.getPersonnel({
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: search.trim() || undefined,
      });
      setPersonnel(res.personnel);
    } catch (err) {
      console.warn('Failed to load personnel:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPersonnel();
  };

  const handleAddPersonnel = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Missing Info', 'Please provide a name and phone number.');
      return;
    }

    setAdding(true);
    try {
      await managerApi.createPersonnel({
        name: newName.trim(),
        phone: newPhone.trim(),
        category: newCategory,
        availabilityStatus: 'AVAILABLE',
      });
      setModalVisible(false);
      setNewName('');
      setNewPhone('');
      fetchPersonnel();
      Alert.alert('Personnel Added', 'Staff member enrolled and available for task assignment.');
    } catch {
      Alert.alert('Error', 'Failed to create personnel.');
    } finally {
      setAdding(false);
    }
  };

  const getStatusBadge = (status: AvailabilityStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return { bg: '#ECFDF5', text: '#059669', label: 'Available' };
      case 'BUSY':
        return { bg: '#FEF3C7', text: '#D97706', label: 'Busy' };
      case 'LEAVE':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'On Leave' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: 'Off Duty' };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PLUMBER':
        return 'droplet';
      case 'ELECTRICIAN':
        return 'zap';
      case 'CLEANER':
        return 'trash-2';
      case 'SECURITY':
        return 'shield';
      case 'GARDENER':
        return 'feather';
      default:
        return 'tool';
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Personnel Management"
        onBackPress={() => smartBack(router, '/manager')}
        rightAction={
          <PremiumPressable
            onPress={() => setModalVisible(true)}
            style={styles.headerAddBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </PremiumPressable>
        }
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff by name or phone..."
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <PremiumPressable
                key={cat.id}
                style={[styles.catTab, active && styles.catTabActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[styles.catTabText, active && styles.catTabTextActive]}>{cat.label}</Text>
              </PremiumPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Personnel List */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={90} borderRadius={18} />
            <Skeleton height={90} borderRadius={18} />
            <Skeleton height={90} borderRadius={18} />
          </View>
        ) : personnel.length > 0 ? (
          personnel.map((person, index) => {
            const statusMeta = getStatusBadge(person.availabilityStatus);
            const iconName = getCategoryIcon(person.category);

            return (
              <ScreenEntrance key={person.id} delay={60 + index * 40}>
                <PremiumPressable
                  style={styles.personCard}
                  onPress={() => router.push(`/manager/personnel/${person.id}` as any)}
                >
                  <View style={styles.personIcon}>
                    <Feather name={iconName as any} size={20} color={theme.colors.primary} />
                  </View>

                  <View style={styles.personInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                        <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.personCategory}>{person.category}</Text>
                    <Text style={styles.personPhone}>{person.phone}</Text>
                  </View>

                  <View style={styles.personActions}>
                    <PremiumPressable
                      style={styles.callIconBtn}
                      onPress={() => Linking.openURL(`tel:${person.phone}`)}
                    >
                      <Feather name="phone" size={16} color={theme.colors.primary} />
                    </PremiumPressable>
                    <View style={styles.taskCountBadge}>
                      <Text style={styles.taskCountText}>{person.activeTasksCount || 0} tasks</Text>
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
            description="Tap the plus button above to add a staff member."
          />
        )}
      </ScrollView>

      {/* Add Personnel Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Maintenance Personnel</Text>
            <Text style={styles.modalSubtitle}>Enter details for the new staff member.</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Ramesh Chandra"
              placeholderTextColor={theme.colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={theme.colors.textSecondary}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Category / Trade</Text>
            <View style={styles.categoryPicker}>
              {(['PLUMBER', 'ELECTRICIAN', 'CLEANER', 'SECURITY', 'GARDENER', 'MAINTENANCE'] as PersonnelCategory[]).map(
                (cat) => {
                  const selected = newCategory === cat;
                  return (
                    <PremiumPressable
                      key={cat}
                      style={[styles.pickerPill, selected && styles.pickerPillSelected]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text style={[styles.pickerPillText, selected && styles.pickerPillTextSelected]}>
                        {cat}
                      </Text>
                    </PremiumPressable>
                  );
                }
              )}
            </View>

            <View style={styles.modalBtnRow}>
              <PremiumPressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </PremiumPressable>
              <Button
                label="Create Personnel"
                variant="primary"
                onPress={handleAddPersonnel}
                loading={adding}
                style={{ flex: 1.2 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  categoryScrollWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: theme.colors.background,
  },
  categories: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingVertical: 10,
    gap: 8,
  },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 98,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  catTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catTabText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  catTabTextActive: {
    color: '#FFFFFF',
  },
  list: { paddingHorizontal: cardSystem.pagePadding, paddingVertical: 20, paddingTop: 14 },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  personIcon: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  personInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  personName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  personCategory: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  personPhone: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
  },
  personActions: { alignItems: 'flex-end', gap: 6 },
  callIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCountBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 98,
  },
  taskCountText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    marginTop: 4,
  },
  pickerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 98,
    backgroundColor: '#F3F4F6',
  },
  pickerPillSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  pickerPillTextSelected: {
    color: '#FFFFFF',
  },
  modalBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
