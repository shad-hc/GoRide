/**
 * Ride Service — all ride lifecycle operations
 */
const Ride = require('../models/Ride');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const {
  geoSearchDrivers,
  rankDriversByDistance,
  getTopDriversForRide,
  publishRideStatus,
  cacheGet,
  cacheSet,
} = require('../config/redis');
const { emitToUser, emitToRide, emitToDrivers } = require('../config/socket');
const {
  calculateFare,
  haversineDistance,
  estimateDuration,
} = require('./pricing.service');
const { addRideCompletionJob, addRideTimeoutJob } = require('../jobs/queueManager');
const logger = require('../utils/logger');

/**
 * Create a new ride request
 */
async function createRideRequest(passengerId, { pickupLocation, dropoffLocation, vehicleType }) {
  // Ensure passenger doesn't already have an active ride
  const existingRide = await Ride.findOne({
    passengerId,
    status: { $in: ['requested', 'accepted', 'in_progress'] },
  });
  if (existingRide) throw new AppError('You already have an active ride', 409);

  const [pLng, pLat] = pickupLocation.coordinates;
  const [dLng, dLat] = dropoffLocation.coordinates;

  // Calculate distance and pricing
  const distanceKm = haversineDistance(pLat, pLng, dLat, dLng);
  const estimatedDurationMin = estimateDuration(distanceKm);
  const fareData = await calculateFare(distanceKm, estimatedDurationMin, vehicleType);

  // Try cached route pricing first
  const routeKey = `route:${pLat.toFixed(3)},${pLng.toFixed(3)}-${dLat.toFixed(3)},${dLng.toFixed(3)}:${vehicleType}`;
  await cacheSet(routeKey, { distanceKm, estimatedDurationMin, fare: fareData }, parseInt(process.env.CACHE_ROUTE_TTL) || 3600);

  // Create ride document
  const ride = await Ride.create({
    passengerId,
    pickupLocation: {
      ...pickupLocation,
      type: 'Point',
    },
    dropoffLocation: {
      ...dropoffLocation,
      type: 'Point',
    },
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    estimatedDurationMin,
    estimatedFare: fareData.total,
    surgeMultiplier: fareData.surgeMultiplier,
    vehicleType: vehicleType || 'economy',
    statusHistory: [{ status: 'requested', timestamp: new Date() }],
  });

  // Find nearby available drivers via Redis GEOSEARCH
  const searchRadius = parseInt(process.env.DRIVER_SEARCH_RADIUS) || 5000;
  const nearbyDrivers = await geoSearchDrivers(pLng, pLat, searchRadius, 10);

  if (nearbyDrivers.length === 0) {
    // Try expanded radius
    const maxRadius = parseInt(process.env.DRIVER_MAX_RADIUS) || 20000;
    const extended = await geoSearchDrivers(pLng, pLat, maxRadius, 10);
    if (extended.length === 0) {
      await ride.updateStatus('cancelled', 'No drivers available', { cancelledBy: 'system', cancellationReason: 'No drivers available' });
      throw new AppError('No drivers available in your area right now', 503);
    }
    nearbyDrivers.push(...extended);
  }

  // Rank drivers in Redis sorted set (score = distance)
  await rankDriversByDistance(ride._id.toString(), nearbyDrivers);

  // Notify each nearby driver via Socket.IO
  const passenger = await User.findById(passengerId).select('name rating').lean();
  const ridePayload = {
    rideId: ride._id,
    passenger: { name: passenger.name, rating: passenger.rating },
    pickupLocation,
    dropoffLocation,
    distanceKm: ride.distanceKm,
    estimatedFare: ride.estimatedFare,
    vehicleType: ride.vehicleType,
  };

  for (const { driverId } of nearbyDrivers) {
    emitToUser(driverId, 'ride:new_request', ridePayload);
  }

  // Set a timeout job to auto-cancel if no driver accepts
  await addRideTimeoutJob(ride._id.toString(), parseInt(process.env.RIDE_REQUEST_TIMEOUT_SECONDS) || 30);

  logger.info(`Ride ${ride._id} requested — ${nearbyDrivers.length} drivers notified`);

  return { ride, nearbyDrivers: nearbyDrivers.length, fareBreakdown: fareData };
}

/**
 * Driver accepts a ride
 */
async function acceptRide(rideId, driverId) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.status !== 'requested') throw new AppError('Ride is no longer available', 409);

  const driver = await User.findById(driverId).select('name rating vehicleInfo location isOnline').lean();
  if (!driver) throw new AppError('Driver not found', 404);
  if (!driver.isOnline) throw new AppError('Driver is not online', 400);

  await ride.updateStatus('accepted', `Accepted by driver ${driverId}`, { driverId });

  // Update driver's online status
  await User.findByIdAndUpdate(driverId, { isOnline: true });

  const payload = {
    rideId: ride._id,
    status: 'accepted',
    driver: {
      id: driverId,
      name: driver.name,
      rating: driver.rating,
      vehicle: driver.vehicleInfo,
    },
  };

  // Notify passenger
  emitToUser(ride.passengerId.toString(), 'ride:status_update', payload);
  // Notify ride room
  emitToRide(rideId, 'ride:status_update', payload);
  // Redis pub/sub broadcast
  await publishRideStatus(rideId, payload);

  return ride;
}

/**
 * Driver starts the ride (passenger picked up)
 */
async function startRide(rideId, driverId) {
  const ride = await Ride.findOne({ _id: rideId, driverId });
  if (!ride) throw new AppError('Ride not found or unauthorized', 404);
  if (ride.status !== 'accepted') throw new AppError(`Cannot start a ride in status: ${ride.status}`, 400);

  await ride.updateStatus('in_progress');

  const payload = { rideId, status: 'in_progress', startedAt: ride.startedAt };
  emitToRide(rideId, 'ride:status_update', payload);
  await publishRideStatus(rideId, payload);

  return ride;
}

/**
 * Driver completes the ride
 */
async function completeRide(rideId, driverId) {
  const ride = await Ride.findOne({ _id: rideId, driverId });
  if (!ride) throw new AppError('Ride not found or unauthorized', 404);
  if (ride.status !== 'in_progress') throw new AppError(`Cannot complete a ride in status: ${ride.status}`, 400);

  await ride.updateStatus('completed', undefined, { fare: ride.estimatedFare });

  // Enqueue post-ride processing (analytics, payout, notifications)
  await addRideCompletionJob(rideId);

  const payload = {
    rideId,
    status: 'completed',
    completedAt: ride.completedAt,
    actualFare: ride.actualFare,
  };
  emitToRide(rideId, 'ride:status_update', payload);
  await publishRideStatus(rideId, payload);

  logger.info(`Ride ${rideId} completed — fare $${ride.actualFare}`);
  return ride;
}

/**
 * Cancel a ride (passenger or driver)
 */
async function cancelRide(rideId, userId, role, reason) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError('Ride not found', 404);

  const isPassenger = ride.passengerId.toString() === userId;
  const isDriver = ride.driverId?.toString() === userId;
  if (!isPassenger && !isDriver) throw new AppError('Not authorized to cancel this ride', 403);

  const cancellableStatuses = ['requested', 'accepted'];
  if (!cancellableStatuses.includes(ride.status)) {
    throw new AppError(`Cannot cancel a ride in status: ${ride.status}`, 400);
  }

  await ride.updateStatus('cancelled', reason, {
    cancelledBy: role,
    cancellationReason: reason || 'No reason provided',
  });

  const payload = { rideId, status: 'cancelled', cancelledBy: role, reason };
  emitToRide(rideId, 'ride:status_update', payload);
  await publishRideStatus(rideId, payload);

  return ride;
}

/**
 * Get rides for a user (paginated)
 */
async function getUserRides(userId, role, { page = 1, limit = 10, status }) {
  const filter = role === 'driver' ? { driverId: userId } : { passengerId: userId };
  if (status) filter.status = status;

  const [rides, total] = await Promise.all([
    Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('passengerId', 'name rating')
      .populate('driverId', 'name rating vehicleInfo')
      .lean(),
    Ride.countDocuments(filter),
  ]);

  return { rides, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Get a single ride with full details
 */
async function getRideById(rideId, userId) {
  const ride = await Ride.findById(rideId)
    .populate('passengerId', 'name rating phone')
    .populate('driverId', 'name rating phone vehicleInfo location')
    .lean();

  if (!ride) throw new AppError('Ride not found', 404);

  const isAuthorized =
    ride.passengerId?._id.toString() === userId ||
    ride.driverId?._id?.toString() === userId;
  if (!isAuthorized) throw new AppError('Not authorized to view this ride', 403);

  return ride;
}

/**
 * Get fare estimate without creating a ride
 */
async function estimateFare({ pickupCoordinates, dropoffCoordinates, vehicleType }) {
  const [pLng, pLat] = pickupCoordinates;
  const [dLng, dLat] = dropoffCoordinates;

  // Check route cache
  const routeKey = `route:${pLat.toFixed(3)},${pLng.toFixed(3)}-${dLat.toFixed(3)},${dLng.toFixed(3)}:${vehicleType || 'economy'}`;
  const cached = await cacheGet(routeKey);
  if (cached) return cached;

  const distanceKm = haversineDistance(pLat, pLng, dLat, dLng);
  const estimatedDurationMin = estimateDuration(distanceKm);
  const fareData = await calculateFare(distanceKm, estimatedDurationMin, vehicleType);

  const result = { distanceKm: parseFloat(distanceKm.toFixed(2)), estimatedDurationMin, ...fareData };
  await cacheSet(routeKey, result, parseInt(process.env.CACHE_ROUTE_TTL) || 3600);
  return result;
}

module.exports = {
  createRideRequest,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  getUserRides,
  getRideById,
  estimateFare,
};
