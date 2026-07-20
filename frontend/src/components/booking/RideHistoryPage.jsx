import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rideAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { format } from 'date-fns';
import '../booking/Dashboard.css';

const FILTER_OPTIONS = ['all','requested','accepted','in_progress','completed','cancelled'];

export default function RideHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const params = { page, limit: 10, ...(filter !== 'all' ? { status: filter } : {}) };
    setIsLoading(true);
    rideAPI.getAll(params)
      .then((r) => { setRides(r.rides || []); setTotalPages(r.totalPages || 1); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [page, filter]);

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="btn btn-ghost icon-btn" onClick={() => navigate('/')}>←</button>
        <h1>Ride History</h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : rides.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
          <p>No rides found</p>
        </div>
      ) : (
        <>
          {rides.map((ride) => (
            <div key={ride._id} className="ride-card" onClick={() => {}}>
              <div className="ride-card-header">
                <div>
                  <span className={`badge badge-${ride.status}`}>{ride.status.replace('_', ' ')}</span>
                  <div className="ride-date" style={{ marginTop: 6 }}>
                    {format(new Date(ride.createdAt), 'MMM d, yyyy · h:mm a')}
                  </div>
                </div>
                <div className="ride-fare">
                  {ride.actualFare ? `$${ride.actualFare.toFixed(2)}` : ride.estimatedFare ? `~$${ride.estimatedFare.toFixed(2)}` : '—'}
                </div>
              </div>
              <div className="ride-route-mini">
                <span><span className="loc-dot pickup-dot" style={{ width: 8, height: 8 }} />{ride.pickupLocation?.address}</span>
                <span><span className="loc-dot dropoff-dot" style={{ width: 8, height: 8 }} />{ride.dropoffLocation?.address}</span>
              </div>
              {ride.distanceKm && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {ride.distanceKm} km · ~{ride.estimatedDurationMin} min · {ride.vehicleType}
                </div>
              )}
              {ride.status === 'completed' && !ride[user?.role === 'passenger' ? 'passengerRated' : 'driverRated'] && (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/ride/${ride._id}/rate`); }}
                >
                  ⭐ Rate this ride
                </button>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {page} / {totalPages}
              </span>
              <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
