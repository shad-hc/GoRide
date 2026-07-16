const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./config/socket');
const { connectMongo } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initQueues } = require('./jobs/queueManager');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // Connect to databases
    await connectMongo();
    await connectRedis();

    // Initialize background job queues
    await initQueues();

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`API running on port ${PORT} [${process.env.NODE_ENV}]`);
      logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
