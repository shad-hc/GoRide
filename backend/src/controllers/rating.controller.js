const ratingService = require('../services/rating.service');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

async function submitRating(req, res, next) {
  try {
    const rating = await ratingService.submitRating(
      req.user._id.toString(),
      req.user.role,
      req.params.rideId,
      req.body
    );
    ok(res, { rating }, 201);
  } catch (err) { next(err); }
}

async function getUserRatings(req, res, next) {
  try {
    const result = await ratingService.getUserRatings(req.params.userId, req.query);
    ok(res, result);
  } catch (err) { next(err); }
}

async function getMyRatings(req, res, next) {
  try {
    const result = await ratingService.getUserRatings(req.user._id.toString(), req.query);
    ok(res, result);
  } catch (err) { next(err); }
}

module.exports = { submitRating, getUserRatings, getMyRatings };
