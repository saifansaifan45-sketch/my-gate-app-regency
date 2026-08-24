/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export function AppLoadingScreen() {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={{ opacity }}>
        <Image
          source={require('../../../../assets/regency-salma-typographic-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // warm ivory
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 80,
  },
});
