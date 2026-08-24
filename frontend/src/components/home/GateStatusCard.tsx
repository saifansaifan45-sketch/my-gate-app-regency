import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { VisitorApprovalCard, VisitorApproval } from '../visitor-approval-card';
import { homeLayout } from './homeSurface';

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
  if (pendingVisitor) {
    return (
      <View style={[styles.container, styles.containerPending]}>
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
    <View style={styles.container}>
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
    borderRadius: 18,
    paddingHorizontal: homeLayout.cardPaddingLarge,
    paddingVertical: homeLayout.cardPaddingLarge,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
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
  },
  shieldIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textColumn: {
    flex: 1,
  },
  cardHeaderSmall: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  statusTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  statusDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  actionLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 2,
    paddingLeft: 6,
  },
  actionLinkText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
