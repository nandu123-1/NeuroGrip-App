import { create } from 'zustand';

export interface Recommendation {
  id: string;
  category: 'ergonomic' | 'exercise' | 'clinical' | 'pacing';
  title: string;
  detail: string;
  actionableTip: string;
  badgeColor: string;
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  dateString: string;
  testType: 'alphabet' | 'free' | 'steadiness' | 'fatigue' | 'game';
  testName: string;
  durationSeconds: number;
  avgGripGrams: number;
  peakGripGrams: number;
  avgTremorHz: number;
  tremorSeverity: 'Low' | 'Mild' | 'Moderate' | 'Elevated';
  stabilityScore: number; // 0 - 100
  interventions: number;
  strokesCount: number;
  recommendations: Recommendation[];
}

export function generateRecommendations(
  avgGrip: number,
  peakGrip: number,
  tremorHz: number,
  interventions: number,
  stability: number
): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Grip Pressure Analysis
  if (avgGrip > 380 || peakGrip > 520) {
    recs.push({
      id: 'grip-high',
      category: 'ergonomic',
      title: 'Compensatory Pinch Overpressure',
      detail: `Average pinch grip was ${avgGrip}g (peak ${peakGrip}g), significantly exceeding the optimal 180-320g writing range.`,
      actionableTip: 'Perform 60 seconds of gentle tendon-gliding stretches before writing. Try using a 14mm contoured silicone pen grip to distribute flexor load.',
      badgeColor: '#EF4444',
    });
  } else if (avgGrip < 140) {
    recs.push({
      id: 'grip-light',
      category: 'ergonomic',
      title: 'Sub-Optimal Contact Stability',
      detail: `Average grip force was ${avgGrip}g. Light contact can lead to stroke discontinuity and slip on glass.`,
      actionableTip: 'Maintain firm thumb-index contact and rest the fourth and fifth fingers against the writing surface for base stability.',
      badgeColor: '#F59E0B',
    });
  } else {
    recs.push({
      id: 'grip-optimal',
      category: 'ergonomic',
      title: 'Balanced Ergonomic Pinch Force',
      detail: `Average pinch force was ${avgGrip}g, maintaining smooth muscular efficiency throughout the session.`,
      actionableTip: 'Continue holding the pen at this baseline force to prevent premature hand fatigue during extended sessions.',
      badgeColor: '#10B981',
    });
  }

  // 2. Kinetic Tremor Frequency Analysis
  if (tremorHz >= 4.0 && tremorHz <= 6.5) {
    recs.push({
      id: 'tremor-clinical',
      category: 'clinical',
      title: 'Action Tremor Oscillations (4-6 Hz)',
      detail: `Dominant movement frequency peaked at ${tremorHz} Hz during continuous path tracing.`,
      actionableTip: 'Practice in the Biofeedback Coach (Play tab). Anchor the ulnar side of your wrist firmly to the desk to mechanically dampen kinetic oscillation.',
      badgeColor: '#8B5CF6',
    });
  } else if (tremorHz > 6.5) {
    recs.push({
      id: 'tremor-fast',
      category: 'clinical',
      title: 'High-Frequency Postural Tremor (>6.5 Hz)',
      detail: `High-frequency micro-tremor detected at ${tremorHz} Hz, commonly associated with physiological fatigue or autonomic activation.`,
      actionableTip: 'Check caffeine intake prior to testing and allow 2 minutes of hand-relaxation breathing exercises before initiating tests.',
      badgeColor: '#EC4899',
    });
  }

  // 3. Pacing and Fatigue Interventions
  if (interventions >= 3) {
    recs.push({
      id: 'pacing-fatigue',
      category: 'pacing',
      title: 'Neuromuscular Fatigue Breakdown',
      detail: `${interventions} haptic biofeedback threshold alerts were triggered as motor steadiness declined over time.`,
      actionableTip: 'Adopt a 3-minute writing block with mandatory 45-second palm extension intervals to forestall motor fatigue.',
      badgeColor: '#F59E0B',
    });
  }

  // 4. Overall Coordination & Exercise Progression
  if (stability >= 82) {
    recs.push({
      id: 'exercise-advanced',
      category: 'exercise',
      title: 'Superior Motor Control (>80%)',
      detail: `Overall trajectory smoothness and grip constancy scored ${stability}%.`,
      actionableTip: 'Advance to tightening spiral radii and continuous cursive loop exercises to reinforce neuromuscular calibration.',
      badgeColor: '#0EA5E9',
    });
  } else {
    recs.push({
      id: 'exercise-foundational',
      category: 'exercise',
      title: 'Prescribed Steady-Line Training',
      detail: `Motor stability index recorded at ${stability}%. Trajectory showed minor deviation under speed changes.`,
      actionableTip: 'Complete two daily 3-minute spiral traces at steady pacing before progressing to rapid cursive handwriting.',
      badgeColor: '#06B6D4',
    });
  }

  return recs;
}

const initialSeedSessions: SessionRecord[] = [
  {
    id: 'sess-001',
    timestamp: Date.now() - 1000 * 60 * 35, // 35 mins ago
    dateString: 'Today, 11:42 AM',
    testType: 'alphabet',
    testName: 'Alphabet Handwriting Tracing',
    durationSeconds: 114,
    avgGripGrams: 285,
    peakGripGrams: 470,
    avgTremorHz: 4.8,
    tremorSeverity: 'Mild',
    stabilityScore: 84,
    interventions: 1,
    strokesCount: 4,
    recommendations: generateRecommendations(285, 470, 4.8, 1, 84),
  },
  {
    id: 'sess-002',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 1 - 1000 * 60 * 120, // Yesterday
    dateString: 'Yesterday, 04:15 PM',
    testType: 'alphabet',
    testName: 'Dysgraphia Alphabet Assessment',
    durationSeconds: 142,
    avgGripGrams: 410,
    peakGripGrams: 560,
    avgTremorHz: 5.2,
    tremorSeverity: 'Moderate',
    stabilityScore: 73,
    interventions: 4,
    strokesCount: 7,
    recommendations: generateRecommendations(410, 560, 5.2, 4, 73),
  },
  {
    id: 'sess-003',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2 - 1000 * 60 * 200, // 2 days ago
    dateString: 'Nov 16, 10:20 AM',
    testType: 'free',
    testName: 'Freehand Digital Inking & Note Test',
    durationSeconds: 210,
    avgGripGrams: 310,
    peakGripGrams: 485,
    avgTremorHz: 4.2,
    tremorSeverity: 'Mild',
    stabilityScore: 79,
    interventions: 2,
    strokesCount: 18,
    recommendations: generateRecommendations(310, 485, 4.2, 2, 79),
  },
  {
    id: 'sess-004',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 90, // 3 days ago
    dateString: 'Nov 15, 02:45 PM',
    testType: 'steadiness',
    testName: 'Static Hold & Fine Motor Calibration',
    durationSeconds: 90,
    avgGripGrams: 220,
    peakGripGrams: 340,
    avgTremorHz: 3.8,
    tremorSeverity: 'Low',
    stabilityScore: 89,
    interventions: 0,
    strokesCount: 2,
    recommendations: generateRecommendations(220, 340, 3.8, 0, 89),
  },
  {
    id: 'sess-005',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago
    dateString: 'Nov 14, 04:15 PM',
    testType: 'game',
    testName: 'Sky Glider: AeroTherapy Flight',
    durationSeconds: 65,
    avgGripGrams: 285,
    peakGripGrams: 420,
    avgTremorHz: 4.1,
    tremorSeverity: 'Mild',
    stabilityScore: 86,
    interventions: 1,
    strokesCount: 42,
    recommendations: [
      {
        id: 'game-glider-ergo',
        category: 'ergonomic',
        title: 'Ergonomic Speed Modulation (78% in Zone)',
        detail: 'Maintained optimal 250-550g grip boost throughout straightaways. Squeeze intensified slightly on sharp turns.',
        actionableTip: 'Keep thumb loose when turning the glider to avoid involuntary pinch spikes.',
        badgeColor: '#10B981',
      },
      {
        id: 'game-glider-steadiness',
        category: 'exercise',
        title: 'Fluid Trajectory Tracking',
        detail: 'Cleared 14/16 sky rings with minimal turbulence deviation.',
        actionableTip: 'Progress to Archimedean Spiral Level 2 to build continuous circular muscle memory.',
        badgeColor: '#38BDF8',
      },
    ],
  },
];

interface SessionState {
  sessions: SessionRecord[];
  activeFilter: 'all' | 'alphabet' | 'free' | 'game' | 'alert';
  selectedSessionId: string | null;

  // Actions
  setFilter: (filter: 'all' | 'alphabet' | 'free' | 'game' | 'alert') => void;
  selectSession: (id: string | null) => void;
  addSession: (data: {
    testType: 'alphabet' | 'free' | 'steadiness' | 'fatigue' | 'game';
    testName: string;
    durationSeconds: number;
    avgGripGrams: number;
    peakGripGrams: number;
    avgTremorHz: number;
    interventions: number;
    strokesCount: number;
    customRecommendations?: Recommendation[];
  }) => SessionRecord;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: initialSeedSessions,
  activeFilter: 'all',
  selectedSessionId: null,

  setFilter: (activeFilter) => set({ activeFilter }),
  selectSession: (selectedSessionId) => set({ selectedSessionId }),

  addSession: (data) => {
    const stabilityScore = Math.max(
      35,
      Math.min(
        98,
        Math.round(
          100 -
            (data.interventions * 6 +
              Math.max(0, data.avgGripGrams - 320) * 0.08 +
              Math.max(0, data.avgTremorHz - 3.5) * 8)
        )
      )
    );

    let tremorSeverity: 'Low' | 'Mild' | 'Moderate' | 'Elevated' = 'Low';
    if (data.avgTremorHz > 6.0) tremorSeverity = 'Elevated';
    else if (data.avgTremorHz > 5.0) tremorSeverity = 'Moderate';
    else if (data.avgTremorHz > 4.0) tremorSeverity = 'Mild';

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = `Today, ${timeStr}`;

    const newSession: SessionRecord = {
      id: `sess-${Date.now()}`,
      timestamp: Date.now(),
      dateString,
      testType: data.testType,
      testName: data.testName,
      durationSeconds: Math.max(15, data.durationSeconds),
      avgGripGrams: data.avgGripGrams,
      peakGripGrams: data.peakGripGrams,
      avgTremorHz: data.avgTremorHz,
      tremorSeverity,
      stabilityScore,
      interventions: data.interventions,
      strokesCount: data.strokesCount,
      recommendations:
        data.customRecommendations && data.customRecommendations.length > 0
          ? data.customRecommendations
          : generateRecommendations(
              data.avgGripGrams,
              data.peakGripGrams,
              data.avgTremorHz,
              data.interventions,
              stabilityScore
            ),
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      selectedSessionId: newSession.id,
    }));

    return newSession;
  },

  deleteSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      selectedSessionId: state.selectedSessionId === id ? null : state.selectedSessionId,
    })),

  clearHistory: () => set({ sessions: [], selectedSessionId: null }),
}));
