/**
 * Caretaker Routes
 * CRUD operations for caretaker management (SMS notification recipients).
 */

const express = require('express');
const router = express.Router();
const Caretaker = require('../models/Caretaker');
const socketService = require('../services/socketService');

/**
 * GET /api/caretakers
 * Fetch all caretakers
 */
router.get('/', async (req, res) => {
  try {
    const caretakers = await Caretaker.find().sort({ createdAt: -1 });
    res.json({ success: true, data: caretakers });
  } catch (error) {
    console.error('Error fetching caretakers:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch caretakers' });
  }
});

/**
 * POST /api/caretakers
 * Add a new caretaker
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, relationship } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Caretaker name and phone number are required' 
      });
    }

    const caretaker = new Caretaker({
      name,
      phone,
      relationship: relationship || ''
    });

    await caretaker.save();
    console.log(`👤 Caretaker added: ${caretaker.name} (${caretaker.phone})`);

    socketService.emit('caretaker:created', caretaker);

    res.status(201).json({ success: true, data: caretaker });
  } catch (error) {
    console.error('Error adding caretaker:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to add caretaker' });
  }
});

/**
 * PUT /api/caretakers/:id
 * Update a caretaker
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, relationship, isActive } = req.body;

    const caretaker = await Caretaker.findByIdAndUpdate(
      req.params.id,
      { name, phone, relationship, isActive },
      { new: true, runValidators: true }
    );

    if (!caretaker) {
      return res.status(404).json({ success: false, error: 'Caretaker not found' });
    }

    console.log(`👤 Caretaker updated: ${caretaker.name}`);
    socketService.emit('caretaker:updated', caretaker);

    res.json({ success: true, data: caretaker });
  } catch (error) {
    console.error('Error updating caretaker:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update caretaker' });
  }
});

/**
 * DELETE /api/caretakers/:id
 * Delete a caretaker
 */
router.delete('/:id', async (req, res) => {
  try {
    const caretaker = await Caretaker.findByIdAndDelete(req.params.id);

    if (!caretaker) {
      return res.status(404).json({ success: false, error: 'Caretaker not found' });
    }

    console.log(`🗑️  Caretaker deleted: ${caretaker.name}`);
    socketService.emit('caretaker:deleted', { id: req.params.id });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting caretaker:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete caretaker' });
  }
});

module.exports = router;
