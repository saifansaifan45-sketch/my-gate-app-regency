import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { VisitorApprovalCard, VisitorApproval } from '../visitor-approval-card';
import { homeLayout } from './homeSurface';

import { useResponsive } from '../../hooks/useResponsive';

interface GateStatusCardProps {
  pendingVisitor: VisitorApproval | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: () => void;
  onViewActivityPress: () => void;
}

export const GateStatusCard: React.FC<GateStatusCardProps> = ({
  pendingVisitor,
  onApprove,
  onReject,
  onDismiss,
  onViewActivityPress,
}) => {
  const { pagePadding } = useResponsive();

  if (pendingVisitor) {
    return (
      <View style={[styles.container, styles.containerPending, { paddingHorizontal: pagePadding }]}>
        <VisitorApprovalCard
          visitor={pendingVisitor}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDismiss}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal: pagePadding }]}>
      <PremiumPressable
        style={styles.card}
        onPress={onViewActivityPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Gate status: All clear. No one is waiting at the gate."
      >
        {/* Subtle Architectural Wireframe Art in background */}
        <View style={styles.bgIllustrationContainer} pointerEvents="none">
          <Feather name="home" size={140} color="rgba(255, 255, 255, 0.07)" style={styles.houseIcon} />
        </View>

        {/* Content */}
        <View style={styles.innerContent}>
          {/* Left Shield Icon Pill */}
          <View style={styles.shieldIconContainer}>
            <Feather name="shield" size={26} color="#FFFFFF" />
          </View>

          {/* Center/Right Text Information */}
          <View style={styles.textColumn}>
            <Text style={styles.cardHeaderSmall}>Gate status</Text>
            <Text style={styles.statusTitle}>All clear</Text>
            <Text style={styles.statusDescription}>No one is waiting at the gate.</Text>
          </View>

          {/* Right Action Link */}
          <View style={styles.actionLinkWrap}>
            <Text style={styles.actionLinkText}>View gate activity</Text>
            <Feather name="chevron-right" size={15} color="#FFFFFF" />
          </View>
        </View>
      </PremiumPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: homeLayout.pagePadding,
    marginBottom: homeLayout.sectionSpacing,
  },
  containerPending: {
    // The visitor approval card carries its own bottom margin; avoid doubling it.
    marginBottom: 0,
  },
  card: {
    backgroundColor: '#143D2A', // Deep hunter green
    borderRadius: 16,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPadding,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  bgIllustrationContainer: {
    position: 'absolute',
    right: -20,
    bottom: -35,
  },
  houseIcon: {
    opacity: 0.8,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  shieldIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textColumn: {
    flex: 1,
    paddingRight: 8,
  },
  cardHeaderSmall: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  statusDescription: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  actionLinkWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
