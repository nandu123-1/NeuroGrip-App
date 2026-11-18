import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useBleStore } from '../store/useBleStore';
import { useThemeStore } from '../store/useThemeStore';
import { Colors } from '../theme/colors';
import SkyGliderGame from '../components/SkyGliderGame';
import ZenKoiGame from '../components/ZenKoiGame';
import DualSyncForgeGame from '../components/DualSyncForgeGame';
import {
  PlaneIcon,
  LotusIcon,
  GamepadIcon,
  SparklesIcon,
  CheckCircleIcon,
  LightbulbIcon,
  InfoIcon,
} from '../components/Icons';
import { SpringButton } from '../components/SpringButton';
import { PulseDot } from '../components/PulseDot';

const { width } = Dimensions.get('window');

type ActiveTab = 'glider' | 'koi' | 'forge' | 'coach';

// Isolated, memoized Bio Coach tab so high-frequency sensor updates don't re-render games
const BioCoachTab = React.memo(function BioCoachTab({ stars }: { stars: number }) {
  const { pressure, tremor, status, interventions, pressureGrams } = useBleStore();
  const { colors } = useThemeStore();
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );
    breathingLoop.start();
    return () => breathingLoop.stop();
  }, [pulseAnim]);

  let message = 'Optimal Motor Balance';
  let subMessage = 'Smooth neuromuscular control with gentle finger flexor tension.';
  let themeColor = colors.success;
  let glowColor = colors.isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.15)';
  let iconComponent = <SparklesIcon size={48} color={themeColor} />;

  if (status !== 'Connected') {
    message = 'Connect Smart Pen';
    subMessage = 'Power on the smart pen and writing pad to initiate live biofeedback.';
    themeColor = colors.textMuted;
    glowColor = colors.isDark ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.15)';
    iconComponent = <LightbulbIcon size={48} color={themeColor} />;
  } else if (pressure > 700) {
    message = 'Relax Pinch Grip';
    subMessage = 'Finger pinch load exceeds 700g. Lighten your grip to avoid flexor spasm.';
    themeColor = colors.warning;
    glowColor = colors.isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(217, 119, 6, 0.15)';
    iconComponent = <LightbulbIcon size={48} color={themeColor} />;
  } else if (tremor > 6000) {
    message = 'Harmonic Diaphragm Breathing';
    subMessage = 'Inhale and exhale in rhythm with the glowing orb to anchor kinetic tremor.';
    themeColor = colors.primary;
    glowColor = colors.isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.15)';
    iconComponent = <CheckCircleIcon size={48} color={themeColor} />;
  }

  const isOnline = status === 'Connected';
  const pinchGrams = pressureGrams || Math.round((pressure / 1023) * 600);

  return (
    <View style={[styles.coachContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header Trophy Bar */}
      <View style={styles.topScoreBar}>
        <View style={[styles.scorePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <SparklesIcon size={16} color="#F59E0B" />
          <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{stars} Stars Earned</Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Biofeedback Alerts:</Text>
          <Text
            style={[
              styles.scoreValue,
              { color: interventions > 3 ? colors.warning : colors.textPrimary },
            ]}
          >
            {interventions}
          </Text>
        </View>
      </View>

      {/* Interactive Multi-layered Biofeedback Orb */}
      <View style={styles.orbContainer}>
        <Animated.View
          style={[
            styles.outerAura,
            {
              backgroundColor: glowColor,
              borderColor: themeColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={[styles.middleAura, { borderColor: themeColor }]}>
            <View style={[styles.innerCore, { borderColor: themeColor, backgroundColor: colors.cardBg }]}>
              {iconComponent}
            </View>
          </View>
        </Animated.View>

        <Text style={[styles.headlineMessage, { color: themeColor }]}>{message}</Text>
        <Text style={[styles.subtextGuidance, { color: colors.textSecondary }]}>{subMessage}</Text>
      </View>

      {/* Bottom Therapeutic Level Card */}
      <View style={[styles.statsCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.statCol}>
          <Text style={[styles.statHeading, { color: colors.textMuted }]}>PINCH FORCE</Text>
          <Text
            style={[
              styles.statNumber,
              { color: pressure > 700 ? colors.warning : colors.success },
            ]}
          >
            {pinchGrams}
            <Text style={styles.statUnit}> g</Text>
          </Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>
            {pressure > 700 ? 'Excessive Force' : 'Optimal Calibrated'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.statCol}>
          <Text style={[styles.statHeading, { color: colors.textMuted }]}>STEADINESS</Text>
          <Text
            style={[
              styles.statNumber,
              { color: tremor > 6000 ? colors.danger : colors.primary },
            ]}
          >
            {tremor > 6000 ? 'Kinetic Spikes' : 'Smooth Flow'}
          </Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>Movement Quality</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.statCol}>
          <Text style={[styles.statHeading, { color: colors.textMuted }]}>HARDWARE</Text>
          <Text style={[styles.statNumber, { color: colors.primary }]}>
            {isOnline ? 'Online' : 'Standby'}
          </Text>
          <Text style={[styles.statCaption, { color: colors.textMuted }]}>Smart Pad & Pen</Text>
        </View>
      </View>
    </View>
  );
});

export default function GamifiedViewScreen() {
  const status = useBleStore((s) => s.status);
  const { colors } = useThemeStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('glider');
  const [stars] = useState(18);
  const [showMasterGuide, setShowMasterGuide] = useState(false);

  const isOnline = status === 'Connected';

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Top Header & Segmented Game Switcher */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Therapeutic Play Field</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Kinetic Tremor & Fine-Motor Grip Training
            </Text>
          </View>

          <View style={styles.headerActions}>
            <SpringButton
              style={[styles.masterGuideBtn, { backgroundColor: colors.isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.1)', borderColor: colors.border }]}
              onPress={() => setShowMasterGuide(true)}
            >
              <InfoIcon size={14} color={colors.primary} />
              <Text style={[styles.masterGuideBtnText, { color: colors.primary }]}>How to Play</Text>
            </SpringButton>

            <View style={[styles.syncPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <PulseDot color={isOnline ? colors.success : colors.warning} size={6} isPulsing={isOnline} />
              <Text style={[styles.syncText, { color: colors.textMuted }]}>
                {isOnline ? 'Synced' : 'Touch'}
              </Text>
            </View>
          </View>
        </View>

        {/* 4-Way Segmented Tabs with Spring Interactions */}
        <View style={[styles.segmentedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SpringButton
            style={[styles.segmentBtn, activeTab === 'glider' && styles.segmentBtnActiveGlider]}
            onPress={() => setActiveTab('glider')}
          >
            <PlaneIcon size={14} color={activeTab === 'glider' ? '#080C14' : colors.primary} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'glider' ? '#080C14' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Glider
            </Text>
          </SpringButton>

          <SpringButton
            style={[styles.segmentBtn, activeTab === 'koi' && styles.segmentBtnActiveKoi]}
            onPress={() => setActiveTab('koi')}
          >
            <LotusIcon size={14} color={activeTab === 'koi' ? '#080C14' : '#10B981'} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'koi' ? '#080C14' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Zen Koi
            </Text>
          </SpringButton>

          <SpringButton
            style={[styles.segmentBtn, activeTab === 'forge' && styles.segmentBtnActiveForge]}
            onPress={() => setActiveTab('forge')}
          >
            <GamepadIcon size={14} color={activeTab === 'forge' ? '#080C14' : '#F59E0B'} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'forge' ? '#080C14' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Dual Forge
            </Text>
          </SpringButton>

          <SpringButton
            style={[styles.segmentBtn, activeTab === 'coach' && styles.segmentBtnActiveCoach]}
            onPress={() => setActiveTab('coach')}
          >
            <LightbulbIcon size={14} color={activeTab === 'coach' ? '#080C14' : colors.accent} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'coach' ? '#080C14' : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Coach
            </Text>
          </SpringButton>
        </View>
      </View>

      {/* Render Active Game */}
      {activeTab === 'glider' && <SkyGliderGame />}

      {activeTab === 'koi' && <ZenKoiGame />}

      {activeTab === 'forge' && <DualSyncForgeGame />}

      {activeTab === 'coach' && <BioCoachTab stars={stars} />}

      {/* Comprehensive How to Play Guide Modal */}
      <Modal
        visible={showMasterGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMasterGuide(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.masterGuideModalScroll}>
            <View style={[styles.masterGuideModalCard, { backgroundColor: colors.surface, borderColor: colors.borderHighlight }]}>
              <View style={styles.masterGuideHeader}>
                <Text style={[styles.masterGuideTitle, { color: colors.textPrimary }]}>Game Field Manual & Rules</Text>
                <Text style={[styles.masterGuideSubtitle, { color: colors.textSecondary }]}>Neuromotor & Fine-Motor Training Guide</Text>
              </View>

              {/* Game 1: Dual Sync Forge */}
              <View style={[styles.gameManualCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.manualCardHeader}>
                  <View style={[styles.manualIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <GamepadIcon size={22} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.manualCardTitle, { color: colors.textPrimary }]}>Dual Sync Forge (Grip + Tremor)</Text>
                    <Text style={styles.manualCardTag}>Combined Dual Neuromotor Challenge</Text>
                  </View>
                </View>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Goal:</Text> Synthesize 5 Quantum Crystals by maintaining both hand stillness and pinch pressure.
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Tremor Control:</Text> Keep your containment crosshair centered over the orbiting core (&lt;4.2 Hz).
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Grip Calibration:</Text> Match the shifting target pinch force (180-320g, 340-520g, or 530-680g).
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Dual Sync:</Text> When both conditions are met, plasma lightning sparks and the crystal charges!
                </Text>
              </View>

              {/* Game 2: Zen Koi Pond */}
              <View style={[styles.gameManualCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.manualCardHeader}>
                  <View style={[styles.manualIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <LotusIcon size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.manualCardTitle, { color: colors.textPrimary }]}>Zen Koi Pond (Tremor Steadiness)</Text>
                    <Text style={styles.manualCardTag}>Kinetic Oscillation Hold & Calmness</Text>
                  </View>
                </View>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Goal:</Text> Bloom all 6 water lilies in sequence.
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Steadiness:</Text> Hold pen tip inside the active ring with low tremor (&lt;4.6 Hz) to charge the bloom.
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Bloom Pinch:</Text> When full green, gently pinch (180-450g) to open the flower!
                </Text>
              </View>

              {/* Game 3: Sky Glider */}
              <View style={[styles.gameManualCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.manualCardHeader}>
                  <View style={[styles.manualIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                    <PlaneIcon size={22} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.manualCardTitle, { color: colors.textPrimary }]}>Sky Glider (Grip Boost & Altitude)</Text>
                    <Text style={styles.manualCardTag}>Finger Flexor Modulation & Tracking</Text>
                  </View>
                </View>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>Goal:</Text> Steer your glider through 18 altitude corridor rings.
                </Text>
                <Text style={[styles.manualText, { color: colors.textSecondary }]}>
                  • <Text style={[styles.boldText, { color: colors.textPrimary }]}>ErgoZone Boost:</Text> Squeeze between 220g and 550g for thruster boost! Clutching &gt;700g adds drag.
                </Text>
              </View>

              <SpringButton
                style={styles.masterGuideCloseBtn}
                onPress={() => setShowMasterGuide(false)}
              >
                <CheckCircleIcon size={18} color="#080C14" />
                <Text style={styles.masterGuideCloseBtnText}>Close Manual</Text>
              </SpringButton>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masterGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  masterGuideBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentBtnActiveGlider: {
    backgroundColor: Colors.primary,
  },
  segmentBtnActiveKoi: {
    backgroundColor: '#10B981',
  },
  segmentBtnActiveForge: {
    backgroundColor: '#F59E0B',
  },
  segmentBtnActiveCoach: {
    backgroundColor: Colors.accent,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmentTextActiveDark: {
    color: '#080C14',
    fontWeight: '900',
  },
  coachContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  topScoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  outerAura: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  middleAura: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCore: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlineMessage: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtextGuidance: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  statHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statCaption: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  // Master Guide Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  masterGuideModalScroll: {
    paddingVertical: 30,
    width: '100%',
    alignItems: 'center',
  },
  masterGuideModalCard: {
    width: width - 32,
    backgroundColor: '#0A1428',
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  masterGuideHeader: {
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  masterGuideTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  masterGuideSubtitle: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  gameManualCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  manualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  manualIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  manualCardTag: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  manualText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  masterGuideCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
  },
  masterGuideCloseBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#080C14',
  },
});
