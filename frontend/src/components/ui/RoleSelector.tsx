import React, { useEffect, useRef } from 'react';
import { Platform, Animated, Easing, View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { theme } from '../../theme';

interface RoleSelectorProps {
  selected: 'owner' | 'tenant';
  onChange: (role: 'owner' | 'tenant') => void;
}

interface RoleTileProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  sublabel: string;
  selected: boolean;
  selectedColor: string;
  selectedBackground: string;
  selectedBorderColor: string;
  onPress: () => void;
}

function RoleTile({
  icon,
  label,
  sublabel,
  selected,
  selectedColor,
  selectedBackground,
  selectedBorderColor,
  onPress,
}: RoleTileProps) {
  const pop = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(0)).current;

  const bounce = () => {
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.03,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const handlePress = () => {
    if (selected) {
      bounce();
    }
    onPress();
  };

  useEffect(() => {
    if (selected) {
      bounce();
    }

    Animated.timing(check, {
      toValue: selected ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [selected, pop, check]);

  const iconColor = selected ? selectedColor : theme.colors.textSecondary;
  const textColor = selected ? selectedColor : theme.colors.textPrimary;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tile,
        selected && {
          backgroundColor: selectedBackground,
          borderColor: selectedColor,
          borderBottomColor: selectedBorderColor,
        },
        pressed && styles.tilePressed,
      ]}
    >
      <Animated.View style={[styles.tileInner, { transform: [{ scale: pop }] }]}>
        <View style={[styles.iconCircle, { backgroundColor: selected ? 'rgba(20, 61, 42, 0.08)' : 'rgba(0,0,0,0.04)' }]}>
          <Feather name={icon} size={20} color={iconColor} />
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={[styles.tileText, { color: textColor }]}>
            {label}
          </Text>
          <Text numberOfLines={1} style={styles.tileSubtext}>
            {sublabel}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.checkBadge,
          {
            borderColor: selectedColor,
            opacity: check,
            transform: [{ scale: check }],
          },
        ]}
      >
        <Feather name="check" size={12} color={selectedColor} style={styles.checkIcon} />
      </Animated.View>
    </Pressable>
  );
}

export function RoleSelector({ selected, onChange }: RoleSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>What is your relationship with this property?</Text>

      <View style={styles.column}>
        <RoleTile
          icon="home"
          label="I own this property"
          sublabel="Property Owner / Landlord"
          selected={selected === 'owner'}
          selectedColor={theme.colors.primary}
          selectedBackground="#F3F8F5"
          selectedBorderColor="#0E2B1E"
          onPress={() => onChange('owner')}
        />

        <RoleTile
          icon="key"
          label="I don't own the property"
          sublabel="Tenant / Co-resident"
          selected={selected === 'tenant'}
          selectedColor={theme.colors.accent}
          selectedBackground="#FBF4F0"
          selectedBorderColor="#B45F4B"
          onPress={() => onChange('tenant')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  label: {
    marginBottom: 10,
    color: theme.colors.textPrimary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },

  column: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },

  tile: {
    width: '100%',
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E4E2',
    borderBottomWidth: 4,
    borderBottomColor: '#CCD1D3',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  tilePressed: {
    borderBottomWidth: 1.5,
  },

  tileInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  textWrap: {
    flex: 1,
  },

  tileText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    lineHeight: 18,
  },

  tileSubtext: {
    marginTop: 2,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  checkIcon: {
    textAlign: 'center',
    lineHeight: 12,
  },
});