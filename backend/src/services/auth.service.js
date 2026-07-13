const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { cacheDel } = require('../config/redis');

/** Generate access + refresh token pair */
function generateTokens(userId, role) {
  const payload = { id: userId, role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

  return { accessToken, refreshToken };
}

async function register({ name, email, password, phone, role, vehicleInfo, licenseNumber }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already in use', 409);

  const user = await User.create({
    name, email, password, phone,
    role: role || 'passenger',
    vehicleInfo: role === 'driver' ? vehicleInfo : undefined,
    licenseNumber: role === 'driver' ? licenseNumber : undefined,
  });

  const tokens = generateTokens(user._id.toString(), user.role);
  return { user, ...tokens };
}

async function login({ email, password }) {
  const user = await User.findOne({ email, isActive: true }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = generateTokens(user._id.toString(), user.role);
  return { user, ...tokens };
}

async function refreshTokens(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new AppError('User not found', 401);

  return generateTokens(user._id.toString(), user.role);
}

async function logout(userId) {
  // Invalidate cached session
  await cacheDel(`user:session:${userId}`);
}

module.exports = { register, login, refreshTokens, logout };
