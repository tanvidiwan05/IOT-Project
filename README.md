# 💊 Smart Medicine Reminder & Monitoring System

An IoT-based medicine reminder system using **ESP8266 (NodeMCU)**, **IR sensor**, **buzzer**, and a **web dashboard** with real-time alerts and caretaker SMS notifications.

---

## 🏗️ System Architecture

```
User sets schedule (Website) → Stored in MongoDB
        ↓
At scheduled time → ESP8266 triggers buzzer
        ↓
IR sensor checks medicine intake (0=present, 1=taken)
        ↓
ESP8266 sends status → Backend server
        ↓
After 3 min: if not taken → mark Missed + buzzer again
        ↓
After 2 hours: if still not taken → SMS to caretaker(s)
```

## 📁 Project Structure

```
Medicine Box/
├── server/                    # Backend + Frontend
│   ├── server.js              # Express entry point
│   ├── config/db.js           # MongoDB connection
│   ├── models/                # Mongoose schemas
│   │   ├── Schedule.js
│   │   ├── Caretaker.js
│   │   └── Log.js
│   ├── routes/                # REST API
│   │   ├── schedules.js
│   │   ├── caretakers.js
│   │   ├── device.js
│   │   └── logs.js
│   ├── services/              # Business logic
│   │   ├── scheduler.js       # Cron + escalation
│   │   ├── smsService.js      # Twilio SMS
│   │   └── socketService.js   # WebSocket
│   └── public/                # Frontend
│       ├── index.html
│       ├── css/styles.css
│       └── js/app.js
├── firmware/
│   └── medicine_box.ino       # ESP8266 Arduino code
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ installed
- **MongoDB** running locally or MongoDB Atlas URI
- **Arduino IDE** (for ESP8266 firmware)

### 1. Backend Setup

```bash
cd server
npm install
```

Edit `.env` with your settings:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/medicinebox
TWILIO_ACCOUNT_SID=your_sid        # Optional
TWILIO_AUTH_TOKEN=your_token        # Optional
TWILIO_PHONE_NUMBER=+1234567890    # Optional
TIMEZONE_OFFSET=5.5                # IST
```

Start the server:
```bash
npm start
```

Open **http://localhost:5000** in your browser.

### 2. ESP8266 Setup

1. Open `firmware/medicine_box.ino` in Arduino IDE
2. Install board: **ESP8266** via Board Manager
3. Install library: **ArduinoJson** v7
4. Edit Wi-Fi credentials and server IP in the code
5. Select board: **NodeMCU 1.0 (ESP-12E Module)**
6. Upload to your ESP8266

### Wiring

| Component   | ESP8266 Pin | Notes                    |
|-------------|-------------|--------------------------|
| IR Sensor   | D1 (GPIO5)  | Digital output           |
| Buzzer (+)  | D2 (GPIO4)  | Use transistor for power |
| Buzzer (-)  | GND         |                          |
| IR Sensor VCC | 3.3V     |                          |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules` | List all schedules |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/:id` | Update schedule |
| DELETE | `/api/schedules/:id` | Delete schedule |
| GET | `/api/caretakers` | List caretakers |
| POST | `/api/caretakers` | Add caretaker |
| DELETE | `/api/caretakers/:id` | Remove caretaker |
| POST | `/api/device/status` | ESP8266 sensor data |
| GET | `/api/device/schedules` | ESP8266 fetch schedules |
| POST | `/api/device/heartbeat` | ESP8266 heartbeat |
| GET | `/api/logs` | Intake history |
| GET | `/api/logs/stats` | Statistics |
| GET | `/api/health` | System health |

## ⏰ Escalation Flow

1. **Scheduled Time** → Buzzer triggers, dashboard shows "Pending"
2. **+3 minutes** → Check IR sensor: taken (✅) or missed (❌ + buzzer again)
3. **+2 hours** → If still missed → "Escalated" + SMS to all caretakers

## 📱 SMS Configuration (Twilio)

1. Create a [Twilio account](https://www.twilio.com/)
2. Get your Account SID, Auth Token, and a phone number
3. Add them to `.env`
4. SMS works automatically on escalation. Without credentials, alerts are logged to console.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io (WebSocket) |
| IoT | ESP8266 + HTTP API |
| SMS | Twilio |
| Scheduling | node-cron |
