const rideService = require('../services/ride.service');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

async function requestRide(req, res, next) {
  try {
    const result = await rideService.createRideRequest(req.user._id.toString(), req.body);
    ok(res, result, 201);
  } catch (err) { next(err); }
}

async function estimateFare(req, res, next) {
  try {
    const estimate = await rideService.estimateFare(req.body);
    ok(res, { estimate });
  } catch (err) { next(err); }
}

async function acceptRide(req, res, next) {
  try {
    const ride = await rideService.acceptRide(req.params.id, req.user._id.toString());
    ok(res, { ride });
  } catch (err) { next(err); }
}

async function startRide(req, res, next) {
  try {
    const ride = await rideService.startRide(req.params.id, req.user._id.toString());
    ok(res, { ride });
  } catch (err) { next(err); }
}

async function completeRide(req, res, next) {
  try {
    const ride = await rideService.completeRide(req.params.id, req.user._id.toString());
    ok(res, { ride });
  } catch (err) { next(err); }
}

async function cancelRide(req, res, next) {
  try {
    const ride = await rideService.cancelRide(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
      req.body.reason
    );
    ok(res, { ride });
  } catch (err) { next(err); }
}

async function getMyRides(req, res, next) {
  try {
    const result = await rideService.getUserRides(
      req.user._id.toString(),
      req.user.role,
      req.query
    );
    ok(res, result);
  } catch (err) { next(err); }
}

async function getRide(req, res, next) {
  try {
    const ride = await rideService.getRideById(req.params.id, req.user._id.toString());
    ok(res, { ride });
  } catch (err) { next(err); }
}

module.exports = {
  requestRide,
  estimateFare,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  getMyRides,
  getRide,
};
