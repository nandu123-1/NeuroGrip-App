import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { useBleStore } from '../store/useBleStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAiStore } from '../store/useAiStore';
import { Colors } from '../theme/colors';
import {
  PenIcon,
  PadIcon,
  BluetoothIcon,
  RefreshIcon,
  SparklesIcon,
  TargetIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '../components/Icons';
import { SpringButton } from '../components/SpringButton';
import { PulseDot } from '../components/PulseDot';

export default function DeviceHubScreen() {
  const { colors } = useThemeStore();
  const {
    status,
    connectAndStartListening,
    disconnect,
    penBattery,
    isSimulated,
    toggleSimulation,
    triggerBuzzerHaptic,
    touchX,
    touchY,
    pressureGrams,
  } = useBleStore();

  const {
    activeProfile,
    isCalibrating,
    calibrationProgress,
    calibrationCountdown,
    calibrationPoints,
    startCalibration,
    recordCalibrationPoint,
    updateCalibrationCountdown,
    finishCalibration,
    cancelCalibration,
    resetToDefaultProfile,
  } = useAiStore();

  // Calibration loop countdown & continuous telemetry sampler
  useEffect(() => {
    let timer: any = null;
    let streamTimer: any = null;

    if (isCalibrating) {
      timer = setInterval(() => {
        const nextSec = calibrationCountdown - 1;
        if (nextSec <= 0) {
          clearInterval(timer);
          clearInterval(streamTimer);
          const profile = finishCalibration();
          Alert.alert(
            'Personalized Calibration Complete!',
            `Patient Profile Updated for ${profile.patientId}:\n\n• Safe Pinch Zone: ${profile.minSafePinchGrams}g - ${profile.maxSafePinchGrams}g\n• Tremor Ceiling: < ${profile.maxTremorCeilingHz} Hz\n• Motor Stability: ${profile.stabilityIndex}%\n• Condition Pattern: ${profile.conditionIndicator}`,
            [{ text: 'Apply Envelope' }]
          );
        } else {
          updateCalibrationCountdown(nextSec);
        }
      }, 1000);

      streamTimer = setInterval(() => {
        const liveGrams = pressureGrams || (isSimulated ? 175 + Math.sin(Date.now() / 250) * 35 : 160);
        const ptX = touchX > 0 ? touchX : 120 + ((Date.now() / 20) % 240);
        const ptY = touchY > 0 ? touchY : 140 + Math.sin(Date.now() / 250) * 60;
        recordCalibrationPoint({
          x: ptX,
          y: ptY,
          pressure: liveGrams,
          timestamp: Date.now(),
        });
      }, 100);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (streamTimer) clearInterval(streamTimer);
    };
  }, [isCalibrating, calibrationCountdown, pressureGrams, touchX, touchY, isSimulated]);

  const handleManualComplete = () => {
    const profile = finishCalibration();
    Alert.alert(
      'Personalized Calibration Saved',
      `Individualized Profile Envelope:\n\n• Safe Pinch Zone: ${profile.minSafePinchGrams}g - ${profile.maxSafePinchGrams}g\n• Tremor Ceiling: < ${profile.maxTremorCeilingHz} Hz\n• Motor Stability: ${profile.stabilityIndex}%\n• Condition Pattern: ${profile.conditionIndicator}`,
      [{ text: 'OK' }]
    );
  };

  const isConnected = status === 'Connected' || isSimulated;
  const isScanning = status === 'Scanning' || status === 'Connecting';

  // Radar sweep animation
  const radarSweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sweepLoop = Animated.loop(
      Animated.timing(radarSweep, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    sweepLoop.start();
    return () => sweepLoop.stop();
  }, [radarSweep]);

  const spin = radarSweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Section Header */}
      <View style={styles.heroHeader}>
        <View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Hardware Command Hub</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>BLE 5.0 Mesh Architecture & Peripheral Management</Text>
        </View>
        <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <BluetoothIcon size={16} color={isConnected ? colors.success : colors.primary} />
          <Text style={[styles.pillBadgeText, { color: isConnected ? colors.success : colors.textPrimary }]}>{isConnected ? 'Active Hub' : 'Standby'}</Text>
        </View>
      </View>

      {/* Main Radar / Topology Status Card */}
      <View style={[styles.hubMasterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.radarSection}>
          {/* Animated Sonar Radar Svg */}
          <View style={styles.radarWrapper}>
            <Svg width={110} height={110}>
              <Circle cx={55} cy={55} r={50} stroke={colors.border} strokeWidth={1} fill="none" />
              <Circle cx={55} cy={55} r={34} stroke={colors.primaryGlow} strokeWidth={1} fill="none" />
              <Circle cx={55} cy={55} r={18} stroke={colors.primaryGlow} strokeWidth={1} fill="none" />
              <Line x1={5} y1={55} x2={105} y2={55} stroke={colors.border} strokeWidth={1} />
              <Line x1={55} y1={5} x2={55} y2={105} stroke={colors.border} strokeWidth={1} />
            </Svg>

            {/* Rotating Sonar Beam */}
            <Animated.View style={[styles.radarBeam, { transform: [{ rotate: spin }] }]}>
              <View style={[styles.radarNeedle, { backgroundColor: colors.primary }]} />
            </Animated.View>

            {/* Center Core Dot */}
            <View style={styles.radarCenterDot}>
              <PulseDot
                color={isConnected ? colors.success : isScanning ? colors.warning : colors.danger}
                size={8}
                isPulsing={isConnected || isScanning}
              />
            </View>
          </View>

          <View style={styles.radarInfo}>
            <Text style={[styles.hubTitle, { color: colors.textPrimary }]}>
              {isConnected
                ? 'NeuroGrip Hub Synced'
                : isScanning
                ? 'Discovering Peripherals...'
                : 'System Standby'}
            </Text>
            <Text style={[styles.hubSubtitle, { color: colors.textSecondary }]}>
              {isConnected
                ? 'Bi-directional low-latency telemetry streaming (100 Hz)'
                : 'Turn on your ESP32 Writing Pad & XIAO Smart Pen'}
            </Text>

            {isScanning && (
              <View style={[styles.scanningBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.scanningText, { color: colors.primary }]}>Listening for BLE 19B10000...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Button */}
        <SpringButton
          style={[
            styles.primaryActionBtn,
            { backgroundColor: isConnected ? colors.surfaceElevated : colors.primary, borderColor: isConnected ? colors.danger : colors.primary, borderWidth: 1 },
          ]}
          onPress={isConnected ? disconnect : connectAndStartListening}
        >
          <BluetoothIcon color={isConnected ? colors.danger : colors.isDark ? '#080C14' : '#FFFFFF'} size={18} />
          <Text style={[styles.primaryActionBtnText, { color: isConnected ? colors.danger : colors.isDark ? '#080C14' : '#FFFFFF' }]}>
            {isConnected ? 'Disconnect System' : 'Scan & Pair Peripherals'}
          </Text>
        </SpringButton>
      </View>

      {/* Hardware Peripherals Detail Cards */}
      <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>CONNECTED PERIPHERALS</Text>

      {/* 1. Waveshare 3.5" (F) Writing Pad */}
      <View style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.deviceCardHeader}>
          <View style={[styles.deviceIconCircle, { backgroundColor: colors.surfaceElevated }]}>
            <PadIcon color={colors.primary} size={22} />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={[styles.deviceName, { color: colors.textPrimary }]}>NeuroGrip Touch Pad</Text>
            <Text style={[styles.deviceChip, { color: colors.textSecondary }]}>ESP32 DevKit V1 + Waveshare 3.5" (F)</Text>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                borderColor: isConnected ? 'rgba(16, 185, 129, 0.35)' : colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: isConnected ? colors.success : colors.textMuted }]}>
              {isConnected ? 'ONLINE' : 'STANDBY'}
            </Text>
          </View>
        </View>

        <View style={[styles.specGrid, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>DISPLAY</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>480 × 320 LCD</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>DIGITIZER</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>Capacitive Touch</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>PROTOCOL</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>Dual BLE Hub</Text>
          </View>
        </View>
      </View>

      {/* 2. Seeed XIAO nRF52840 Smart Pen */}
      <View style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.deviceCardHeader}>
          <View style={[styles.deviceIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <PenIcon color={colors.warning} size={22} />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={[styles.deviceName, { color: colors.textPrimary }]}>NeuroGrip Smart Pen</Text>
            <Text style={[styles.deviceChip, { color: colors.textSecondary }]}>Seeed XIAO nRF52840 Sense</Text>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                borderColor: isConnected ? 'rgba(16, 185, 129, 0.35)' : colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: isConnected ? colors.success : colors.textMuted }]}>
              {isConnected ? 'PAIRED' : 'STANDBY'}
            </Text>
          </View>
        </View>

        <View style={[styles.batteryRow, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.specLabel, { color: colors.textMuted }]}>BATTERY</Text>
          <View style={[styles.batteryTrack, { backgroundColor: colors.isDark ? '#1E293B' : '#E2E8F0' }]}>
            <View style={[styles.batteryFill, { width: `${penBattery}%` }]} />
          </View>
          <Text style={[styles.batteryPercentText, { color: colors.textPrimary }]}>{penBattery}%</Text>
        </View>

        <View style={[styles.specGrid, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>PRESSURE</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>FSR 402 Force</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>IMU</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>LSM6DS3TR-C</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>HAPTICS</Text>
            <Text style={[styles.specValue, { color: colors.textPrimary }]}>Piezo Buzzer</Text>
          </View>
        </View>

        {/* Haptic Test Button */}
        <SpringButton
          style={[styles.hapticTestBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={triggerBuzzerHaptic}
        >
          <SparklesIcon size={16} color={colors.warning} />
          <Text style={[styles.hapticTestBtnText, { color: colors.warning }]}>Test Pen Buzzer & Haptics</Text>
        </SpringButton>
      </View>

      {/* AI Personalized Threshold Calibration Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <TargetIcon size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>AI Personalized Threshold Calibration</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>30-Second Patient Baseline Calibration Loop</Text>
            </View>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isCalibrating
                  ? 'rgba(245, 158, 11, 0.14)'
                  : activeProfile.isCalibrated
                  ? 'rgba(16, 185, 129, 0.14)'
                  : colors.surfaceElevated,
                borderColor: isCalibrating
                  ? Colors.warning
                  : activeProfile.isCalibrated
                  ? Colors.success
                  : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: isCalibrating
                    ? Colors.warning
                    : activeProfile.isCalibrated
                    ? Colors.success
                    : colors.textMuted,
                },
              ]}
            >
              {isCalibrating
                ? 'CALIBRATING...'
                : activeProfile.isCalibrated
                ? 'CALIBRATED'
                : 'BASELINE'}
            </Text>
          </View>
        </View>

        {isCalibrating ? (
          <View style={[styles.calibratingActiveBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.calibrationCountdownRow}>
              <View>
                <Text style={[styles.countdownLabel, { color: colors.textMuted }]}>TIME REMAINING</Text>
                <Text style={[styles.countdownNumber, { color: colors.primary }]}>{calibrationCountdown}s</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.countdownLabel, { color: colors.textMuted }]}>KINETIC SAMPLES</Text>
                <Text style={[styles.pointsCapturedText, { color: colors.accent }]}>{calibrationPoints.length} points</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.calibProgressBarTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.calibProgressBarFill,
                  {
                    width: `${Math.max(4, calibrationProgress)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>

            <Text style={[styles.calibrationPromptText, { color: colors.textSecondary }]}>
              Write cursive loops or phrases on the Waveshare LCD with your smart pen. The AI is calculating your individual pinch variance and tremor baseline.
            </Text>

            <View style={styles.calibActionButtonsRow}>
              <SpringButton
                style={[styles.calibCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={cancelCalibration}
              >
                <Text style={[styles.calibCancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </SpringButton>

              <SpringButton
                style={[styles.calibFinishBtn, { backgroundColor: colors.primary }]}
                onPress={handleManualComplete}
              >
                <SparklesIcon size={14} color={colors.isDark ? '#080C14' : '#FFFFFF'} />
                <Text style={[styles.calibFinishBtnText, { color: colors.isDark ? '#080C14' : '#FFFFFF' }]}>Complete Early</Text>
              </SpringButton>
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={[styles.envelopeMetricsGrid, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.envelopeCol}>
                <Text style={[styles.envelopeLabel, { color: colors.textMuted }]}>SAFE PINCH ZONE</Text>
                <Text style={[styles.envelopeVal, { color: colors.success }]}>
                  {activeProfile.minSafePinchGrams} - {activeProfile.maxSafePinchGrams}g
                </Text>
              </View>
              <View style={styles.envelopeCol}>
                <Text style={[styles.envelopeLabel, { color: colors.textMuted }]}>TREMOR CEILING</Text>
                <Text style={[styles.envelopeVal, { color: colors.accent }]}>
                  &lt; {activeProfile.maxTremorCeilingHz} Hz
                </Text>
              </View>
              <View style={styles.envelopeCol}>
                <Text style={[styles.envelopeLabel, { color: colors.textMuted }]}>MOTOR STABILITY</Text>
                <Text style={[styles.envelopeVal, { color: colors.primary }]}>
                  {activeProfile.stabilityIndex}%
                </Text>
              </View>
              <View style={styles.envelopeCol}>
                <Text style={[styles.envelopeLabel, { color: colors.textMuted }]}>CLASSIFICATION</Text>
                <Text style={[styles.envelopeVal, { color: colors.textPrimary }]}>
                  {activeProfile.conditionIndicator.split(' ')[0]}
                </Text>
              </View>
            </View>

            <Text style={[styles.clinicalNoteText, { color: colors.textMuted }]}>
              {activeProfile.clinicalNotes}
            </Text>

            <View style={styles.calibBtnRow}>
              <SpringButton
                style={[styles.startCalibBtn, { backgroundColor: colors.primary }]}
                onPress={() => startCalibration()}
              >
                <SparklesIcon size={16} color={colors.isDark ? '#080C14' : '#FFFFFF'} />
                <Text style={[styles.startCalibBtnText, { color: colors.isDark ? '#080C14' : '#FFFFFF' }]}>
                  {activeProfile.isCalibrated ? 'Recalibrate 30s Baseline' : 'Start 30s Guided Calibration'}
                </Text>
              </SpringButton>

              {activeProfile.isCalibrated && (
                <SpringButton
                  style={[styles.resetCalibBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={resetToDefaultProfile}
                >
                  <RefreshIcon size={14} color={colors.textSecondary} />
                  <Text style={[styles.resetCalibBtnText, { color: colors.textSecondary }]}>Reset</Text>
                </SpringButton>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Simulator Toggle */}
      <SpringButton
        style={[
          styles.simToggleCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isSimulated && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        onPress={toggleSimulation}
      >
        <RefreshIcon size={18} color={isSimulated ? (colors.isDark ? '#080C14' : '#FFFFFF') : colors.primary} />
        <Text
          style={[
            styles.simToggleText,
            { color: colors.textPrimary },
            isSimulated && { color: colors.isDark ? '#080C14' : '#FFFFFF' },
          ]}
        >
          {isSimulated ? 'Stop Active Simulation' : 'Launch Offline Demo Simulation'}
        </Text>
      </SpringButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  hubMasterCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  radarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  radarWrapper: {
    width: 110,
    height: 110,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarBeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarNeedle: {
    width: 2,
    height: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.75)',
    position: 'absolute',
    top: 6,
    borderRadius: 1,
  },
  radarCenterDot: {
    position: 'absolute',
  },
  radarInfo: {
    flex: 1,
  },
  hubTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  hubSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  scanningText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  disconnectActionBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderWidth: 1,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080C14',
  },
  disconnectActionBtnText: {
    color: Colors.danger,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  deviceCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  deviceChip: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  batteryTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  batteryPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  specGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  specItem: {
    alignItems: 'center',
    flex: 1,
  },
  specLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  hapticTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 12,
  },
  hapticTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.warning,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  calibratingActiveBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  calibrationCountdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pointsCapturedText: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calibProgressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calibProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  calibrationPromptText: {
    fontSize: 11,
    lineHeight: 16,
  },
  calibActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  calibCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calibCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calibFinishBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibFinishBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  envelopeMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  envelopeCol: {
    width: '46%',
  },
  envelopeLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  envelopeVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  clinicalNoteText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  calibBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  startCalibBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startCalibBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  resetCalibBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetCalibBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  simToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.35)',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  simToggleCardActive: {
    backgroundColor: Colors.accent,
  },
  simToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent,
  },
  simToggleTextActive: {
    color: '#080C14',
  },
});
