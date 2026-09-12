import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, StyleSheet, Keyboard, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CenterModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A native overlay for centered dialog content with spring scale entrance physics.
 */
export function CenterModal({ visible, onClose, children }: CenterModalProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Keyboard.dismiss();
      backdropAnim.setValue(0);
      scaleAnim.setValue(0.92);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 240,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setRendered(false);
      });
    }
  }, [visible, rendered, backdropAnim, scaleAnim]);

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              transform: [{ scale: scaleAnim }],
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
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  dialogContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

