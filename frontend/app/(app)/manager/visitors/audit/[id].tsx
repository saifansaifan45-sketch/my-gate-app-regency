import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { smartBack } from '../../../../../src/navigation/history';
import { Text } from '../../../../../src/components/ui/Text';
import { AppHeader } from '../../../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../../../src/hooks/useScreenInsets';
import { theme } from '../../../../../src/theme';
import { visitorsApi } from '../../../../../src/api/visitors';

export default function VisitorAuditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { top, bottomClearance } = useScreenInsets(false);

  const { data, isLoading } = useQuery({
    queryKey: ['visitor-audit', id],
    queryFn: () => visitorsApi.getVisitorAudit(id),
  });

  if (isLoading || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const { visitor, auditLogs } = data;
  const isException = (visitor.visitorType === 'DELIVERY' && visitor.status === 'CHECKED_OUT' && !visitor.handoffTimestamp) || (visitor.status === 'CHECKED_IN' && visitor.checkInTime && ((new Date().getTime() - new Date(visitor.checkInTime).getTime()) / (1000 * 60 * 60) > 12));

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <AppHeader variant="subscreen" title="Audit Trail" onBackPress={() => smartBack(router, '/manager/visitors')} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]} showsVerticalScrollIndicator={false}>
        
        {isException && (
          <View style={styles.exceptionCard}>
            <View style={styles.exceptionHeader}>
              <Feather name="alert-triangle" size={18} color="#D97706" />
              <Text style={styles.exceptionTitle}>Operational Exception Detected</Text>
            </View>
            <Text style={styles.exceptionDesc}>
              {visitor.visitorType === 'DELIVERY' && !visitor.handoffTimestamp 
                ? 'Delivery exited the gate but security failed to document the package handoff.'
                : 'Subject has been checked in for over 12 hours without a documented exit.'}
            </Text>
          </View>
        )}

        <View style={styles.detailsCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailName}>{visitor.visitorType === 'DELIVERY' || visitor.visitorType === 'CAB' ? (visitor.provider || visitor.name) : visitor.name}</Text>
            <Text style={styles.detailType}>{visitor.visitorType} • {visitor.status}</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Destination</Text>
              <Text style={styles.gridValue}>{visitor.unit?.unitNumber || 'Community'}</Text>
            </View>
            {Boolean(visitor.vehicleNumber) && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Vehicle</Text>
                <Text style={styles.gridValue}>{visitor.vehicleNumber}</Text>
              </View>
            )}
            {Boolean(visitor.purpose) && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Purpose</Text>
                <Text style={styles.gridValue}>{visitor.purpose}</Text>
              </View>
            )}
            {Boolean(visitor.handoffTimestamp) && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Handoff To</Text>
                <Text style={styles.gridValue}>{visitor.handoffRecipientType}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Immutable Audit Trail</Text>
        <View style={styles.timelineCard}>
          {auditLogs.map((log: any, idx: number) => {
            const isLast = idx === auditLogs.length - 1;
            const actionText = log.action.replace('VISITOR_', '').replace('_', ' ');
            return (
              <View key={log.id} style={styles.timelineItem}>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />}
                <View style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{actionText}</Text>
                  <Text style={styles.timelineTime}>{new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
                  {log.actor && (
                    <Text style={styles.timelineActor}>By: {log.actor.firstName} {log.actor.lastName} ({log.actor.role})</Text>
                  )}
                </View>
              </View>
            );
          })}
          {auditLogs.length === 0 && (
            <Text style={styles.emptyText}>No immutable audit logs exist yet for this record.</Text>
          )}
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  
  exceptionCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F59E0B', marginBottom: 20 },
  exceptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  exceptionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#B45309' },
  exceptionDesc: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#92400E', lineHeight: 18 },

  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  detailHeader: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 16, marginBottom: 16 },
  detailName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: theme.colors.textPrimary, marginBottom: 4 },
  detailType: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: theme.colors.textSecondary },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '45%' },
  gridLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },
  gridValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textPrimary },

  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12 },
  
  timelineCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 60 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, zIndex: 2 },
  timelineLine: { position: 'absolute', left: 4.5, top: 15, width: 1, height: '100%', zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1, paddingBottom: 24 },
  timelineTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: theme.colors.textPrimary },
  timelineTime: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  timelineActor: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: theme.colors.primary, marginTop: 4 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' }
});
