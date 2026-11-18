import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Line,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { useBleStore } from '../store/useBleStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAiStore } from '../store/useAiStore';
import { Colors } from '../theme/colors';
import {
  TrashIcon,
  RefreshIcon,
  CanvasIcon,
  SparklesIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  TargetIcon,
} from '../components/Icons';
import { SpringButton } from '../components/SpringButton';
import { PulseDot } from '../components/PulseDot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);
const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH * (320.0 / 480.0)); // Exact 480x320 ratio

export default function LiveCanvasScreen() {
  const { colors } = useThemeStore();
  const {
    strokes,
    currentStroke,
    touchX,
    touchY,
    isTouched,
    pressureGrams,
    pressure,
    tremorHz,
    status,
    testMode,
    alphabetSet,
    isSimulated,
    clearStrokes,
    setTestMode,
    setAlphabetSet,
    toggleSimulation,
    triggerBuzzerHaptic,
  } = useBleStore();

  const {
    activeProfile,
    activeViolation,
    checkLiveTelemetry,
    evaluateSessionPoints,
  } = useAiStore();

  const isOnline = status === 'Connected' || isSimulated;
  const pinchGrams = pressureGrams || Math.round((pressure / 1023) * 600);
  const currentHz = tremorHz || (isOnline ? 3.8 : 0);

  // Real-time AI Threshold monitoring & Pen Haptic Trigger
  useEffect(() => {
    if (isOnline && (pinchGrams > 0 || currentHz > 0)) {
      checkLiveTelemetry(pinchGrams, currentHz, () => {
        triggerBuzzerHaptic().catch(() => {});
      });
    }
  }, [pinchGrams, currentHz, isOnline, checkLiveTelemetry, triggerBuzzerHaptic]);

  // Animated cursor pulsation
  const touchAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTouched) {
      Animated.sequence([
        Animated.timing(touchAnim, { toValue: 1.35, duration: 120, useNativeDriver: true }),
        Animated.timing(touchAnim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [isTouched, touchAnim]);

  // Coordinate mapping from 480x320 to canvas dimensions
  const scaleX = (x: number) => (x / 480.0) * CANVAS_WIDTH;
  const scaleY = (y: number) => (y / 320.0) * CANVAS_HEIGHT;

  // Personalized Pressure color gradient logic
  const getPressureColor = () => {
    if (pinchGrams > activeProfile.maxSafePinchGrams) return Colors.danger;
    if (pinchGrams < activeProfile.minSafePinchGrams && pinchGrams >= 25) return Colors.warning;
    return Colors.success;
  };

  // Build SVG path string from strokes
  const renderPath = (points: { x: number; y: number }[], key: string, isCurrent: boolean) => {
    if (points.length < 2) return null;
    let d = `M ${scaleX(points[0].x)} ${scaleY(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${scaleX(points[i].x)} ${scaleY(points[i].y)}`;
    }
    const inkStrokeColor = isCurrent ? colors.primary : colors.inkCyan;
    return (
      <Path
        key={key}
        d={d}
        stroke={inkStrokeColor}
        strokeWidth={isCurrent ? 3.4 : 2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={isCurrent ? 1 : 0.88}
      />
    );
  };

  // Clinical Alphabet Tracing Guidelines & Letter Paths
  const renderAlphabetGuide = () => {
    if (testMode !== 'alphabet') return null;

    const yAscender = scaleY(65);
    const yMidline = scaleY(135);
    const yBaseline = scaleY(205);
    const yDescender = scaleY(275);
    const guideLineColor = colors.isDark ? '#475569' : '#CBD5E1';
    const midLineColor = colors.primary;
    const baseLineColor = colors.isDark ? '#38BDF8' : '#0F172A';
    const letterColor = colors.isDark ? 'rgba(56, 189, 248, 0.42)' : 'rgba(2, 132, 199, 0.45)';

    let letterPaths: { d: string; id: string }[] = [];

    if (alphabetSet === 'upper') {
      // Uppercase A B C D E
      letterPaths = [
        // A
        {
          id: 'A',
          d: `M ${scaleX(35)} ${scaleY(205)} L ${scaleX(65)} ${scaleY(65)} L ${scaleX(95)} ${scaleY(205)} M ${scaleX(50)} ${scaleY(150)} L ${scaleX(80)} ${scaleY(150)}`,
        },
        // B
        {
          id: 'B',
          d: `M ${scaleX(125)} ${scaleY(205)} L ${scaleX(125)} ${scaleY(65)} M ${scaleX(125)} ${scaleY(65)} C ${scaleX(170)} ${scaleY(65)}, ${scaleX(170)} ${scaleY(135)}, ${scaleX(125)} ${scaleY(135)} C ${scaleX(175)} ${scaleY(135)}, ${scaleX(175)} ${scaleY(205)}, ${scaleX(125)} ${scaleY(205)}`,
        },
        // C
        {
          id: 'C',
          d: `M ${scaleX(265)} ${scaleY(95)} C ${scaleX(250)} ${scaleY(65)}, ${scaleX(205)} ${scaleY(65)}, ${scaleX(205)} ${scaleY(135)} C ${scaleX(205)} ${scaleY(205)}, ${scaleX(250)} ${scaleY(205)}, ${scaleX(265)} ${scaleY(175)}`,
        },
        // D
        {
          id: 'D',
          d: `M ${scaleX(295)} ${scaleY(205)} L ${scaleX(295)} ${scaleY(65)} M ${scaleX(295)} ${scaleY(65)} C ${scaleX(355)} ${scaleY(65)}, ${scaleX(355)} ${scaleY(205)}, ${scaleX(295)} ${scaleY(205)}`,
        },
        // E
        {
          id: 'E',
          d: `M ${scaleX(380)} ${scaleY(205)} L ${scaleX(380)} ${scaleY(65)} L ${scaleX(425)} ${scaleY(65)} M ${scaleX(380)} ${scaleY(135)} L ${scaleX(415)} ${scaleY(135)} M ${scaleX(380)} ${scaleY(205)} L ${scaleX(425)} ${scaleY(205)}`,
        },
      ];
    } else if (alphabetSet === 'lower') {
      // Lowercase a b c d e
      letterPaths = [
        // a
        {
          id: 'a',
          d: `M ${scaleX(85)} ${scaleY(150)} C ${scaleX(80)} ${scaleY(135)}, ${scaleX(50)} ${scaleY(135)}, ${scaleX(50)} ${scaleY(170)} C ${scaleX(50)} ${scaleY(205)}, ${scaleX(80)} ${scaleY(205)}, ${scaleX(85)} ${scaleY(190)} M ${scaleX(85)} ${scaleY(135)} L ${scaleX(85)} ${scaleY(205)}`,
        },
        // b
        {
          id: 'b',
          d: `M ${scaleX(130)} ${scaleY(65)} L ${scaleX(130)} ${scaleY(205)} M ${scaleX(130)} ${scaleY(150)} C ${scaleX(135)} ${scaleY(135)}, ${scaleX(175)} ${scaleY(135)}, ${scaleX(175)} ${scaleY(170)} C ${scaleX(175)} ${scaleY(205)}, ${scaleX(135)} ${scaleY(205)}, ${scaleX(130)} ${scaleY(190)}`,
        },
        // c
        {
          id: 'c',
          d: `M ${scaleX(255)} ${scaleY(155)} C ${scaleX(245)} ${scaleY(135)}, ${scaleX(215)} ${scaleY(135)}, ${scaleX(215)} ${scaleY(170)} C ${scaleX(215)} ${scaleY(205)}, ${scaleX(245)} ${scaleY(205)}, ${scaleX(255)} ${scaleY(185)}`,
        },
        // d
        {
          id: 'd',
          d: `M ${scaleX(345)} ${scaleY(65)} L ${scaleX(345)} ${scaleY(205)} M ${scaleX(345)} ${scaleY(190)} C ${scaleX(340)} ${scaleY(205)}, ${scaleX(305)} ${scaleY(205)}, ${scaleX(305)} ${scaleY(170)} C ${scaleX(305)} ${scaleY(135)}, ${scaleX(340)} ${scaleY(135)}, ${scaleX(345)} ${scaleY(150)}`,
        },
        // e
        {
          id: 'e',
          d: `M ${scaleX(390)} ${scaleY(170)} L ${scaleX(435)} ${scaleY(170)} C ${scaleX(435)} ${scaleY(135)}, ${scaleX(390)} ${scaleY(135)}, ${scaleX(390)} ${scaleY(170)} C ${scaleX(390)} ${scaleY(205)}, ${scaleX(430)} ${scaleY(205)}, ${scaleX(440)} ${scaleY(190)}`,
        },
      ];
    } else {
      // NEURO
      letterPaths = [
        // N
        {
          id: 'N',
          d: `M ${scaleX(45)} ${scaleY(205)} L ${scaleX(45)} ${scaleY(65)} L ${scaleX(95)} ${scaleY(205)} L ${scaleX(95)} ${scaleY(65)}`,
        },
        // E
        {
          id: 'E',
          d: `M ${scaleX(130)} ${scaleY(205)} L ${scaleX(130)} ${scaleY(65)} L ${scaleX(175)} ${scaleY(65)} M ${scaleX(130)} ${scaleY(135)} L ${scaleX(165)} ${scaleY(135)} M ${scaleX(130)} ${scaleY(205)} L ${scaleX(175)} ${scaleY(205)}`,
        },
        // U
        {
          id: 'U',
          d: `M ${scaleX(210)} ${scaleY(65)} L ${scaleX(210)} ${scaleY(175)} C ${scaleX(210)} ${scaleY(205)}, ${scaleX(265)} ${scaleY(205)}, ${scaleX(265)} ${scaleY(175)} L ${scaleX(265)} ${scaleY(65)}`,
        },
        // R
        {
          id: 'R',
          d: `M ${scaleX(300)} ${scaleY(205)} L ${scaleX(300)} ${scaleY(65)} M ${scaleX(300)} ${scaleY(65)} C ${scaleX(345)} ${scaleY(65)}, ${scaleX(345)} ${scaleY(135)}, ${scaleX(300)} ${scaleY(135)} L ${scaleX(345)} ${scaleY(205)}`,
        },
        // O
        {
          id: 'O',
          d: `M ${scaleX(415)} ${scaleY(65)} C ${scaleX(375)} ${scaleY(65)}, ${scaleX(375)} ${scaleY(205)}, ${scaleX(415)} ${scaleY(205)} C ${scaleX(455)} ${scaleY(205)}, ${scaleX(455)} ${scaleY(65)}, ${scaleX(415)} ${scaleY(65)}`,
        },
      ];
    }

    return (
      <G key="alphabet-guide-layer">
        {/* 4 Clinical Handwriting Guidelines */}
        <Line x1="10" y1={yAscender} x2={CANVAS_WIDTH - 10} y2={yAscender} stroke={guideLineColor} strokeWidth="1" strokeDasharray="4,4" />
        <Line x1="10" y1={yMidline} x2={CANVAS_WIDTH - 10} y2={yMidline} stroke={midLineColor} strokeWidth="1.2" strokeDasharray="6,4" />
        <Line x1="10" y1={yBaseline} x2={CANVAS_WIDTH - 10} y2={yBaseline} stroke={baseLineColor} strokeWidth="1.8" />
        <Line x1="10" y1={yDescender} x2={CANVAS_WIDTH - 10} y2={yDescender} stroke={guideLineColor} strokeWidth="1" strokeDasharray="4,4" />

        {/* Tracing Alphabet Paths */}
        {letterPaths.map((lp) => (
          <Path
            key={lp.id}
            d={lp.d}
            stroke={letterColor}
            strokeWidth="2.8"
            strokeDasharray="7,5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </G>
    );
  };

  return (
    <ScrollView style={[styles.scrollContainer, { backgroundColor: colors.bg }]} contentContainerStyle={styles.container}>
      {/* Top Glassmorphic Navigation Bar */}
      <View style={styles.heroHeader}>
        <View>
          <View style={styles.brandRow}>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>NEUROGRIP</Text>
            <View style={[styles.proBadge, { backgroundColor: colors.isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.1)', borderColor: colors.border }]}>
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>AI ENVELOPE</Text>
            </View>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Adaptive Neuromuscular Biofeedback Mirror</Text>
        </View>

        {/* Live Status Pill */}
        <View style={[styles.statusPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <PulseDot
            color={isSimulated ? '#A855F7' : isOnline ? colors.success : colors.warning}
            size={7}
            isPulsing={isOnline}
          />
          <Text style={[styles.statusPillText, { color: colors.textMuted }]}>
            {isSimulated ? 'Simulated Pad' : isOnline ? 'Hardware Synced' : 'Standby'}
          </Text>
        </View>
      </View>

      {/* Real-time AI Personalized Threshold Alert Banner */}
      {activeViolation && (
        <View
          style={[
            styles.aiAlertBanner,
            {
              backgroundColor:
                activeViolation.type === 'HIGH_PINCH'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : activeViolation.type === 'EXCESSIVE_TREMOR'
                  ? 'rgba(244, 63, 94, 0.12)'
                  : 'rgba(245, 158, 11, 0.12)',
              borderColor:
                activeViolation.type === 'HIGH_PINCH'
                  ? Colors.danger
                  : activeViolation.type === 'EXCESSIVE_TREMOR'
                  ? '#F43F5E'
                  : Colors.warning,
            },
          ]}
        >
          <AlertTriangleIcon
            size={18}
            color={
              activeViolation.type === 'HIGH_PINCH'
                ? Colors.danger
                : activeViolation.type === 'EXCESSIVE_TREMOR'
                ? '#F43F5E'
                : Colors.warning
            }
          />
          <View style={styles.aiAlertTextCol}>
            <Text
              style={[
                styles.aiAlertTitle,
                {
                  color:
                    activeViolation.type === 'HIGH_PINCH'
                      ? Colors.danger
                      : activeViolation.type === 'EXCESSIVE_TREMOR'
                      ? '#F43F5E'
                      : Colors.warning,
                },
              ]}
            >
              {activeViolation.type === 'HIGH_PINCH'
                ? 'PERSONAL PINCH CEILING EXCEEDED'
                : activeViolation.type === 'EXCESSIVE_TREMOR'
                ? 'KINETIC TREMOR SURGE DETECTED'
                : 'GRIP INSTABILITY ALERT'}
            </Text>
            <Text style={[styles.aiAlertSubtitle, { color: colors.textSecondary }]}>
              {activeViolation.message}
            </Text>
          </View>
        </View>
      )}

      {/* Biometric Telemetry Matrix Card with Personalized Bounds */}
      <View style={[styles.telemetryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Pinch Pressure Gauge */}
        <View style={styles.telemetryCol}>
          <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>PINCH LOAD</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.telemetryValue, { color: getPressureColor() }]}>
              {pinchGrams}
            </Text>
            <Text style={[styles.telemetryUnit, { color: colors.textMuted }]}>g</Text>
          </View>
          <View style={[styles.microMeterTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.microMeterFill,
                {
                  width: `${Math.min(100, (pinchGrams / 600) * 100)}%`,
                  backgroundColor: getPressureColor(),
                },
              ]}
            />
          </View>
          <Text style={[styles.envelopeSubtext, { color: colors.textMuted }]}>
            Safe: {activeProfile.minSafePinchGrams}-{activeProfile.maxSafePinchGrams}g
          </Text>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        {/* Tremor Frequency */}
        <View style={styles.telemetryCol}>
          <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>TREMOR SPECTRUM</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.telemetryValue, { color: currentHz > activeProfile.maxTremorCeilingHz ? colors.danger : colors.primary }]}>
              {currentHz.toFixed(1)}
            </Text>
            <Text style={[styles.telemetryUnit, { color: colors.textMuted }]}>Hz</Text>
          </View>
          <Text style={[styles.envelopeSubtext, { color: currentHz > activeProfile.maxTremorCeilingHz ? colors.danger : colors.textMuted }]}>
            Ceiling: &lt; {activeProfile.maxTremorCeilingHz} Hz
          </Text>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        {/* Contact Nib State */}
        <View style={styles.telemetryCol}>
          <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>STYLUS TIP</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.contactStateText, { color: isTouched ? colors.primary : colors.textMuted }]}>
              {isTouched ? 'INKING' : 'HOVER'}
            </Text>
          </View>
          <Text style={[styles.envelopeSubtext, { color: colors.textMuted }]}>
            {activeProfile.conditionIndicator.split(' ')[0]}
          </Text>
        </View>
      </View>

      {/* Personalized Patient Profile Strip */}
      <View style={[styles.aiProfileStrip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <ShieldCheckIcon size={14} color={activeProfile.isCalibrated ? colors.success : colors.primary} />
        <Text style={[styles.aiProfileStripText, { color: colors.textSecondary }]}>
          {activeProfile.isCalibrated
            ? `Calibrated for ${activeProfile.patientId} • Bounds [${activeProfile.minSafePinchGrams}-${activeProfile.maxSafePinchGrams}g] • Stability ${activeProfile.stabilityIndex}%`
            : `Population Baseline Active • Run 30s calibration in Hub to personalize`}
        </Text>
      </View>

      {/* Drafting Tablet Frame */}
      <View style={[styles.padBezel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Top Header of Tablet */}
        <View style={[styles.padBezelHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.bezelDotsRow}>
            <View style={[styles.hardwareLed, { backgroundColor: isOnline ? '#10B981' : '#F59E0B' }]} />
            <Text style={[styles.bezelModelText, { color: colors.textSecondary }]}>480 × 320 CAPACITIVE DIGITIZER</Text>
          </View>
          <View style={[styles.samplingPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.samplingText, { color: colors.primary }]}>100 Hz SPI</Text>
          </View>
        </View>

        {/* Precision Drafting Surface */}
        <View style={[styles.canvasSurface, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: colors.canvasBg, borderColor: colors.border }]}>
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
            {/* Base drafting background */}
            <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={colors.canvasBg} rx={12} />

            {/* Grid pattern lines */}
            {Array.from({ length: 8 }).map((_, i) => (
              <Line
                key={`h-${i}`}
                x1="0"
                y1={(CANVAS_HEIGHT / 8) * i}
                x2={CANVAS_WIDTH}
                y2={(CANVAS_HEIGHT / 8) * i}
                stroke={colors.gridLine}
                strokeWidth="0.8"
              />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <Line
                key={`v-${i}`}
                x1={(CANVAS_WIDTH / 12) * i}
                y1="0"
                x2={(CANVAS_WIDTH / 12) * i}
                y2={CANVAS_HEIGHT}
                stroke={colors.gridLine}
                strokeWidth="0.8"
              />
            ))}

            {/* Corner Alignment Ticks */}
            <Line x1="10" y1="10" x2="24" y2="10" stroke={colors.gridCross} strokeWidth="1.5" />
            <Line x1="10" y1="10" x2="10" y2="24" stroke={colors.gridCross} strokeWidth="1.5" />

            <Line x1={CANVAS_WIDTH - 10} y1="10" x2={CANVAS_WIDTH - 24} y2="10" stroke={colors.gridCross} strokeWidth="1.5" />
            <Line x1={CANVAS_WIDTH - 10} y1="10" x2={CANVAS_WIDTH - 10} y2="24" stroke={colors.gridCross} strokeWidth="1.5" />

            <Line x1="10" y1={CANVAS_HEIGHT - 10} x2="24" y2={CANVAS_HEIGHT - 10} stroke={colors.gridCross} strokeWidth="1.5" />
            <Line x1="10" y1={CANVAS_HEIGHT - 10} x2="10" y2={CANVAS_HEIGHT - 24} stroke={colors.gridCross} strokeWidth="1.5" />

            <Line x1={CANVAS_WIDTH - 10} y1={CANVAS_HEIGHT - 10} x2={CANVAS_WIDTH - 24} y2={CANVAS_HEIGHT - 10} stroke={colors.gridCross} strokeWidth="1.5" />
            <Line x1={CANVAS_WIDTH - 10} y1={CANVAS_HEIGHT - 10} x2={CANVAS_WIDTH - 10} y2={CANVAS_HEIGHT - 24} stroke={colors.gridCross} strokeWidth="1.5" />

            {/* Clinical Alphabet Tracing Template */}
            {renderAlphabetGuide()}

            {/* Completed Inking Strokes */}
            {strokes.map((stroke, idx) => renderPath(stroke, `strk-${idx}`, false))}

            {/* Active Drawing Stroke */}
            {currentStroke && renderPath(currentStroke, 'strk-active', true)}

            {/* Stylus Target Crosshairs */}
            {isTouched && (
              <G>
                <Line
                  x1={scaleX(touchX) - 18}
                  y1={scaleY(touchY)}
                  x2={scaleX(touchX) + 18}
                  y2={scaleY(touchY)}
                  stroke={colors.primary}
                  strokeWidth="1"
                  opacity={0.5}
                />
                <Line
                  x1={scaleX(touchX)}
                  y1={scaleY(touchY) - 18}
                  x2={scaleX(touchX)}
                  y2={scaleY(touchY) + 18}
                  stroke={colors.primary}
                  strokeWidth="1"
                  opacity={0.5}
                />
                <Circle
                  cx={scaleX(touchX)}
                  cy={scaleY(touchY)}
                  r={12}
                  fill={colors.primaryGlow}
                />
                <Circle
                  cx={scaleX(touchX)}
                  cy={scaleY(touchY)}
                  r={3.8}
                  fill={colors.primary}
                />
              </G>
            )}
          </Svg>

          {/* Empty Prompt Overlay */}
          {strokes.length === 0 && !currentStroke && (
            <View style={styles.canvasEmptyHint} pointerEvents="none">
              <CanvasIcon color={colors.isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.3)'} size={32} />
              <Text style={[styles.emptyHintText, { color: colors.textMuted }]}>
                {testMode === 'alphabet'
                  ? 'Trace the alphabet guidelines with your smart pen on the pad'
                  : 'Write or draw with the smart pen on the pad'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Interactive Mode & Action Bar */}
      <View style={[styles.actionDeck, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Test Mode Switcher */}
        <View style={[styles.segmentedModeBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <SpringButton
            style={[
              styles.modeSegment,
              testMode === 'free' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setTestMode('free')}
          >
            <Text style={[styles.modeSegmentText, { color: testMode === 'free' ? (colors.isDark ? '#080C14' : '#FFFFFF') : colors.textSecondary }]}>
              Freehand Inking
            </Text>
          </SpringButton>

          <SpringButton
            style={[
              styles.modeSegment,
              testMode === 'alphabet' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setTestMode('alphabet')}
          >
            <Text style={[styles.modeSegmentText, { color: testMode === 'alphabet' ? (colors.isDark ? '#080C14' : '#FFFFFF') : colors.textSecondary }]}>
              Alphabet Tracing
            </Text>
          </SpringButton>
        </View>

        {/* Letter Set Sub-Selector (when in Alphabet Mode) */}
        {testMode === 'alphabet' && (
          <View style={styles.alphabetSetRow}>
            {(
              [
                { key: 'upper', label: 'A B C D E' },
                { key: 'lower', label: 'a b c d e' },
                { key: 'neuro', label: 'N E U R O' },
              ] as const
            ).map((set) => (
              <SpringButton
                key={set.key}
                style={[
                  styles.alphabetChip,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  alphabetSet === set.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setAlphabetSet(set.key)}
              >
                <Text
                  style={[
                    styles.alphabetChipText,
                    { color: alphabetSet === set.key ? (colors.isDark ? '#080C14' : '#FFFFFF') : colors.textSecondary },
                  ]}
                >
                  {set.label}
                </Text>
              </SpringButton>
            ))}
          </View>
        )}

        {/* Control Buttons */}
        <View style={styles.buttonRow}>
          <SpringButton style={[styles.clearBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={clearStrokes}>
            <TrashIcon color={colors.textSecondary} size={16} />
            <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear Pad</Text>
          </SpringButton>

          <SpringButton
            style={[
              styles.simBtn,
              { backgroundColor: isSimulated ? colors.accent : colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={toggleSimulation}
          >
            <RefreshIcon color={isSimulated ? '#080C14' : colors.accent} size={16} />
            <Text style={[styles.simBtnText, { color: isSimulated ? '#080C14' : colors.accent }]}>
              {isSimulated ? 'Stop Demo' : 'Simulate Input'}
            </Text>
          </SpringButton>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 14,
  },
  heroHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 1.2,
  },
  proBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  aiAlertBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiAlertTextCol: {
    flex: 1,
  },
  aiAlertTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  aiAlertSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  aiProfileStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  aiProfileStripText: {
    fontSize: 11,
    fontWeight: '600',
  },
  telemetryCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  telemetryCol: {
    alignItems: 'center',
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  telemetryUnit: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  microMeterTrack: {
    width: '80%',
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
  },
  microMeterFill: {
    height: '100%',
    borderRadius: 2,
  },
  subtextPill: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  envelopeSubtext: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  contactStateText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  coordsMiniText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  cardDivider: {
    width: 1,
    height: 38,
    backgroundColor: Colors.border,
  },
  padBezel: {
    width: CANVAS_WIDTH + 14,
    backgroundColor: '#0D1527',
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
    borderRadius: 18,
    padding: 7,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  padBezelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    paddingBottom: 6,
    paddingTop: 2,
  },
  bezelDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hardwareLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bezelModelText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  samplingPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  samplingText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  canvasSurface: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#02040A',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
  },
  canvasEmptyHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 30,
  },
  emptyHintText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionDeck: {
    width: '100%',
    gap: 10,
  },
  segmentedModeBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  alphabetSetRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 2,
  },
  alphabetChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    alignItems: 'center',
  },
  alphabetChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.primary,
  },
  alphabetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  alphabetChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  modeSegment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeSegmentActive: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
  },
  modeSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modeSegmentTextActive: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  simBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.35)',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  simBtnActive: {
    backgroundColor: Colors.accent,
  },
  simBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent,
  },
  simBtnTextActive: {
    color: '#080C14',
  },
});
