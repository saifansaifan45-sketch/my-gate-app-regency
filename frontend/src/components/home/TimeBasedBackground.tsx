/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, StyleSheet, Animated, Image, ImageSourcePropType } from 'react-native';
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

const PERIOD_HIGH_IMAGES: Record<TimePeriod, ImageSourcePropType> = {
  morning: require('../../../assets/morning.webp'),
  afternoon: require('../../../assets/afternoon.webp'),
  evening: require('../../../assets/evening.webp'),
  night: require('../../../assets/night.webp'),
};

const PERIOD_THUMB_IMAGES: Record<TimePeriod, ImageSourcePropType> = {
  morning: require('../../../assets/morning-thumb.jpg'),
  afternoon: require('../../../assets/afternoon-thumb.jpg'),
  evening: require('../../../assets/evening-thumb.jpg'),
  night: require('../../../assets/night-thumb.jpg'),
};

// Subtle dark surface fallback color instead of harsh bright blue
const PERIOD_SURFACE_COLORS: Record<TimePeriod, string> = {
  morning: '#1F1B14',
  afternoon: '#141E28',
  evening: '#1E1413',
  night: '#0B1522',
};

export const getHeroSurfaceColor = (period: TimePeriod): string => PERIOD_SURFACE_COLORS[period];

interface TimeBasedBackgroundProps {
  currentPeriod: TimePeriod;
}

export const TimeBasedBackground: React.FC<TimeBasedBackgroundProps> = ({ currentPeriod }) => {
  const [displayedPeriod, setDisplayedPeriod] = useState<TimePeriod>(currentPeriod);
  const highResOpacity = useRef(new Animated.Value(0)).current;
  const crossfadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger progressive fade-in for high-res asset
    Animated.timing(highResOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [displayedPeriod, highResOpacity]);

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
      {/* 1. Base Layer: Instant Ultra-Lightweight Blurred Low-Res Dynamic Thumbnail (~500 bytes) */}
      <Image
        source={PERIOD_THUMB_IMAGES[displayedPeriod]}
        style={styles.imageBackground}
        resizeMode="cover"
        blurRadius={Platform.OS === 'web' ? 8 : 12}
      />

      {/* 2. High-Res Image Layer fading in smoothly over thumbnail */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: highResOpacity }]}>
        <Image
          source={PERIOD_HIGH_IMAGES[displayedPeriod]}
          style={styles.imageBackground}
          resizeMode="cover"
        />
      </Animated.View>

      {/* 3. Time Period Dynamic Crossfade Layer */}
      {currentPeriod !== displayedPeriod && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: crossfadeAnim }]}>
          <Image
            source={PERIOD_THUMB_IMAGES[currentPeriod]}
            style={styles.imageBackground}
            resizeMode="cover"
            blurRadius={Platform.OS === 'web' ? 8 : 12}
          />
          <Image
            source={PERIOD_HIGH_IMAGES[currentPeriod]}
            style={styles.imageBackground}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* 4. Left-to-right dark forest gradient overlay */}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
