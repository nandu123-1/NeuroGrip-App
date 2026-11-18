import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface PulseDotProps {
  color?: string;
  size?: number;
  isPulsing?: boolean;
}

export const PulseDot: React.FC<PulseDotProps> = ({
  color = '#10B981',
  size = 8,
  isPulsing = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!isPulsing) {
      scaleAnim.setValue(1);
      opacityAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 2.4,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isPulsing, scaleAnim, opacityAnim]);

  return (
    <View style={[styles.container, { width: size * 2.4, height: size * 2.4 }]}>
      {isPulsing && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
  },
  core: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
});
