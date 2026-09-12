import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Text } from '../../../../src/components/ui/Text';
import { theme } from '../../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { smartBack } from '../../../../src/navigation/history';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../src/api/client';
import { Feather } from '@expo/vector-icons';
import { homeDashboardQueryKey } from '../../../../src/api/home-dashboard';
import { useSession } from '../../../../src/store/auth';

export default function WorkTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasWorkforceAccess } = useSession();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workforce-dashboard'],
    queryFn: async () => {
      const res = await api.get('/work/dashboard');
      return res.data;
    },
    enabled: hasWorkforceAccess(),
    staleTime: 30_000,
  });

  const task = data?.assignedTasks?.find((t: any) => t.id === id);
  const isSecurity = data?.personnelProfile?.category?.toUpperCase() === 'SECURITY';

  React.useEffect(() => {
    if (isSecurity) router.replace('/work/visitors');
  }, [isSecurity, router]);

  const handleComplete = async () => {
    if (!notes.trim()) {
      Alert.alert('Required', 'Please enter completion notes before marking as completed.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/work/tasks/${id}/complete`, { notes });
      await queryClient.invalidateQueries({ queryKey: ['workforce-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
      smartBack(router, '/work/tasks');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Could not complete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !task || isSecurity) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  const isCompleted = task.status === 'COMPLETED';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 6, 20) }]}>
      <View style={styles.header}>
        <View style={styles.responsiveInner}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => smartBack(router, '/work/tasks')} style={styles.backButton} hitSlop={8}>
              <Feather name="arrow-left" size={20} color="#111827" />
            </Pressable>
            <Text style={styles.headerTitle}>Task Detail</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveInner}>
          <View style={styles.infoCard}>
            <View style={styles.detailTopline}>
              <View style={styles.detailIcon}><Feather name="tool" size={22} color={theme.colors.primary} /></View>
              <View style={styles.detailStatus}><Text style={styles.detailStatusText}>{task.status.replace('_', ' ')}</Text></View>
            </View>
            <Text style={styles.title}>{task.ticket.title}</Text>
            <Text style={styles.description}>{task.ticket.description}</Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue}>{task.ticket.unitNumber}</Text>
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Resident</Text>
              <Text style={styles.metaValue}>{task.ticket.residentName}</Text>
            </View>
          </View>

          {!isCompleted ? (
            <View style={styles.completionSection}>
              <Text style={styles.sectionTitle}>Complete Task</Text>
              <Text style={styles.inputLabel}>Completion Notes (Required)</Text>
              <TextInput
                style={styles.input}
                placeholder="E.g., Changed damaged valve"
                placeholderTextColor={theme.colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              
              <Pressable 
                style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
                onPress={handleComplete}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Mark as Completed'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.completionSection}>
               <View style={styles.successBanner}>
                 <Feather name="check-circle" size={24} color="#166534" />
                 <Text style={styles.successText}>This task is marked as completed.</Text>
               </View>
               <Text style={styles.inputLabel}>Your Notes:</Text>
               <Text style={styles.metaValue}>{task.remarks}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  responsiveInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111827',
  },
  content: {
    padding: 24,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  detailTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  detailIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E4F2E7', alignItems: 'center', justifyContent: 'center' },
  detailStatus: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E4F2E7' },
  detailStatusText: { color: '#166534', fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold' },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  metaLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  metaValue: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  completionSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 10,
    marginBottom: 24,
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  successText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#166534',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
