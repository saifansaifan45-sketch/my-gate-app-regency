import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { PremiumPressable } from '../ui/PremiumPressable';
import { Text } from '../ui/Text';
import { UnitResidencyRecord } from '../../api/properties';
import { theme } from '../../theme';
import { homeLayout } from './homeSurface';

export interface PendingResidencyRequest {
  unitId: string;
  unitNumber: string;
  residency: UnitResidencyRecord;
}

interface ResidencyApprovalCardProps {
  requests: PendingResidencyRequest[];
  actionInProgress: string | null;
  onApprove: (request: PendingResidencyRequest) => void;
  onReject: (request: PendingResidencyRequest) => void;
  onReviewAll: () => void;
}

const relationshipLabel = (relationship: string) =>
  relationship === 'FAMILY_MEMBER' ? 'Family member' : 'Resident / tenant';

export function ResidencyApprovalCard({
  requests,
  actionInProgress,
  onApprove,
  onReject,
  onReviewAll,
}: ResidencyApprovalCardProps) {
  if (requests.length === 0) return null;

  const request = requests[0];
  const { residency } = request;
  const applicantName = `${residency.user.firstName} ${residency.user.lastName || ''}`.trim();
  const hasMore = requests.length > 1;

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.heading}>Residency requests</Text>
          <Text style={styles.subheading}>
            {hasMore ? `${requests.length} people are waiting for your review` : 'A person is waiting for your review'}
          </Text>
        </View>
        <PremiumPressable
          accessibilityRole="button"
          accessibilityLabel="Review all residency requests"
          onPress={onReviewAll}
          style={styles.reviewLink}
          scaleTo={0.96}
        >
          <Text style={styles.reviewLinkText}>Review all</Text>
          <Feather name="arrow-up-right" size={15} color={theme.colors.primary} />
        </PremiumPressable>
      </View>

      <View style={styles.card}>
        <PremiumPressable
          accessibilityRole="button"
          accessibilityLabel={`Review residency request from ${applicantName}`}
          onPress={onReviewAll}
          style={styles.reviewArea}
          scaleTo={0.985}
        >
          <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{applicantName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>{applicantName}</Text>
            <Text style={styles.requestMeta}>
              {relationshipLabel(residency.relationshipType)} · Unit {request.unitNumber}
            </Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
          </View>

          <Text style={styles.contact} numberOfLines={1}>
            {residency.user.email}{residency.user.phoneNumber ? `  ·  ${residency.user.phoneNumber}` : ''}
          </Text>
        </PremiumPressable>

        <View style={styles.actions}>
          <Button
            label="Reject"
            size="sm"
            variant="dangerOutline"
            icon="x"
            disabled={actionInProgress === residency.id}
            loading={actionInProgress === residency.id}
            onPress={() => onReject(request)}
            style={styles.actionButton}
          />
          <Button
            label="Approve"
            size="sm"
            icon="check"
            disabled={actionInProgress === residency.id}
            loading={actionInProgress === residency.id}
            onPress={() => onApprove(request)}
            style={styles.actionButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
    alignSelf: 'stretch',
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  heading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    letterSpacing: -0.35,
  },
  subheading: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 44,
    paddingLeft: 10,
  },
  reviewLinkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: '#F2F7F3',
    borderRadius: 16,
    padding: 16,
    alignSelf: 'stretch',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 3,
  },
  reviewArea: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minHeight: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    marginRight: 12,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  identity: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  requestMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  pendingBadge: {
    backgroundColor: '#FFF2DC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: '#9A5A00',
  },
  contact: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
  },
});
