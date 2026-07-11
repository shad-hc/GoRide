const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const {
  subscribeToChannel,
  RIDE_STATUS_CHANNEL,
  DRIVER_LOCATION_CHANNEL,
  geoAddDriver,
  geoRemoveDriver,
  setDriverAvailable,
  publishDriverLocation,
} = require('./redis');

let io;

// Maps socket.id → userId and userId → socket.id for quick lookups
const socketToUser = new Map();
const userToSocket = new Map();

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // ── JWT auth middleware ─────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, userRole } = socket;
    logger.info(`Socket connected: ${userId} (${userRole}) — ${socket.id}`);

    // Register mapping
    socketToUser.set(socket.id, userId);
    userToSocket.set(userId, socket.id);

    // Join personal room for targeted events
    socket.join(`user:${userId}`);
    if (userRole === 'driver') socket.join('drivers');

    // ── DRIVER: update GPS location ─────────────────────
    socket.on('driver:update_location', async ({ lat, lng, rideId }) => {
      try {
        if (userRole !== 'driver') return;

        // Update Redis geo set
        await geoAddDriver(userId, lng, lat);

        // Publish location update for any active ride
        if (rideId) {
          await publishDriverLocation(userId, { driverId: userId, lat, lng, rideId });
          io.to(`ride:${rideId}`).emit('driver:location', { lat, lng, driverId: userId });
        }
      } catch (err) {
        logger.error('Location update error:', err.message);
      }
    });

    // ── DRIVER: go online/offline ───────────────────────
    socket.on('driver:set_availability', async ({ available, lat, lng }) => {
      try {
        if (userRole !== 'driver') return;
        await setDriverAvailable(userId, available);
        if (available && lat && lng) {
          await geoAddDriver(userId, lng, lat);
        } else if (!available) {
          await geoRemoveDriver(userId);
        }
        socket.emit('driver:availability_confirmed', { available });
      } catch (err) {
        logger.error('Availability update error:', err.message);
      }
    });

    // ── Subscribe to ride channel on join ───────────────
    socket.on('ride:join', ({ rideId }) => {
      socket.join(`ride:${rideId}`);
      logger.debug(`${userId} joined ride room ${rideId}`);
    });

    socket.on('ride:leave', ({ rideId }) => {
      socket.leave(`ride:${rideId}`);
    });

    // ── Disconnect ──────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${userId} — ${reason}`);
      socketToUser.delete(socket.id);
      userToSocket.delete(userId);

      // Remove driver from geo set when they disconnect
      if (userRole === 'driver') {
        await geoRemoveDriver(userId).catch(() => {});
        await setDriverAvailable(userId, false).catch(() => {});
      }
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
}

/** Emit event to a specific user (regardless of socket room) */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/** Emit event to all users in a ride room */
function emitToRide(rideId, event, data) {
  if (!io) return;
  io.to(`ride:${rideId}`).emit(event, data);
}

/** Emit to all connected drivers */
function emitToDrivers(event, data) {
  if (!io) return;
  io.to('drivers').emit(event, data);
}

function getIO() {
  return io;
}

module.exports = { initSocket, emitToUser, emitToRide, emitToDrivers, getIO };
