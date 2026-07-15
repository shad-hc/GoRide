/**
 * @swagger
 * tags:
 *   name: Drivers
 *   description: Driver availability, location and stats
 */
const router = require('express').Router();
const ctrl = require('../controllers/driver.controller');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /drivers/nearby:
 *   get:
 *     summary: Find available drivers near a location
 *     tags: [Drivers]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         required: true
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *         required: true
 *       - in: query
 *         name: radius
 *         schema: { type: integer, default: 5000 }
 *       - in: query
 *         name: vehicleType
 *         schema: { type: string, enum: [economy, comfort, xl] }
 */
router.get('/nearby', authenticate, ctrl.nearbyDrivers);

/**
 * @swagger
 * /drivers/availability:
 *   patch:
 *     summary: Set driver online/offline status
 *     tags: [Drivers]
 */
router.patch('/availability', authenticate, authorize('driver'), ctrl.setAvailability);

/**
 * @swagger
 * /drivers/location:
 *   patch:
 *     summary: Update driver GPS location
 *     tags: [Drivers]
 */
router.patch('/location', authenticate, authorize('driver'), ctrl.updateLocation);

/**
 * @swagger
 * /drivers/stats:
 *   get:
 *     summary: Get driver statistics
 *     tags: [Drivers]
 */
router.get('/stats', authenticate, authorize('driver'), ctrl.getStats);

module.exports = router;
