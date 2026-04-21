/**
 * Log Routes
 * API endpoints for medicine intake history and statistics.
 */

const express = require('express');
const router = express.Router();
const Log = require('../models/Log');

/**
 * GET /api/logs
 * Fetch intake history with optional date filtering and pagination
 * Query params: ?date=YYYY-MM-DD&page=1&limit=20&status=Taken
 */
router.get('/', async (req, res) => {
  try {
    const { date, page = 1, limit = 50, status } = req.query;
    const filter = {};

    if (date) {
      filter.date = date;
    }
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      Log.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('scheduleId', 'medicineName scheduledTime'),
      Log.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/logs/stats
 * Get summary statistics for today and overall
 */
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's stats
    const [todayTaken, todayMissed, todayEscalated, totalLogs] = await Promise.all([
      Log.countDocuments({ date: today, status: 'Taken' }),
      Log.countDocuments({ date: today, status: 'Missed' }),
      Log.countDocuments({ date: today, status: 'Escalated' }),
      Log.countDocuments()
    ]);

    // Overall compliance rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDate = thirtyDaysAgo.toISOString().split('T')[0];

    const [recentTotal, recentTaken] = await Promise.all([
      Log.countDocuments({ date: { $gte: recentDate } }),
      Log.countDocuments({ date: { $gte: recentDate }, status: 'Taken' })
    ]);

    const complianceRate = recentTotal > 0 
      ? Math.round((recentTaken / recentTotal) * 100) 
      : 100;

    res.json({
      success: true,
      data: {
        today: {
          taken: todayTaken,
          missed: todayMissed,
          escalated: todayEscalated,
          total: todayTaken + todayMissed + todayEscalated
        },
        overall: {
          totalLogs,
          complianceRate,
          period: '30 days'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

/**
 * DELETE /api/logs
 * Clear all logs (admin action)
 */
router.delete('/', async (req, res) => {
  try {
    const result = await Log.deleteMany({});
    console.log(`🗑️  Cleared ${result.deletedCount} log entries`);
    res.json({ success: true, data: { deleted: result.deletedCount } });
  } catch (error) {
    console.error('Error clearing logs:', error.message);
    res.status(500).json({ success: false, error: 'Failed to clear logs' });
  }
});

module.exports = router;
