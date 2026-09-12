import React, { useRef } from 'react';
import { Platform, Pressable, Animated, PressableProps, StyleProp, ViewStyle, GestureResponderEvent, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface PremiumPressableProps extends PressableProps {
  children: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
  activeOpacity?: number;
  pressTranslateY?: number;
  haptic?: 'light' | 'medium' | 'selection' | 'none';
}

export function PremiumPressable({
  children,
  style,
  scaleTo = 0.97,
  activeOpacity = 0.9,
  pressTranslateY = 1,
  haptic = 'none',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...props
}: PremiumPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const triggerHaptic = () => {
    if (Platform.OS === 'web' || haptic === 'none' || disabled) return;
    try {
      if (haptic === 'light') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (haptic === 'medium') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (haptic === 'selection') {
        void Haptics.selectionAsync();
      }
    } catch {
      // Haptics not available on current device
    }
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: scaleTo,
          useNativeDriver: Platform.OS !== 'web',
          speed: 45,
          bounciness: 0,
        }),
        Animated.spring(translateY, {
          toValue: pressTranslateY,
          useNativeDriver: Platform.OS !== 'web',
          speed: 45,
          bounciness: 0,
        }),
      ]).start();
      triggerHaptic();
    }
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
          speed: 40,
          bounciness: 0,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
          speed: 40,
          bounciness: 0,
        }),
      ]).start();
    }
    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      hitSlop={props.hitSlop || { top: 6, bottom: 6, left: 6, right: 6 }}
      {...props}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.touchTarget,
            typeof style === 'function' ? style({ pressed }) : style,
            {
              transform: [{ scale }, { translateY }],
              opacity: disabled ? 0.6 : (pressed ? activeOpacity : 1),
            },
          ]}
        >
          {typeof children === 'function' ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    minHeight: 28,
  },
});
