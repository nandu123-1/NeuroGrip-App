import { create } from 'zustand';
import { BleManager, Device, BleError, Subscription } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import base64 from 'react-native-base64';

// Service & Characteristic UUIDs for Architecture 1 (ESP32 Pad Hub)
export const HUB_DEVICE_NAME = 'NeuroGrip_Hub';
export const PEN_DEVICE_NAME = 'NeuroGrip_Pen';
export const SERVICE_UUID = '19B10000-E8F2-537E-4F6C-D104768A1214';
export const CHARACTERISTIC_DATA_UUID = '19B10001-E8F2-537E-4F6C-D104768A1214';
export const CHARACTERISTIC_CMD_UUID = '19B10002-E8F2-537E-4F6C-D104768A1214';

export const bleManager = new BleManager();

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type Stroke = Point[];

export type ConnectionStatus = 'Disconnected' | 'Scanning' | 'Connecting' | 'Connected';

export interface FsrCalibration {
  adcZero: number;          // Tare baseline (ADC with no pressure)
  adcReference: number;     // Reference grip ADC
  referenceGrams: number;   // Target grams at reference grip (e.g. 250g)
  exponent: number;         // Power-law exponent
  isCalibrated: boolean;
}

export function convertFsrAdcToGrams(rawAdc: number, calib: FsrCalibration): number {
  if (!calib) return 0;
  
  // Auto-detect 12-bit (0-4095) vs 10-bit (0-1023) ADC architecture
  const is12Bit = rawAdc > 1023 || (calib.adcReference && calib.adcReference > 1023);
  const effectiveZero = calib.adcZero ?? (is12Bit ? 90 : 25);

  if (rawAdc <= effectiveZero + (is12Bit ? 20 : 6)) {
    return 0; // Filter resting sensor noise floor
  }

  const effective = rawAdc - effectiveZero;
  
  // If calib.adcReference was set with 10-bit (<=1023) but live signal is 12-bit, adapt reference dynamically
  let nominalRef = calib.adcReference || (is12Bit ? 2600 : 450);
  if (is12Bit && nominalRef <= 1023) {
    nominalRef = Math.round(nominalRef * (4095 / 1023));
  }

  const refEffective = Math.max(30, nominalRef - effectiveZero);
  const ratio = Math.max(0, effective / refEffective);

  // Non-linear FSR 402 conductance power-law curve: F ~ (G)^gamma
  const exponent = calib.exponent || 0.88;
  const refGrams = calib.referenceGrams || 250;
  const grams = Math.round(refGrams * Math.pow(ratio, exponent));
  return Math.max(0, Math.min(850, grams));
}

export function convertGramsToFsrAdc(grams: number, calib: FsrCalibration): number {
  if (!calib || grams <= 0) return calib?.adcZero ?? 90;
  const is12Bit = calib.adcReference > 1023 || calib.adcZero > 50;
  const effectiveZero = calib.adcZero ?? (is12Bit ? 90 : 25);
  let nominalRef = calib.adcReference || (is12Bit ? 2600 : 450);
  if (is12Bit && nominalRef <= 1023) {
    nominalRef = Math.round(nominalRef * (4095 / 1023));
  }
  const refGrams = calib.referenceGrams || 250;
  const exponent = calib.exponent || 0.88;
  const refEffective = Math.max(30, nominalRef - effectiveZero);
  const ratio = Math.pow(Math.max(0.01, grams / refGrams), 1.0 / exponent);
  const effective = ratio * refEffective;
  const rawAdc = Math.round(effectiveZero + effective);
  return Math.max(0, Math.min(is12Bit ? 4095 : 1023, rawAdc));
}

interface BleState {
  status: ConnectionStatus;
  device: Device | null;
  
  // Real-time Telemetry
  touchX: number;
  touchY: number;
  isTouched: boolean;
  pressure: number;            // 0 - 1023 / 4095
  pressureGrams: number;       // Calibrated 0 - 850g
  tremor: number;              // Tremor Magnitude
  tremorHz: number;            // Tremor Frequency
  penBattery: number;          // 0 - 100%
  padStatus: string;
  interventions: number;

  // FSR 402 Calibration
  fsrCalibration: FsrCalibration;
  setFsrTareZero: (zeroAdc?: number) => void;
  setFsrReferenceGrip: (refAdc?: number, targetGrams?: number) => void;
  resetFsrCalibration: () => void;
  
  // Interactive Canvas Strokes
  strokes: Stroke[];
  currentStroke: Stroke | null;
  testMode: 'free' | 'alphabet';
  alphabetSet: 'upper' | 'lower' | 'neuro';
  
  // Simulation Mode (for immediate testing without hardware)
  isSimulated: boolean;

  // Actions
  connectAndStartListening: () => Promise<void>;
  disconnect: () => Promise<void>;
  resetInterventions: () => void;
  clearStrokes: () => void;
  setTestMode: (mode: 'free' | 'alphabet') => void;
  setAlphabetSet: (setKey: 'upper' | 'lower' | 'neuro') => Promise<void>;
  sendCommand: (cmd: string) => Promise<void>;
  toggleSimulation: () => void;
  triggerBuzzerHaptic: () => Promise<void>;
  syncPersonalizedLimitsToPen: (minGrams?: number, maxGrams?: number) => Promise<boolean>;
}

let monitorSubscription: Subscription | null = null;
let disconnectSubscription: Subscription | null = null;
let simInterval: ReturnType<typeof setInterval> | null = null;
let wasTriggered = false;

export const useBleStore = create<BleState>((set, get) => ({
  status: 'Disconnected',
  device: null,
  
  touchX: 0,
  touchY: 0,
  isTouched: false,
  pressure: 0,
  pressureGrams: 0,
  tremor: 0,
  tremorHz: 0,
  penBattery: 95,
  padStatus: 'Idle',
  interventions: 0,
  
  strokes: [],
  currentStroke: null,
  testMode: 'alphabet',
  alphabetSet: 'upper',
  isSimulated: false,

  fsrCalibration: {
    adcZero: 0,
    adcReference: 700,
    referenceGrams: 250,
    exponent: 0.88,
    isCalibrated: true,
  },

  setFsrTareZero: (zeroAdc?: number) => {
    const live = zeroAdc !== undefined ? zeroAdc : get().pressure;
    set((state) => ({
      fsrCalibration: {
        ...state.fsrCalibration,
        adcZero: Math.max(0, Math.min(200, live)),
        isCalibrated: true,
      },
      pressureGrams: 0,
    }));
    // Send live hardware tare command through BLE bridge to Smart Pen
    get().sendCommand('CMD:TARE');
  },

  setFsrReferenceGrip: (refAdc?: number, targetGrams = 250) => {
    const live = refAdc !== undefined ? refAdc : get().pressure;
    const base = get().fsrCalibration.adcZero;
    const cleanRef = Math.max(base + 80, live);
    set((state) => ({
      fsrCalibration: {
        ...state.fsrCalibration,
        adcReference: cleanRef,
        referenceGrams: targetGrams,
        isCalibrated: true,
      },
      pressureGrams: targetGrams,
    }));
  },

  resetFsrCalibration: () => {
    set({
      fsrCalibration: {
        adcZero: 90,
        adcReference: 2600,
        referenceGrams: 250,
        exponent: 0.88,
        isCalibrated: false,
      },
    });
  },

  resetInterventions: () => set({ interventions: 0 }),
  
  clearStrokes: () => {
    set({ strokes: [], currentStroke: null });
    get().sendCommand('CMD:CLEAR');
  },

  setTestMode: (mode) => {
    set({ testMode: mode, strokes: [], currentStroke: null });
    if (mode === 'free') {
      get().sendCommand('CMD:MODE:FREE');
    } else {
      const { alphabetSet } = get();
      const cmd = alphabetSet === 'lower' ? 'CMD:MODE:ALPHA:LOWER' :
                  alphabetSet === 'neuro' ? 'CMD:MODE:ALPHA:NEURO' : 'CMD:MODE:ALPHA:UPPER';
      get().sendCommand(cmd);
    }
  },

  setAlphabetSet: async (setKey) => {
    set({ alphabetSet: setKey, strokes: [], currentStroke: null });
    const cmd = setKey === 'lower' ? 'CMD:MODE:ALPHA:LOWER' :
                setKey === 'neuro' ? 'CMD:MODE:ALPHA:NEURO' : 'CMD:MODE:ALPHA:UPPER';
    await get().sendCommand(cmd);
  },

  sendCommand: async (cmd: string) => {
    const { device, status } = get();
    if (device && status === 'Connected') {
      try {
        const cmdBase64 = base64.encode(cmd);
        await device.writeCharacteristicWithoutResponseForService(
          SERVICE_UUID,
          CHARACTERISTIC_CMD_UUID,
          cmdBase64
        );
        console.log('[BLE] Sent command (NR):', cmd);
      } catch (err) {
        try {
          const cmdBase64 = base64.encode(cmd);
          await device.writeCharacteristicWithResponseForService(
            SERVICE_UUID,
            CHARACTERISTIC_CMD_UUID,
            cmdBase64
          );
          console.log('[BLE] Sent command (WR):', cmd);
        } catch (e2) {
          console.warn('[BLE] Could not send command:', cmd, e2);
        }
      }
    }
  },

  toggleSimulation: () => {
    const { isSimulated } = get();
    if (isSimulated) {
      if (simInterval) clearInterval(simInterval);
      set({ isSimulated: false, status: 'Disconnected' });
    } else {
      set({ isSimulated: true, status: 'Connected', padStatus: 'Simulated Online' });
      
      let letterProgress = 0;
      let letterIndex = 0;
      
      // Simulation letter waypoints for "A" and "B" across 480x320 pad
      const letterWaypoints = [
        // Letter 'A': bottom-left (100, 240) -> apex (140, 80) -> bottom-right (180, 240) -> crossbar (118, 170 to 162, 170)
        [
          { x: 100, y: 240 }, { x: 120, y: 160 }, { x: 140, y: 80 },
          { x: 160, y: 160 }, { x: 180, y: 240 },
          { x: 120, y: 170 }, { x: 160, y: 170 },
        ],
        // Letter 'B': stem (220, 240 to 220, 80) -> top loop -> bottom loop
        [
          { x: 220, y: 240 }, { x: 220, y: 160 }, { x: 220, y: 80 },
          { x: 260, y: 80 }, { x: 275, y: 120 }, { x: 235, y: 160 },
          { x: 280, y: 200 }, { x: 250, y: 240 }, { x: 220, y: 240 },
        ]
      ];

      simInterval = setInterval(() => {
        letterProgress += 1;
        const currentPath = letterWaypoints[letterIndex % letterWaypoints.length];
        const step = letterProgress % currentPath.length;
        if (letterProgress % currentPath.length === 0) {
          letterIndex += 1;
        }

        const targetPt = currentPath[step];
        const simX = targetPt.x + Math.round((Math.random() - 0.5) * 2);
        const simY = targetPt.y + Math.round((Math.random() - 0.5) * 2);
        const simPressure = Math.round(340 + 120 * Math.sin(letterProgress * 0.4));
        const simGrams = convertFsrAdcToGrams(simPressure, get().fsrCalibration);
        const simTremor = Math.round(2100 + 1500 * Math.abs(Math.sin(letterProgress * 0.2)));
        const simTremorHz = +(3.6 + Math.sin(letterProgress * 0.1) * 0.8).toFixed(1);

        const newPoint: Point = { x: simX, y: simY, pressure: simPressure };
        const isTriggered = simPressure > 700 || simTremor > 6000;

        set((state) => {
          let newInterventions = state.interventions;
          if (isTriggered && !wasTriggered) {
            newInterventions++;
          }
          wasTriggered = isTriggered;

          const updatedStroke = state.currentStroke ? [...state.currentStroke, newPoint] : [newPoint];

          return {
            touchX: simX,
            touchY: simY,
            isTouched: true,
            pressure: simPressure,
            pressureGrams: simGrams,
            tremor: simTremor,
            tremorHz: simTremorHz,
            interventions: newInterventions,
            currentStroke: updatedStroke.length > 50 ? [] : updatedStroke,
            strokes: updatedStroke.length > 50 ? [...state.strokes, updatedStroke] : state.strokes
          };
        });
      }, 60);
    }
  },

  disconnect: async () => {
    const { device } = get();
    if (simInterval) clearInterval(simInterval);
    if (device) {
      try {
        await bleManager.cancelDeviceConnection(device.id);
      } catch (e) {
        // ignore
      }
    }
    if (monitorSubscription) monitorSubscription.remove();
    if (disconnectSubscription) disconnectSubscription.remove();
    set({
      status: 'Disconnected',
      device: null,
      pressure: 0,
      pressureGrams: 0,
      tremor: 0,
      isTouched: false,
      isSimulated: false
    });
  },

  triggerBuzzerHaptic: async () => {
    const { device } = get();
    if (device) {
      try {
        const cmdBase64 = base64.encode('BUZZ:200'); // 200ms haptic alert
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          CHARACTERISTIC_CMD_UUID,
          cmdBase64
        );
      } catch (e) {
        console.warn('Failed to send buzzer command', e);
      }
    }
  },

  syncPersonalizedLimitsToPen: async (minGrams?: number, maxGrams?: number) => {
    const { fsrCalibration, sendCommand, device, status } = get();
    if (!device || status !== 'Connected') {
      console.log('[BLE] Pen not connected. Threshold will sync upon reconnection.');
      return false;
    }
    try {
      const { useAiStore } = require('./useAiStore');
      const activeProfile = useAiStore.getState().activeProfile;
      const targetMinG = minGrams ?? activeProfile.minSafePinchGrams;
      const targetMaxG = maxGrams ?? activeProfile.maxSafePinchGrams;

      // Send direct grams protocol to Pen firmware
      const cmdGrams = `CMD:GRAMS:${targetMinG},${targetMaxG}`;
      await sendCommand(cmdGrams);

      // Also send THRESH protocol in grams for backward compatibility
      const cmdThresh = `CMD:THRESH:${targetMinG},${targetMaxG}`;
      await sendCommand(cmdThresh);
      console.log(`[BLE] Synced personalized thresholds to pen: ${cmdGrams} (${targetMinG}g - ${targetMaxG}g)`);
      return true;
    } catch (err) {
      console.warn('[BLE] Could not sync thresholds to pen:', err);
      return false;
    }
  },

  connectAndStartListening: async () => {
    set({ status: 'Scanning' });

    // Request Android 12+ BLE Permissions
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      if (result['android.permission.BLUETOOTH_SCAN'] !== 'granted') {
        console.warn('Bluetooth permissions denied');
        set({ status: 'Disconnected' });
        return;
      }
    }

    bleManager.startDeviceScan(null, null, async (error, scannedDevice) => {
      if (error) {
        console.warn('Scan error:', error);
        set({ status: 'Disconnected' });
        return;
      }

      // Look for NeuroGrip_Hub (Pad) or NeuroGrip / NeuroGrip_Pen
      if (
        scannedDevice &&
        (scannedDevice.name === HUB_DEVICE_NAME ||
         scannedDevice.name === PEN_DEVICE_NAME ||
         scannedDevice.name === 'NeuroGrip' ||
         scannedDevice.name === 'SmartPen_BLE')
      ) {
        bleManager.stopDeviceScan();
        set({ status: 'Connecting', device: scannedDevice });

        try {
          const connectedDevice = await scannedDevice.connect();
          const deviceWithServices = await connectedDevice.discoverAllServicesAndCharacteristics();
          
          set({ status: 'Connected', device: deviceWithServices });

          // Request High Connection Priority (1 = ConnectionPriorityHigh: 11.25ms - 15ms interval)
          try {
            await connectedDevice.requestConnectionPriority(1);
          } catch (e) {
            console.warn('[BLE] Could not set high connection priority', e);
          }

          // Initial mode sync to hardware pad
          setTimeout(() => {
            const { testMode, alphabetSet } = get();
            if (testMode === 'free') {
              get().sendCommand('CMD:MODE:FREE');
            } else {
              const cmd = alphabetSet === 'lower' ? 'CMD:MODE:ALPHA:LOWER' :
                          alphabetSet === 'neuro' ? 'CMD:MODE:ALPHA:NEURO' : 'CMD:MODE:ALPHA:UPPER';
              get().sendCommand(cmd);
            }
          }, 350);

          // Auto-sync personalized limits to pen
          setTimeout(() => {
            get().syncPersonalizedLimitsToPen();
          }, 700);

          disconnectSubscription = bleManager.onDeviceDisconnected(connectedDevice.id, () => {
            set({ status: 'Disconnected', device: null, isTouched: false });
            if (monitorSubscription) monitorSubscription.remove();
          });

          // Monitor Unified Telemetry Stream
          // Expected protocol: "X:240,Y:160,P:450,T:3200,B:95" or "P:450,T:3200" or "EVT:CLEAR" / "EVT:MODE:n"
          monitorSubscription = deviceWithServices.monitorCharacteristicForService(
            SERVICE_UUID,
            CHARACTERISTIC_DATA_UUID,
            (monitorError: BleError | null, characteristic) => {
              if (monitorError || !characteristic?.value) return;

              const raw = base64.decode(characteristic.value);

              // 0. Hardware Event from Writing Pad (Two-Way Sync)
              if (raw.startsWith('EVT:CLEAR')) {
                set({ strokes: [], currentStroke: null });
                return;
              }
              if (raw.startsWith('EVT:MODE:')) {
                const code = parseInt(raw.slice(9), 10);
                if (code === 0) set({ testMode: 'free', strokes: [], currentStroke: null });
                else if (code === 1) set({ testMode: 'alphabet', alphabetSet: 'upper', strokes: [], currentStroke: null });
                else if (code === 2) set({ testMode: 'alphabet', alphabetSet: 'lower', strokes: [], currentStroke: null });
                else if (code === 3) set({ testMode: 'alphabet', alphabetSet: 'neuro', strokes: [], currentStroke: null });
                return;
              }
              if (raw.startsWith('EVT:THEME:')) {
                const isLight = raw.includes('LIGHT');
                const themeMode = isLight ? 'light' : 'dark';
                try {
                  const { useThemeStore } = require('./useThemeStore');
                  const { DarkColors, LightColors } = require('../theme/colors');
                  useThemeStore.setState({
                    theme: themeMode,
                    colors: isLight ? LightColors : DarkColors,
                  });
                } catch (e) {
                  console.warn('Could not sync theme from hardware event', e);
                }
                return;
              }

              // 1. Fast Full Pad Hub packet: X:(\d+),Y:(\d+),P:(\d+),T:(\d+),B:(\d+)
              if (raw.charCodeAt(0) === 88 /* 'X' */) {
                const parts = raw.split(',');
                if (parts.length >= 4) {
                  const x = parseInt(parts[0].slice(2), 10) || 0;
                  const y = parseInt(parts[1].slice(2), 10) || 0;
                  const p = parseInt(parts[2].slice(2), 10) || 0;
                  const t = parseInt(parts[3].slice(2), 10) || 0;
                  const isDown = x > 0 && y > 0;

                  const grams = convertFsrAdcToGrams(p, get().fsrCalibration);
                  const isTriggered = grams > 420 || t > 6000;

                  set((state) => {
                    let newInterventions = state.interventions;
                    if (isTriggered && !wasTriggered) {
                      newInterventions++;
                    }
                    wasTriggered = isTriggered;

                    let updatedCurrent = state.currentStroke;
                    let updatedStrokes = state.strokes;

                    if (isDown) {
                      // Filter micro-jitter (<2px distance from last point)
                      if (updatedCurrent && updatedCurrent.length > 0) {
                        const lastPt = updatedCurrent[updatedCurrent.length - 1];
                        if (Math.abs(lastPt.x - x) < 2 && Math.abs(lastPt.y - y) < 2) {
                          return {
                            touchX: x,
                            touchY: y,
                            isTouched: true,
                            pressure: p,
                            pressureGrams: grams,
                            tremor: t,
                            tremorHz: +(3.0 + (t / 3000)).toFixed(1),
                            interventions: newInterventions
                          };
                        }
                      }
                      const pt: Point = { x, y, pressure: p };
                      updatedCurrent = updatedCurrent ? [...updatedCurrent, pt] : [pt];
                    } else if (updatedCurrent && updatedCurrent.length > 0) {
                      updatedStrokes = [...updatedStrokes, updatedCurrent];
                      updatedCurrent = null;
                    } else if (!state.isTouched) {
                      return {
                        touchX: 0,
                        touchY: 0,
                        isTouched: false,
                        pressure: p,
                        pressureGrams: grams,
                        tremor: t,
                        tremorHz: +(3.0 + (t / 3000)).toFixed(1),
                        interventions: newInterventions
                      };
                    }

                    return {
                      touchX: x,
                      touchY: y,
                      isTouched: isDown,
                      pressure: p,
                      pressureGrams: grams,
                      tremor: t,
                      tremorHz: +(3.0 + (t / 3000)).toFixed(1),
                      interventions: newInterventions,
                      currentStroke: updatedCurrent,
                      strokes: updatedStrokes
                    };
                  });
                  return;
                }
              }

              // 2. Direct Pen packet: P:(\d+),T:(\d+) or Grip=(\d+)|Tremor=([\d.]+)
              const match = raw.match(/P:(\d+),T:(\d+)/);
              const gripMatch = raw.match(/Grip=(\d+).*?Tremor=([\d.]+)/i);

              if (match || gripMatch) {
                const currentPressure = match ? parseInt(match[1], 10) : parseInt(gripMatch![1], 10);
                const currentTremor = match
                  ? parseInt(match[2], 10)
                  : Math.round(parseFloat(gripMatch![2]) * 1000);

                const grams = convertFsrAdcToGrams(currentPressure, get().fsrCalibration);
                const isTriggered = grams > 420 || currentTremor > 6000;

                set((state) => {
                  let newInterventions = state.interventions;
                  if (isTriggered && !wasTriggered) {
                    newInterventions++;
                  }
                  wasTriggered = isTriggered;

                  return {
                    pressure: currentPressure,
                    pressureGrams: grams,
                    tremor: currentTremor,
                    tremorHz: +(3.0 + (currentTremor / 3000)).toFixed(1),
                    interventions: newInterventions
                  };
                });
              }
            }
          );
        } catch (connectionError) {
          console.warn('Connection failed:', connectionError);
          set({ status: 'Disconnected', device: null });
        }
      }
    });
  }
}));
