/**
 * Schedule Model
 * Represents a medicine schedule with time, name, days, and current status.
 * Status transitions: Pending → Taken | Missed → Escalated
 */

const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  // Medicine name (optional but recommended)
  medicineName: {
    type: String,
    default: 'Medicine',
    trim: true,
    maxlength: 100
  },

  // Scheduled time in HH:MM format (24-hour)
  scheduledTime: {
    type: String,
    required: [true, 'Scheduled time is required'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)']
  },

  // Days of week when this schedule is active (0=Sunday, 6=Saturday)
  // Empty array means every day
  days: {
    type: [Number],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(d => d >= 0 && d <= 6);
      },
      message: 'Days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },

  // Current status of today's reminder
  status: {
    type: String,
    enum: ['Pending', 'Taken', 'Missed', 'Escalated', 'Idle'],
    default: 'Idle'
  },

  // Whether this schedule is active
  isActive: {
    type: Boolean,
    default: true
  },

  // Timestamp when buzzer was last triggered
  lastTriggered: {
    type: Date,
    default: null
  },

  // Timestamp when status was last updated
  statusUpdatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // adds createdAt and updatedAt
});

// Index for efficient schedule lookups by time
scheduleSchema.index({ scheduledTime: 1, isActive: 1 });

// Virtual to get formatted days as names
scheduleSchema.virtual('dayNames').get(function() {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (this.days.length === 0) return ['Every Day'];
  return this.days.map(d => names[d]);
});

// Ensure virtuals are included in JSON output
scheduleSchema.set('toJSON', { virtuals: true });
scheduleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
