import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Text } from '../../src/components/ui/Text';
import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { useSession } from '../../src/store/auth';
import { useToast } from '../../src/store/toast';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { theme } from '../../src/theme';
import { ownershipTransfersApi } from '../../src/api/ownership-transfers';

export default function OwnershipTransferScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { primaryOwnership, primaryResidency, hasOwnership } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const unitId = primaryOwnership?.unitId || primaryResidency?.unitId || '';
  const [email, setEmail] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const transfers = useQuery({ queryKey: ['ownership-transfers'], queryFn: ownershipTransfersApi.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ownership-transfers'] });
  const transferError = (error: any) => error?.response?.data?.error?.message || 'Unable to update the handover.';

  const propose = async () => {
    try {
      await ownershipTransfersApi.propose(unitId, email.trim(), new Date(Date.now() + 60000).toISOString(), documentReference.trim() || undefined);
      setEmail(''); setDocumentReference(''); refresh();
      showToast({ title: 'Handover proposed', message: 'The incoming owner must accept the recorded clause.', type: 'success' });
    } catch (error) { showToast({ title: 'Handover not proposed', message: transferError(error), type: 'error' }); }
  };

  return <View style={styles.container}>
    <AppHeader variant="subscreen" title="Ownership handover" rightAction={<PremiumPressable onPress={() => router.back()} accessibilityLabel="Go back"><Feather name="x" size={20} color={theme.colors.textSecondary} /></PremiumPressable>} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 24 }]}>
      <View style={styles.intro}><View style={styles.icon}><Feather name="repeat" size={20} color={theme.colors.primary} /></View><View style={styles.introCopy}><Text style={styles.title}>Transfer legal ownership</Text><Text style={styles.description}>This is a controlled handover between existing accounts. It does not replace a registered title document.</Text></View></View>
      {hasOwnership() && <View style={styles.form}><Input label="Incoming owner email" placeholder="name@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Input label="Document reference (optional)" placeholder="Agreement or registry reference" value={documentReference} onChangeText={setDocumentReference} /><Button label="Propose handover" onPress={propose} disabled={!unitId || !email.trim()} /></View>}
      <Text style={styles.sectionTitle}>Handover history</Text>
      {transfers.isLoading ? <ActivityIndicator color={theme.colors.primary} /> : transfers.data?.transfers.length ? transfers.data.transfers.map((transfer) => <View key={transfer.id} style={styles.transfer}><View style={styles.transferHeader}><Text style={styles.transferUnit}>Unit {transfer.unit?.unitNumber || '—'}</Text><Text style={styles.status}>{transfer.status}</Text></View><Text style={styles.people}>{transfer.fromOwner?.email} → {transfer.toOwner?.email}</Text><Text style={styles.clause}>{transfer.clauseText}</Text>{transfer.status === 'PROPOSED' && <Button label="Accept clause" onPress={async () => { try { await ownershipTransfersApi.accept(transfer.id); refresh(); } catch (error) { showToast({ title: 'Acceptance failed', message: transferError(error), type: 'error' }); } }} />}{transfer.status === 'ACCEPTED' && <Button label="Complete handover" onPress={async () => { try { await ownershipTransfersApi.complete(transfer.id); refresh(); } catch (error) { showToast({ title: 'Completion failed', message: transferError(error), type: 'error' }); } }} />}{(transfer.status === 'PROPOSED' || transfer.status === 'ACCEPTED') && <PremiumPressable onPress={async () => { try { await ownershipTransfersApi.cancel(transfer.id); refresh(); } catch (error) { showToast({ title: 'Cancellation failed', message: transferError(error), type: 'error' }); } }} accessibilityLabel="Cancel handover"><Text style={styles.cancel}>Cancel handover</Text></PremiumPressable>}</View>) : <Text style={styles.empty}>No ownership handovers yet.</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: 20, gap: 18 }, intro: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F1EA', alignItems: 'center', justifyContent: 'center' }, introCopy: { flex: 1, gap: 5 }, title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: theme.colors.textPrimary }, description: { color: theme.colors.textSecondary, lineHeight: 20 }, form: { padding: 16, gap: 14, backgroundColor: theme.colors.surface, borderRadius: 16 }, sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary }, transfer: { padding: 16, gap: 10, backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }, transferHeader: { flexDirection: 'row', justifyContent: 'space-between' }, transferUnit: { fontFamily: 'PlusJakartaSans_700Bold', color: theme.colors.textPrimary }, status: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: theme.colors.primary }, people: { color: theme.colors.textSecondary }, clause: { color: theme.colors.textPrimary, lineHeight: 19 }, cancel: { color: theme.status.danger.foreground, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', paddingVertical: 10 }, empty: { color: theme.colors.textSecondary, paddingVertical: 20 }
});
