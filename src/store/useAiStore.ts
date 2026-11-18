import { create } from 'zustand';
import {
  NeuroGripAiEngine,
  RawPoint,
  PersonalizedThresholdProfile,
  AiAssessmentResult,
  ExtractedKinematicFeatures,
} from '../ai/neurogripAiModel';

interface AiViolationAlert {
  type: 'HIGH_PINCH' | 'LOW_PINCH' | 'EXCESSIVE_TREMOR' | 'MICROGRAPHIA';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface AiState {
  // Personalized Patient Threshold Profile
  activeProfile: PersonalizedThresholdProfile;

  // Active / Latest Clinical AI Motor Assessment
  latestAssessment: AiAssessmentResult | null;

  // Real-time Calibration Workflow State (30-sec Guided Task)
  isCalibrating: boolean;
  calibrationProgress: number; // 0 - 100%
  calibrationPoints: RawPoint[];
  calibrationCountdown: number; // 30s down to 0

  // Real-time Threshold Violation State (live pen stream monitor)
  activeViolation: AiViolationAlert | null;
  violationCount: number;

  // Actions
  startCalibration: (patientId?: string) => void;
  recordCalibrationPoint: (point: RawPoint) => void;
  updateCalibrationCountdown: (secondsRemaining: number) => void;
  finishCalibration: () => PersonalizedThresholdProfile;
  cancelCalibration: () => void;
  
  // Real-time Telemetry Monitor
  checkLiveTelemetry: (
    pressureGrams: number,
    tremorHz: number,
    isWriting?: boolean,
    onViolationHaptic?: () => void
  ) => AiViolationAlert | null;
  clearActiveViolation: () => void;

  // Full Session Motor Assessment
  evaluateSessionPoints: (points: RawPoint[]) => AiAssessmentResult;

  // Manual Fine-Tuning by Clinician/Therapist
  updateCustomThresholds: (bounds: {
    minSafePinchGrams?: number;
    maxSafePinchGrams?: number;
    maxTremorCeilingHz?: number;
  }) => void;

  resetToDefaultProfile: () => void;
}

const DEFAULT_PROFILE: PersonalizedThresholdProfile = {
  patientId: 'PT-9042',
  isCalibrated: false,
  calibrationDate: 'Not Calibrated',
  baselinePinchGrams: 175,
  pinchStdDev: 25,
  minSafePinchGrams: 120,
  maxSafePinchGrams: 260,
  baselineTremorHz: 4.8,
  maxTremorCeilingHz: 6.5,
  kumoAnomalyBaseline: 0.18,
  conditionIndicator: 'Normal Baseline',
  pdRiskScore: 22,
  stabilityIndex: 88,
  clinicalNotes: 'Standard population baseline applied. Run 30-sec calibration loop to establish patient-specific envelope.',
};

export const useAiStore = create<AiState>((set, get) => ({
  activeProfile: DEFAULT_PROFILE,
  latestAssessment: null,
  isCalibrating: false,
  calibrationProgress: 0,
  calibrationPoints: [],
  calibrationCountdown: 30,
  activeViolation: null,
  violationCount: 0,

  startCalibration: (patientId?: string) => {
    set({
      isCalibrating: true,
      calibrationProgress: 0,
      calibrationCountdown: 30,
      calibrationPoints: [],
      activeViolation: null,
    });
  },

  recordCalibrationPoint: (point: RawPoint) => {
    const { isCalibrating, calibrationPoints } = get();
    if (!isCalibrating) return;

    const newPoints = [...calibrationPoints, point];
    const progress = Math.min(100, Math.round((newPoints.length / 300) * 100)); // ~300 points in 30s @ 10Hz
    set({
      calibrationPoints: newPoints,
      calibrationProgress: progress,
    });
  },

  updateCalibrationCountdown: (secondsRemaining: number) => {
    const progress = Math.min(100, Math.round(((30 - secondsRemaining) / 30) * 100));
    set({
      calibrationCountdown: secondsRemaining,
      calibrationProgress: progress,
    });
  },

  finishCalibration: () => {
    const { calibrationPoints, activeProfile } = get();
    const pid = activeProfile.patientId || 'PT-9042';

    // Run AI calibration algorithm
    const calibrated = NeuroGripAiEngine.calibratePersonalProfile(pid, calibrationPoints);
    const features = NeuroGripAiEngine.extractFeatures(calibrationPoints);
    const assessment = NeuroGripAiEngine.evaluateMotorCondition(features);

    const fullAssessment: AiAssessmentResult = {
      timestamp: new Date().toLocaleTimeString(),
      overallScore: assessment.stabilityIndex,
      pdProbability: assessment.pdProbability,
      kumoAnomalyScore: features.kumoAnomalyScore,
      micrographiaSlope: features.micrographiaDecaySlope,
      detectedCondition: assessment.detectedCondition,
      severity: assessment.severity,
      features,
      recommendations: assessment.recommendations,
    };

    set({
      activeProfile: calibrated,
      latestAssessment: fullAssessment,
      isCalibrating: false,
      calibrationProgress: 100,
      calibrationCountdown: 0,
      calibrationPoints: [],
    });

    // Auto-sync personalized limits to Smart Pen firmware via BLE
    try {
      const { useBleStore } = require('./useBleStore');
      useBleStore.getState().syncPersonalizedLimitsToPen(calibrated.minSafePinchGrams, calibrated.maxSafePinchGrams);
    } catch (e) {
      console.warn('[AI] Could not auto-sync limits to pen on calibration finish', e);
    }

    return calibrated;
  },

  cancelCalibration: () => {
    set({
      isCalibrating: false,
      calibrationProgress: 0,
      calibrationCountdown: 30,
      calibrationPoints: [],
    });
  },

  checkLiveTelemetry: (
    pressureGrams: number,
    tremorHz: number,
    isWriting = false,
    onViolationHaptic?: () => void
  ) => {
    const { activeProfile, activeViolation } = get();
    const now = Date.now();

    // Ignore tiny idle touches (<15g)
    if (pressureGrams < 15) {
      if (activeViolation) {
        set({ activeViolation: null });
      }
      return null;
    }

    let alert: AiViolationAlert | null = null;

    // 1. Check Upper Pinch Force Threshold (Always active to prevent fatigue and cramp)
    if (pressureGrams > activeProfile.maxSafePinchGrams) {
      alert = {
        type: 'HIGH_PINCH',
        message: `Pinch force (${Math.round(pressureGrams)}g) exceeds personal safe ceiling (${activeProfile.maxSafePinchGrams}g)`,
        value: Math.round(pressureGrams),
        threshold: activeProfile.maxSafePinchGrams,
        timestamp: now,
      };
    }
    // 2. Check Lower Pinch Force Threshold ONLY WHEN ACTIVELY INKING ON DIGITIZER
    // This stops false alarms when the user is simply resting or hovering the pen
    else if (isWriting && pressureGrams < activeProfile.minSafePinchGrams && pressureGrams >= 25) {
      alert = {
        type: 'LOW_PINCH',
        message: `Pinch grip loose (${Math.round(pressureGrams)}g). Minimum secure threshold is ${activeProfile.minSafePinchGrams}g`,
        value: Math.round(pressureGrams),
        threshold: activeProfile.minSafePinchGrams,
        timestamp: now,
      };
    }
    // 3. Check Tremor Frequency Ceiling (Flags acute kinetic tremors above patient baseline)
    else if (tremorHz > activeProfile.maxTremorCeilingHz && tremorHz > 3.0) {
      alert = {
        type: 'EXCESSIVE_TREMOR',
        message: `Tremor spike (${tremorHz.toFixed(1)}Hz) exceeds calibrated ceiling (${activeProfile.maxTremorCeilingHz}Hz)`,
        value: tremorHz,
        threshold: activeProfile.maxTremorCeilingHz,
        timestamp: now,
      };
    }

    // Debounce state updates: only trigger state update if alert type changed or 1200ms elapsed
    if (alert) {
      const isNewType = !activeViolation || activeViolation.type !== alert.type;
      const isSustainedInterval = activeViolation && (now - activeViolation.timestamp > 1200);

      if (isNewType || isSustainedInterval) {
        if (onViolationHaptic) {
          onViolationHaptic();
        }
        set((state) => ({
          activeViolation: alert,
          violationCount: isNewType ? state.violationCount + 1 : state.violationCount,
        }));
      }
    } else if (activeViolation) {
      set({ activeViolation: null });
    }

    return alert;
  },

  clearActiveViolation: () => {
    set({ activeViolation: null });
  },

  evaluateSessionPoints: (points: RawPoint[]): AiAssessmentResult => {
    const features = NeuroGripAiEngine.extractFeatures(points);
    const evalResult = NeuroGripAiEngine.evaluateMotorCondition(features);

    const assessment: AiAssessmentResult = {
      timestamp: new Date().toLocaleTimeString(),
      overallScore: evalResult.stabilityIndex,
      pdProbability: evalResult.pdProbability,
      kumoAnomalyScore: features.kumoAnomalyScore,
      micrographiaSlope: features.micrographiaDecaySlope,
      detectedCondition: evalResult.detectedCondition,
      severity: evalResult.severity,
      features,
      recommendations: evalResult.recommendations,
    };

    set({ latestAssessment: assessment });
    return assessment;
  },

  updateCustomThresholds: (bounds) => {
    const { activeProfile } = get();
    const newMin = bounds.minSafePinchGrams !== undefined ? bounds.minSafePinchGrams : activeProfile.minSafePinchGrams;
    const rawMax = bounds.maxSafePinchGrams !== undefined ? bounds.maxSafePinchGrams : activeProfile.maxSafePinchGrams;
    const newMax = Math.max(newMin + 40, rawMax);
    const newTremor = bounds.maxTremorCeilingHz !== undefined ? bounds.maxTremorCeilingHz : activeProfile.maxTremorCeilingHz;

    const updated: PersonalizedThresholdProfile = {
      ...activeProfile,
      minSafePinchGrams: newMin,
      maxSafePinchGrams: newMax,
      maxTremorCeilingHz: newTremor,
      clinicalNotes: `Manual therapist override on ${new Date().toLocaleDateString()}. Bounds: [${newMin}g - ${newMax}g], Tremor: <${newTremor}Hz`,
    };
    set({ activeProfile: updated });

    // Sync updated manual thresholds to pen firmware
    try {
      const { useBleStore } = require('./useBleStore');
      useBleStore.getState().syncPersonalizedLimitsToPen(newMin, newMax);
    } catch (e) {
      console.warn('[AI] Could not auto-sync custom limits to pen', e);
    }
  },

  resetToDefaultProfile: () => {
    set({
      activeProfile: DEFAULT_PROFILE,
      latestAssessment: null,
      activeViolation: null,
      violationCount: 0,
    });
  },
}));
