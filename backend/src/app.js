
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const rideRoutes = require('./routes/ride.routes');
const driverRoutes = require('./routes/driver.routes');
const ratingRoutes = require('./routes/rating.routes');

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ── Security middleware ─────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting 
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});

// ── Body parsing + compression 
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Request logging 
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health check (no auth, no rate limit) 
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

// ── API Documentatio
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'GoRide API',
  customCss: '.swagger-ui .topbar { background: #1a1a2e; }',
}));

// ── API Routes 
const API = `/api/${process.env.API_VERSION || 'v1'}`;
app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/users`, apiLimiter, userRoutes);
app.use(`${API}/rides`, apiLimiter, rideRoutes);
app.use(`${API}/drivers`, apiLimiter, driverRoutes);
app.use(`${API}/ratings`, apiLimiter, ratingRoutes);

// ── Error handling 
app.use(notFound);
app.use(errorHandler);

module.exports = app;
