import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, StyleSheet, Keyboard, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
  * A native overlay for bottom-sheet content with fluid spring entrance physics,
  * backdrop fade, and safe area insets.
  */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Keyboard.dismiss();
      backdropAnim.setValue(0);
      slideAnim.setValue(60);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 60,
          duration: 160,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setRendered(false);
      });
    }
  }, [visible, rendered, backdropAnim, slideAnim]);

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
              opacity: backdropAnim,
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.52)',
  },
  sheetContainer: {
    width: '100%',
  },
});

