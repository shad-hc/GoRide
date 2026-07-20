import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useRideStore } from '../../store';
import { rideAPI, driverAPI } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideRoom } from '../../hooks/useSocket';
import RideMap from '../map/RideMap';
import './Dashboard.css';

const VEHICLE_TYPES = [
  { id: 'economy', label: 'Economy', icon: '🚗', desc: 'Affordable rides' },
  { id: 'comfort', label: 'Comfort', icon: '🚙', desc: '1.4× — Extra space' },
  { id: 'xl',      label: 'XL',      icon: '🚐', desc: '1.8× — Up to 6 seats' },
];

const STATUS_LABELS = {
  requested:   { label: 'Finding driver…',     icon: '🔍', color: 'warning' },
  accepted:    { label: 'Driver on the way!',   icon: '🚗', color: 'accent'  },
  in_progress: { label: 'Ride in progress',     icon: '🛣️', color: 'accent'  },
  completed:   { label: 'Ride completed!',      icon: '✅', color: 'success' },
  cancelled:   { label: 'Ride cancelled',       icon: '❌', color: 'danger'  },
};

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentRide, setCurrentRide, estimate, setEstimate, nearbyDrivers, setNearbyDrivers, clearRide } = useRideStore();

  const { position } = useGeolocation({ watch: false });

  const [step, setStep] = useState('idle'); // idle | locating | estimating | confirming | riding
  const [pickup, setPickup]   = useState({ address: '', coords: null });
  const [dropoff, setDropoff] = useState({ address: '', coords: null });
  const [vehicleType, setVehicleType] = useState('economy');
  const [driverPos, setDriverPos] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Join ride room for real-time updates
  useRideRoom(currentRide?._id);

  // Listen to real-time status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload) => {
      setCurrentRide((prev) => ({ ...prev, ...payload }));
      if (payload.status === 'completed') {
        setTimeout(() => navigate(`/ride/${payload.rideId}/rate`), 1500);
      }
    };
    socket.on('ride:status_update', handler);

    const locHandler = (payload) => setDriverPos({ lat: payload.lat, lng: payload.lng });
    socket.on('driver:location', locHandler);

    return () => {
      socket.off('ride:status_update', handler);
      socket.off('driver:location', locHandler);
    };
  }, []);

  // Auto-populate pickup from GPS
  useEffect(() => {
    if (position && !pickup.coords) {
      setPickup({ address: `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`, coords: [position.lng, position.lat] });
    }
  }, [position]);

  // Fetch nearby drivers periodically
  useEffect(() => {
    if (!position || currentRide) return;
    const fetch = async () => {
      try {
        const res = await driverAPI.nearby({ lat: position.lat, lng: position.lng, radius: 5000 });
        setNearbyDrivers(res.drivers || []);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [position, currentRide]);

  const handleEstimate = async () => {
    if (!pickup.coords || !dropoff.coords) { setError('Enter both pickup and dropoff locations'); return; }
    setIsLoading(true); setError('');
    try {
      const res = await rideAPI.estimate({
        pickupCoordinates: pickup.coords,
        dropoffCoordinates: dropoff.coords,
        vehicleType,
      });
      setEstimate(res.estimate);
      setStep('confirming');
    } catch (e) {
      setError(e.error || 'Could not estimate fare');
    } finally { setIsLoading(false); }
  };

  const handleRequestRide = async () => {
    setIsLoading(true); setError('');
    try {
      const res = await rideAPI.request({
        pickupLocation:  { address: pickup.address,  coordinates: pickup.coords },
        dropoffLocation: { address: dropoff.address, coordinates: dropoff.coords },
        vehicleType,
      });
      setCurrentRide(res.ride);
      setStep('riding');
    } catch (e) {
      setError(e.error || 'Could not request ride');
    } finally { setIsLoading(false); }
  };

  const handleCancel = async () => {
    if (!currentRide?._id) { clearRide(); setStep('idle'); return; }
    setIsLoading(true);
    try {
      await rideAPI.cancel(currentRide._id, 'Passenger cancelled');
      clearRide(); setStep('idle'); setDriverPos(null);
    } catch (e) { setError(e.error || 'Cancel failed'); }
    finally { setIsLoading(false); }
  };

  const useCurrentLocation = () => {
    if (position) setPickup({ address: 'My Location', coords: [position.lng, position.lat] });
  };

  const rideStatusInfo = currentRide ? STATUS_LABELS[currentRide.status] : null;

  return (
    <div className="dashboard">
      {/* ── Map ─────────────────────────────────────────── */}
      <div className="map-area">
        <RideMap
          userPosition={position}
          pickupCoords={pickup.coords}
          dropoffCoords={dropoff.coords}
          driverPosition={driverPos}
          nearbyDrivers={nearbyDrivers}
          rideStatus={currentRide?.status}
          className="full-map"
        />
      </div>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar animate-slide-up">
        {/* Header */}
        <div className="sidebar-header">
          <div>
            <div className="app-brand">🚗 RideHail</div>
            <div className="user-greeting">Hello, {user?.name?.split(' ')[0]}</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost icon-btn" onClick={() => navigate('/ride/history')} title="Ride History">📋</button>
            <button className="btn btn-ghost icon-btn" onClick={logout} title="Logout">🚪</button>
          </div>
        </div>

        {/* Nearby drivers indicator */}
        {!currentRide && (
          <div className="drivers-badge">
            <span className={`online-dot ${nearbyDrivers.length > 0 ? 'active' : ''}`} />
            {nearbyDrivers.length > 0
              ? `${nearbyDrivers.length} driver${nearbyDrivers.length > 1 ? 's' : ''} nearby`
              : 'No drivers nearby'}
          </div>
        )}

        {error && <div className="panel-error">{error}</div>}

        {/* ── IDLE / BOOKING ──────────────────────────── */}
        {(step === 'idle' || step === 'confirming') && !currentRide && (
          <div className="booking-panel">
            <h2 className="panel-title">Where to?</h2>

            {/* Pickup */}
            <div className="location-field">
              <span className="loc-dot pickup-dot" />
              <div className="loc-input-wrap">
                <input
                  className="input"
                  placeholder="Pickup location"
                  value={pickup.address}
                  onChange={(e) => setPickup({ address: e.target.value, coords: null })}
                />
                <button className="loc-gps-btn" onClick={useCurrentLocation} title="Use GPS">📍</button>
              </div>
            </div>

            {/* Mock geocode for demo: parse "lat,lng" */}
            <div className="location-field">
              <span className="loc-dot dropoff-dot" />
              <input
                className="input"
                placeholder="Dropoff location (or lat,lng)"
                value={dropoff.address}
                onChange={(e) => {
                  const v = e.target.value;
                  const parts = v.split(',').map(Number);
                  const coords = parts.length === 2 && !isNaN(parts[0]) ? [parts[1], parts[0]] : null;
                  setDropoff({ address: v, coords });
                }}
              />
            </div>

            {/* Vehicle type selector */}
            <div className="vehicle-grid">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v.id}
                  className={`vehicle-btn ${vehicleType === v.id ? 'selected' : ''}`}
                  onClick={() => setVehicleType(v.id)}
                >
                  <span className="v-icon">{v.icon}</span>
                  <span className="v-label">{v.label}</span>
                  <span className="v-desc">{v.desc}</span>
                </button>
              ))}
            </div>

            {/* Estimate / Confirm */}
            {step === 'idle' && (
              <button className="btn btn-primary full-btn" onClick={handleEstimate} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : '🔍 Get Fare Estimate'}
              </button>
            )}

            {step === 'confirming' && estimate && (
              <div className="estimate-card animate-slide-up">
                <div className="estimate-header">
                  <h3>Fare Estimate</h3>
                  <button className="btn-link" onClick={() => setStep('idle')}>← Edit</button>
                </div>
                <div className="estimate-row">
                  <span>Distance</span>
                  <span>{estimate.distanceKm} km</span>
                </div>
                <div className="estimate-row">
                  <span>Duration</span>
                  <span>~{estimate.estimatedDurationMin} min</span>
                </div>
                {estimate.surgeMultiplier > 1 && (
                  <div className="estimate-row surge">
                    <span>⚡ Surge</span>
                    <span>{estimate.surgeMultiplier}×</span>
                  </div>
                )}
                <div className="estimate-row total">
                  <span>Total</span>
                  <span>${estimate.total}</span>
                </div>
                <button className="btn btn-primary full-btn" onClick={handleRequestRide} disabled={isLoading}>
                  {isLoading ? <span className="spinner" /> : '🚗 Request Ride'}
                </button>
                <button className="btn btn-ghost full-btn" onClick={() => setStep('idle')} style={{ marginTop: 8 }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE RIDE ──────────────────────────────── */}
        {currentRide && (
          <div className="ride-panel animate-slide-up">
            <div className={`ride-status-banner status-${currentRide.status}`}>
              <span className="status-icon">{rideStatusInfo?.icon}</span>
              <span className="status-label">{rideStatusInfo?.label}</span>
            </div>

            {currentRide.status === 'requested' && (
              <div className="searching-anim">
                <div className="pulse-ring" />
                <span>🔍</span>
              </div>
            )}

            {/* Driver info (once accepted) */}
            {['accepted', 'in_progress'].includes(currentRide.status) && currentRide.driver && (
              <div className="driver-info-card">
                <div className="driver-avatar">{currentRide.driver?.name?.[0] || '👤'}</div>
                <div className="driver-details">
                  <div className="driver-name">{currentRide.driver?.name}</div>
                  <div className="driver-rating">⭐ {currentRide.driver?.rating?.toFixed(1)}</div>
                  {currentRide.driver?.vehicle && (
                    <div className="driver-vehicle">
                      {currentRide.driver.vehicle.color} {currentRide.driver.vehicle.make} {currentRide.driver.vehicle.model}
                      {' · '}<strong>{currentRide.driver.vehicle.licensePlate}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ride-route">
              <div className="route-row">
                <span className="loc-dot pickup-dot" />
                <span>{currentRide.pickupLocation?.address}</span>
              </div>
              <div className="route-line" />
              <div className="route-row">
                <span className="loc-dot dropoff-dot" />
                <span>{currentRide.dropoffLocation?.address}</span>
              </div>
            </div>

            <div className="ride-meta">
              <div className="meta-item">
                <span>Estimated fare</span>
                <strong>${currentRide.estimatedFare?.toFixed(2)}</strong>
              </div>
              <div className="meta-item">
                <span>Distance</span>
                <strong>{currentRide.distanceKm} km</strong>
              </div>
            </div>

            {currentRide.status === 'completed' && (
              <div className="completed-banner">
                <p>Ride completed! 🎉</p>
                <p>Actual fare: <strong>${currentRide.actualFare?.toFixed(2)}</strong></p>
                <button className="btn btn-primary full-btn" onClick={() => navigate(`/ride/${currentRide._id}/rate`)}>
                  ⭐ Rate your ride
                </button>
              </div>
            )}

            {['requested', 'accepted'].includes(currentRide.status) && (
              <button className="btn btn-danger full-btn" onClick={handleCancel} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : '✕ Cancel Ride'}
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
