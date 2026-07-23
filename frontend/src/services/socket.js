import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
  socket.on('disconnect', (reason) => console.warn('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}

//Join the room for a specific ride 
export function joinRideRoom(rideId) {
  socket?.emit('ride:join', { rideId });
}

export function leaveRideRoom(rideId) {
  socket?.emit('ride:leave', { rideId });
}

//Emit driver GPS update
export function emitLocationUpdate(lat, lng, rideId = null) {
  socket?.emit('driver:update_location', { lat, lng, rideId });
}

// Set driver availability
export function emitSetAvailability(available, lat = null, lng = null) {
  socket?.emit('driver:set_availability', { available, lat, lng });
}
