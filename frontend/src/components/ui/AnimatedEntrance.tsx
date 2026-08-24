import React, { useEffect, useRef } from 'react';
import { Platform, Animated, Easing, ViewStyle } from 'react-native';

interface AnimatedEntranceProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
}

export function AnimatedEntrance({
  children,
  delay = 0,
  style,
  direction = 'up',
  distance = 24,
  duration = 480,
}: AnimatedEntranceProps) {
  const opacity = useRef(new Animated.Value(0.96)).current;
  const translate = useRef(new Animated.Value(direction === 'none' ? 0 : distance)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translate, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  }, [delay, duration, opacity, translate]);

  const transform = [];
  if (direction === 'up' || direction === 'down') {
    transform.push({ translateY: direction === 'up' ? translate : Animated.multiply(translate, -1) });
  } else if (direction === 'left' || direction === 'right') {
    transform.push({ translateX: direction === 'left' ? translate : Animated.multiply(translate, -1) });
  }

  return (
    <Animated.View style={[style, { opacity, transform }]}>
      {children}
    </Animated.View>
  );
}
