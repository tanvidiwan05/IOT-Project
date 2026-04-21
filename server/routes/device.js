/**
 * Device Routes
 * API endpoints for ESP8266 IoT device communication.
 * Handles sensor data, schedule polling, and heartbeat.
 */

const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const scheduler = require('../services/scheduler');

/**
 * POST /api/device/status
 * ESP8266 sends IR sensor readings
 * Body: { irSensor: 0 | 1 }
 *   0 = Medicine present (not taken)
 *   1 = Medicine taken (removed)
 */
router.post('/status', async (req, res) => {
  try {
    const { irSensor } = req.body;

    if (irSensor === undefined || irSensor === null) {
      return res.status(400).json({ success: false, error: 'irSensor value required' });
    }

    const sensorValue = parseInt(irSensor);
    if (sensorValue !== 0 && sensorValue !== 1) {
      return res.status(400).json({ success: false, error: 'irSensor must be 0 or 1' });
    }

    // Update scheduler with sensor data
    await scheduler.updateSensorStatus(sensorValue);

    const deviceState = scheduler.getDeviceStatus();

    res.json({
      success: true,
      data: {
        irSensor: sensorValue,
        buzzerActive: deviceState.buzzerActive,
        acknowledged: true
      }
    });
  } catch (error) {
    console.error('Error processing device status:', error.message);
    res.status(500).json({ success: false, error: 'Failed to process device status' });
  }
});

/**
 * GET /api/device/schedules
 * ESP8266 fetches active schedules to know when to trigger buzzer
 * Returns simplified schedule list with buzzer state
 */
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find({ isActive: true })
      .select('scheduledTime medicineName status days')
      .sort({ scheduledTime: 1 });

    const deviceState = scheduler.getDeviceStatus();
    const activeReminders = scheduler.getActiveReminders();

    res.json({
      success: true,
      data: {
        schedules: schedules.map(s => ({
          id: s._id,
          time: s.scheduledTime,
          name: s.medicineName,
          status: s.status,
          days: s.days
        })),
        buzzerActive: true,
        activeReminders: activeReminders.length,
        serverTime: scheduler.getCurrentHHMM()
      }
    });
  } catch (error) {
    console.error('Error fetching device schedules:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

/**
 * POST /api/device/heartbeat
 * ESP8266 sends periodic heartbeat to confirm it's online
 * Body: { rssi: -60 } (optional Wi-Fi signal strength)
 */
router.post('/heartbeat', (req, res) => {
  try {
    scheduler.updateHeartbeat();

    const { rssi } = req.body;
    if (rssi) {
      console.log(`📡 Device heartbeat | RSSI: ${rssi} dBm`);
    }

    const deviceState = scheduler.getDeviceStatus();

    res.json({
      success: true,
      data: {
        acknowledged: true,
        buzzerActive: deviceState.buzzerActive,
        serverTime: scheduler.getCurrentHHMM()
      }
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error.message);
    res.status(500).json({ success: false, error: 'Failed to process heartbeat' });
  }
});

/**
 * GET /api/device/status
 * Frontend fetches current device status
 */
router.get('/status', (req, res) => {
  try {
    const deviceState = scheduler.getDeviceStatus();
    const activeReminders = scheduler.getActiveReminders();

    res.json({
      success: true,
      data: {
        ...deviceState,
        activeReminders
      }
    });
  } catch (error) {
    console.error('Error fetching device status:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch device status' });
  }
});

module.exports = router;
