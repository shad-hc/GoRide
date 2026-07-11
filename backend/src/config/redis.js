const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;
let pubClient;   // for PUBLISH
let subClient;   // dedicated to SUBSCRIBE

function createClient(name) {
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,

    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);

      logger.warn(
        `Redis [${name}] reconnecting in ${delay}ms (attempt ${times})`
      );

      return delay;
    },
  });

  client.on("ready", () => {
    logger.info(`Redis [${name}] ready`);
  });

  client.on("error", (err) => {
    logger.error(`Redis [${name}] error: ${err.message}`);
  });

  client.on("close", () => {
    logger.warn(`Redis [${name}] connection closed`);
  });

  client.on("reconnecting", () => {
    logger.info(`Redis [${name}] reconnecting...`);
  });

  return client;
}


async function connectRedis() {
  redisClient = createClient('main');
  pubClient   = createClient('pub');
  subClient   = createClient('sub');

  // Verify connectivity
  await redisClient.ping();
}

// ── Geospatial helpers ──────────────────────────────────────────────────────

/** Store driver location in Redis geo set */
async function geoAddDriver(driverId, lng, lat) {
  return redisClient.geoadd('drivers:available', lng, lat, driverId);
}

/** Remove driver from available geo set */
async function geoRemoveDriver(driverId) {
  return redisClient.zrem('drivers:available', driverId);
}

/**
 * Find available drivers within radius of a point
 * @returns Array of { member, distance } objects sorted by distance ASC
 */
async function geoSearchDrivers(lng, lat, radiusMeters = 5000, count = 10) {
  // GEOSEARCH key FROMLONLAT lng lat BYRADIUS r m ASC COUNT n WITHCOORD WITHDIST
  const results = await redisClient.geosearch(
    'drivers:available',
    'FROMLONLAT', lng, lat,
    'BYRADIUS', radiusMeters, 'm',
    'ASC',
    'COUNT', count,
    'WITHCOORD',
    'WITHDIST'
  );
  // Each result: [memberId, distance, [lon, lat]]
  return results.map(([memberId, distance, [dLon, dLat]]) => ({
    driverId: memberId,
    distance: parseFloat(distance), // metres
    lon: parseFloat(dLon),
    lat: parseFloat(dLat),
  }));
}

/** Get distance between two drivers/locations (metres) */
async function geoDist(member1, member2) {
  return redisClient.geodist('drivers:available', member1, member2, 'm');
}

// ── Pub/Sub helpers ─────────────────────────────────────────────────────────

const RIDE_STATUS_CHANNEL = (rideId) => `ride:status:${rideId}`;
const DRIVER_LOCATION_CHANNEL = (driverId) => `driver:location:${driverId}`;

async function publishRideStatus(rideId, payload) {
  return pubClient.publish(RIDE_STATUS_CHANNEL(rideId), JSON.stringify(payload));
}

async function publishDriverLocation(driverId, payload) {
  return pubClient.publish(DRIVER_LOCATION_CHANNEL(driverId), JSON.stringify(payload));
}

async function subscribeToChannel(channel, handler) {
  await subClient.subscribe(channel);
  subClient.on('message', (ch, message) => {
    if (ch === channel) {
      try { handler(JSON.parse(message)); } catch { handler(message); }
    }
  });
}

// ── Cache helpers ───────────────────────────────────────────────────────────

async function cacheSet(key, value, ttlSeconds) {
  return redisClient.setex(key, ttlSeconds, JSON.stringify(value));
}

async function cacheGet(key) {
  const raw = await redisClient.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function cacheDel(key) {
  return redisClient.del(key);
}

// ── Driver availability flag ────────────────────────────────────────────────

async function setDriverAvailable(driverId, available) {
  const key = `driver:available:${driverId}`;
  if (available) return redisClient.set(key, '1', 'EX', 60 * 60 * 12); // 12h TTL
  return redisClient.del(key);
}

async function isDriverAvailable(driverId) {
  return (await redisClient.get(`driver:available:${driverId}`)) === '1';
}

// ── Sorted set for driver ranking ───────────────────────────────────────────

async function rankDriversByDistance(rideId, driverDistances) {
  const key = `ride:drivers:${rideId}`;
  const args = [];
  for (const { driverId, distance } of driverDistances) {
    args.push(distance, driverId);
  }
  if (args.length === 0) return;
  await redisClient.zadd(key, ...args);
  await redisClient.expire(key, 300); // 5min TTL
}

async function getTopDriversForRide(rideId, count = 5) {
  return redisClient.zrangebyscore(`ride:drivers:${rideId}`, '-inf', '+inf', 'LIMIT', 0, count);
}

module.exports = {
  getRedis: () => redisClient,
  connectRedis,
  // Geo
  geoAddDriver,
  geoRemoveDriver,
  geoSearchDrivers,
  geoDist,
  // Pub/sub
  publishRideStatus,
  publishDriverLocation,
  subscribeToChannel,
  RIDE_STATUS_CHANNEL,
  DRIVER_LOCATION_CHANNEL,
  // Cache
  cacheSet,
  cacheGet,
  cacheDel,
  // Driver state
  setDriverAvailable,
  isDriverAvailable,
  // Rankings
  rankDriversByDistance,
  getTopDriversForRide,
};
