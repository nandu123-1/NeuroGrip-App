import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { SunIcon, MoonIcon } from './Icons';
import { SpringButton } from './SpringButton';

interface ThemeToggleProps {
  size?: number;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 20 }) => {
  const { theme, colors, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <SpringButton
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          borderColor: colors.border,
        },
      ]}
      onPress={toggleTheme}
    >
      <View style={styles.iconWrapper}>
        {isDark ? (
          <MoonIcon color="#38BDF8" size={size} />
        ) : (
          <SunIcon color="#D97706" size={size} />
        )}
      </View>
    </SpringButton>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
