const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const { cacheGet, cacheSet } = require('../config/redis');

/** Verify JWT and attach user to req */
async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try cache first to avoid DB hit on every request
    const cacheKey = `user:session:${decoded.id}`;
    let user = await cacheGet(cacheKey);

    if (!user) {
      user = await User.findById(decoded.id).select('-password').lean();
      if (!user) throw new AppError('User not found', 401);
      await cacheSet(cacheKey, user, parseInt(process.env.CACHE_USER_TTL) || 600);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict to specific roles */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

/** Optional auth — attaches user if token present, doesn't fail if missing */
async function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next();
  await authenticate(req, res, next);
}

module.exports = { authenticate, authorize, optionalAuth };
