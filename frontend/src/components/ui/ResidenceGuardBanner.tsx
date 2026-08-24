import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { PremiumPressable } from './PremiumPressable';
import { useResidenceAuth } from '../../hooks/useResidenceAuth';

interface ResidenceGuardBannerProps {
  customMessage?: string;
}

export const ResidenceGuardBanner: React.FC<ResidenceGuardBannerProps> = ({ customMessage }) => {
  const router = useRouter();
  const { canPerformResidentAction, reasonMessage } = useResidenceAuth();

  if (canPerformResidentAction) {
    return null;
  }

  const displayMessage =
    customMessage || reasonMessage || 'Verify your account and link an active residence to continue.';

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Feather name="shield-off" size={20} color="#C2410C" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Residence Link Required</Text>
        <Text style={styles.message}>{displayMessage}</Text>
        <PremiumPressable
          style={styles.actionBtn}
          onPress={() => router.push('/residency-requests')}
          scaleTo={0.96}
        >
          <Text style={styles.actionBtnText}>Complete Verification</Text>
          <Feather name="arrow-right" size={14} color="#FFFFFF" />
        </PremiumPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#9A3412',
    marginBottom: 2,
  },
  message: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    lineHeight: 18,
    color: '#C2410C',
    marginBottom: 10,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C2410C',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
});
