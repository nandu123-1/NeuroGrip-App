// =========================================================================
// TFT_eSPI User_Setup.h for Waveshare 3.5inch RPi LCD (F) on ESP32 DevKit V1
// Display: ST7796S (480x320 IPS) | Interface: 4-Wire SPI
// =========================================================================

#define ST7796_DRIVER     // Defines ST7796S driver

#define TFT_WIDTH  320
#define TFT_HEIGHT 480

// Pin allocations for ESP32 DevKit V1 to Waveshare 3.5" (F)
#define TFT_MOSI 23       // VSPI MOSI (GH1.25 Pin 10)
#define TFT_MISO 19       // VSPI MISO (GH1.25 Pin 11)
#define TFT_SCLK 18       // VSPI SCLK (GH1.25 Pin 9)
#define TFT_CS   15       // Chip select (GH1.25 Pin 8)
#define TFT_DC    2       // Data/Command (GH1.25 Pin 7)
#define TFT_RST   4       // Reset pin (GH1.25 Pin 6)
#define TFT_BL   32       // Backlight (GH1.25 Pin 5, or tie to 3.3V)

#define TFT_BACKLIGHT_ON HIGH

// Fonts to load
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_FONT6
#define LOAD_FONT7
#define LOAD_FONT8
#define LOAD_GFXFF
#define SMOOTH_FONT

// SPI Frequencies
#define SPI_FREQUENCY       40000000  // 40 MHz high-speed SPI
#define SPI_READ_FREQUENCY  20000000
