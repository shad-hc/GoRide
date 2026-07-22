import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

const STATUS_COLORS = {
  requested:   '#ffd166',
  accepted:    '#00d4aa',
  in_progress: '#00d4aa',
  completed:   '#06d6a0',
  cancelled:   '#ff6b6b',
};

export default function RideMap({
  userPosition,
  pickupCoords,
  dropoffCoords,
  driverPosition,
  nearbyDrivers = [],
  rideStatus,
  className = '',
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const center = userPosition
      ? [userPosition.lng, userPosition.lat]
      : [-74.006, 40.7128]; // NYC default

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'bottom-right'
    );

    map.current.on('load', () => setMapLoaded(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const setMarker = useCallback((id, coords, el) => {
    if (markers.current[id]) {
      markers.current[id].setLngLat(coords);
    } else {
      markers.current[id] = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map.current);
    }
  }, []);

  const removeMarker = useCallback((id) => {
    markers.current[id]?.remove();
    delete markers.current[id];
  }, []);

  const makeEl = (emoji, size = 32) => {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${size}px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))`;
    el.textContent = emoji;
    return el;
  };

  // User position marker
  useEffect(() => {
    if (!mapLoaded || !userPosition) return;
    setMarker('user', [userPosition.lng, userPosition.lat], makeEl('📍', 28));
  }, [mapLoaded, userPosition, setMarker]);

  // Pickup marker
  useEffect(() => {
    if (!mapLoaded) return;
    if (pickupCoords) {
      setMarker('pickup', pickupCoords, makeEl('🟢', 28));
      map.current?.flyTo({ center: pickupCoords, zoom: 14 });
    } else {
      removeMarker('pickup');
    }
  }, [mapLoaded, pickupCoords, setMarker, removeMarker]);

  // Dropoff marker
  useEffect(() => {
    if (!mapLoaded) return;
    if (dropoffCoords) {
      setMarker('dropoff', dropoffCoords, makeEl('🔴', 28));
      // Fit bounds to show both pickup and dropoff
      if (pickupCoords) {
        const bounds = new mapboxgl.LngLatBounds(pickupCoords, dropoffCoords);
        map.current?.fitBounds(bounds, { padding: 80 });
      }
    } else {
      removeMarker('dropoff');
    }
  }, [mapLoaded, dropoffCoords, pickupCoords, setMarker, removeMarker]);

  // Driver position
  useEffect(() => {
    if (!mapLoaded) return;
    if (driverPosition) {
      setMarker('driver', [driverPosition.lng, driverPosition.lat], makeEl('🚗', 32));
    } else {
      removeMarker('driver');
    }
  }, [mapLoaded, driverPosition, setMarker, removeMarker]);

  // Nearby drivers (pre-ride)
  useEffect(() => {
    if (!mapLoaded) return;

    // Remove old nearby markers
    Object.keys(markers.current)
      .filter((k) => k.startsWith('nearby:'))
      .forEach((k) => { markers.current[k]?.remove(); delete markers.current[k]; });

    if (!rideStatus || rideStatus === 'requested') {
      nearbyDrivers.forEach((d) => {
        const id = `nearby:${d.driverId}`;
        setMarker(id, [d.lon, d.lat], makeEl('🚙', 24));
      });
    }
  }, [mapLoaded, nearbyDrivers, rideStatus, setMarker]);

  // Draw route line between pickup and dropoff
  useEffect(() => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords) return;
    if (!map.current.getSource('route')) {
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      });
      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': STATUS_COLORS[rideStatus] || '#00d4aa',
          'line-width': 3,
          'line-dasharray': [2, 1],
          'line-opacity': 0.8,
        },
      });
    }

    map.current.getSource('route')?.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [pickupCoords, dropoffCoords],
      },
    });

    if (map.current.getLayer('route')) {
      map.current.setPaintProperty('route', 'line-color', STATUS_COLORS[rideStatus] || '#00d4aa');
    }
  }, [mapLoaded, pickupCoords, dropoffCoords, rideStatus]);

  // Listen to real-time driver location updates
  useEffect(() => {
    const handler = (e) => {
      const { lat, lng } = e.detail;
      if (map.current && mapLoaded) {
        setMarker('driver', [lng, lat], makeEl('🚗', 32));
      }
    };
    window.addEventListener('driver:location', handler);
    return () => window.removeEventListener('driver:location', handler);
  }, [mapLoaded, setMarker]);

  return (
    <div
      ref={mapContainer}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
