const logger = require('../utils/logger');

/** Operational error with HTTP status */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 404 handler */
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/** Central error handler */
function errorHandler(err, req, res, next) {
  let { message, statusCode = 500, isOperational } = err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
    isOperational = true;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    isOperational = true;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401; message = 'Invalid token'; isOperational = true;
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401; message = 'Token expired'; isOperational = true;
  }

  // Log non-operational (unexpected) errors
  if (!isOperational) logger.error(err);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}


module.exports = { AppError, notFound, errorHandler };
