/**
 * Caretaker Model
 * Stores caretaker information for SMS alert notifications.
 * Multiple caretakers can be added for redundancy.
 */

const mongoose = require('mongoose');

const caretakerSchema = new mongoose.Schema({
  // Caretaker's name
  name: {
    type: String,
    required: [true, 'Caretaker name is required'],
    trim: true,
    maxlength: 100
  },

  // Phone number with country code (e.g., +91XXXXXXXXXX)
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+?[1-9]\d{7,14}$/, 'Please enter a valid phone number with country code']
  },

  // Relationship to patient (optional)
  relationship: {
    type: String,
    default: '',
    trim: true
  },

  // Whether this caretaker should receive alerts
  isActive: {
    type: Boolean,
    default: true
  },

  // Track last SMS sent to avoid spamming
  lastAlertSentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Caretaker', caretakerSchema);
