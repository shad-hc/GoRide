const Rating = require('../models/Rating');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { AppError } = require('../middleware/errorHandler');

async function submitRating(raterId, riderRole, rideId, { score, comment, tags }) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.status !== 'completed') throw new AppError('Can only rate completed rides', 400);

  // Determine who is being rated
  const isPassenger = riderRole === 'passenger';
  const ratedUserId = isPassenger
    ? ride.driverId  // passenger rates driver
    : ride.passengerId; // driver rates passenger

  if (!ratedUserId) throw new AppError('No user to rate for this ride', 400);

  // Check authorization
  const authorized = isPassenger
    ? ride.passengerId.toString() === raterId
    : ride.driverId?.toString() === raterId;
  if (!authorized) throw new AppError('Not authorized to rate this ride', 403);

  // Check already rated
  const field = isPassenger ? 'passengerRated' : 'driverRated';
  if (ride[field]) throw new AppError('You have already rated this ride', 409);

  // Create rating
  const rating = await Rating.create({
    rideId,
    raterId,
    ratedUserId,
    raterRole: riderRole,
    score,
    comment,
    tags,
  });

  // Update user's rolling average
  const ratedUser = await User.findById(ratedUserId);
  await ratedUser.addRating(score);

  // Mark ride as rated
  await Ride.findByIdAndUpdate(rideId, { [field]: true });

  return rating;
}

async function getUserRatings(userId, { page = 1, limit = 20 }) {
  const [ratings, total] = await Promise.all([
    Rating.find({ ratedUserId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('raterId', 'name')
      .populate('rideId', 'pickupLocation dropoffLocation createdAt')
      .lean(),
    Rating.countDocuments({ ratedUserId: userId }),
  ]);

  // Compute average
  const aggregate = await Rating.aggregate([
    { $match: { ratedUserId: require('mongoose').Types.ObjectId.createFromHexString(userId) } },
    { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
  ]);

  return {
    ratings,
    total,
    page,
    averageScore: aggregate[0]?.avg?.toFixed(2) ?? null,
    ratingCount: aggregate[0]?.count ?? 0,
  };
}

module.exports = { submitRating, getUserRatings };
