import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useDriverStore } from '../../store';
import { rideAPI, driverAPI } from '../../services/api';
import { getSocket, emitLocationUpdate, emitSetAvailability } from '../../services/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import RideMap from '../map/RideMap';
import '../booking/Dashboard.css';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isOnline, setOnline, pendingRideRequest, setPendingRequest, clearPendingRequest, stats, setStats } = useDriverStore();

  const { position, refresh: refreshPos } = useGeolocation({ watch: true, intervalMs: 5000 });

  const [activeRide, setActiveRide] = useState(null);
  const [passengerPos, setPassengerPos] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Fetch driver stats on mount
  useEffect(() => {
    driverAPI.stats().then((r) => setStats(r.stats)).catch(() => {});
  }, []);

  // Wire up socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('ride:new_request', (payload) => {
      setPendingRequest(payload);
      setCountdown(60); // 60s to accept
    });

    socket.on('ride:status_update', (payload) => {
      if (activeRide && payload.status === 'cancelled') {
        setActiveRide(null);
      }
    });

    return () => {
      socket.off('ride:new_request');
      socket.off('ride:status_update');
    };
  }, [activeRide]);

  // Countdown timer for pending requests
  useEffect(() => {
    if (!pendingRideRequest || countdown === null) return;
    if (countdown <= 0) { clearPendingRequest(); setCountdown(null); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, pendingRideRequest]);

  // Broadcast location while online
  useEffect(() => {
    if (!isOnline || !position) return;
    emitLocationUpdate(position.lat, position.lng, activeRide?._id);
    driverAPI.updateLocation({ lat: position.lat, lng: position.lng }).catch(() => {});
  }, [position, isOnline, activeRide]);

  const toggleOnline = async () => {
    setIsLoading(true);
    try {
      await refreshPos();
      const newState = !isOnline;
      await driverAPI.setAvailability({
        available: newState,
        lat: position?.lat,
        lng: position?.lng,
      });
      emitSetAvailability(newState, position?.lat, position?.lng);
      setOnline(newState);
    } catch (e) {
      setError(e.error || 'Failed to update status');
    } finally { setIsLoading(false); }
  };

  const handleAcceptRide = async () => {
    if (!pendingRideRequest) return;
    setIsLoading(true); setError('');
    try {
      const res = await rideAPI.accept(pendingRideRequest.rideId);
      setActiveRide(res.ride);
      clearPendingRequest();
      setCountdown(null);
    } catch (e) {
      setError(e.error || 'Failed to accept ride');
    } finally { setIsLoading(false); }
  };

  const handleRejectRide = () => {
    clearPendingRequest();
    setCountdown(null);
  };

  const handleStartRide = async () => {
    setIsLoading(true);
    try {
      const res = await rideAPI.start(activeRide._id);
      setActiveRide(res.ride);
    } catch (e) { setError(e.error || 'Failed to start ride'); }
    finally { setIsLoading(false); }
  };

  const handleCompleteRide = async () => {
    setIsLoading(true);
    try {
      const res = await rideAPI.complete(activeRide._id);
      setActiveRide(res.ride);
      // Refresh stats after completion
      driverAPI.stats().then((r) => setStats(r.stats)).catch(() => {});
      setTimeout(() => {
        navigate(`/ride/${activeRide._id}/rate`);
        setActiveRide(null);
      }, 2000);
    } catch (e) { setError(e.error || 'Failed to complete ride'); }
    finally { setIsLoading(false); }
  };

  const pickupCoords = activeRide?.pickupLocation?.coordinates;
  const dropoffCoords = activeRide?.dropoffLocation?.coordinates;

  return (
    <div className="dashboard">
      {/* Map */}
      <div className="map-area">
        <RideMap
          userPosition={position}
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          rideStatus={activeRide?.status}
          className="full-map"
        />
      </div>

      {/* Sidebar */}
      <aside className="sidebar driver-sidebar animate-slide-up">
        {/* Header */}
        <div className="sidebar-header">
          <div>
            <div className="app-brand">🚗 RideHail Driver</div>
            <div className="user-greeting">{user?.name}</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost icon-btn" onClick={logout}>🚪</button>
          </div>
        </div>

        {error && <div className="panel-error">{error}</div>}

        {/* Online toggle */}
        <div className={`online-toggle ${isOnline ? 'active' : ''}`}>
          <div>
            <div className="toggle-label">{isOnline ? '🟢 Online' : '⚫ Offline'}</div>
            <div className="toggle-sub">{isOnline ? 'Accepting ride requests' : 'Go online to accept rides'}</div>
          </div>
          <div
            className={`toggle-switch ${isOnline ? 'on' : ''}`}
            onClick={toggleOnline}
            role="button"
            aria-label="Toggle availability"
          >
            <div className="toggle-knob" />
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.todayRides}</div>
              <div className="stat-label">Today's Rides</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalRides}</div>
              <div className="stat-label">Total Rides</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">${stats.totalEarnings}</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">⭐ {stats.rating?.toFixed(1)}</div>
              <div className="stat-label">Rating ({stats.ratingCount})</div>
            </div>
          </div>
        )}

        {/* Incoming ride request */}
        {pendingRideRequest && !activeRide && (
          <div className="request-panel">
            <div className="request-title">
              <span>🔔</span>
              <span>New Ride Request</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--warning)' }}>{countdown}s</span>
            </div>

            <div className="ride-route">
              <div className="route-row">
                <span className="loc-dot pickup-dot" />
                <span>{pendingRideRequest.pickupLocation?.address}</span>
              </div>
              <div className="route-line" />
              <div className="route-row">
                <span className="loc-dot dropoff-dot" />
                <span>{pendingRideRequest.dropoffLocation?.address}</span>
              </div>
            </div>

            <div className="ride-meta">
              <div className="meta-item">
                <span>Distance</span>
                <strong>{pendingRideRequest.distanceKm?.toFixed(1)} km</strong>
              </div>
              <div className="meta-item">
                <span>Fare</span>
                <strong>${pendingRideRequest.estimatedFare?.toFixed(2)}</strong>
              </div>
            </div>

            <div className="meta-item" style={{ marginBottom: 4 }}>
              <span>Passenger</span>
              <strong>
                {pendingRideRequest.passenger?.name} · ⭐ {pendingRideRequest.passenger?.rating?.toFixed(1)}
              </strong>
            </div>

            <div className="request-actions">
              <button className="btn btn-primary" onClick={handleAcceptRide} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : '✓ Accept'}
              </button>
              <button className="btn btn-ghost" onClick={handleRejectRide}>✕ Decline</button>
            </div>
          </div>
        )}

        {/* Active ride */}
        {activeRide && (
          <div className="ride-panel animate-slide-up">
            <div className={`ride-status-banner status-${activeRide.status}`}>
              <span className="status-icon">
                {activeRide.status === 'accepted'    ? '🚗' :
                 activeRide.status === 'in_progress' ? '🛣️' :
                 activeRide.status === 'completed'   ? '✅' : '❓'}
              </span>
              <span className="status-label">
                {activeRide.status === 'accepted'    ? 'Head to pickup' :
                 activeRide.status === 'in_progress' ? 'Ride in progress' :
                 activeRide.status === 'completed'   ? 'Ride completed!' : activeRide.status}
              </span>
            </div>

            <div className="ride-route">
              <div className="route-row">
                <span className="loc-dot pickup-dot" />
                <span>{activeRide.pickupLocation?.address}</span>
              </div>
              <div className="route-line" />
              <div className="route-row">
                <span className="loc-dot dropoff-dot" />
                <span>{activeRide.dropoffLocation?.address}</span>
              </div>
            </div>

            <div className="ride-meta">
              <div className="meta-item">
                <span>Fare</span>
                <strong>${activeRide.estimatedFare?.toFixed(2)}</strong>
              </div>
              <div className="meta-item">
                <span>Distance</span>
                <strong>{activeRide.distanceKm} km</strong>
              </div>
            </div>

            {activeRide.status === 'accepted' && (
              <button className="btn btn-primary full-btn" onClick={handleStartRide} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : '🚀 Start Ride'}
              </button>
            )}

            {activeRide.status === 'in_progress' && (
              <button className="btn btn-primary full-btn" onClick={handleCompleteRide} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : '🏁 Complete Ride'}
              </button>
            )}
          </div>
        )}

        {/* Idle state */}
        {isOnline && !activeRide && !pendingRideRequest && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👀</div>
            <div style={{ fontSize: 14 }}>Waiting for ride requests…</div>
            <div className="animate-pulse" style={{ marginTop: 8, fontSize: 12 }}>
              Your location is being shared
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
