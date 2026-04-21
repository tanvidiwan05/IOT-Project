/**
 * Schedule Routes
 * CRUD operations for medicine schedules.
 */

const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const socketService = require('../services/socketService');

/**
 * GET /api/schedules
 * Fetch all schedules, sorted by time
 */
router.get('/', async (req, res) => {
  try {
    const schedules = await Schedule.find().sort({ scheduledTime: 1 });
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

/**
 * GET /api/schedules/upcoming
 * Fetch upcoming schedules for today
 */
router.get('/upcoming', async (req, res) => {
  try {
    const schedules = await Schedule.find({ isActive: true })
      .sort({ scheduledTime: 1 });
    
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching upcoming schedules:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch upcoming schedules' });
  }
});

/**
 * POST /api/schedules
 * Create a new medicine schedule
 */
router.post('/', async (req, res) => {
  try {
    const { medicineName, scheduledTime, days, isActive } = req.body;

    if (!scheduledTime) {
      return res.status(400).json({ success: false, error: 'Scheduled time is required' });
    }

    const schedule = new Schedule({
      medicineName: medicineName || 'Medicine',
      scheduledTime,
      days: days || [],
      isActive: isActive !== undefined ? isActive : true
    });

    await schedule.save();
    console.log(`💊 Schedule created: ${schedule.medicineName} at ${schedule.scheduledTime}`);

    // Notify connected clients
    socketService.emit('schedule:created', schedule);

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error creating schedule:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

/**
 * PUT /api/schedules/:id
 * Update an existing schedule
 */
router.put('/:id', async (req, res) => {
  try {
    const { medicineName, scheduledTime, days, isActive } = req.body;

    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { medicineName, scheduledTime, days, isActive, statusUpdatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    console.log(`💊 Schedule updated: ${schedule.medicineName} at ${schedule.scheduledTime}`);
    socketService.emit('schedule:updated', schedule);

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error updating schedule:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    console.log(`🗑️  Schedule deleted: ${schedule.medicineName}`);
    socketService.emit('schedule:deleted', { id: req.params.id });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting schedule:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

module.exports = router;
