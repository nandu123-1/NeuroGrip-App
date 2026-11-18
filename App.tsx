import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LiveCanvasScreen from './src/screens/LiveCanvasScreen';
import GamifiedViewScreen from './src/screens/GamifiedViewScreen';
import TherapistAnalyticsScreen from './src/screens/TherapistAnalyticsScreen';
import SessionHistoryScreen from './src/screens/SessionHistoryScreen';
import DeviceHubScreen from './src/screens/DeviceHubScreen';

import {
  CanvasIcon,
  PlayIcon,
  ChartIcon,
  HistoryIcon,
  HubIcon,
} from './src/components/Icons';
import { ThemeToggle } from './src/components/ThemeToggle';
import { useThemeStore } from './src/store/useThemeStore';
import { Colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();

export default function App() {
  const { colors, theme } = useThemeStore();

  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Canvas"
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.headerBg,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
            headerTitleStyle: {
              fontWeight: '900',
              fontSize: 18,
              color: colors.textPrimary,
              letterSpacing: 0.5,
            },
            headerRight: () => (
              <View style={{ marginRight: 16 }}>
                <ThemeToggle size={18} />
              </View>
            ),
            tabBarStyle: {
              backgroundColor: colors.tabBarBg,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 68,
              paddingBottom: 10,
              paddingTop: 8,
              marginHorizontal: 12,
              marginBottom: Platform.OS === 'android' ? 10 : 8,
              borderRadius: 22,
              position: 'absolute',
              shadowColor: colors.isDark ? '#000' : '#64748B',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: colors.isDark ? 0.5 : 0.12,
              shadowRadius: 12,
              elevation: colors.isDark ? 10 : 6,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 0.4,
            },
          }}
        >
          <Tab.Screen
            name="Canvas"
            component={LiveCanvasScreen}
            options={{
              title: 'Live Pad Mirror',
              tabBarLabel: 'Pad Mirror',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconWrapper}>
                  <CanvasIcon color={color} size={21} />
                  {focused && <View style={styles.activeTabDot} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Play"
            component={GamifiedViewScreen}
            options={{
              title: 'Play Field & Bio Coach',
              tabBarLabel: 'Play',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconWrapper}>
                  <PlayIcon color={color} size={21} />
                  {focused && <View style={[styles.activeTabDot, { backgroundColor: '#10B981' }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Analytics"
            component={TherapistAnalyticsScreen}
            options={{
              title: 'Clinical Diagnostics',
              tabBarLabel: 'Analytics',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconWrapper}>
                  <ChartIcon color={color} size={21} />
                  {focused && <View style={styles.activeTabDot} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="History"
            component={SessionHistoryScreen}
            options={{
              title: 'Session History & Recs',
              tabBarLabel: 'History',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconWrapper}>
                  <HistoryIcon color={color} size={21} />
                  {focused && <View style={[styles.activeTabDot, { backgroundColor: Colors.accent }]} />}
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Hub"
            component={DeviceHubScreen}
            options={{
              title: 'Hardware Hub',
              tabBarLabel: 'Hub',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconWrapper}>
                  <HubIcon color={color} size={21} />
                  {focused && <View style={styles.activeTabDot} />}
                </View>
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 28,
  },
  activeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    position: 'absolute',
    bottom: -2,
  },
});
