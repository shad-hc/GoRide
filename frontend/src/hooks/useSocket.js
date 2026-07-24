import { useEffect, useRef } from 'react';
import { getSocket, connectSocket, joinRideRoom, leaveRideRoom } from '../services/socket';
import { useAuthStore, useRideStore, useDriverStore } from '../store';

/**
 * Initializes socket connection and wires up event handlers.
 * Should be mounted once at the App level.
 */
export function useSocket() {
  const { user, accessToken } = useAuthStore();
  const { setCurrentRide, updateRideStatus } = useRideStore();
  const { setPendingRequest } = useDriverStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!accessToken || !user) return;

    const socket = connectSocket(accessToken);
    socketRef.current = socket;

    // ── Passenger events ──────────────────────────────────
    socket.on('ride:status_update', (payload) => {
      console.log('[Socket] ride:status_update', payload);
      updateRideStatus(payload.status, payload);
    });

    socket.on('driver:location', (payload) => {
      // Map component subscribes to this via its own listener
      window.dispatchEvent(new CustomEvent('driver:location', { detail: payload }));
    });

    socket.on('ride:eta_update', (payload) => {
      window.dispatchEvent(new CustomEvent('ride:eta_update', { detail: payload }));
    });

    // ── Driver events ──────────────────────────────────────
    socket.on('ride:new_request', (payload) => {
      console.log('[Socket] New ride request:', payload.rideId);
      setPendingRequest(payload);
    });

    socket.on('driver:availability_confirmed', ({ available }) => {
      useDriverStore.getState().setOnline(available);
    });

    return () => {
      socket.off('ride:status_update');
      socket.off('driver:location');
      socket.off('ride:new_request');
      socket.off('driver:availability_confirmed');
      socket.off('ride:eta_update');
    };
  }, [accessToken, user]);

  return socketRef.current;
}

/** Hook to join/leave a ride room and receive updates */
export function useRideRoom(rideId) {
  useEffect(() => {
    if (!rideId) return;
    joinRideRoom(rideId);
    return () => leaveRideRoom(rideId);
  }, [rideId]);
}
