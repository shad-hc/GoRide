import { useState, useEffect, useCallback } from 'react';

/**
 * useGeolocation — tracks user's GPS position
 * @param {object} options
 * @param {boolean} options.watch - continuously watch position
 * @param {number}  options.intervalMs - polling interval if watch=true
 */
export function useGeolocation({ watch = false, intervalMs = 5000 } = {}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const update = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    update();
    if (!watch) return;
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [watch, intervalMs, update]);

  return { position, error, isLoading, refresh: update };
}
