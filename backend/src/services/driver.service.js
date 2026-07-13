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


module.exports = {
  setDriverOnlineStatus,
  updateDriverLocation,  
};
