const { validationResult, body, param, query } = require('express-validator');
const { AppError } = require('./errorHandler');

/** Run after validation rules — returns 422 if any fail */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(messages, 422));
  }
  next();
}

// ── Validation rule sets ────────────────────────────────────

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be ≥ 8 characters')
    .matches(/\d/).withMessage('Password must contain a number'),
  body('phone').isMobilePhone().withMessage('Valid phone number required'),
  body('role').optional().isIn(['passenger', 'driver']).withMessage('Role must be passenger or driver'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const rideRequestRules = [
  body('pickupLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Pickup coordinates must be [lng, lat]'),
  body('pickupLocation.address').trim().notEmpty().withMessage('Pickup address required'),
  body('dropoffLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Dropoff coordinates must be [lng, lat]'),
  body('dropoffLocation.address').trim().notEmpty().withMessage('Dropoff address required'),
  body('vehicleType').optional().isIn(['economy', 'comfort', 'xl']),
];

const ratingRules = [
  body('score').isFloat({ min: 1, max: 5 }).withMessage('Score must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }),
];

const paginationRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const mongoIdRule = (field = 'id') =>
  param(field).isMongoId().withMessage(`Invalid ${field}`);

module.exports = {
  validate,
  registerRules,
  loginRules,
  rideRequestRules,
  ratingRules,
  paginationRules,
  mongoIdRule,
};
