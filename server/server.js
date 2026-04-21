/**
 * Smart Medicine Reminder — Main Server
 * 
 * Entry point for the backend application.
 * Sets up Express, Socket.io, MongoDB, and all services.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

// Import configuration and services
const connectDB = require('./config/db');
const socketService = require('./services/socketService');
const smsService = require('./services/smsService');
const scheduler = require('./services/scheduler');

// Import routes
const scheduleRoutes = require('./routes/schedules');
const caretakerRoutes = require('./routes/caretakers');
const deviceRoutes = require('./routes/device');
const logRoutes = require('./routes/logs');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// ═══════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════

// Enable CORS for all origins (ESP8266 + frontend)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging (simple)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ═══════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════

app.use('/api/schedules', scheduleRoutes);
app.use('/api/caretakers', caretakerRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/logs', logRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date(),
      sms: smsService.getStatus(),
      device: scheduler.getDeviceStatus()
    }
  });
});

// Catch-all: serve frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════
//  ERROR HANDLING
// ═══════════════════════════════════════════════

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Socket.io
    socketService.init(server);

    // 3. Initialize SMS service
    smsService.init();

    // 4. Initialize scheduler
    scheduler.init();

    // 5. Start listening
    server.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║   💊 Smart Medicine Reminder — Server Running   ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(`║   🌐 Web UI:  http://localhost:${PORT}             ║`);
      console.log(`║   📡 API:     http://localhost:${PORT}/api          ║`);
      console.log(`║   🔌 Socket:  ws://localhost:${PORT}               ║`);
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close();
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start the server
startServer();
