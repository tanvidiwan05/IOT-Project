#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// WiFi
const char* WIFI_SSID     = "Hari";
const char* WIFI_PASSWORD = "12345678";

// Server
const char* SERVER_URL = "http://10.122.127.4:5000";

// Pins
const int IR_SENSOR_PIN = D1;
const int BUZZER_PIN    = D2;
const int LED_PIN       = D4;

// Timing
const unsigned long SCHEDULE_POLL_INTERVAL = 30000;
const unsigned long HEARTBEAT_INTERVAL     = 60000;
const unsigned long SENSOR_READ_INTERVAL   = 2000;
const unsigned long SENSOR_DEBOUNCE_MS     = 500;
const unsigned long BUZZER_PATTERN_ON      = 500;
const unsigned long BUZZER_PATTERN_OFF     = 500;

// State
unsigned long lastSchedulePoll = 0;
unsigned long lastHeartbeat    = 0;
unsigned long lastSensorRead   = 0;
unsigned long lastBuzzerToggle = 0;

int currentSensorValue  = 0;
int previousSensorValue = 0;
unsigned long lastSensorChange = 0;

bool buzzerActive = false;
bool buzzerState  = false;

bool wifiConnected = false;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(IR_SENSOR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, HIGH);

  connectWiFi();
}

// ================= LOOP =================
void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    readIRSensor();
  }

  if (now - lastSchedulePoll >= SCHEDULE_POLL_INTERVAL) {
    lastSchedulePoll = now;
    pollSchedules();
  }

  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  if (buzzerActive) {
    handleBuzzerPattern(now);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  yield();
}

// ================= WIFI =================
void connectWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());
}

// ================= SENSOR =================
void readIRSensor() {
  int value = digitalRead(IR_SENSOR_PIN);

  if (value != previousSensorValue) {
    if (millis() - lastSensorChange > SENSOR_DEBOUNCE_MS) {
      previousSensorValue = value;
      lastSensorChange = millis();

      if (value != currentSensorValue) {
        currentSensorValue = value;
        sendSensorStatus();
      }
    }
  }
}

// ================= SEND STATUS =================
void sendSensorStatus() {
  WiFiClient client;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/device/status";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(1024);
  doc["irSensor"] = currentSensorValue;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);

  if (code > 0) {
    String response = http.getString();

    DynamicJsonDocument resDoc(1024);
    deserializeJson(resDoc, response);

    buzzerActive = resDoc["data"]["buzzerActive"];
  }

  http.end();
}

// ================= POLL =================
void pollSchedules() {
  WiFiClient client;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/device/schedules";

  http.begin(client, url);

  int code = http.GET();

  if (code > 0) {
    String response = http.getString();

    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);

    buzzerActive = doc["data"]["buzzerActive"];
  }

  http.end();
}

// ================= HEARTBEAT =================
void sendHeartbeat() {
  WiFiClient client;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/device/heartbeat";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(1024);
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();

  String payload;
  serializeJson(doc, payload);

  http.POST(payload);

  http.end();
}

// ================= BUZZER =================
void handleBuzzerPattern(unsigned long now) {
  unsigned long interval = buzzerState ? BUZZER_PATTERN_ON : BUZZER_PATTERN_OFF;

  if (now - lastBuzzerToggle >= interval) {
    lastBuzzerToggle = now;
    buzzerState = !buzzerState;
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  }
}