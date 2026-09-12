import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui/Text';

interface Props { typerNames: string[]; }
export function TypingIndicator({ typerNames }: Props) {
  if (typerNames.length === 0) return null;
  return (
    <View style={{ padding: 8 }}>
      <Text style={{ fontSize: 12, opacity: 0.6 }}>{typerNames.join(', ')} typing...</Text>
    </View>
  );
}
