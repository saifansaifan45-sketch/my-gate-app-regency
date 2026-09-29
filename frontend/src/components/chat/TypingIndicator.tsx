import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../../theme';

interface TypingIndicatorProps {
  typerNames: string[];
}

export function TypingIndicator({ typerNames }: TypingIndicatorProps) {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const containerTranslateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(containerTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered bouncing wave
    const createDotAnim = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -5,
            duration: 280,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 280,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(500 - delay),
        ])
      );
    };

    const anim1 = createDotAnim(dot1Anim, 0);
    const anim2 = createDotAnim(dot2Anim, 140);
    const anim3 = createDotAnim(dot3Anim, 280);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1Anim, dot2Anim, dot3Anim, containerOpacity, containerTranslateY]);

  const label =
    typerNames.length === 1
      ? `${typerNames[0]} is typing...`
      : typerNames.length === 2
      ? `${typerNames[0]} and ${typerNames[1]} are typing...`
      : 'Several people are typing...';

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: containerOpacity,
          transform: [{ translateY: containerTranslateY }],
        },
      ]}
    >
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot1Anim }] }]}
          />
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot2Anim }] }]}
          />
          <Animated.View
            style={[styles.dot, { transform: [{ translateY: dot3Anim }] }]}
          />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E6ECE6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.primary,
  },
  label: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
