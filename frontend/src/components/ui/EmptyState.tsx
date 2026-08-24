import React from 'react';
import { Feather } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from '../../theme';
import { AnimatedEntrance } from './AnimatedEntrance';

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <AnimatedEntrance delay={200}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Feather name={icon} size={32} color={theme.colors.textSecondary} style={styles.icon} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  icon: { marginBottom: 16, opacity: 0.8 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  description: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
