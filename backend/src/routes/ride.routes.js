/**
 * @swagger
 * tags:
 *   name: Rides
 *   description: Ride request, management, and tracking
 */
const router = require('express').Router();
const ctrl = require('../controllers/ride.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { rideRequestRules, mongoIdRule, validate } = require('../middleware/validate');

router.use(authenticate);

/**
 * @swagger
 * /rides/estimate:
 *   post:
 *     summary: Get fare estimate for a route
 *     tags: [Rides]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pickupCoordinates: { type: array, items: { type: number }, example: [-73.9, 40.7] }
 *               dropoffCoordinates: { type: array, items: { type: number } }
 *               vehicleType: { type: string, enum: [economy, comfort, xl] }
 */
router.post('/estimate', ctrl.estimateFare);

/**
 * @swagger
 * /rides:
 *   post:
 *     summary: Create a ride request
 *     tags: [Rides]
 *   get:
 *     summary: Get user's ride history
 *     tags: [Rides]
 */
router.route('/')
  .post(rideRequestRules, validate, authorize('passenger'), ctrl.requestRide)
  .get(ctrl.getMyRides);

/**
 * @swagger
 * /rides/{id}:
 *   get:
 *     summary: Get ride details
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 */
router.get('/:id', mongoIdRule('id'), validate, ctrl.getRide);

/**
 * @swagger
 * /rides/{id}/accept:
 *   patch:
 *     summary: Driver accepts a ride
 *     tags: [Rides]
 */
router.patch('/:id/accept', mongoIdRule('id'), validate, authorize('driver'), ctrl.acceptRide);

/**
 * @swagger
 * /rides/{id}/start:
 *   patch:
 *     summary: Driver starts the ride
 *     tags: [Rides]
 */
router.patch('/:id/start', mongoIdRule('id'), validate, authorize('driver'), ctrl.startRide);

/**
 * @swagger
 * /rides/{id}/complete:
 *   patch:
 *     summary: Driver completes the ride
 *     tags: [Rides]
 */
router.patch('/:id/complete', mongoIdRule('id'), validate, authorize('driver'), ctrl.completeRide);

/**
 * @swagger
 * /rides/{id}/cancel:
 *   patch:
 *     summary: Cancel a ride
 *     tags: [Rides]
 */
router.patch('/:id/cancel', mongoIdRule('id'), validate, ctrl.cancelRide);

module.exports = router;
