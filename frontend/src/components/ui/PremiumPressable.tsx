import React, { useRef } from 'react';
import { Platform, Pressable, Animated, PressableProps, StyleProp, ViewStyle, GestureResponderEvent, StyleSheet } from 'react-native';

interface PremiumPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
  activeOpacity?: number;
  pressTranslateY?: number;
}

export function PremiumPressable({ children, style, scaleTo = 0.98, activeOpacity = 0.9, pressTranslateY = 1, onPressIn, onPressOut, ...props }: PremiumPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: Platform.OS !== 'web',
        speed: 40,
        bounciness: 0,
      }),
      Animated.spring(translateY, {
        toValue: pressTranslateY,
        useNativeDriver: Platform.OS !== 'web',
        speed: 40,
        bounciness: 0,
      }),
    ]).start();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 40,
      bounciness: 0,
    }).start();
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      speed: 40,
      bounciness: 0,
    }).start();
    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {({ pressed }) => (
        <Animated.View style={[
          styles.touchTarget,
          typeof style === 'function' ? style({ pressed }) : style,
          { transform: [{ scale }, { translateY }], opacity: pressed ? activeOpacity : 1 },
        ]}>
          {typeof children === 'function' ? (children as any)({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
