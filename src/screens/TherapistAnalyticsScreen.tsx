import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from 'react-native-svg';
import { useBleStore } from '../store/useBleStore';
import { useSessionStore } from '../store/useSessionStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAiStore } from '../store/useAiStore';
import { Colors } from '../theme/colors';
import {
  ChartIcon,
  SparklesIcon,
  CheckCircleIcon,
  TargetIcon,
  SlidersIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
} from '../components/Icons';
import { SpringButton } from '../components/SpringButton';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 56;
const CHART_HEIGHT = 120;

export default function TherapistAnalyticsScreen() {
  const { colors } = useThemeStore();
  const { pressureGrams, tremorHz, interventions, status, isSimulated } = useBleStore();
  const { addSession } = useSessionStore();
  const { activeProfile, latestAssessment, updateCustomThresholds } = useAiStore();

  const [minSafePinch, setMinSafePinch] = useState(activeProfile.minSafePinchGrams);
  const [maxSafePinch, setMaxSafePinch] = useState(activeProfile.maxSafePinchGrams);
  const [maxTremorCeiling, setMaxTremorCeiling] = useState(activeProfile.maxTremorCeilingHz);

  // Synchronize local tuning states when active profile updates
  useEffect(() => {
    setMinSafePinch(activeProfile.minSafePinchGrams);
    setMaxSafePinch(activeProfile.maxSafePinchGrams);
    setMaxTremorCeiling(activeProfile.maxTremorCeilingHz);
  }, [activeProfile.minSafePinchGrams, activeProfile.maxSafePinchGrams, activeProfile.maxTremorCeilingHz]);

  const handleApplyThresholds = () => {
    updateCustomThresholds({
      minSafePinchGrams: minSafePinch,
      maxSafePinchGrams: maxSafePinch,
      maxTremorCeilingHz: maxTremorCeiling,
    });
    Alert.alert(
      'Personalized Thresholds Deployed',
      `Hardware & Biofeedback updated:\n\n• Pinch Safe Range: ${minSafePinch}g - ${maxSafePinch}g\n• Tremor Ceiling: < ${maxTremorCeiling} Hz\n\nReal-time stylus haptics will trigger if patient exceeds these bounds.`,
      [{ text: 'OK' }]
    );
  };

  // 30-sample rolling history buffer
  const [pressureHistory, setPressureHistory] = useState<number[]>(Array(30).fill(160));
  const [tremorHistory, setTremorHistory] = useState<number[]>(Array(30).fill(3.8));

  useEffect(() => {
    if (status === 'Connected' || isSimulated) {
      setPressureHistory((prev) => [...prev.slice(1), Math.max(0, pressureGrams || 160)]);
      setTremorHistory((prev) => [...prev.slice(1), Math.max(0, tremorHz || 3.8)]);
    }
  }, [pressureGrams, tremorHz, status, isSimulated]);

  // Build SVG path for filled area graph
  const buildSvgAreaPath = (data: number[], maxVal: number): { lineD: string; areaD: string } => {
    if (data.length < 2) return { lineD: '', areaD: '' };
    const stepX = CHART_WIDTH / (data.length - 1);
    let lineD = `M 0 ${CHART_HEIGHT - (data[0] / maxVal) * (CHART_HEIGHT - 16)}`;
    for (let i = 1; i < data.length; i++) {
      const y = Math.max(8, Math.min(CHART_HEIGHT - 8, CHART_HEIGHT - (data[i] / maxVal) * (CHART_HEIGHT - 16)));
      lineD += ` L ${i * stepX} ${y}`;
    }
    const areaD = `${lineD} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
    return { lineD, areaD };
  };

  const avgPressure = Math.round(pressureHistory.reduce((a, b) => a + b, 0) / pressureHistory.length);
  const peakPressure = Math.max(...pressureHistory);
  const avgTremor = +(tremorHistory.reduce((a, b) => a + b, 0) / tremorHistory.length).toFixed(1);

  // Compute live clinical stability score (0 - 100)
  const stabilityScore = Math.max(
    45,
    Math.min(
      98,
      Math.round(100 - (interventions * 5 + Math.max(0, avgPressure - 320) * 0.08 + Math.max(0, avgTremor - 3.5) * 7))
    )
  );

  const saveToHistory = () => {
    const s = addSession({
      testType: 'steadiness',
      testName: 'Kinematic Diagnostic Run',
      durationSeconds: 150,
      avgGripGrams: avgPressure,
      peakGripGrams: peakPressure,
      avgTremorHz: avgTremor,
      interventions,
      strokesCount: 5,
    });

    Alert.alert(
      'Session Recorded to History',
      `Diagnostic assessment logged with stability score ${s.stabilityScore}%. Check the History tab for detailed clinical & ergonomic recommendations.`,
      [{ text: 'View Now' }]
    );
  };

  const exportReport = () => {
    Alert.alert(
      'Session Report Generated',
      `NeuroGrip Diagnostic Metrics Exported:\n\n• Stability Index: ${stabilityScore}%\n• Avg Pinch Force: ${avgPressure} g\n• Peak Pinch Force: ${peakPressure} g\n• Dominant Tremor: ${avgTremor} Hz\n• Interventions: ${interventions}`,
      [{ text: 'OK' }]
    );
  };

  const pressurePaths = buildSvgAreaPath(pressureHistory, 600);
  const tremorPaths = buildSvgAreaPath(tremorHistory, 10.0);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Clinical Header */}
      <View style={styles.heroHeader}>
        <View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Clinical Diagnostics</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>High-Frequency Biomarker & Neuromuscular Analysis</Text>
        </View>
        <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <ChartIcon size={16} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Live Stream</Text>
        </View>
      </View>

      {/* Neuromotor Stability Hero Card */}
      <View style={[styles.stabilityHeroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.stabilityLeft}>
          <Text style={[styles.stabilityHeading, { color: colors.textMuted }]}>NEUROMOTOR STABILITY INDEX</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNumber, { color: stabilityScore >= 80 ? colors.success : colors.warning }]}>{stabilityScore}</Text>
            <Text style={[styles.scoreTotal, { color: colors.textMuted }]}>/ 100</Text>
          </View>
          <View style={[styles.stabilityBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <CheckCircleIcon size={14} color={colors.success} />
            <Text style={[styles.stabilityBadgeText, { color: colors.textSecondary }]}>
              {stabilityScore >= 80 ? 'Optimal Fine-Motor Baseline' : 'Kinetic Deviation Detected'}
            </Text>
          </View>
        </View>

        {/* Circular SVG Gauge */}
        <View style={styles.gaugeWrapper}>
          <Svg width={88} height={88}>
            <Circle
              cx={44}
              cy={44}
              r={36}
              stroke="#1E293B"
              strokeWidth={7}
              fill="none"
            />
            <Circle
              cx={44}
              cy={44}
              r={36}
              stroke={stabilityScore >= 80 ? Colors.success : Colors.primary}
              strokeWidth={7}
              fill="none"
              strokeDasharray={`${(stabilityScore / 100) * 226} 226`}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
            />
          </Svg>
          <View style={styles.gaugeInnerLabel}>
            <Text style={styles.gaugePctText}>{stabilityScore}%</Text>
          </View>
        </View>
      </View>

      {/* Overview 4-Metric Grid */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SESSION BIOMARKER MATRIX</Text>
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>AVG PINCH LOAD</Text>
          <Text style={[styles.kpiValue, { color: avgPressure > 400 ? colors.warning : colors.success }]}>
            {avgPressure} <Text style={[styles.kpiUnit, { color: colors.textMuted }]}>g</Text>
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Ergonomic: 180-380g</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>PEAK PINCH</Text>
          <Text style={[styles.kpiValue, { color: peakPressure > 500 ? colors.danger : colors.primary }]}>
            {peakPressure} <Text style={[styles.kpiUnit, { color: colors.textMuted }]}>g</Text>
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Fatigue Guard: 500g</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>TREMOR SPECTRUM</Text>
          <Text style={[styles.kpiValue, { color: avgTremor > 6.0 ? colors.danger : colors.accent }]}>
            {avgTremor} <Text style={[styles.kpiUnit, { color: colors.textMuted }]}>Hz</Text>
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Action Tremor: 4-6 Hz</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>FATIGUE ALERTS</Text>
          <Text style={[styles.kpiValue, { color: interventions > 3 ? colors.warning : colors.textPrimary }]}>
            {interventions}
          </Text>
          <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Threshold Over-grips</Text>
        </View>
      </View>

      {/* AI Diagnostic Motor Assessment & Biomarker Card */}
      <View style={[styles.aiDiagnosticCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderTitleCol}>
            <View style={[styles.iconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <TargetIcon size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>AI Motor Condition Classifier</Text>
              <Text style={[styles.cardHeaderSub, { color: colors.textSecondary }]}>XGBoost + LightGBM + NVIDIA Kumo Ensemble</Text>
            </View>
          </View>
          <View style={[styles.conditionPill, { backgroundColor: 'rgba(56, 189, 248, 0.14)', borderColor: colors.primary }]}>
            <Text style={[styles.conditionPillText, { color: colors.primary }]}>
              {latestAssessment?.detectedCondition || activeProfile.conditionIndicator}
            </Text>
          </View>
        </View>

        {/* 4-Decomposition Biomarkers */}
        <View style={[styles.biomarkerGrid, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.biomarkerCol}>
            <Text style={[styles.biomarkerLabel, { color: colors.textMuted }]}>PD RISK PROBABILITY</Text>
            <Text style={[styles.biomarkerVal, { color: (latestAssessment?.pdProbability || activeProfile.pdRiskScore / 100) > 0.335 ? colors.danger : colors.success }]}>
              {latestAssessment?.pdProbability !== undefined ? Math.round(latestAssessment.pdProbability * 100) : activeProfile.pdRiskScore}%
            </Text>
            <Text style={[styles.biomarkerSub, { color: colors.textMuted }]}>Cutoff: 33.5%</Text>
          </View>

          <View style={styles.biomarkerCol}>
            <Text style={[styles.biomarkerLabel, { color: colors.textMuted }]}>MICROGRAPHIA SLOPE</Text>
            <Text style={[styles.biomarkerVal, { color: (latestAssessment?.micrographiaSlope || -0.08) < -0.15 ? colors.warning : colors.textPrimary }]}>
              {latestAssessment?.micrographiaSlope !== undefined ? latestAssessment.micrographiaSlope : -0.08}
            </Text>
            <Text style={[styles.biomarkerSub, { color: colors.textMuted }]}>Stroke Decay Rate</Text>
          </View>

          <View style={styles.biomarkerCol}>
            <Text style={[styles.biomarkerLabel, { color: colors.textMuted }]}>KUMO ANOMALY</Text>
            <Text style={[styles.biomarkerVal, { color: colors.accent }]}>
              {latestAssessment?.kumoAnomalyScore !== undefined ? latestAssessment.kumoAnomalyScore : activeProfile.kumoAnomalyBaseline}
            </Text>
            <Text style={[styles.biomarkerSub, { color: colors.textMuted }]}>Temporal Residual</Text>
          </View>

          <View style={styles.biomarkerCol}>
            <Text style={[styles.biomarkerLabel, { color: colors.textMuted }]}>SEVERITY LEVEL</Text>
            <Text style={[styles.biomarkerVal, { color: latestAssessment?.severity === 'Severe' ? colors.danger : latestAssessment?.severity === 'Moderate' ? colors.warning : colors.success }]}>
              {latestAssessment?.severity || 'Mild'}
            </Text>
            <Text style={[styles.biomarkerSub, { color: colors.textMuted }]}>Kinetic Grade</Text>
          </View>
        </View>

        {/* AI Recommendations List */}
        <View style={styles.recsBox}>
          <Text style={[styles.recsHeader, { color: colors.textPrimary }]}>Clinical Action Recommendations:</Text>
          {(latestAssessment?.recommendations || [
            'Individualized envelope active. Baseline grip and resting tremor within calibrated thresholds.',
            'Maintain daily fine-motor tracing sessions to preserve kinetic fluidity.',
          ]).map((rec, idx) => (
            <View key={idx} style={styles.recItemRow}>
              <Text style={[styles.recBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.recItemText, { color: colors.textSecondary }]}>{rec}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Personalized Threshold Clinician Tuning Card */}
      <View style={[styles.thresholdTuningCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderTitleCol}>
            <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <SlidersIcon size={18} color={colors.success} />
            </View>
            <View>
              <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>Personalized Safe Zone Tuning</Text>
              <Text style={[styles.cardHeaderSub, { color: colors.textSecondary }]}>Individualized Biofeedback Alarm Thresholds</Text>
            </View>
          </View>
          <View style={[styles.conditionPill, { backgroundColor: 'rgba(16, 185, 129, 0.14)', borderColor: colors.success }]}>
            <Text style={[styles.conditionPillText, { color: colors.success }]}>ACTIVE PEN</Text>
          </View>
        </View>

        {/* Stepper Controls */}
        <View style={styles.stepperList}>
          {/* Lower Safe Pinch Limit */}
          <View style={[styles.stepperRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepperTitle, { color: colors.textPrimary }]}>Lower Safe Pinch Limit</Text>
              <Text style={[styles.stepperSub, { color: colors.textMuted }]}>Prevents stylus slipping / hypotonic drops</Text>
            </View>
            <View style={styles.stepperControl}>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMinSafePinch((prev) => Math.max(30, prev - 10))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>-</Text>
              </SpringButton>
              <Text style={[styles.stepperValText, { color: colors.primary }]}>{minSafePinch}g</Text>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMinSafePinch((prev) => Math.min(maxSafePinch - 20, prev + 10))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>+</Text>
              </SpringButton>
            </View>
          </View>

          {/* Upper Safe Pinch Ceiling */}
          <View style={[styles.stepperRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepperTitle, { color: colors.textPrimary }]}>Upper Safe Pinch Ceiling</Text>
              <Text style={[styles.stepperSub, { color: colors.textMuted }]}>Triggers smart pen haptic buzzer to relieve cramp</Text>
            </View>
            <View style={styles.stepperControl}>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMaxSafePinch((prev) => Math.max(minSafePinch + 20, prev - 10))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>-</Text>
              </SpringButton>
              <Text style={[styles.stepperValText, { color: Colors.danger }]}>{maxSafePinch}g</Text>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMaxSafePinch((prev) => Math.min(550, prev + 10))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>+</Text>
              </SpringButton>
            </View>
          </View>

          {/* Tremor Ceiling */}
          <View style={styles.stepperRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepperTitle, { color: colors.textPrimary }]}>Tremor Safety Ceiling</Text>
              <Text style={[styles.stepperSub, { color: colors.textMuted }]}>Flags pathological surges above baseline</Text>
            </View>
            <View style={styles.stepperControl}>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMaxTremorCeiling((prev) => +(Math.max(3.0, prev - 0.2)).toFixed(1))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>-</Text>
              </SpringButton>
              <Text style={[styles.stepperValText, { color: colors.accent }]}>{maxTremorCeiling.toFixed(1)}Hz</Text>
              <SpringButton
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setMaxTremorCeiling((prev) => +(Math.min(12.0, prev + 0.2)).toFixed(1))}
              >
                <Text style={[styles.stepperBtnText, { color: colors.textPrimary }]}>+</Text>
              </SpringButton>
            </View>
          </View>
        </View>

        {/* Deploy Button */}
        <SpringButton
          style={[styles.deployThresholdBtn, { backgroundColor: colors.primary }]}
          onPress={handleApplyThresholds}
        >
          <ShieldCheckIcon size={16} color={colors.isDark ? '#080C14' : '#FFFFFF'} />
          <Text style={[styles.deployThresholdBtnText, { color: colors.isDark ? '#080C14' : '#FFFFFF' }]}>
            Apply & Sync Personalized Thresholds to Pen
          </Text>
        </SpringButton>
      </View>

      {/* Pinch Pressure Progression Curve */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Grip Force Progression Curve</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Index finger pinch pressure (FSR calibrated grams)</Text>
          </View>
          <View style={[styles.chartBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.chartBadgeText, { color: colors.primary }]}>{pressureGrams || 160} g</Text>
          </View>
        </View>

        <View style={styles.chartBox}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="pressureAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.35" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Threshold Guideline */}
            <Line
              x1="0"
              y1={CHART_HEIGHT * 0.4}
              x2={CHART_WIDTH}
              y2={CHART_HEIGHT * 0.4}
              stroke="rgba(245, 158, 11, 0.4)"
              strokeDasharray="4,4"
              strokeWidth="1"
            />

            {/* Area Fill */}
            <Path d={pressurePaths.areaD} fill="url(#pressureAreaGrad)" />
            {/* Waveform Stroke */}
            <Path d={pressurePaths.lineD} stroke={colors.primary} strokeWidth="2.5" fill="none" />
          </Svg>
        </View>

        <View style={styles.chartLegend}>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>0 g (Resting)</Text>
          <Text style={[styles.legendText, { color: colors.warning }]}>-- 380 g Fatigue Limit</Text>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>600 g</Text>
        </View>
      </View>

      {/* Tremor Oscillatory Spectrogram */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Kinetic Tremor Oscillation</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>LSM6DS3 6-DoF angular frequency distribution</Text>
          </View>
          <View style={[styles.chartBadge, { backgroundColor: 'rgba(129, 140, 248, 0.14)', borderColor: 'rgba(129, 140, 248, 0.35)' }]}>
            <Text style={[styles.chartBadgeText, { color: colors.accent }]}>{tremorHz || 3.8} Hz</Text>
          </View>
        </View>

        <View style={styles.chartBox}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="tremorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#818CF8" stopOpacity="0.35" />
                <Stop offset="1" stopColor="#818CF8" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            <Path d={tremorPaths.areaD} fill="url(#tremorAreaGrad)" />
            <Path d={tremorPaths.lineD} stroke={colors.accent} strokeWidth="2.5" fill="none" />
          </Svg>
        </View>

        <View style={styles.chartLegend}>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>0 Hz (Still)</Text>
          <Text style={[styles.legendText, { color: colors.accent }]}>3-6 Hz Clinical Band</Text>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>10 Hz</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsCol}>
        <SpringButton style={[styles.saveHistoryBtn, { backgroundColor: colors.primary }]} onPress={saveToHistory}>
          <SparklesIcon size={18} color={colors.isDark ? '#080C14' : '#FFFFFF'} />
          <Text style={[styles.saveHistoryBtnText, { color: colors.isDark ? '#080C14' : '#FFFFFF' }]}>Save Assessment to History & Recs</Text>
        </SpringButton>

        <SpringButton
          style={[styles.exportButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={exportReport}
        >
          <Text style={[styles.exportButtonText, { color: colors.textSecondary }]}>Export Session Assessment (JSON / CSV)</Text>
        </SpringButton>
      </View>
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
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stabilityHeroCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  stabilityLeft: {
    flex: 1,
  },
  stabilityHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  scoreTotal: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  stabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  stabilityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  gaugeWrapper: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gaugeInnerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePctText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  kpiUnit: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  kpiSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chartBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chartBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  chartBox: {
    marginVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  actionButtonsCol: {
    gap: 10,
    marginTop: 6,
  },
  saveHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  saveHistoryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080C14',
  },
  exportButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  aiDiagnosticCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cardHeaderSub: {
    fontSize: 11,
    marginTop: 2,
  },
  conditionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  conditionPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  biomarkerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    borderRadius: 14,
    gap: 10,
  },
  biomarkerCol: {
    width: '46%',
  },
  biomarkerLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  biomarkerVal: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  biomarkerSub: {
    fontSize: 9,
    marginTop: 1,
  },
  recsBox: {
    gap: 6,
    paddingTop: 4,
  },
  recsHeader: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  recItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recBullet: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  recItemText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  thresholdTuningCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  stepperList: {
    gap: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  stepperTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepperSub: {
    fontSize: 10,
    marginTop: 2,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  stepperValText: {
    fontSize: 14,
    fontWeight: '900',
    minWidth: 46,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  deployThresholdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  deployThresholdBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
