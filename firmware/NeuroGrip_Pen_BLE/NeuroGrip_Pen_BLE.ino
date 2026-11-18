/*
 * =====================================================================
 * NEUROGRIP SMART PEN - ARCHITECTURE 1 TRANSMITTER FIRMWARE
 * Board: Seeed Studio XIAO nRF52840 (or XIAO SAMD21/ESP32C3)
 * Sensors:
 *   - Interlink FSR 402 on Analog Pin A0 (Index finger pinch force)
 *   - InvenSense MPU-6050 (GY-521) on I2C (SDA=D4, SCL=D5)
 *   - KY-012 Active Buzzer on Digital Pin D0
 * BLE Protocol:
 *   - Device Name: "NeuroGrip_Pen"
 *   - Service UUID: 19B10000-E8F2-537E-4F6C-D104768A1214
 *   - Data Char (Notify): 19B10001-E8F2-537E-4F6C-D104768A1214
 *   - Cmd Char (Write):   19B10002-E8F2-537E-4F6C-D104768A1214
 * =====================================================================
 */

#include <ArduinoBLE.h>
#include <Wire.h>

// Hardware Pin Definitions
#define PIN_FSR         A0
#define PIN_BUZZER      D0

// MPU-6050 I2C Address
#define MPU6050_ADDR    0x68

// BLE UUIDs
#define BLE_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define BLE_DATA_CHAR_UUID      "19B10001-E8F2-537E-4F6C-D104768A1214"
#define BLE_CMD_CHAR_UUID       "19B10002-E8F2-537E-4F6C-D104768A1214"

BLEService neuroGripService(BLE_SERVICE_UUID);
BLEStringCharacteristic dataChar(BLE_DATA_CHAR_UUID, BLERead | BLENotify, 64);
BLEStringCharacteristic cmdChar(BLE_CMD_CHAR_UUID, BLEWrite, 32);

// Filter & Sensor Variables
int rawFSR = 0;
int filteredFSR = 0;
int16_t ax, ay, az;
int16_t gx, gy, gz;
int prevAx = 0, prevAy = 0, prevAz = 0;
int tremorMagnitude = 0;

// Personalized Threshold Limits (Dynamically Configurable via BLE from companion app)
int minPinchAdcThreshold = 800;   // Default lower pinch limit (~100g in 12-bit)
int maxPinchAdcThreshold = 3400;  // Default upper safe pinch ceiling (~480g in 12-bit)
unsigned long lastHapticAlertTime = 0;
const unsigned long HAPTIC_DEBOUNCE_MS = 850; // Prevent high-frequency buzzing churn

unsigned long lastSampleTime = 0;
const unsigned long SAMPLE_INTERVAL_MS = 20; // 50 Hz acquisition

void setupMPU6050() {
  Wire.begin();
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0x00); // Wake up MPU-6050
  Wire.endTransmission(true);
}

void readMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B); // Accelerometer start register
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);

  if (Wire.available() >= 14) {
    ax = (Wire.read() << 8) | Wire.read();
    ay = (Wire.read() << 8) | Wire.read();
    az = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read(); // Skip temperature
    gx = (Wire.read() << 8) | Wire.read();
    gy = (Wire.read() << 8) | Wire.read();
    gz = (Wire.read() << 8) | Wire.read();

    // High-pass filter for tremor estimation (difference between consecutive acceleration vectors)
    int dX = abs(ax - prevAx);
    int dY = abs(ay - prevAy);
    int dZ = abs(az - prevAz);
    tremorMagnitude = (int)(sqrt((long)dX * dX + (long)dY * dY + (long)dZ * dZ));

    prevAx = ax;
    prevAy = ay;
    prevAz = az;
  }
}

void triggerBuzzer(int durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(durationMs);
  digitalWrite(PIN_BUZZER, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  setupMPU6050();

  if (!BLE.begin()) {
    Serial.println("[ERR] Starting BLE failed!");
    while (1);
  }

  BLE.setLocalName("NeuroGrip_Pen");
  BLE.setAdvertisedService(neuroGripService);
  neuroGripService.addCharacteristic(dataChar);
  neuroGripService.addCharacteristic(cmdChar);
  BLE.addService(neuroGripService);

  BLE.advertise();
  Serial.println("[OK] NeuroGrip Smart Pen BLE Peripheral Active.");

  // Short power-on confirmation chirp
  triggerBuzzer(60);
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("[BLE] Connected to: ");
    Serial.println(central.address());

    while (central.connected()) {
      unsigned long now = millis();

      // Check for incoming commands (e.g. "BUZZ:200" or "CMD:THRESH:900,3400")
      if (cmdChar.written()) {
        String cmd = cmdChar.value();
        Serial.print("[BLE CMD] ");
        Serial.println(cmd);

        if (cmd.startsWith("BUZZ:")) {
          int dur = cmd.substring(5).toInt();
          triggerBuzzer(dur > 0 ? dur : 100);
        } else if (cmd.startsWith("CMD:THRESH:") || cmd.startsWith("SET:LIMIT:")) {
          // Supports "CMD:THRESH:<maxAdc>" or "CMD:THRESH:<minAdc>,<maxAdc>"
          int colonIdx = cmd.lastIndexOf(':');
          String valStr = cmd.substring(colonIdx + 1);
          int commaIdx = valStr.indexOf(',');
          if (commaIdx > 0) {
            int newMin = valStr.substring(0, commaIdx).toInt();
            int newMax = valStr.substring(commaIdx + 1).toInt();
            if (newMin >= 0) minPinchAdcThreshold = newMin;
            if (newMax > 300) maxPinchAdcThreshold = newMax;
          } else {
            int newMax = valStr.toInt();
            if (newMax > 300) maxPinchAdcThreshold = newMax;
          }
          // Confirmation double-chirp
          triggerBuzzer(50);
          delay(80);
          triggerBuzzer(50);
          Serial.print("[OK] Personalized Limits Synced to Pen: Min=");
          Serial.print(minPinchAdcThreshold);
          Serial.print(", Max=");
          Serial.println(maxPinchAdcThreshold);
        }
      }

      // Sample sensors at 50 Hz
      if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
        lastSampleTime = now;

        // Read FSR and smooth with EWMA filter (alpha = 0.25)
        rawFSR = analogRead(PIN_FSR);
        filteredFSR = (filteredFSR * 3 + rawFSR) / 4;

        // Read MPU-6050 motion and tremor
        readMPU6050();

        // Local haptic alert if excessive force detected (> maxPinchAdcThreshold)
        if (filteredFSR > maxPinchAdcThreshold) {
          if (now - lastHapticAlertTime >= HAPTIC_DEBOUNCE_MS) {
            lastHapticAlertTime = now;
            triggerBuzzer(60); // 60ms crisp tactile pulse
          }
        }

        // Format telemetry packet: "P:<pressure>,T:<tremor>"
        char buffer[32];
        snprintf(buffer, sizeof(buffer), "P:%d,T:%d", filteredFSR, tremorMagnitude);
        dataChar.writeValue(buffer);
      }
    }

    Serial.println("[BLE] Disconnected from central.");
  }
}
