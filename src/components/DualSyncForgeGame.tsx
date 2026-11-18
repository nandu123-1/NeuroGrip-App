import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Modal,
  Alert,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useBleStore } from '../store/useBleStore';
import { useSessionStore, Recommendation } from '../store/useSessionStore';
import { useThemeStore } from '../store/useThemeStore';
import { Particle } from '../game/types';
import { TrophyIcon, SparklesIcon, InfoIcon, CheckCircleIcon, GamepadIcon } from './Icons';
import { SpringButton } from './SpringButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = 380;
const TOTAL_CRYSTALS = 5;

// Pressure modulation target zones
const TARGET_ZONES = [
  { name: 'Tempering Pulse', minGrip: 180, maxGrip: 320, color: '#38BDF8', label: '180 - 320g' },
  { name: 'Harmonic Fusion', minGrip: 340, maxGrip: 520, color: '#10B981', label: '340 - 520g' },
  { name: 'Plasma Infusion', minGrip: 530, maxGrip: 680, color: '#F59E0B', label: '530 - 680g' },
];

export default function DualSyncForgeGame() {
  const { addSession } = useSessionStore();
  const { colors } = useThemeStore();

  // Primary UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [, setFrameTick] = useState(0);
  const lastRenderTime = useRef(0);

  // Cached summary state for post-game modal
  const [finalScore, setFinalScore] = useState(0);
  const [finalSyncPct, setFinalSyncPct] = useState(85);
  const [finalTremorCalmPct, setFinalTremorCalmPct] = useState(88);

  // Consolidated mutable game state in a single ref for rock-solid 60 FPS performance
  const gameState = useRef({
    score: 0,
    crystalsForged: 0,
    currentZoneIndex: 0,
    chargeProgress: 0, // 0 to 1
    cursor: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    core: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      angle: 0,
      radiusX: CANVAS_WIDTH * 0.32,
      radiusY: CANVAS_HEIGHT * 0.28,
      speed: 0.022,
    },
    particles: [] as Particle[],
    stats: {
      totalFrames: 0,
      dualSyncFrames: 0,
      calmFrames: 0,
      targetGripFrames: 0,
      maxGrip: 0,
      gripSum: 0,
      tremorSum: 0,
    },
    isHovering: false,
    isTremorSteady: true,
    isGripMatched: false,
    isDualSync: false,
    lastTremor: 3.5,
    lastGrip: 260,
  });

  const animFrameId = useRef<number | null>(null);

  // PanResponder for direct finger touch on mobile screen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const boundedX = Math.max(20, Math.min(CANVAS_WIDTH - 20, gestureState.moveX - 16));
        const boundedY = Math.max(20, Math.min(CANVAS_HEIGHT - 20, gestureState.moveY - 140));
        gameState.current.cursor = { x: boundedX, y: boundedY };
      },
    })
  ).current;

  // Initialize Forge state
  const initForge = useCallback(() => {
    gameState.current.score = 0;
    gameState.current.crystalsForged = 0;
    gameState.current.currentZoneIndex = 0;
    gameState.current.chargeProgress = 0;
    gameState.current.particles = [];
    gameState.current.cursor = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    gameState.current.core = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      angle: 0,
      radiusX: CANVAS_WIDTH * 0.32,
      radiusY: CANVAS_HEIGHT * 0.28,
      speed: 0.022,
    };
    gameState.current.stats = {
      totalFrames: 0,
      dualSyncFrames: 0,
      calmFrames: 0,
      targetGripFrames: 0,
      maxGrip: 0,
      gripSum: 0,
      tremorSum: 0,
    };
  }, []);

  useEffect(() => {
    initForge();
  }, [initForge]);

  // Start game
  const startGame = () => {
    initForge();
    setIsGameOver(false);
    setIsPlaying(true);
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    let isRunning = true;

    const gameLoop = () => {
      if (!isRunning) return;

      try {
        const state = gameState.current;
        state.stats.totalFrames += 1;

        // Read instantaneous BLE hardware telemetry directly
        const ble = useBleStore.getState();
        const currentTremor = ble.tremorHz || 3.5;
        const currentGrip = ble.pressureGrams || 260;
        state.lastTremor = currentTremor;
        state.lastGrip = currentGrip;

        // Map pad touch coordinates if pad is touched
        if (ble.status === 'Connected' && ble.isTouched && ble.touchX > 0 && ble.touchY > 0) {
          const mappedX = (ble.touchX / 480) * (CANVAS_WIDTH - 40) + 20;
          const mappedY = (ble.touchY / 320) * (CANVAS_HEIGHT - 40) + 20;
          state.cursor = {
            x: Math.max(20, Math.min(CANVAS_WIDTH - 20, mappedX)),
            y: Math.max(20, Math.min(CANVAS_HEIGHT - 20, mappedY)),
          };
        }

        state.stats.tremorSum += currentTremor;
        state.stats.gripSum += currentGrip;
        if (currentGrip > state.stats.maxGrip) {
          state.stats.maxGrip = currentGrip;
        }

        // 1. Move Quantum Core in orbital path
        state.core.angle += state.core.speed;
        const cx = CANVAS_WIDTH / 2;
        const cy = CANVAS_HEIGHT / 2;
        state.core.x = cx + Math.cos(state.core.angle) * state.core.radiusX;
        state.core.y = cy + Math.sin(state.core.angle * 1.5) * state.core.radiusY;

        // 2. Spatial Containment Check
        const dx = state.cursor.x - state.core.x;
        const dy = state.cursor.y - state.core.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isHovering = dist <= 42; // Containment field radius
        state.isHovering = isHovering;

        // 3. Neuromotor Criteria Checks
        const isTremorSteady = currentTremor < 4.2; // Steadiness target
        const activeZone = TARGET_ZONES[state.currentZoneIndex];
        const isGripMatched = currentGrip >= activeZone.minGrip && currentGrip <= activeZone.maxGrip;

        state.isTremorSteady = isTremorSteady;
        state.isGripMatched = isGripMatched;

        if (isTremorSteady) state.stats.calmFrames += 1;
        if (isGripMatched) state.stats.targetGripFrames += 1;

        // 4. Combined Dual Sync Check (Hovering + Steady + Matched Grip)
        const isDualSync = isHovering && isTremorSteady && isGripMatched;
        state.isDualSync = isDualSync;

        if (isDualSync) {
          state.stats.dualSyncFrames += 1;
          state.chargeProgress = Math.min(1.0, state.chargeProgress + 0.016);
          state.score += 8;

          // Electric plasma lightning particles
          if (Math.random() < 0.8) {
            state.particles.push({
              id: Math.random(),
              x: state.core.x + (Math.random() * 20 - 10),
              y: state.core.y + (Math.random() * 20 - 10),
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 0,
              maxLife: 16,
              color: activeZone.color,
              size: 4.5,
            });
          }

          // Crystal synthesis complete!
          if (state.chargeProgress >= 1.0) {
            state.crystalsForged += 1;
            state.score += 500;
            state.chargeProgress = 0;
            state.currentZoneIndex = (state.currentZoneIndex + 1) % TARGET_ZONES.length;

            // Explosion of synthesis sparks
            for (let i = 0; i < 20; i++) {
              const ang = (i / 20) * Math.PI * 2;
              state.particles.push({
                id: Math.random(),
                x: state.core.x,
                y: state.core.y,
                vx: Math.cos(ang) * 5,
                vy: Math.sin(ang) * 5,
                life: 0,
                maxLife: 28,
                color: '#F59E0B',
                size: 6,
              });
            }

            // Check round victory
            if (state.crystalsForged >= TOTAL_CRYSTALS) {
              const finalSync = Math.round(
                (state.stats.dualSyncFrames / Math.max(1, state.stats.totalFrames)) * 100
              );
              const finalCalm = Math.round(
                (state.stats.calmFrames / Math.max(1, state.stats.totalFrames)) * 100
              );
              setFinalScore(state.score);
              setFinalSyncPct(finalSync);
              setFinalTremorCalmPct(finalCalm);
              setIsPlaying(false);
              setIsGameOver(true);
              return;
            }
          }
        } else if (isHovering) {
          // In containment field but not in dual sync: slow decay
          state.chargeProgress = Math.max(0, state.chargeProgress - 0.004);
        } else {
          // Out of field: decay charge
          state.chargeProgress = Math.max(0, state.chargeProgress - 0.012);
        }

        // 5. Update Particles (capped for 60fps performance)
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life += 1;
          if (p.life >= p.maxLife) {
            state.particles.splice(i, 1);
          }
        }
        if (state.particles.length > 8) {
          state.particles.splice(0, state.particles.length - 8);
        }

        // Throttle React SVG re-render to ~30ms (~33fps) to eliminate thread stutter
        const now = Date.now();
        if (now - lastRenderTime.current >= 30) {
          lastRenderTime.current = now;
          setFrameTick((t) => (t + 1) | 0);
        }
      } catch (err) {
        console.warn('DualSyncForge frame error caught:', err);
      }

      animFrameId.current = requestAnimationFrame(gameLoop);
    };

    animFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isPlaying]);

  // Save session to history
  const handleSaveGameSession = () => {
    const totalFrames = Math.max(1, gameState.current.stats.totalFrames);
    const avgGrip = Math.round(gameState.current.stats.gripSum / totalFrames) || 310;
    const avgTremor = +(gameState.current.stats.tremorSum / totalFrames).toFixed(1) || 3.8;

    const customRecs: Recommendation[] = [
      {
        id: 'forge-rec-dual',
        category: 'clinical',
        title: `Dual Neuromotor Synergy: ${finalSyncPct}%`,
        detail: `Achieved simultaneous tremor stability and grip calibration for ${finalSyncPct}% of crucible activation.`,
        actionableTip:
          finalSyncPct >= 75
            ? 'Remarkable dual-task coordination! Your brain maintained both spatial steadiness and fine digit pressure modulation.'
            : 'Practice separating hand stillness from finger pinching. Relax your shoulder while letting fingers modulate force.',
        badgeColor: finalSyncPct >= 75 ? Colors.success : Colors.primary,
      },
      {
        id: 'forge-rec-stability',
        category: 'exercise',
        title: `Crucible Stability: ${finalTremorCalmPct}%`,
        detail: `Maintained containment field integrity (&lt;4.2 Hz) for ${finalTremorCalmPct}% of the forging run.`,
        actionableTip: 'Keep a steady breathing cadence when the core reaches high-velocity orbital turns.',
        badgeColor: Colors.success,
      },
    ];

    addSession({
      testType: 'game',
      testName: 'Dual Sync Forge: Grip & Tremor',
      durationSeconds: Math.round(totalFrames / 60) || 50,
      avgGripGrams: avgGrip,
      peakGripGrams: gameState.current.stats.maxGrip || 540,
      avgTremorHz: avgTremor,
      interventions: finalSyncPct < 65 ? 2 : 0,
      strokesCount: gameState.current.crystalsForged,
      customRecommendations: customRecs,
    });

    Alert.alert(
      'Dual Forge Session Logged!',
      `Logged ${finalScore} pts with ${finalSyncPct}% Dual Synergy to Session History.`,
      [{ text: 'Awesome' }]
    );
  };

  const state = gameState.current;
  const activeZone = TARGET_ZONES[state.currentZoneIndex];
  const currentGrip = state.lastGrip;
  const currentTremor = state.lastTremor;
  const isDualSync = state.isDualSync;

  return (
    <View style={styles.container}>
      {/* Top HUD with Dual Metric Readouts */}
      <View style={styles.hudRow}>
        <View style={[styles.scorePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>SCORE</Text>
          <Text style={[styles.hudValue, { color: colors.textPrimary }]}>{state.score}</Text>
        </View>

        <View
          style={[
            styles.dualStatusPill,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isDualSync && styles.dualStatusPillActive,
          ]}
        >
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>SYNERGY</Text>
          <Text style={[styles.hudValue, { color: isDualSync ? '#F59E0B' : colors.textMuted }]}>
            {isDualSync ? '⚡ DUAL SYNC' : 'CALIBRATING'}
          </Text>
        </View>

        <View style={[styles.crystalsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>CRYSTALS</Text>
          <Text style={[styles.hudValue, { color: colors.success }]}>
            {state.crystalsForged}/{TOTAL_CRYSTALS}
          </Text>
        </View>

        <SpringButton
          style={[styles.guideBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => setShowGuide(true)}
        >
          <InfoIcon size={14} color={colors.primary} />
          <Text style={[styles.guideBtnText, { color: colors.primary }]}>Guide</Text>
        </SpringButton>
      </View>

      {/* Main Reactor Crucible Canvas */}
      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Defs>
            <LinearGradient id="reactorGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0F172A" stopOpacity="1" />
              <Stop offset="0.5" stopColor="#1E1B4B" stopOpacity="1" />
              <Stop offset="1" stopColor="#0B0F19" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F59E0B" stopOpacity="1" />
              <Stop offset="0.7" stopColor="#EC4899" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#8B5CF6" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Reactor Chamber Floor */}
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#reactorGrad)" rx={16} />

          {/* Orbital Track Guideline */}
          <Circle
            cx={CANVAS_WIDTH / 2}
            cy={CANVAS_HEIGHT / 2}
            r={CANVAS_WIDTH * 0.3}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1.5"
            strokeDasharray="6,6"
          />

          {/* Target Pressure Zone Ambient Halo */}
          <Circle
            cx={state.core.x}
            cy={state.core.y}
            r={50}
            fill={activeZone.color}
            opacity={0.08}
          />

          {/* Quantum Core */}
          <G transform={`translate(${state.core.x}, ${state.core.y})`}>
            {/* Charge Ring */}
            <Circle
              cx="0"
              cy="0"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="3"
            />
            {state.chargeProgress > 0 && (
              <Circle
                cx="0"
                cy="0"
                r="26"
                fill="none"
                stroke={isDualSync ? '#F59E0B' : activeZone.color}
                strokeWidth="4"
                strokeDasharray={`${state.chargeProgress * (2 * Math.PI * 26)} 200`}
                strokeLinecap="round"
              />
            )}
            {/* Core Body */}
            <Circle cx="0" cy="0" r="16" fill="url(#coreGrad)" />
            <Circle cx="-3" cy="-3" r="4" fill="#FFFFFF" opacity={0.7} />
          </G>

          {/* Lightning Arcs when in Dual Sync */}
          {isDualSync && (
            <Line
              x1={state.cursor.x}
              y1={state.cursor.y}
              x2={state.core.x}
              y2={state.core.y}
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="4,2"
            />
          )}

          {/* Particle Sparkles */}
          {state.particles.map((p) => (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.size * (1 - p.life / p.maxLife)}
              fill={p.color}
              opacity={1 - p.life / p.maxLife}
            />
          ))}

          {/* Player Containment Ring Cursor */}
          <G transform={`translate(${state.cursor.x}, ${state.cursor.y})`}>
            <Circle
              cx="0"
              cy="0"
              r="32"
              fill="none"
              stroke={isDualSync ? '#F59E0B' : state.isHovering ? '#38BDF8' : 'rgba(255,255,255,0.2)'}
              strokeWidth={state.isHovering ? '2.5' : '1.5'}
              strokeDasharray={state.isHovering ? 'none' : '4,4'}
            />
            {/* Crosshair ticks */}
            <Line x1="-8" y1="0" x2="8" y2="0" stroke="#38BDF8" strokeWidth="1.5" />
            <Line x1="0" y1="-8" x2="0" y2="8" stroke="#38BDF8" strokeWidth="1.5" />
            <Circle cx="0" cy="0" r="3" fill="#38BDF8" />
          </G>
        </Svg>

        {/* Guidance Overlay when Idle */}
        {!isPlaying && !isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.idleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.forgeHalo}>
                <GamepadIcon size={38} color="#F59E0B" />
              </View>
              <Text style={[styles.idleTitle, { color: colors.textPrimary }]}>Dual Sync Forge</Text>
              <Text style={[styles.idleSubtitle, { color: colors.textSecondary }]}>Grip Pressure + Tremor Stability Combined</Text>

              <View style={[styles.quickGuideBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>1</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Hold pen steady (&lt;4.2 Hz) inside the floating core</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>2</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Match the target pinch force zone shown on HUD</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>3</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Maintain Dual Sync to forge 5 Quantum Crystals!</Text>
                </View>
              </View>

              <View style={styles.idleBtnRow}>
                <SpringButton
                  style={[styles.howToPlayMiniBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => setShowGuide(true)}
                >
                  <InfoIcon size={16} color={colors.primary} />
                  <Text style={[styles.howToPlayMiniText, { color: colors.primary }]}>Full Manual</Text>
                </SpringButton>

                <SpringButton style={styles.playBtn} onPress={startGame}>
                  <Text style={styles.playBtnText}>Start Forging ⚡</Text>
                </SpringButton>
              </View>
            </View>
          </View>
        )}

        {/* Victory Screen */}
        {isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.trophyHalo}>
                <TrophyIcon size={42} color="#F59E0B" />
              </View>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>Synthesis Complete!</Text>
              <Text style={styles.resultStars}>💎 💎 💎</Text>

              <View style={[styles.resultStatsRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>TOTAL SCORE</Text>
                  <Text style={[styles.resultStatVal, { color: colors.textPrimary }]}>{finalScore}</Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>DUAL SYNC</Text>
                  <Text style={[styles.resultStatVal, { color: '#F59E0B' }]}>
                    {finalSyncPct}%
                  </Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>STEADINESS</Text>
                  <Text style={[styles.resultStatVal, { color: colors.success }]}>
                    {finalTremorCalmPct}%
                  </Text>
                </View>
              </View>

              <SpringButton
                style={styles.saveHistoryBtn}
                onPress={handleSaveGameSession}
              >
                <SparklesIcon size={18} color="#080C14" />
                <Text style={styles.saveHistoryBtnText}>Save Crucible Run to History</Text>
              </SpringButton>

              <SpringButton style={[styles.retryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={startGame}>
                <Text style={[styles.retryBtnText, { color: colors.textPrimary }]}>Forge Next Reactor</Text>
              </SpringButton>
            </View>
          </View>
        )}
      </View>

      {/* Dual Calibration Telemetry Dashboard */}
      <View style={[styles.dualDashboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Metric 1: Grip Target Band */}
        <View style={styles.dashMetricCol}>
          <View style={styles.dashMetricHeader}>
            <Text style={[styles.dashMetricTitle, { color: colors.textMuted }]}>PINCH TARGET: {activeZone.label}</Text>
            <Text style={[styles.dashStatus, { color: state.isGripMatched ? colors.success : '#F59E0B' }]}>
              {state.isGripMatched ? '✓ MATCHED' : currentGrip < activeZone.minGrip ? '↑ SQUEEZE' : '↓ RELAX'}
            </Text>
          </View>
          <View style={[styles.meterTrack, { backgroundColor: colors.surfaceElevated }]}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(100, (currentGrip / 700) * 100)}%`,
                  backgroundColor: state.isGripMatched ? colors.success : '#F59E0B',
                },
              ]}
            />
          </View>
          <Text style={[styles.dashValue, { color: colors.textPrimary }]}>{currentGrip} g</Text>
        </View>

        <View style={[styles.dashDivider, { backgroundColor: colors.border }]} />

        {/* Metric 2: Tremor Steadiness */}
        <View style={styles.dashMetricCol}>
          <View style={styles.dashMetricHeader}>
            <Text style={[styles.dashMetricTitle, { color: colors.textMuted }]}>TREMOR LOCK: &lt;4.2 Hz</Text>
            <Text style={[styles.dashStatus, { color: state.isTremorSteady ? colors.success : colors.danger }]}>
              {state.isTremorSteady ? '✓ STEADY' : '⚠️ SHAKY'}
            </Text>
          </View>
          <View style={[styles.meterTrack, { backgroundColor: colors.surfaceElevated }]}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(100, (currentTremor / 8.0) * 100)}%`,
                  backgroundColor: state.isTremorSteady ? colors.success : colors.danger,
                },
              ]}
            />
          </View>
          <Text style={[styles.dashValue, { color: colors.textPrimary }]}>{currentTremor.toFixed(1)} Hz</Text>
        </View>
      </View>

      {/* Comprehensive How to Play Guide Modal */}
      <Modal
        visible={showGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuide(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.guideModalCard}>
            <View style={styles.guideModalHeader}>
              <View style={styles.guideHeaderIconWrap}>
                <GamepadIcon size={28} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideModalTitle}>How to Play: Dual Sync Forge</Text>
                <Text style={styles.guideModalSubtitle}>Combined Grip Force + Kinetic Tremor Training</Text>
              </View>
            </View>

            <View style={styles.guideSection}>
              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#38BDF8' }]}>1</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Follow the Floating Core</Text>
                  <Text style={styles.guideItemDesc}>
                    Move the smart pen tip on your pad to keep the containment ring aligned over the moving plasma orb.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#10B981' }]}>2</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Match the Target Pinch Force</Text>
                  <Text style={styles.guideItemDesc}>
                    Check the target zone (e.g. 180-320g, 340-520g, or 530-680g). Squeeze or ease off your pinch until the meter turns green.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#F59E0B' }]}>3</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Achieve Dual Sync Synergy</Text>
                  <Text style={styles.guideItemDesc}>
                    When BOTH your hand is steady (&lt;4.2 Hz) AND your grip matches the target zone, high-voltage Dual Sync charges the core to synthesize crystals!
                  </Text>
                </View>
              </View>
            </View>

            <SpringButton
              style={styles.guideCloseBtn}
              onPress={() => setShowGuide(false)}
            >
              <CheckCircleIcon size={18} color="#080C14" />
              <Text style={styles.guideCloseBtnText}>Enter Crucible!</Text>
            </SpringButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  hudRow: {
    flexDirection: 'row',
    width: CANVAS_WIDTH,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scorePill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dualStatusPill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
  },
  dualStatusPillActive: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  crystalsPill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  guideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
  },
  guideBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  hudValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  canvasWrapper: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
    elevation: 8,
  },
  idleOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 10, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  idleCard: {
    width: '100%',
    backgroundColor: '#0A1324',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  forgeHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  idleTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  idleSubtitle: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '700',
    marginBottom: 14,
  },
  quickGuideBox: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 18,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  guideStepText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  idleBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  howToPlayMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
  },
  howToPlayMiniText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080C14',
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#0A1324',
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  trophyHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  resultStars: {
    fontSize: 20,
    marginVertical: 4,
  },
  resultStatsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    marginVertical: 16,
  },
  resultStatBox: {
    alignItems: 'center',
  },
  resultStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  resultStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  resultStatDivider: {
    width: 1,
    height: '80%',
    backgroundColor: Colors.border,
  },
  saveHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 10,
  },
  saveHistoryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080C14',
  },
  retryBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dualDashboardCard: {
    flexDirection: 'row',
    width: CANVAS_WIDTH,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  dashMetricCol: {
    flex: 1,
  },
  dashDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  dashMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dashMetricTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dashStatus: {
    fontSize: 10,
    fontWeight: '800',
  },
  meterTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  dashValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  guideModalCard: {
    width: '100%',
    backgroundColor: '#0A1428',
    borderColor: Colors.borderHighlight,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    paddingBottom: 14,
  },
  guideHeaderIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  guideModalSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  guideSection: {
    gap: 14,
    marginBottom: 20,
  },
  guideItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  guideBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  guideBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  guideItemContent: {
    flex: 1,
  },
  guideItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  guideItemDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  guideCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 13,
    borderRadius: 14,
  },
  guideCloseBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#080C14',
  },
});
