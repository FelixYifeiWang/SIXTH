#include <Arduino.h>
#include <WiFi.h>
#include <math.h>

// ===================== WiFi configuration =====================
// Fill in your network credentials. If left blank or unreachable, the sketch
// still runs over USB serial — WiFi is additive, not required.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const uint16_t TCP_PORT = 4040;           // Laptop connects with: nc <ip> 4040
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 10000;

WiFiServer server(TCP_PORT);
WiFiClient client;                         // single active client (dev prototype; no auth)

// ===================== Pin definitions =====================
const int MOTOR_PIN = 21;    // Feather MI pin -> ULN2803A 1B
const int THERM_PIN = 34;    // Feather A2 / GPIO34
const int MOIST_PIN = 39;    // Feather A3 / GPIO39

// ===================== Command-driven outputs =====================
// Servo-style PWM outputs driven by single-char commands from Serial or WiFi.
// '1'..'5' activate (2000us); 'R'/'r' resets all five to 1500us.
struct CommandOutput {
  uint8_t pin;
  const char* name;
};

const CommandOutput OUTPUTS[] = {
  { 12, "right_top_haptic" },     // key '1'
  { 13, "right_bottom_haptic" },  // key '2'
  { 27, "left_bottom_haptic" },   // key '3'
  { 32, "ventilation" },          // key '4'
  { 33, "left_top_haptic" },      // key '5'
};
const uint8_t OUTPUT_COUNT = sizeof(OUTPUTS) / sizeof(OUTPUTS[0]);

const uint16_t OUT_RESET_US = 1500;
const uint16_t OUT_ACTIVATE_US = 2000;
const uint32_t OUT_PWM_FREQ = 50;       // 50 Hz servo-style
const uint8_t  OUT_PWM_RES = 16;        // 16-bit duty
const uint32_t OUT_PWM_PERIOD_US = 20000; // 1/50 Hz

// ===================== Thermistor calibration =====================
// Fixed divider resistor for thermistor
const float SERIES_RESISTOR = 220000.0;

// Calibrated nominal thermistor resistance at 25C
const float THERMISTOR_NOMINAL = 1000000.0;

// Reference temperature
const float TEMPERATURE_NOMINAL = 25.0;

// Beta value estimate
const float BETA_VALUE = 3950.0;

// ===================== Moisture sensor calibration =====================
// Fixed divider resistor for moisture sensor
const float MOIST_SERIES_RESISTOR = 560000.0;

// Moisture reference points based on your measurements
const float MOIST_RES_WET = 100000.0;      // heavily moistened
const float MOIST_RES_DAMP = 1000000.0;    // slightly moistened

// ADC settings
const float ADC_MAX = 4095.0;
const float VREF = 3.3;

// ===================== Timing =====================
unsigned long lastPrint = 0;
unsigned long lastMotorToggle = 0;
bool motorState = false;

// Motor timing: 1 second ON, 1 second OFF
const unsigned long MOTOR_ON_TIME = 1000;
const unsigned long MOTOR_OFF_TIME = 1000;

// ===================== Thermistor functions =====================
int readThermistorRawAveraged(int samples = 16) {
  long total = 0;
  for (int i = 0; i < samples; i++) {
    total += analogRead(THERM_PIN);
    delay(5);
  }
  return total / samples;
}

float readThermistorResistance() {
  int raw = readThermistorRawAveraged();

  if (raw <= 0) raw = 1;
  if (raw >= 4095) raw = 4094;

  // Divider:
  // 3.3V -- 220k -- ADC node -- thermistor -- GND
  float resistance = SERIES_RESISTOR * ((float)raw / (ADC_MAX - raw));
  return resistance;
}

float readTemperatureC() {
  float R = readThermistorResistance();

  float steinhart;
  steinhart = R / THERMISTOR_NOMINAL;
  steinhart = log(steinhart);
  steinhart /= BETA_VALUE;
  steinhart += 1.0 / (TEMPERATURE_NOMINAL + 273.15);
  steinhart = 1.0 / steinhart;
  steinhart -= 273.15;

  return steinhart;
}

// ===================== Moisture functions =====================
int readMoistureRawAveraged(int samples = 16) {
  long total = 0;
  for (int i = 0; i < samples; i++) {
    total += analogRead(MOIST_PIN);
    delay(5);
  }
  return total / samples;
}

float readMoistureResistance() {
  int raw = readMoistureRawAveraged();

  if (raw <= 0) raw = 1;
  if (raw >= 4095) raw = 4094;

  // Divider:
  // 3.3V -- 560k -- ADC node -- moisture sensor -- GND
  float resistance = MOIST_SERIES_RESISTOR * ((float)raw / (ADC_MAX - raw));
  return resistance;
}

float readMoisturePercent() {
  float R = readMoistureResistance();

  // Clamp rough range:
  // 100k  -> 100% wet
  // 1M    -> 0% wet
  float percent = 100.0 * (MOIST_RES_DAMP - R) / (MOIST_RES_DAMP - MOIST_RES_WET);

  if (percent > 100.0) percent = 100.0;
  if (percent < 0.0) percent = 0.0;

  return percent;
}

// ===================== Reporting =====================
// Writes a full sensor report to any Print target (Serial, WiFiClient, etc.).
void printReport(Print& out) {
  int thermRaw = readThermistorRawAveraged();
  float thermVoltage = (thermRaw / ADC_MAX) * VREF;
  float thermResistance = readThermistorResistance();
  float tempC = readTemperatureC();
  float tempF = tempC * 9.0 / 5.0 + 32.0;

  int moistRaw = readMoistureRawAveraged();
  float moistVoltage = (moistRaw / ADC_MAX) * VREF;
  float moistResistance = readMoistureResistance();
  float moistPercent = readMoisturePercent();

  out.println("====== SENSOR REPORT ======");

  out.println("------ Thermistor ------");
  out.print("ADC raw: ");
  out.println(thermRaw);

  out.print("Voltage: ");
  out.print(thermVoltage, 3);
  out.println(" V");

  out.print("Resistance: ");
  out.print(thermResistance, 0);
  out.println(" ohms");

  out.print("Temp: ");
  out.print(tempC, 2);
  out.print(" °C  |  ");
  out.print(tempF, 2);
  out.println(" °F");

  out.println("------ Moisture ------");
  out.print("ADC raw: ");
  out.println(moistRaw);

  out.print("Voltage: ");
  out.print(moistVoltage, 3);
  out.println(" V");

  out.print("Resistance: ");
  out.print(moistResistance, 0);
  out.println(" ohms");

  out.print("Moisture: ");
  out.print(moistPercent, 1);
  out.println(" %");

  out.println("------------------------");
}

// ===================== WiFi =====================
void beginWiFi() {
  Serial.print("Connecting to WiFi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    server.begin();
    Serial.print("WiFi connected. Listening on ");
    Serial.print(WiFi.localIP());
    Serial.print(":");
    Serial.println(TCP_PORT);
    Serial.print("From your laptop on the same network, run: nc ");
    Serial.print(WiFi.localIP());
    Serial.print(" ");
    Serial.println(TCP_PORT);
  } else {
    Serial.println("WiFi unavailable — continuing over USB serial only.");
  }
}

void serviceWiFiClient() {
  if (WiFi.status() != WL_CONNECTED) return;

  // Accept a new client if one is waiting and we don't already have one.
  if (!client || !client.connected()) {
    if (client) client.stop();
    WiFiClient incoming = server.available();
    if (incoming) {
      client = incoming;
      Serial.print("WiFi client connected: ");
      Serial.println(client.remoteIP());
    }
  }
}

// ===================== Command-driven outputs =====================
uint32_t microsToDuty(uint16_t us) {
  // Clamp to one period; convert us -> duty in 16-bit space.
  if (us > OUT_PWM_PERIOD_US) us = OUT_PWM_PERIOD_US;
  const uint32_t maxDuty = (1UL << OUT_PWM_RES) - 1;
  return ((uint32_t)us * maxDuty) / OUT_PWM_PERIOD_US;
}

void setOutputMicros(uint8_t idx, uint16_t us) {
  if (idx >= OUTPUT_COUNT) return;
  ledcWrite(OUTPUTS[idx].pin, microsToDuty(us));
}

void setupCommandOutputs() {
  for (uint8_t i = 0; i < OUTPUT_COUNT; i++) {
    ledcAttach(OUTPUTS[i].pin, OUT_PWM_FREQ, OUT_PWM_RES);
    setOutputMicros(i, OUT_RESET_US);
  }
}

void resetAllOutputs(Print& reply) {
  for (uint8_t i = 0; i < OUTPUT_COUNT; i++) {
    setOutputMicros(i, OUT_RESET_US);
  }
  reply.print("RESET all ");
  reply.print(OUT_RESET_US);
  reply.println("us");
}

void handleCommand(char c, Print& reply) {
  if (c >= '1' && c <= '5') {
    uint8_t idx = c - '1';
    if (idx < OUTPUT_COUNT) {
      setOutputMicros(idx, OUT_ACTIVATE_US);
      reply.print("ACT ");
      reply.print(OUTPUTS[idx].name);
      reply.print(" ");
      reply.print(OUT_ACTIVATE_US);
      reply.println("us");
    }
  } else if (c == 'R' || c == 'r') {
    resetAllOutputs(reply);
  }
  // Silently ignore anything else (newlines, keepalives, noise).
}

void serviceInput() {
  while (Serial.available() > 0) {
    handleCommand((char)Serial.read(), Serial);
  }
  if (client && client.connected()) {
    while (client.available() > 0) {
      handleCommand((char)client.read(), client);
    }
  }
}

// ===================== Setup =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(THERM_PIN, ADC_11db);
  analogSetPinAttenuation(MOIST_PIN, ADC_11db);

  setupCommandOutputs();

  Serial.println("Integrated Motor + Thermistor + Moisture Test Starting...");

  beginWiFi();
}

// ===================== Loop =====================
void loop() {
  unsigned long now = millis();

  // -------- Motor control --------
  if (motorState) {
    if (now - lastMotorToggle >= MOTOR_ON_TIME) {
      motorState = false;
      digitalWrite(MOTOR_PIN, LOW);
      lastMotorToggle = now;
      Serial.println("Motor OFF");
    }
  } else {
    if (now - lastMotorToggle >= MOTOR_OFF_TIME) {
      motorState = true;
      digitalWrite(MOTOR_PIN, HIGH);
      lastMotorToggle = now;
      Serial.println("Motor ON");
    }
  }

  // -------- WiFi client management --------
  serviceWiFiClient();

  // -------- Command input (Serial + WiFi) --------
  serviceInput();

  // -------- Sensor reading and print --------
  if (now - lastPrint >= 1000) {
    lastPrint = now;

    printReport(Serial);
    if (client && client.connected()) {
      printReport(client);
    }
  }
}