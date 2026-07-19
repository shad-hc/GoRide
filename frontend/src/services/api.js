import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;

const api = axios.create({
  baseURL: API,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401 ───────────────────
api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { accessToken } = await axios.post(`${API}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Rides ─────────────────────────────────────────────────────
export const rideAPI = {
  estimate: (data) => api.post('/rides/estimate', data),
  request: (data) => api.post('/rides', data),
  getAll: (params) => api.get('/rides', { params }),
  getById: (id) => api.get(`/rides/${id}`),
  accept: (id) => api.patch(`/rides/${id}/accept`),
  start: (id) => api.patch(`/rides/${id}/start`),
  complete: (id) => api.patch(`/rides/${id}/complete`),
  cancel: (id, reason) => api.patch(`/rides/${id}/cancel`, { reason }),
};

// ── Drivers ───────────────────────────────────────────────────
export const driverAPI = {
  setAvailability: (data) => api.patch('/drivers/availability', data),
  updateLocation: (data) => api.patch('/drivers/location', data),
  nearby: (params) => api.get('/drivers/nearby', { params }),
  stats: () => api.get('/drivers/stats'),
};

// ── Ratings ───────────────────────────────────────────────────
export const ratingAPI = {
  submit: (rideId, data) => api.post(`/ratings/ride/${rideId}`, data),
  getMyRatings: (params) => api.get('/ratings/me', { params }),
};

// ── Users ─────────────────────────────────────────────────────
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.patch('/users/profile', data),
};

export default api;
