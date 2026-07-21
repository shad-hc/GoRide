import { create } from 'zustand';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

// ── Auth store 
export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await authAPI.login(credentials);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      connectSocket(accessToken);
      set({ user, accessToken, isLoading: false });
    } catch (err) {
      set({ error: err.error || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await authAPI.register(data);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      connectSocket(accessToken);
      set({ user, accessToken, isLoading: false });
    } catch (err) {
      set({ error: err.error || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await authAPI.logout().catch(() => {});
    localStorage.clear();
    disconnectSocket();
    set({ user: null, accessToken: null });
  },

  clearError: () => set({ error: null }),
}));

// ── Ride store 
export const useRideStore = create((set, get) => ({
  currentRide: null,
  rideHistory: [],
  estimate: null,
  nearbyDrivers: [],
  isLoading: false,
  error: null,

  setCurrentRide: (ride) => set({ currentRide: ride }),
  setEstimate: (estimate) => set({ estimate }),
  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  updateRideStatus: (status, extra = {}) => {
    const { currentRide } = get();
    if (currentRide) {
      set({ currentRide: { ...currentRide, status, ...extra } });
    }
  },

  clearRide: () => set({ currentRide: null, estimate: null }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));

// ── Driver store 
export const useDriverStore = create((set) => ({
  isOnline: false,
  pendingRideRequest: null,
  stats: null,

  setOnline: (v) => set({ isOnline: v }),
  setPendingRequest: (req) => set({ pendingRideRequest: req }),
  clearPendingRequest: () => set({ pendingRideRequest: null }),
  setStats: (stats) => set({ stats }),
}));
