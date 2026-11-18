/*
 * =====================================================================
 * NEUROGRIP WRITING PAD - ARCHITECTURE 1 SMART HUB FIRMWARE
 * Board: ESP32 DevKit V1
 * Display: Waveshare 3.5inch RPi LCD (F) - CAPACITIVE TOUCH
 * Drivers:
 *   - Display: ST7796S (4-Wire SPI @ 40MHz, IPS 480x320)
 *   - Touch:   Goodix GT911 (I2C Capacitive Multi-touch)
 * Connector: Uses standard 40-pin header OR 13-Pin GH1.25 connector
 *
 * Dual-Role / Bridge:
 *   1. Captures capacitive touch (X, Y) from GT911 at high polling rate
 *   2. Connects to NeuroGrip_Pen via BLE (Receives Grip Pinch & Tremor)
 *   3. Advertises as "NeuroGrip_Hub" to Mobile App (Transmits Fused Packets)
 * =====================================================================
 */

#include <SPI.h>
#include <Wire.h>
#include <TFT_eSPI.h>              // Fast ST7796S display driver
#include <TAMC_GT911.h>            // Goodix GT911 capacitive touch driver
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// -------------------------------------------------------------
// Waveshare 3.5" (F) GH1.25 / GPIO Pin Configuration
// -------------------------------------------------------------
// I2C Pins for GT911 Capacitive Touch
#define TOUCH_SDA   21    // GH1.25 Pin 4
#define TOUCH_SCL   22    // GH1.25 Pin 3
#define TOUCH_INT   27    // GH1.25 Pin 2 (Interrupt)
#define TOUCH_RST   14    // GH1.25 Pin 1 (Reset)

#define SCREEN_WIDTH  480
#define SCREEN_HEIGHT 320

TFT_eSPI tft = TFT_eSPI();
TAMC_GT911 touch = TAMC_GT911(TOUCH_SDA, TOUCH_SCL, TOUCH_INT, TOUCH_RST, SCREEN_WIDTH, SCREEN_HEIGHT);

// -------------------------------------------------------------
// BLE Service & Characteristic UUIDs
// -------------------------------------------------------------
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define DATA_CHAR_UUID      "19B10001-E8F2-537E-4F6C-D104768A1214"
#define CMD_CHAR_UUID       "19B10002-E8F2-537E-4F6C-D104768A1214"

BLEServer* pServer = NULL;
BLECharacteristic* pDataCharacteristic = NULL;
bool phoneConnected = false;

// -------------------------------------------------------------
// Shared Telemetry State
// -------------------------------------------------------------
volatile int penPressure = 0;
volatile int penTremor = 0;
bool penConnected = false;

int prevX = -1, prevY = -1;
bool testMode = true; // true = SPIRAL assessment, false = FREE inking

// BLE Server Callbacks (for Mobile Companion App)
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    phoneConnected = true;
    Serial.println("[BLE] Mobile App Connected to Pad Hub!");
  }
  void onDisconnect(BLEServer* pServer) {
    phoneConnected = false;
    Serial.println("[BLE] Mobile App Disconnected.");
    pServer->startAdvertising(); // Resume advertising for auto-reconnect
  }
};

// -------------------------------------------------------------
// UI Rendering Functions
// -------------------------------------------------------------
void drawUI() {
  tft.fillRect(0, 0, 480, 45, 0x18E3); // Slate navy header
  tft.drawFastHLine(0, 45, 480, TFT_DARKGREY);

  tft.setTextColor(TFT_WHITE, 0x18E3);
  tft.setTextSize(2);
  tft.drawString("NeuroGrip Pad (F)", 10, 14);

  // Pen telemetry status pill
  tft.setTextSize(1);
  tft.setTextColor(penConnected ? TFT_GREEN : TFT_YELLOW, 0x18E3);
  tft.drawString(penConnected ? "PEN: ACTIVE" : "PEN: SEARCHING", 205, 18);

  // Touch Clear Button
  tft.fillRoundRect(315, 8, 75, 30, 4, TFT_RED);
  tft.setTextColor(TFT_WHITE, TFT_RED);
  tft.setTextSize(2);
  tft.drawString("CLEAR", 325, 15);

  // Touch Mode Button (SPIRAL vs FREE)
  tft.fillRoundRect(398, 8, 74, 30, 4, testMode ? 0x03EF : 0x01CF);
  tft.setTextColor(TFT_WHITE, testMode ? 0x03EF : 0x01CF);
  tft.drawString(testMode ? "SPIRAL" : "FREE", 405, 15);
}

void drawSpiralGuide() {
  int cx = 240, cy = 180;
  float b = 2.4;
  int lx = cx, ly = cy;
  for (float th = 0; th < 8.0 * PI; th += 0.05) {
    float r = b * th;
    int sx = cx + (int)(r * cos(th));
    int sy = cy + (int)(r * sin(th));
    if (sx >= 5 && sx < 475 && sy >= 50 && sy < 315) {
      tft.drawLine(lx, ly, sx, sy, 0x39E7); // Subtle reference gray
      lx = sx;
      ly = sy;
    }
  }
  // Center start indicator
  tft.fillCircle(cx, cy, 3, TFT_CYAN);
}

void clearCanvas() {
  tft.fillRect(0, 46, 480, 274, TFT_BLACK);
  if (testMode) drawSpiralGuide();
  prevX = -1;
  prevY = -1;
}

// -------------------------------------------------------------
// Setup & Initialization
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("[NeuroGrip] Initializing Waveshare 3.5\" (F) Capacitive Touch Pad...");

  // 1. Initialize ST7796S IPS Display
  tft.init();
  tft.setRotation(1); // Landscape (480x320)
  tft.fillScreen(TFT_BLACK);

  // 2. Initialize GT911 Capacitive Touch
  touch.begin();
  touch.setRotation(1); // Match display rotation

  drawUI();
  clearCanvas();

  // 3. Initialize BLE Server for Mobile App Hub
  BLEDevice::init("NeuroGrip_Hub");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pDataCharacteristic = pService->createCharacteristic(
    DATA_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pDataCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[OK] Waveshare 3.5\" (F) ST7796S + GT911 Ready & BLE Advertising.");
}

// -------------------------------------------------------------
// Main Loop: Touch Detection + Inking + Telemetry Streaming
// -------------------------------------------------------------
void loop() {
  int touchX = 0, touchY = 0;
  bool isDown = false;

  // Poll GT911 capacitive touch controller
  touch.read();

  if (touch.isTouched && touch.touches > 0) {
    // Read primary touch contact point (supports conductive stylus tip)
    touchX = touch.points[0].x;
    touchY = touch.points[0].y;
    touchX = constrain(touchX, 0, 479);
    touchY = constrain(touchY, 0, 319);
    isDown = true;

    // Header buttons detection
    if (touchY < 45) {
      // Clear Button [315, 8] to [390, 38]
      if (touchX >= 315 && touchX <= 390) {
        clearCanvas();
        delay(150);
      } 
      // Mode Button [398, 8] to [472, 38]
      else if (touchX >= 398 && touchX <= 472) {
        testMode = !testMode;
        drawUI();
        clearCanvas();
        delay(150);
      }
      prevX = -1; prevY = -1;
      return;
    }

    // Active digital ink drawing on the IPS display glass
    if (prevX > 0 && prevY > 0) {
      tft.drawLine(prevX, prevY, touchX, touchY, TFT_CYAN);
      tft.drawLine(prevX + 1, prevY, touchX + 1, touchY, TFT_CYAN);
    } else {
      tft.fillCircle(touchX, touchY, 1, TFT_CYAN);
    }
    prevX = touchX;
    prevY = touchY;
  } else {
    prevX = -1;
    prevY = -1;
  }

  // Stream fused telemetry packet to mobile app if connected
  if (phoneConnected && pDataCharacteristic) {
    char packet[48];
    // Protocol: X:<x>,Y:<y>,P:<pressure>,T:<tremor>
    snprintf(packet, sizeof(packet), "X:%d,Y:%d,P:%d,T:%d",
             isDown ? touchX : 0,
             isDown ? touchY : 0,
             penPressure,
             penTremor);

    pDataCharacteristic->setValue((uint8_t*)packet, strlen(packet));
    pDataCharacteristic->notify();
  }

  delay(12); // ~80 Hz smooth touch polling rate
}
