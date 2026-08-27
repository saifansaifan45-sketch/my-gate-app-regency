/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, StyleSheet, Animated, ImageBackground, ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export const getTimePeriod = (customDate?: Date): TimePeriod => {
  const d = customDate || new Date();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMins = hours * 60 + minutes;

  // 05:00 AM (300) - 11:59 AM (719) -> morning.png
  if (totalMins >= 300 && totalMins <= 719) {
    return 'morning';
  }
  // 12:00 PM (720) - 03:59 PM (959) -> afternoon.png
  if (totalMins > 719 && totalMins <= 959) {
    return 'afternoon';
  }
  // 04:00 PM (960) - 07:59 PM (1199) -> evening.png
  if (totalMins > 959 && totalMins <= 1199) {
    return 'evening';
  }
  // 08:00 PM (1200) - 04:59 AM (299) -> night.png
  return 'night';
};

export const getTimeGreeting = (period: TimePeriod): string => {
  switch (period) {
    case 'morning':
      return 'Good morning,';
    case 'afternoon':
      return 'Good afternoon,';
    case 'evening':
      return 'Good evening,';
    case 'night':
      return 'Good night,';
  }
};

const PERIOD_IMAGES: Record<TimePeriod, ImageSourcePropType> = {
  morning: require('../../../assets/morning.avif'),
  afternoon: require('../../../assets/afternoon.avif'),
  evening: require('../../../assets/evening.avif'),
  night: require('../../../assets/night.avif'),
};

// Sampled from the dominant light in each approved hero asset. This is the
// surrounding home canvas, while the dashboard remains a stable readable surface.
const PERIOD_SURFACE_COLORS: Record<TimePeriod, string> = {
  morning: '#C7A36B',
  afternoon: '#5EA5D7',
  evening: '#9E625A',
  night: '#163D70',
};

export const getHeroSurfaceColor = (period: TimePeriod): string => PERIOD_SURFACE_COLORS[period];

interface TimeBasedBackgroundProps {
  currentPeriod: TimePeriod;
}

export const TimeBasedBackground: React.FC<TimeBasedBackgroundProps> = ({ currentPeriod }) => {
  const [displayedPeriod, setDisplayedPeriod] = useState<TimePeriod>(currentPeriod);
  const crossfadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentPeriod !== displayedPeriod) {
      crossfadeAnim.setValue(0);
      Animated.timing(crossfadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setDisplayedPeriod(currentPeriod);
        crossfadeAnim.setValue(0);
      });
    }
  }, [currentPeriod, displayedPeriod, crossfadeAnim]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* The current time asset stays unfiltered and is swapped with a soft crossfade. */}
      <Animated.View style={StyleSheet.absoluteFill}>
        <ImageBackground
          source={PERIOD_IMAGES[displayedPeriod]}
          style={styles.imageBackground}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Crossfade Layer */}
      {currentPeriod !== displayedPeriod && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: crossfadeAnim }]}>
          <ImageBackground
            source={PERIOD_IMAGES[currentPeriod]}
            style={styles.imageBackground}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* Left-to-right dark forest gradient overlay to ensure high contrast for text on the left while keeping right image details visible */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#0B1F16" stopOpacity="0.82" />
              <Stop offset="45%" stopColor="#0B1F16" stopOpacity="0.45" />
              <Stop offset="85%" stopColor="#0B1F16" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#0B1F16" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  imageBackground: {
    width: '100%',
    height: '100%',
  },
});
