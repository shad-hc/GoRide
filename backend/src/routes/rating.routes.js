/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: Submit and retrieve ride ratings
 */
const router = require('express').Router();
const ctrl = require('../controllers/rating.controller');
const { authenticate } = require('../middleware/auth');
const { ratingRules, mongoIdRule, validate } = require('../middleware/validate');

router.use(authenticate);

/**
 * @swagger
 * /ratings/me:
 *   get:
 *     summary: Get my received ratings
 *     tags: [Ratings]
 */
router.get('/me', ctrl.getMyRatings);

/**
 * @swagger
 * /ratings/ride/{rideId}:
 *   post:
 *     summary: Submit a rating for a completed ride
 *     tags: [Ratings]
 */
router.post('/ride/:rideId', mongoIdRule('rideId'), ratingRules, validate, ctrl.submitRating);

/**
 * @swagger
 * /ratings/user/{userId}:
 *   get:
 *     summary: Get ratings for a specific user
 *     tags: [Ratings]
 */
router.get('/user/:userId', mongoIdRule('userId'), validate, ctrl.getUserRatings);

module.exports = router;
