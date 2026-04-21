/**
 * Socket.io Service
 * Manages WebSocket connections and event broadcasting.
 * Provides a singleton pattern for the Socket.io instance.
 */

let io = null;

/**
 * Initialize Socket.io with the HTTP server
 * @param {http.Server} server - HTTP server instance
 */
const init = (server) => {
  const { Server } = require('socket.io');
  
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client can join a room for targeted events
    socket.on('join', (room) => {
      socket.join(room);
      console.log(`📡 Socket ${socket.id} joined room: ${room}`);
    });

    // Handle manual medicine confirmation from frontend
    socket.on('medicine:confirm', (data) => {
      console.log(`💊 Medicine confirmed via frontend:`, data);
      // This will be handled by the scheduler service
      if (global.handleManualConfirm) {
        global.handleManualConfirm(data.scheduleId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`❌ Socket error: ${err.message}`);
    });
  });

  console.log('🔌 Socket.io initialized');
  return io;
};

/**
 * Get the Socket.io instance
 * @returns {Server} Socket.io server instance
 */
const getIO = () => {
  if (!io) {
    console.warn('⚠️  Socket.io not initialized yet');
    return null;
  }
  return io;
};

/**
 * Emit an event to all connected clients
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
const emit = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`📤 Emitted: ${event}`);
  }
};

/**
 * Emit to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

module.exports = { init, getIO, emit, emitToRoom };
