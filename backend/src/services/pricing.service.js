/**
 * Pricing Service
 *
 * Fare = (baseFare + distanceKm × costPerKm + durationMin × costPerMin) × surgeMultiplier
 * Rates are cached in Redis for quick retrieval.
 */
const { cacheGet, cacheSet } = require('../config/redis');

const VEHICLE_MULTIPLIERS = {
  economy: 1.0,
  comfort: 1.4,
  xl: 1.8,
};

/** Fetch pricing config (from cache or env) */
async function getPricingConfig(vehicleType = 'economy') {
  const cacheKey = `pricing:config:${vehicleType}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const config = {
    baseFare: parseFloat(process.env.BASE_FARE) || 2.50,
    costPerKm: (parseFloat(process.env.COST_PER_KM) || 1.20) * (VEHICLE_MULTIPLIERS[vehicleType] || 1),
    costPerMin: parseFloat(process.env.COST_PER_MIN) || 0.25,
    vehicleType,
  };

  await cacheSet(cacheKey, config, parseInt(process.env.CACHE_PRICING_TTL) || 300);
  return config;
}

/**
 * Calculate surge multiplier based on driver demand in area.
 * In production this would query active rides vs available drivers.
 */
async function getSurgeMultiplier(lat, lng) {
  // Placeholder — production: query Redis sorted sets for demand density
  const hour = new Date().getHours();
  const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  return isPeakHour ? 1.5 : 1.0;
}

/**
 * Calculate fare estimate
 * @param {number} distanceKm
 * @param {number} durationMin
 * @param {string} vehicleType
 * @param {number} [surgeMult]
 */
async function calculateFare(distanceKm, durationMin, vehicleType = 'economy', surgeMult) {
  const pricing = await getPricingConfig(vehicleType);
  const surge = surgeMult ?? await getSurgeMultiplier();

  const raw = pricing.baseFare
    + distanceKm * pricing.costPerKm
    + durationMin * pricing.costPerMin;

  const total = parseFloat((raw * surge).toFixed(2));

  return {
    baseFare: pricing.baseFare,
    distanceFare: parseFloat((distanceKm * pricing.costPerKm).toFixed(2)),
    timeFare: parseFloat((durationMin * pricing.costPerMin).toFixed(2)),
    surgeMultiplier: surge,
    total,
    breakdown: pricing,
  };
}

/**
 * Estimate distance and duration between two coordinates using Haversine.
 * In production, integrate Google Maps Distance Matrix API.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDuration(distanceKm) {
  // Assume average city speed 25 km/h + 3 min buffer
  return Math.ceil((distanceKm / 25) * 60 + 3);
}

module.exports = {
  calculateFare,
  getPricingConfig,
  getSurgeMultiplier,
  haversineDistance,
  estimateDuration,
};
