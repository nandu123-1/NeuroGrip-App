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
import { RingObstacle, Particle } from '../game/types';
import { PlaneIcon, TrophyIcon, SparklesIcon, InfoIcon, CheckCircleIcon } from './Icons';
import { SpringButton } from './SpringButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = 380;
const TOTAL_RINGS = 18;

export default function SkyGliderGame() {
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
  const [finalRingsCleared, setFinalRingsCleared] = useState(0);
  const [finalErgoPct, setFinalErgoPct] = useState(85);

  // Consolidated mutable game state in a single ref for rock-solid 60 FPS performance
  const gameState = useRef({
    score: 0,
    combo: 1,
    ringsCleared: 0,
    glider: {
      x: 80,
      y: CANVAS_HEIGHT / 2,
      targetY: CANVAS_HEIGHT / 2,
      vy: 0,
      tilt: 0,
    },
    rings: [] as RingObstacle[],
    particles: [] as Particle[],
    stats: {
      totalFrames: 0,
      ergoFrames: 0,
      maxGrip: 0,
      gripSum: 0,
      tremorSum: 0,
      ringsHit: 0,
    },
    lastGrip: 280,
    inErgoZone: true,
  });

  const animFrameId = useRef<number | null>(null);

  // Direct touch pan handler on phone screen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const boundedY = Math.max(30, Math.min(CANVAS_HEIGHT - 30, gestureState.moveY - 140));
        gameState.current.glider.targetY = boundedY;
      },
    })
  ).current;

  // Initialize ring corridor
  const initRings = useCallback(() => {
    const newRings: RingObstacle[] = [];
    let startX = CANVAS_WIDTH + 60;
    for (let i = 0; i < TOTAL_RINGS; i++) {
      const waveY =
        CANVAS_HEIGHT / 2 +
        Math.sin(i * 0.75) * (CANVAS_HEIGHT * 0.3) +
        (Math.random() * 30 - 15);
      newRings.push({
        id: i,
        x: startX,
        y: Math.max(45, Math.min(CANVAS_HEIGHT - 45, waveY)),
        radius: 32,
        isPassed: false,
        isHit: false,
        type: i % 4 === 3 ? 'spiral' : i % 3 === 2 ? 'star' : 'normal',
      });
      startX += 170;
    }
    gameState.current.rings = newRings;
    gameState.current.particles = [];
    gameState.current.score = 0;
    gameState.current.combo = 1;
    gameState.current.ringsCleared = 0;
    gameState.current.glider = {
      x: 80,
      y: CANVAS_HEIGHT / 2,
      targetY: CANVAS_HEIGHT / 2,
      vy: 0,
      tilt: 0,
    };
    gameState.current.stats = {
      totalFrames: 0,
      ergoFrames: 0,
      maxGrip: 0,
      gripSum: 0,
      tremorSum: 0,
      ringsHit: 0,
    };
  }, []);

  useEffect(() => {
    initRings();
  }, [initRings]);

  // Start game
  const startGame = () => {
    initRings();
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
        const currentGrip = ble.pressureGrams || 280;
        const currentTremor = ble.tremorHz || 3.8;
        state.lastGrip = currentGrip;

        // If hardware touch pad is connected and being pressed, map Y directly
        if (ble.status === 'Connected' && ble.isTouched && ble.touchY > 0) {
          const mappedY = (ble.touchY / 320) * (CANVAS_HEIGHT - 60) + 30;
          state.glider.targetY = Math.max(30, Math.min(CANVAS_HEIGHT - 30, mappedY));
        }

        state.stats.gripSum += currentGrip;
        state.stats.tremorSum += currentTremor;
        if (currentGrip > state.stats.maxGrip) {
          state.stats.maxGrip = currentGrip;
        }

        // ErgoZone check (220g - 550g optimal writing force)
        const inErgoZone = currentGrip >= 220 && currentGrip <= 550;
        const isOverGrip = currentGrip > 700;
        state.inErgoZone = inErgoZone;

        if (inErgoZone) state.stats.ergoFrames += 1;

        // Forward flight speed
        let speed = 3.6;
        if (inErgoZone) speed = 5.2; // Boost!
        else if (isOverGrip) speed = 2.4; // High drag penalty

        // Tremor buffeting jitter if >5.5 Hz
        let jitter = 0;
        if (currentTremor > 5.5) {
          jitter = (Math.random() - 0.5) * ((currentTremor - 5.0) * 4);
        }

        // Smooth vertical altitude following & banking tilt
        const dy = state.glider.targetY + jitter - state.glider.y;
        state.glider.vy = dy * 0.18;
        state.glider.y += state.glider.vy;
        state.glider.tilt = Math.max(-25, Math.min(25, state.glider.vy * 2.2));

        // Engine exhaust thruster particles
        if (Math.random() < 0.6) {
          state.particles.push({
            id: Math.random(),
            x: state.glider.x - 22,
            y: state.glider.y + (Math.random() * 8 - 4),
            vx: -(speed * 0.8 + Math.random() * 2),
            vy: (Math.random() - 0.5) * 1.5,
            life: 0,
            maxLife: inErgoZone ? 24 : 14,
            color: isOverGrip ? '#EF4444' : inErgoZone ? '#10B981' : '#38BDF8',
            size: inErgoZone ? 4.5 : 3,
          });
        }

        // Move obstacle rings & collision detection
        let allPassed = true;

        for (let i = 0; i < state.rings.length; i++) {
          const ring = state.rings[i];
          const nextX = ring.x - speed;
          let hit = ring.isHit;
          let passed = ring.isPassed;

          // Check passing gate
          if (!passed && nextX <= state.glider.x + 10) {
            passed = true;
            const distY = Math.abs(state.glider.y - ring.y);
            if (distY <= ring.radius + 10) {
              hit = true;
              state.stats.ringsHit += 1;
              state.ringsCleared = state.stats.ringsHit;

              const basePts = ring.type === 'star' ? 300 : ring.type === 'spiral' ? 200 : 100;
              state.score += basePts * state.combo;
              state.combo = Math.min(8, state.combo + 1);

              // Spawn collection sparks
              for (let k = 0; k < 12; k++) {
                const ang = (k / 12) * Math.PI * 2;
                state.particles.push({
                  id: Math.random(),
                  x: ring.x,
                  y: ring.y,
                  vx: Math.cos(ang) * 4,
                  vy: Math.sin(ang) * 4,
                  life: 0,
                  maxLife: 20,
                  color: ring.type === 'star' ? '#F59E0B' : '#10B981',
                  size: 4,
                });
              }
            } else {
              // Missed ring
              state.combo = 1;
            }
          }

          ring.x = nextX;
          ring.isHit = hit;
          ring.isPassed = passed;

          if (nextX > -50) allPassed = false;
        }

        // Update particles (capped for 60fps performance)
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

        // Victory / End of Corridor check
        if (allPassed && state.rings.length > 0) {
          const finalErgo = Math.round(
            (state.stats.ergoFrames / Math.max(1, state.stats.totalFrames)) * 100
          );
          setFinalScore(state.score);
          setFinalRingsCleared(state.ringsCleared);
          setFinalErgoPct(finalErgo);
          setIsPlaying(false);
          setIsGameOver(true);
          return;
        }

        // Throttle React SVG re-render to ~30ms (~33fps) to eliminate thread stutter
        const now = Date.now();
        if (now - lastRenderTime.current >= 30) {
          lastRenderTime.current = now;
          setFrameTick((t) => (t + 1) | 0);
        }
      } catch (err) {
        console.warn('SkyGlider frame error caught:', err);
      }

      animFrameId.current = requestAnimationFrame(gameLoop);
    };

    animFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isPlaying]);

  // Save game run to Session History
  const handleSaveGameSession = () => {
    const totalFrames = Math.max(1, gameState.current.stats.totalFrames);
    const avgGrip = Math.round(gameState.current.stats.gripSum / totalFrames) || 280;
    const avgTremor = +(gameState.current.stats.tremorSum / totalFrames).toFixed(1) || 3.9;
    const hitRate = Math.round((finalRingsCleared / TOTAL_RINGS) * 100);

    const customRecs: Recommendation[] = [
      {
        id: 'glider-rec-path',
        category: 'exercise',
        title: `Gate Accuracy: ${hitRate}% (${finalRingsCleared}/${TOTAL_RINGS} Rings)`,
        detail: `Successfully navigated ${finalRingsCleared} altitude corridors while actively modulating grip load.`,
        actionableTip:
          hitRate >= 80
            ? 'Superb vertical altitude control! Ready for faster corridor speeds.'
            : 'Focus on early altitude alignment before reaching each gate ring to maximize combo multipliers.',
        badgeColor: hitRate >= 80 ? Colors.success : Colors.primary,
      },
      {
        id: 'glider-rec-ergo',
        category: 'clinical',
        title: `ErgoZone Pinch Grip: ${finalErgoPct}%`,
        detail: `Sustained ideal writing pinch force (220g - 550g) for ${finalErgoPct}% of flight time.`,
        actionableTip:
          finalErgoPct >= 75
            ? 'Optimal digit flexor relaxation achieved. Your index and thumb maintained balanced joint tension.'
            : 'Lighten your pinch grip when approaching gates; clutching too hard reduces thruster maneuverability.',
        badgeColor: finalErgoPct >= 75 ? Colors.success : Colors.warning,
      },
    ];

    addSession({
      testType: 'game',
      testName: 'Sky Glider: Pressure Corridor',
      durationSeconds: Math.round(totalFrames / 60) || 45,
      avgGripGrams: avgGrip,
      peakGripGrams: gameState.current.stats.maxGrip || 520,
      avgTremorHz: avgTremor,
      interventions: finalErgoPct < 70 ? 2 : 0,
      strokesCount: finalRingsCleared,
      customRecommendations: customRecs,
    });

    Alert.alert(
      'Flight Session Saved!',
      `Logged ${finalScore} pts with ${finalErgoPct}% ErgoZone accuracy to History.`,
      [{ text: 'Excellent' }]
    );
  };

  const state = gameState.current;
  const currentGrip = state.lastGrip;
  const inErgoZone = state.inErgoZone;

  return (
    <View style={styles.container}>
      {/* Top HUD Row */}
      <View style={styles.hudRow}>
        <View style={[styles.scorePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>SCORE</Text>
          <Text style={[styles.hudValue, { color: colors.textPrimary }]}>{state.score}</Text>
        </View>

        <View style={[styles.comboPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>COMBO</Text>
          <Text style={[styles.hudValue, { color: colors.warning }]}>
            {state.combo}x
          </Text>
        </View>

        <View style={[styles.ringsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hudLabel, { color: colors.textMuted }]}>RINGS</Text>
          <Text style={[styles.hudValue, { color: colors.success }]}>
            {state.ringsCleared}/{TOTAL_RINGS}
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

      {/* Main Sky Flight Canvas */}
      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Defs>
            <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B132B" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#1C2541" stopOpacity="1" />
              <Stop offset="1" stopColor="#0B132B" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="gateGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#38BDF8" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#818CF8" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Deep Atmosphere Sky */}
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#skyGrad)" rx={16} />

          {/* Altitude Level Grid Lines */}
          <Line x1="0" y1={CANVAS_HEIGHT * 0.25} x2={CANVAS_WIDTH} y2={CANVAS_HEIGHT * 0.25} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,8" />
          <Line x1="0" y1={CANVAS_HEIGHT * 0.5} x2={CANVAS_WIDTH} y2={CANVAS_HEIGHT * 0.5} stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="6,6" />
          <Line x1="0" y1={CANVAS_HEIGHT * 0.75} x2={CANVAS_WIDTH} y2={CANVAS_HEIGHT * 0.75} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,8" />

          {/* Rings & Obstacles */}
          {state.rings.map((ring) => {
            if (ring.x < -40 || ring.x > CANVAS_WIDTH + 40) return null;
            const isGold = ring.type === 'star' || ring.type === 'spiral';

            return (
              <G key={ring.id} transform={`translate(${ring.x}, ${ring.y})`}>
                <Circle
                  cx="0"
                  cy="0"
                  r={ring.radius}
                  fill="none"
                  stroke={ring.isHit ? '#10B981' : isGold ? '#F59E0B' : 'url(#gateGrad)'}
                  strokeWidth={ring.isHit ? '3.5' : '2.5'}
                  strokeDasharray={isGold ? '4,4' : 'none'}
                  opacity={ring.isPassed && !ring.isHit ? 0.25 : 1}
                />
                <Circle
                  cx="0"
                  cy="0"
                  r={ring.radius - 8}
                  fill="none"
                  stroke={ring.isHit ? '#10B981' : isGold ? '#FBBF24' : '#38BDF8'}
                  strokeWidth="1"
                  opacity={0.4}
                />
              </G>
            );
          })}

          {/* Thruster & Sparkle Particles */}
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

          {/* Futuristic Sky Glider Ship */}
          <G transform={`translate(${state.glider.x}, ${state.glider.y}) rotate(${state.glider.tilt})`}>
            {/* Plasma Cockpit & Hull */}
            <Path
              d="M 24 0 L -16 -12 L -8 0 L -16 12 Z"
              fill={inErgoZone ? '#10B981' : '#38BDF8'}
            />
            {/* Energy Core */}
            <Circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
          </G>
        </Svg>

        {/* Guidance Overlay when Idle */}
        {!isPlaying && !isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.idleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.planeHalo}>
                <PlaneIcon size={38} color="#38BDF8" />
              </View>
              <Text style={[styles.idleTitle, { color: colors.textPrimary }]}>Sky Glider</Text>
              <Text style={[styles.idleSubtitle, { color: colors.textSecondary }]}>Grip Force Modulation & Altitude Tracking</Text>

              <View style={[styles.quickGuideBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>1</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Draw or slide stylus up/down to steer glider</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>2</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Squeeze into green ErgoZone (220-550g) for boost</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <Text style={styles.guideStepNum}>3</Text>
                  <Text style={[styles.guideStepText, { color: colors.textSecondary }]}>Clear 18 altitude rings to set the high score!</Text>
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
                  <Text style={styles.playBtnText}>Launch Flight 🚀</Text>
                </SpringButton>
              </View>
            </View>
          </View>
        )}

        {/* Victory / Game Over Screen */}
        {isGameOver && (
          <View style={styles.idleOverlay}>
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.trophyHalo}>
                <TrophyIcon size={42} color="#F59E0B" />
              </View>
              <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>Flight Finished!</Text>
              <Text style={styles.resultStars}>⭐️ ⭐️ ⭐️</Text>

              <View style={[styles.resultStatsRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>TOTAL SCORE</Text>
                  <Text style={[styles.resultStatVal, { color: colors.textPrimary }]}>{finalScore}</Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>GATES HIT</Text>
                  <Text style={[styles.resultStatVal, { color: colors.primary }]}>
                    {finalRingsCleared}/{TOTAL_RINGS}
                  </Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStatBox}>
                  <Text style={[styles.resultStatLabel, { color: colors.textMuted }]}>ERGO-ZONE</Text>
                  <Text style={[styles.resultStatVal, { color: colors.success }]}>
                    {finalErgoPct}%
                  </Text>
                </View>
              </View>

              <SpringButton
                style={styles.saveHistoryBtn}
                onPress={handleSaveGameSession}
              >
                <SparklesIcon size={18} color="#080C14" />
                <Text style={styles.saveHistoryBtnText}>Save Flight to History & Recs</Text>
              </SpringButton>

              <SpringButton style={[styles.retryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={startGame}>
                <Text style={[styles.retryBtnText, { color: colors.textPrimary }]}>Fly Next Corridor</Text>
              </SpringButton>
            </View>
          </View>
        )}
      </View>

      {/* Real-time Grip Pressure Biofeedback Meter */}
      <View style={[styles.ergoMeterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.ergoMeterHeader}>
          <Text style={[styles.ergoMeterTitle, { color: colors.textMuted }]}>FINGER PINCH LOAD (ERGO-ZONE: 220-550g)</Text>
          <Text
            style={[
              styles.ergoStatusText,
              { color: inErgoZone ? colors.success : colors.warning },
            ]}
          >
            {inErgoZone ? '⚡ Thruster Boost!' : '⚠️ Heavy Air Drag'}
          </Text>
          <Text style={[styles.ergoGramsValue, { color: colors.textPrimary }]}>{currentGrip} g</Text>
        </View>

        <View style={[styles.ergoTrack, { backgroundColor: colors.surfaceElevated }]}>
          <View
            style={[
              styles.ergoFill,
              {
                width: `${Math.min(100, (currentGrip / 750) * 100)}%`,
                backgroundColor: inErgoZone ? colors.success : '#F59E0B',
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
                <PlaneIcon size={28} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideModalTitle}>How to Play: Sky Glider</Text>
                <Text style={styles.guideModalSubtitle}>Fine Grip Force Modulation & Dynamic Tracking</Text>
              </View>
            </View>

            <View style={styles.guideSection}>
              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#38BDF8' }]}>1</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Altitude Steering</Text>
                  <Text style={styles.guideItemDesc}>
                    Move the stylus up and down on your Waveshare pad to control the glider's elevation and align with incoming rings.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#10B981' }]}>2</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>ErgoZone Pinch Thruster</Text>
                  <Text style={styles.guideItemDesc}>
                    Hold finger pressure in the green ErgoZone (220g – 550g). This triggers continuous plasma boost and speeds up flight.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={[styles.guideBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Text style={[styles.guideBadgeText, { color: '#EF4444' }]}>3</Text>
                </View>
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Avoid Over-Grip & Tremor</Text>
                  <Text style={styles.guideItemDesc}>
                    Clutching above 700g creates high drag penalties. Tremor spikes (&gt;5.5 Hz) cause turbulence jitter. Stay smooth and relaxed!
                  </Text>
                </View>
              </View>
            </View>

            <SpringButton
              style={styles.guideCloseBtn}
              onPress={() => setShowGuide(false)}
            >
              <CheckCircleIcon size={18} color="#080C14" />
              <Text style={styles.guideCloseBtnText}>Ready to Fly!</Text>
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
  comboPill: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ringsPill: {
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
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  planeHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
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
    color: '#38BDF8',
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
    backgroundColor: Colors.primary,
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
  ergoMeterCard: {
    width: CANVAS_WIDTH,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  ergoMeterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ergoMeterTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  ergoStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ergoGramsValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  ergoTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ergoFill: {
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
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
    color: '#38BDF8',
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
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  guideCloseBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#080C14',
  },
});
