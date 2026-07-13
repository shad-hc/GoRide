const User = require('../models/User');
const Ride = require('../models/Ride');
const { AppError } = require('../middleware/errorHandler');
const {
  geoAddDriver,
  geoRemoveDriver,
  geoSearchDrivers,
  setDriverAvailable,
  isDriverAvailable,
} = require('../config/redis');

/**
 * Set driver online/offline and update Redis geo
 */
async function setDriverOnlineStatus(driverId, available, coords) {
  const driver = await User.findOneAndUpdate(
    { _id: driverId, role: 'driver' },
    { isOnline: available, ...(coords ? { location: { type: 'Point', coordinates: [coords.lng, coords.lat] } } : {}) },
    { new: true }
  ).select('-password');

  if (!driver) throw new AppError('Driver not found', 404);

  await setDriverAvailable(driverId, available);

  if (available && coords) {
    await geoAddDriver(driverId, coords.lng, coords.lat);
  } else if (!available) {
    await geoRemoveDriver(driverId);
  }

  return driver;
}

/**
 * Update driver location (called periodically from mobile app)
 */
async function updateDriverLocation(driverId, { lat, lng }) {
  await Promise.all([
    User.findByIdAndUpdate(driverId, {
      location: { type: 'Point', coordinates: [lng, lat] },
    }),
    geoAddDriver(driverId, lng, lat),
  ]);
}

/**
 * Find available drivers near a point (uses Redis GEOSEARCH)
 */
async function findNearbyDrivers(lat, lng, radius = 5000, vehicleType) {
  const results = await geoSearchDrivers(lng, lat, radius);

  if (!results.length) return [];

  // Hydrate from MongoDB for additional details
  const driverIds = results.map((r) => r.driverId);
  const filter = { _id: { $in: driverIds }, role: 'driver', isOnline: true };
  if (vehicleType) filter['vehicleInfo.type'] = vehicleType;

  const drivers = await User.find(filter)
    .select('name rating vehicleInfo location')
    .lean();

  // Merge distance data from Redis with Mongo details
  const distMap = new Map(results.map((r) => [r.driverId, r]));
  return drivers
    .map((d) => ({ ...d, ...distMap.get(d._id.toString()) }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get driver stats
 */
async function getDriverStats(driverId) {
  const [totalRides, earnings, rating] = await Promise.all([
    Ride.countDocuments({ driverId, status: 'completed' }),
    Ride.aggregate([
      { $match: { driverId: require('mongoose').Types.ObjectId.createFromHexString(driverId), status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$actualFare' } } },
    ]),
    User.findById(driverId).select('rating ratingCount').lean(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRides = await Ride.countDocuments({
    driverId,
    status: 'completed',
    completedAt: { $gte: today },
  });

  return {
    totalRides,
    todayRides,
    totalEarnings: earnings[0]?.total?.toFixed(2) ?? '0.00',
    rating: rating?.rating,
    ratingCount: rating?.ratingCount,
  };
}

module.exports = {
  setDriverOnlineStatus,
  updateDriverLocation,
  findNearbyDrivers,
  getDriverStats,
};
