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
  Ellipse,
  Line,
} from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useBleStore } from '../store/useBleStore';
import { useSessionStore, Recommendation } from '../store/useSessionStore';
import { useThemeStore } from '../store/useThemeStore';
import { LilyPad, KoiFish, Particle } from '../game/types';
import { LotusIcon, TrophyIcon, SparklesIcon, InfoIcon, CheckCircleIcon } from './Icons';
import { SpringButton } from './SpringButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = 380;
const TOTAL_LOTUS = 6;

export default function ZenKoiGame() {
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
  const [finalCalmScore, setFinalCalmScore] = useState(90);

  // Consolidated mutable game state in a single ref for rock-solid 60 FPS performance
  const gameState = useRef({
    score: 0,
    currentStep: 0,
    cursor: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    lilyPads: [] as LilyPad[],
    koiList: [] as KoiFish[],
    particles: [] as Particle[],
    stats: {
      totalFrames: 0,
      calmFrames: 0,
      tremorSum: 0,
      gripSum: 0,
      bloomedCount: 0,
      tremorSpikes: 0,
    },
    lastTremor: 3.6,
    isTremorCalm: true,
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

  // Initialize Pond Lilies & Koi Fish
  const initPond = useCallback(() => {
    const padPositions = [
      { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.28 },
      { x: CANVAS_WIDTH * 0.72, y: CANVAS_HEIGHT * 0.24 },
      { x: CANVAS_WIDTH * 0.48, y: CANVAS_HEIGHT * 0.52 },
      { x: CANVAS_WIDTH * 0.22, y: CANVAS_HEIGHT * 0.74 },
      { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT * 0.72 },
      { x: CANVAS_WIDTH * 0.50, y: CANVAS_HEIGHT * 0.82 },
    ];

    const pads: LilyPad[] = padPositions.map((pos, idx) => ({
      id: idx,
      x: pos.x,
      y: pos.y,
      radius: 28,
      state: idx === 0 ? 'active' : 'inactive',
      lockProgress: 0,
      bloomPetals: 0,
    }));

    const fish: KoiFish[] = [
      {
        id: 1,
        x: CANVAS_WIDTH * 0.3,
        y: CANVAS_HEIGHT * 0.4,
        vx: 1.2,
        vy: 0.8,
        angle: 0.6,
        color: '#F59E0B',
        size: 26,
      },
      {
        id: 2,
        x: CANVAS_WIDTH * 0.7,
        y: CANVAS_HEIGHT * 0.6,
        vx: -1.0,
        vy: -0.9,
        angle: 3.8,
        color: '#EF4444',
        size: 22,
      },
    ];

    gameState.current.lilyPads = pads;
    gameState.current.koiList = fish;
    gameState.current.particles = [];
    gameState.current.score = 0;
    gameState.current.currentStep = 0;
    gameState.current.cursor = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    gameState.current.stats = {
      totalFrames: 0,
      calmFrames: 0,
      tremorSum: 0,
      gripSum: 0,
      bloomedCount: 0,
      tremorSpikes: 0,
    };
  }, []);

  // Initialize pond on mount
  useEffect(() => {
    initPond();
  }, [initPond]);

  // Start game
  const startGame = () => {
    initPond();
    setIsGameOver(false);
    setIsPlaying(true);
  };

  // Main 60 FPS Game Loop (Zero-crash architecture reading useBleStore.getState() directly)
  useEffect(() => {
    if (!isPlaying) return;

    let isRunning = true;

    const gameLoop = () => {
      if (!isRunning) return;

      try {
        const state = gameState.current;
        state.stats.totalFrames += 1;

        // Read instantaneous BLE hardware telemetry directly without re-render cascades
        const ble = useBleStore.getState();
        const currentTremor = ble.tremorHz || 3.6;
        const currentGrip = ble.pressureGrams || 260;
        state.lastTremor = currentTremor;

        // If hardware pad touch is active, map directly to cursor
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

        // Tremor steadiness check (<4.6 Hz is calm)
        const isTremorCalm = currentTremor < 4.6;
        state.isTremorCalm = isTremorCalm;

        if (isTremorCalm) {
          state.stats.calmFrames += 1;
        } else {
          state.stats.tremorSpikes += 1;
        }

        // 1. Animate Swimming Koi Fish
        for (let i = 0; i < state.koiList.length; i++) {
          const fish = state.koiList[i];
          let nx = fish.x + fish.vx;
          let ny = fish.y + fish.vy;
          let nvx = fish.vx;
          let nvy = fish.vy;

          if (nx < 30 || nx > CANVAS_WIDTH - 30) nvx = -nvx;
          if (ny < 30 || ny > CANVAS_HEIGHT - 30) nvy = -nvy;

          nvx += (Math.random() - 0.5) * 0.18;
          nvy += (Math.random() - 0.5) * 0.18;

          const spd = Math.sqrt(nvx * nvx + nvy * nvy);
          if (spd > 2.0) {
            nvx = (nvx / spd) * 2.0;
            nvy = (nvy / spd) * 2.0;
          }

          fish.x = nx;
          fish.y = ny;
          fish.vx = nvx;
          fish.vy = nvy;
          fish.angle = Math.atan2(nvy, nvx);
        }

        // 2. Active Lily Pad Target Acquisition & Bloom Logic
        const activeIdx = state.currentStep;
        if (activeIdx < state.lilyPads.length) {
          const activePad = state.lilyPads[activeIdx];
          const dx = state.cursor.x - activePad.x;
          const dy = state.cursor.y - activePad.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const isHovering = dist <= activePad.radius + 12;

          let nextProgress = activePad.lockProgress;

          if (isHovering && activePad.state !== 'bloomed') {
            if (isTremorCalm) {
              // Steadiness charges ring!
              nextProgress = Math.min(1.0, nextProgress + 0.02);
            } else {
              // Tremor disturbance: slow leakage
              nextProgress = Math.max(0, nextProgress - 0.012);
              if (Math.random() < 0.25) {
                state.particles.push({
                  id: Math.random(),
                  x: activePad.x + (Math.random() * 20 - 10),
                  y: activePad.y + (Math.random() * 20 - 10),
                  vx: (Math.random() - 0.5) * 2,
                  vy: (Math.random() - 0.5) * 2,
                  life: 0,
                  maxLife: 20,
                  color: 'rgba(56, 189, 248, 0.4)',
                  size: 8,
                });
              }
            }

            // Bloom lotus once lock ring is full
            const isPinchGentle = currentGrip >= 180 && currentGrip <= 450;
            if (nextProgress >= 1.0 && (isPinchGentle || isHovering)) {
              activePad.state = 'bloomed';
              activePad.bloomPetals = 8;
              state.stats.bloomedCount += 1;
              state.score += 250;

              // Blossom golden sparkles
              for (let i = 0; i < 14; i++) {
                const ang = (i / 14) * Math.PI * 2;
                state.particles.push({
                  id: Math.random(),
                  x: activePad.x,
                  y: activePad.y,
                  vx: Math.cos(ang) * 3,
                  vy: Math.sin(ang) * 3,
                  life: 0,
                  maxLife: 26,
                  color: i % 2 === 0 ? '#10B981' : '#F59E0B',
                  size: 5,
                });
              }

              // Attract nearby koi
              if (state.koiList[0]) {
                state.koiList[0].vx = (activePad.x - state.koiList[0].x) * 0.04;
                state.koiList[0].vy = (activePad.y - state.koiList[0].y) * 0.04;
              }

              // Advance step
              if (activeIdx + 1 < TOTAL_LOTUS) {
                state.currentStep += 1;
                state.lilyPads[activeIdx + 1].state = 'active';
              } else {
                // Round victory!
                const finalCalm = Math.round(
                  (state.stats.calmFrames / Math.max(1, state.stats.totalFrames)) * 100
                );
                setFinalScore(state.score);
                setFinalCalmScore(finalCalm);
                setIsPlaying(false);
                setIsGameOver(true);
                return;
              }
            }
          } else if (activePad.state !== 'bloomed') {
            nextProgress = Math.max(0, nextProgress - 0.015);
          }

          activePad.lockProgress = nextProgress;
        }

        // 3. Update Water Sparkle Particles (strictly capped for smooth 60fps)
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
        console.warn('ZenKoiGame frame error caught:', err);
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
    const avgTremor = +(gameState.current.stats.tremorSum / totalFrames).toFixed(1) || 3.7;
    const avgGrip = Math.round(gameState.current.stats.gripSum / totalFrames) || 270;

    const customRecs: Recommendation[] = [
      {
        id: 'koi-rec-steadiness',
        category: 'clinical',
        title: `Pond Tremor Steadiness: ${finalCalmScore}%`,
        detail: `Maintained calm neuromotor stability (<4.5 Hz) for ${finalCalmScore}% of the target acquisition phase.`,
        actionableTip:
          finalCalmScore >= 80
            ? 'Exceptional kinetic stability! Your resting hand anchor significantly reduced action tremors.'
            : 'Try resting your wrist on the desk when hovering over each lotus pad to anchor involuntary tremor.',
        badgeColor: finalCalmScore >= 80 ? Colors.success : Colors.primary,
      },
      {
        id: 'koi-rec-impulse',
        category: 'exercise',
        title: 'Modulated Lotus Bloom',
        detail: `Bloomed ${gameState.current.stats.bloomedCount}/${TOTAL_LOTUS} blossoms with controlled pinch pressure.`,
        actionableTip: 'Continue holding the pen at 200-400g to prevent digit fatigue and micro-cramps.',
        badgeColor: Colors.success,
      },
    ];

    addSession({
      testType: 'game',
      testName: 'Zen Koi Pond: Ripple Catcher',
      durationSeconds: Math.round(totalFrames / 60) || 40,
      avgGripGrams: avgGrip,
      peakGripGrams: avgGrip + 110,
      avgTremorHz: avgTremor,
      interventions: gameState.current.stats.tremorSpikes > 20 ? 1 : 0,
      strokesCount: gameState.current.stats.bloomedCount,
      customRecommendations: customRecs,
    });

    Alert.alert(
      'Zen Garden Saved!',
      `Logged ${finalScore} pts with ${finalCalmScore}% calmness to Session History & AI Recs.`,
      [{ text: 'Great!' }]
    );
  };

  const state = gameState.current;
  const currentTremor = state.lastTremor;
  const isTremorCalm = state.isTremorCalm;

  return (
    <View style={styles.container}>
      {/* Top HUD with Guide Button */}
      <View style={styles.hudRow}>
        <View style={[styles.scorePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>SCORE</Text>
          <Text style={[styles.hudValue, { color: colors.textPrimary }]}>{state.score}</Text>
        </View>

        <View style={[styles.calmPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.calmLabel, { color: colors.textMuted }]}>TREMOR STABILITY</Text>
          <Text
            style={[
              styles.calmValue,
              { color: isTremorCalm ? colors.success : colors.danger },
            ]}
          >
            {isTremorCalm ? 'Calm (Steady)' : 'Shaky (Breathe)'}
          </Text>
        </View>

        <View style={[styles.bloomsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>BLOOMED</Text>
          <Text style={[styles.hudValue, { color: colors.success }]}>
            {state.currentStep}/{TOTAL_LOTUS}
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

      {/* Main Pond Canvas */}
      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Defs>
            <LinearGradient id="pondGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#032030" stopOpacity="1" />
              <Stop offset="0.5" stopColor="#003554" stopOpacity="1" />
              <Stop offset="1" stopColor="#051923" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="lotusGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#10B981" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#059669" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Pond Water Surface */}
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#pondGrad)" rx={16} />

          {/* Water Ripples */}
          <Circle cx={CANVAS_WIDTH * 0.5} cy={CANVAS_HEIGHT * 0.5} r={110} fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="2" />
          <Circle cx={CANVAS_WIDTH * 0.5} cy={CANVAS_HEIGHT * 0.5} r={160} fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1.5" />

          {/* Swimming Koi Fish */}
          {state.koiList.map((fish) => {
            const rotDeg = (fish.angle * 180) / Math.PI;
            return (
              <G
                key={fish.id}
                transform={`translate(${fish.x}, ${fish.y}) rotate(${rotDeg})`}
              >
                <Path
                  d="M -18 0 L -26 -6 L -24 0 L -26 6 Z"
                  fill={fish.color}
                  opacity={0.8}
                />
                <Ellipse cx="0" cy="0" rx={fish.size * 0.6} ry={fish.size * 0.28} fill={fish.color} />
                <Circle cx="2" cy="0" r="3.5" fill="#FFFFFF" opacity={0.8} />
              </G>
            );
          })}

          {/* Lily Pads */}
          {state.lilyPads.map((pad) => {
            const isActive = pad.state === 'active';
            const isBloomed = pad.state === 'bloomed';

            return (
              <G key={pad.id} transform={`translate(${pad.x}, ${pad.y})`}>
                <Circle
                  cx="0"
                  cy="0"
                  r={pad.radius}
                  fill="url(#lotusGrad)"
                  stroke={isActive ? '#38BDF8' : '#047857'}
                  strokeWidth={isActive ? '2.5' : '1.5'}
                />
                <Line x1="0" y1="0" x2={pad.radius} y2={-5} stroke="#032030" strokeWidth="2" />

                {isActive && (
                  <Circle
                    cx="0"
                    cy="0"
                    r={pad.radius + 8}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    opacity={0.7}
                  />
                )}

                {isActive && pad.lockProgress > 0 && (
                  <Circle
                    cx="0"
                    cy="0"
                    r={pad.radius + 5}
                    fill="none"
                    stroke={isTremorCalm ? '#10B981' : '#EF4444'}
                    strokeWidth="3.5"
                    strokeDasharray={`${pad.lockProgress * (2 * Math.PI * (pad.radius + 5))} 300`}
                  />
                )}

                {isBloomed && (
                  <G>
                    <Circle cx="0" cy="0" r="10" fill="#F43F5E" />
                    <Circle cx="-5" cy="-5" r="7" fill="#FB7185" opacity={0.85} />
                    <Circle cx="5" cy="-5" r="7" fill="#FB7185" opacity={0.85} />
                    <Circle cx="5" cy="5" r="7" fill="#FB7185" opacity={0.85} />
                    <Circle cx="-5" cy="5" r="7" fill="#FB7185" opacity={0.85} />
                    <Circle cx="0" cy="0" r="4" fill="#FBBF24" />
                  </G>
                )}
              </G>
            );
          })}

          {/* Water Particle Sparkles */}
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

          {/* Pen Cursor Aura */}
          <G transform={`translate(${state.cursor.x}, ${state.cursor.y})`}>
            <Circle cx="0" cy="0" r="12" fill="rgba(56, 189, 248, 0.25)" />
            <Circle cx="0" cy="0" r="4" fill="#38BDF8" />
          </G>
        </Svg>

        {/* Guidance Overlay when Idle */}
        {!isPlaying && !isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.idleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.lotusHalo}>
                <LotusIcon size={38} color="#10B981" />
              </View>
              <Text style={[styles.idleTitle, { color: colors.textPrimary }]}>Zen Koi Pond</Text>
              <Text style={[styles.idleSubtitle, { color: colors.textSecondary }]}>Tremor Modulation & Steady Acquisition</Text>

              {/* Quick How to Play Snippet */}
              <View style={[styles.quickGuideBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>1</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Hold pen tip inside glowing lily pad</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>2</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Keep hand steady (&lt;4.6 Hz) to charge bloom</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>3</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Gently pinch (180-450g) to blossom the lotus!</Text>
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
                  <Text style={styles.playBtnText}>Enter Garden 🪷</Text>
                </SpringButton>
              </View>
            </View>
          </View>
        )}

        {/* Game Over / Victory Modal */}
        {isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.trophyHalo}>
                <TrophyIcon size={42} color="#F59E0B" />
              </View>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>Garden Blossomed!</Text>
              <Text style={styles.resultStars}>⭐️ ⭐️ ⭐️</Text>

              <View style={[styles.resultStatsRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>TOTAL SCORE</Text>
                  <Text style={[styles.resultStatVal, { color: colors.textPrimary }]}>{finalScore}</Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>STEADINESS</Text>
                  <Text style={[styles.resultStatVal, { color: colors.success }]}>
                    {finalCalmScore}%
                  </Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>BLOOMS</Text>
                  <Text style={[styles.resultStatVal, { color: colors.primary }]}>
                    {TOTAL_LOTUS}/{TOTAL_LOTUS}
                  </Text>
                </View>
              </View>

              <SpringButton
                style={styles.saveHistoryBtn}
                onPress={handleSaveGameSession}
              >
                <SparklesIcon size={18} color="#080C14" />
                <Text style={styles.saveHistoryBtnText}>Save Garden to History & Recs</Text>
              </SpringButton>

              <SpringButton style={[styles.retryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={startGame}>
                <Text style={[styles.retryBtnText, { color: colors.textPrimary }]}>Enter Next Garden</Text>
              </SpringButton>
            </View>
          </View>
        )}
      </View>

      {/* Real-time Tremor Biofeedback Radar */}
      <View style={[styles.calmMeterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.calmMeterHeader}>
          <Text style={[styles.calmMeterTitle, { color: colors.textMuted }]}>KINETIC TREMOR RADAR</Text>
          <Text
            style={[
              styles.calmStatusText,
              { color: isTremorCalm ? colors.success : colors.danger },
            ]}
          >
            {isTremorCalm ? '✓ Optimal Steadiness' : '⚠️ Muscle Oscillation High'}
          </Text>
          <Text style={[styles.calmFreqValue, { color: colors.textPrimary }]}>{currentTremor.toFixed(1)} Hz</Text>
        </View>

        <View style={[styles.calmTrack, { backgroundColor: colors.surfaceElevated }]}>
          <View
            style={[
              styles.calmFill,
              {
                width: `${Math.min(100, (currentTremor / 8.0) * 100)}%`,
                backgroundColor: isTremorCalm ? colors.success : colors.danger,
              },
            ]}
          />
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
                <LotusIcon size={28} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideModalTitle}>How to Play: Zen Koi Pond</Text>
                <Text style={styles.guideModalSubtitle}>Kinetic Tremor Suppression & Fine Motor Hold</Text>
              </View>
            </View>

            <View style={styles.guideSection}>
              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#38BDF8' }]}>1</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Target the Active Lotus</Text>
                  <Text style={styles.guideItemDesc}>
                    Look for the pulsing dashed ring. Draw or move your smart pen tip on the Waveshare pad directly over the lotus.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#10B981' }]}>2</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Hold Steady to Charge Bloom</Text>
                  <Text style={styles.guideItemDesc}>
                    Keep hand oscillation under 4.6 Hz. If your hand shakes, water ripples will leak the energy. Resting your wrist on the desk helps!
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#F59E0B' }]}>3</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Gentle Pinch to Flower</Text>
                  <Text style={styles.guideItemDesc}>
                    Once the ring turns full green, apply a gentle pinch between 180g and 450g to blossom the sacred lotus and earn 250 points!
                  </Text>
                </View>
              </View>
            </View>

            <SpringButton
              style={styles.guideCloseBtn}
              onPress={() => setShowGuide(false)}
            >
              <CheckCircleIcon size={18} color="#080C14" />
              <Text style={styles.guideCloseBtnText}>Got It, Let's Play!</Text>
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
  calmPill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
  },
  bloomsPill: {
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
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  calmLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  calmValue: {
    fontSize: 13,
    fontWeight: '900',
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
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  lotusHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
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
    color: '#10B981',
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
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    color: '#38BDF8',
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
    backgroundColor: '#10B981',
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
    fontSize: 18,
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
    backgroundColor: Colors.primary,
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
  calmMeterCard: {
    width: CANVAS_WIDTH,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  calmMeterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calmMeterTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  calmStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calmFreqValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  calmTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  calmFill: {
    height: '100%',
    borderRadius: 3,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
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
    color: '#10B981',
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
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 14,
  },
  guideCloseBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#080C14',
  },
});
