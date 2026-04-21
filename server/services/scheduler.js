/**
 * Scheduler Service
 * Core logic for medicine reminder scheduling, escalation, and state management.
 * 
 * Flow:
 * 1. Every minute, check if any schedules match current time → trigger "Pending"
 * 2. After 3 minutes of Pending → check IR sensor → mark "Taken" or "Missed"
 * 3. After 2 hours of Missed → mark "Escalated" → send SMS to caretakers
 * 
 * Uses an in-memory map to track active reminders and their escalation timers.
 */

const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Caretaker = require('../models/Caretaker');
const Log = require('../models/Log');
const socketService = require('./socketService');
const smsService = require('./smsService');

// In-memory tracking of active reminders
// Key: scheduleId, Value: { triggeredAt, status, missedAt, buzzerActive }
const activeReminders = new Map();

// Track device (ESP8266) state
let deviceStatus = {
  online: false,
  lastHeartbeat: null,
  irSensor: 0, // 0 = medicine present (not taken), 1 = taken
  buzzerActive: false
};

// Timezone offset in hours (default IST = 5.5)
const TZ_OFFSET = parseFloat(process.env.TIMEZONE_OFFSET || '5.5');

/**
 * Get current time adjusted for timezone
 */
const getCurrentTime = () => {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (TZ_OFFSET * 3600000));
};

/**
 * Get current HH:MM string
 */
const getCurrentHHMM = () => {
  const now = getCurrentTime();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Get today's date string YYYY-MM-DD
 */
const getTodayDate = () => {
  const now = getCurrentTime();
  return now.toISOString().split('T')[0];
};

/**
 * Check if a schedule should run today based on its day configuration
 */
const shouldRunToday = (schedule) => {
  if (!schedule.days || schedule.days.length === 0) return true; // Every day
  const today = getCurrentTime().getDay(); // 0=Sunday
  return schedule.days.includes(today);
};

/**
 * Main scheduler tick - runs every minute
 */
const checkSchedules = async () => {
  const currentTime = getCurrentHHMM();
  const today = getTodayDate();

  try {
    // Find active schedules matching current time
    const schedules = await Schedule.find({
      scheduledTime: currentTime,
      isActive: true
    });

    for (const schedule of schedules) {
      // Skip if not scheduled for today
      if (!shouldRunToday(schedule)) continue;

      // Skip if already triggered today
      if (activeReminders.has(schedule._id.toString())) continue;

      // Check if already logged today
      const existingLog = await Log.findOne({
        scheduleId: schedule._id,
        date: today
      });
      if (existingLog) continue;

      // ═══ TRIGGER REMINDER ═══
      console.log(`⏰ Triggering reminder: ${schedule.medicineName} at ${schedule.scheduledTime}`);

      schedule.status = 'Pending';
      schedule.lastTriggered = new Date();
      schedule.statusUpdatedAt = new Date();
      await schedule.save();

      // Track in memory
      activeReminders.set(schedule._id.toString(), {
        triggeredAt: Date.now(),
        status: 'Pending',
        missedAt: null
      });

      // Set device buzzer flag
      deviceStatus.buzzerActive = true;

      // Emit real-time event to frontend
      socketService.emit('reminder:trigger', {
        scheduleId: schedule._id,
        medicineName: schedule.medicineName,
        scheduledTime: schedule.scheduledTime,
        status: 'Pending',
        message: `Time to take ${schedule.medicineName}!`
      });
    }

    // ═══ CHECK ESCALATIONS ═══
    await checkEscalations(today);

  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
  }
};

/**
 * Check active reminders for escalation (Missed → Escalated)
 */
const checkEscalations = async (today) => {
  const now = Date.now();

  for (const [scheduleId, reminder] of activeReminders.entries()) {
    const elapsedMs = now - reminder.triggeredAt;
    const elapsedMinutes = elapsedMs / 60000;

    // ═══ After 3 minutes: Check if medicine was taken ═══
    if (reminder.status === 'Pending' && elapsedMinutes >= 3) {
      if (deviceStatus.irSensor === 1) {
        // ✅ Medicine was taken!
        await markAsTaken(scheduleId, today);
      } else {
        // ❌ Medicine not taken → mark as Missed
        await markAsMissed(scheduleId, today);
      }
    }

    // ═══ After 2 hours (120 min): Escalate if still missed ═══
    if (reminder.status === 'Missed' && elapsedMinutes >= 120) {
      await markAsEscalated(scheduleId, today);
    }
  }
};

/**
 * Mark a schedule as Taken
 */
const markAsTaken = async (scheduleId, today) => {
  try {
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return;

    schedule.status = 'Taken';
    schedule.statusUpdatedAt = new Date();
    await schedule.save();

    // Create log entry
    await Log.create({
      scheduleId: schedule._id,
      medicineName: schedule.medicineName,
      scheduledTime: schedule.scheduledTime,
      status: 'Taken',
      takenAt: new Date(),
      triggeredAt: new Date(activeReminders.get(scheduleId)?.triggeredAt),
      date: today,
      sensorValue: 1
    });

    // Clear from active reminders
    activeReminders.delete(scheduleId);
    deviceStatus.buzzerActive = false;

    console.log(`✅ ${schedule.medicineName} marked as TAKEN`);

    socketService.emit('reminder:taken', {
      scheduleId: schedule._id,
      medicineName: schedule.medicineName,
      scheduledTime: schedule.scheduledTime,
      status: 'Taken'
    });
  } catch (error) {
    console.error('❌ Error marking as taken:', error.message);
  }
};

/**
 * Mark a schedule as Missed
 */
const markAsMissed = async (scheduleId, today) => {
  try {
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return;

    schedule.status = 'Missed';
    schedule.statusUpdatedAt = new Date();
    await schedule.save();

    // Update tracking
    const reminder = activeReminders.get(scheduleId);
    if (reminder) {
      reminder.status = 'Missed';
      reminder.missedAt = Date.now();
    }

    // Trigger buzzer again
    deviceStatus.buzzerActive = true;

    console.log(`❌ ${schedule.medicineName} marked as MISSED — buzzer re-triggered`);

    socketService.emit('reminder:missed', {
      scheduleId: schedule._id,
      medicineName: schedule.medicineName,
      scheduledTime: schedule.scheduledTime,
      status: 'Missed',
      message: `⚠️ ${schedule.medicineName} was not taken! Please take it now.`
    });
  } catch (error) {
    console.error('❌ Error marking as missed:', error.message);
  }
};

/**
 * Mark a schedule as Escalated and send SMS to caretakers
 */
const markAsEscalated = async (scheduleId, today) => {
  try {
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return;

    schedule.status = 'Escalated';
    schedule.statusUpdatedAt = new Date();
    await schedule.save();

    // Get active caretakers
    const caretakers = await Caretaker.find({ isActive: true });

    // Send SMS alerts
    let smsResults = [];
    if (caretakers.length > 0) {
      smsResults = await smsService.sendAlertToCaretakers(caretakers, schedule);
    } else {
      console.warn('⚠️  No active caretakers configured for SMS alerts');
    }

    // Create log entry
    await Log.create({
      scheduleId: schedule._id,
      medicineName: schedule.medicineName,
      scheduledTime: schedule.scheduledTime,
      status: 'Escalated',
      triggeredAt: new Date(activeReminders.get(scheduleId)?.triggeredAt),
      missedAt: new Date(activeReminders.get(scheduleId)?.missedAt),
      escalatedAt: new Date(),
      date: today,
      sensorValue: 0,
      smsSentTo: smsResults.map(r => ({
        name: r.caretakerName,
        phone: r.caretakerPhone,
        sentAt: r.sentAt
      }))
    });

    // Clear from active reminders
    activeReminders.delete(scheduleId);
    deviceStatus.buzzerActive = false;

    console.log(`🚨 ${schedule.medicineName} ESCALATED — SMS sent to ${caretakers.length} caretaker(s)`);

    socketService.emit('reminder:escalated', {
      scheduleId: schedule._id,
      medicineName: schedule.medicineName,
      scheduledTime: schedule.scheduledTime,
      status: 'Escalated',
      smsResults,
      message: `🚨 ${schedule.medicineName} escalated! Caretakers notified.`
    });
  } catch (error) {
    console.error('❌ Error during escalation:', error.message);
  }
};

/**
 * Handle IR sensor status update from ESP8266
 */
const updateSensorStatus = async (irValue) => {
  deviceStatus.irSensor = irValue;

  // If sensor reports medicine taken (1), check if any reminder is Pending or Missed
  if (irValue === 1) {
    const today = getTodayDate();
    for (const [scheduleId, reminder] of activeReminders.entries()) {
      if (reminder.status === 'Pending' || reminder.status === 'Missed') {
        await markAsTaken(scheduleId, today);
      }
    }
  }

  socketService.emit('device:status', {
    irSensor: irValue,
    buzzerActive: deviceStatus.buzzerActive,
    deviceOnline: deviceStatus.online,
    timestamp: new Date()
  });
};

/**
 * Handle device heartbeat from ESP8266
 */
const updateHeartbeat = () => {
  deviceStatus.online = true;
  deviceStatus.lastHeartbeat = new Date();

  socketService.emit('device:heartbeat', {
    online: true,
    lastHeartbeat: deviceStatus.lastHeartbeat
  });
};

/**
 * Handle manual medicine confirmation from frontend
 */
const handleManualConfirm = async (scheduleId) => {
  const today = getTodayDate();
  if (activeReminders.has(scheduleId)) {
    await markAsTaken(scheduleId, today);
  }
};

/**
 * Get current device status
 */
const getDeviceStatus = () => {
  // Check if device is offline (no heartbeat in 2 minutes)
  if (deviceStatus.lastHeartbeat) {
    const elapsed = Date.now() - deviceStatus.lastHeartbeat.getTime();
    if (elapsed > 120000) {
      deviceStatus.online = false;
    }
  }
  return { ...deviceStatus };
};

/**
 * Get active reminders for API
 */
const getActiveReminders = () => {
  const reminders = [];
  for (const [id, data] of activeReminders.entries()) {
    reminders.push({ scheduleId: id, ...data });
  }
  return reminders;
};

/**
 * Reset all schedules to Idle at midnight
 */
const resetDailySchedules = async () => {
  try {
    await Schedule.updateMany(
      { status: { $ne: 'Idle' } },
      { status: 'Idle', statusUpdatedAt: new Date() }
    );
    activeReminders.clear();
    deviceStatus.buzzerActive = false;
    console.log('🔄 Daily schedule reset complete');
  } catch (error) {
    console.error('❌ Daily reset error:', error.message);
  }
};

/**
 * Initialize the scheduler
 */
const init = () => {
  // Register manual confirm handler globally
  global.handleManualConfirm = handleManualConfirm;

  // Run check every minute
  cron.schedule('* * * * *', () => {
    checkSchedules();
  });

  // Reset schedules at midnight
  cron.schedule('0 0 * * *', () => {
    resetDailySchedules();
  });

  // Check device online status every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    if (deviceStatus.lastHeartbeat) {
      const elapsed = Date.now() - deviceStatus.lastHeartbeat.getTime();
      if (elapsed > 120000 && deviceStatus.online) {
        deviceStatus.online = false;
        console.warn('⚠️  ESP8266 device appears offline');
        socketService.emit('device:offline', { lastHeartbeat: deviceStatus.lastHeartbeat });
      }
    }
  });

  console.log('⏰ Scheduler initialized — checking every minute');
};

module.exports = {
  init,
  updateSensorStatus,
  updateHeartbeat,
  handleManualConfirm,
  getDeviceStatus,
  getActiveReminders,
  getCurrentHHMM,
  getTodayDate
};
