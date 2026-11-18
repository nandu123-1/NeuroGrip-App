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
    onViolationHaptic?: () => void
  ) => {
    const { activeProfile, activeViolation, violationCount } = get();
    const now = Date.now();

    // Ignore tiny idle touches (<10g)
    if (pressureGrams < 10) {
      if (activeViolation) {
        set({ activeViolation: null });
      }
      return null;
    }

    let alert: AiViolationAlert | null = null;

    // Check Upper Pinch Force Threshold (Hypertonic Cramp Prevention)
    if (pressureGrams > activeProfile.maxSafePinchGrams) {
      alert = {
        type: 'HIGH_PINCH',
        message: `Pinch force (${Math.round(pressureGrams)}g) exceeds personal safe ceiling (${activeProfile.maxSafePinchGrams}g)`,
        value: Math.round(pressureGrams),
        threshold: activeProfile.maxSafePinchGrams,
        timestamp: now,
      };
    }
    // Check Lower Pinch Force Threshold (Slip / Hypotonic Drop Prevention)
    else if (pressureGrams < activeProfile.minSafePinchGrams && pressureGrams >= 25) {
      alert = {
        type: 'LOW_PINCH',
        message: `Pinch grip loose (${Math.round(pressureGrams)}g). Minimum secure threshold is ${activeProfile.minSafePinchGrams}g`,
        value: Math.round(pressureGrams),
        threshold: activeProfile.minSafePinchGrams,
        timestamp: now,
      };
    }
    // Check Tremor Frequency Ceiling (Tremor Surge / Dysregulation)
    else if (tremorHz > activeProfile.maxTremorCeilingHz && tremorHz > 2.0) {
      alert = {
        type: 'EXCESSIVE_TREMOR',
        message: `Tremor spike (${tremorHz.toFixed(1)}Hz) exceeds calibrated ceiling (${activeProfile.maxTremorCeilingHz}Hz)`,
        value: tremorHz,
        threshold: activeProfile.maxTremorCeilingHz,
        timestamp: now,
      };
    }

    if (alert) {
      // Trigger haptic callback if crossing into new violation or sustained after 800ms
      if (!activeViolation || activeViolation.type !== alert.type || (now - activeViolation.timestamp > 800)) {
        if (onViolationHaptic) {
          onViolationHaptic();
        }
      }
      set({
        activeViolation: alert,
        violationCount: violationCount + 1,
      });
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
    const updated: PersonalizedThresholdProfile = {
      ...activeProfile,
      minSafePinchGrams: bounds.minSafePinchGrams !== undefined ? bounds.minSafePinchGrams : activeProfile.minSafePinchGrams,
      maxSafePinchGrams: bounds.maxSafePinchGrams !== undefined ? bounds.maxSafePinchGrams : activeProfile.maxSafePinchGrams,
      maxTremorCeilingHz: bounds.maxTremorCeilingHz !== undefined ? bounds.maxTremorCeilingHz : activeProfile.maxTremorCeilingHz,
      clinicalNotes: `Manual therapist override on ${new Date().toLocaleDateString()}. Bounds: [${bounds.minSafePinchGrams ?? activeProfile.minSafePinchGrams}g - ${bounds.maxSafePinchGrams ?? activeProfile.maxSafePinchGrams}g]`,
    };
    set({ activeProfile: updated });
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
