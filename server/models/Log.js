/**
 * Log Model
 * Records history of medicine intake events for tracking and analysis.
 * Each log entry represents one scheduled dose and its outcome.
 */

const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  // Reference to the original schedule
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },

  // Denormalized fields for historical records (schedule may be deleted)
  medicineName: {
    type: String,
    default: 'Medicine'
  },

  scheduledTime: {
    type: String,
    required: true
  },

  // Final status of this dose
  status: {
    type: String,
    enum: ['Taken', 'Missed', 'Escalated'],
    required: true
  },

  // When the medicine was actually taken (null if missed/escalated)
  takenAt: {
    type: Date,
    default: null
  },

  // When the reminder was first triggered
  triggeredAt: {
    type: Date,
    default: null
  },

  // When it was marked as missed
  missedAt: {
    type: Date,
    default: null
  },

  // When escalation SMS was sent
  escalatedAt: {
    type: Date,
    default: null
  },

  // Caretakers who were notified via SMS
  smsSentTo: [{
    name: String,
    phone: String,
    sentAt: Date
  }],

  // Date of this log entry (YYYY-MM-DD for easy date-based queries)
  date: {
    type: String,
    required: true
  },

  // IR sensor value that confirmed intake (1 = taken)
  sensorValue: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient date-based and schedule-based lookups
logSchema.index({ date: -1 });
logSchema.index({ scheduleId: 1, date: -1 });
logSchema.index({ status: 1 });

module.exports = mongoose.model('Log', logSchema);
