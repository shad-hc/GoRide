const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;
let pubClient;   // for PUBLISH
let subClient;   // dedicated to SUBSCRIBE

function createClient(name) {
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,

    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);

      logger.warn(
        `Redis [${name}] reconnecting in ${delay}ms (attempt ${times})`
      );

      return delay;
    },
  });

  client.on("ready", () => {
    logger.info(`Redis [${name}] ready`);
  });

  client.on("error", (err) => {
    logger.error(`Redis [${name}] error: ${err.message}`);
  });

  client.on("close", () => {
    logger.warn(`Redis [${name}] connection closed`);
  });

  client.on("reconnecting", () => {
    logger.info(`Redis [${name}] reconnecting...`);
  });

  return client;
}


async function connectRedis() {
  redisClient = createClient('main');
  pubClient   = createClient('pub');
  subClient   = createClient('sub');

  // Verify connectivity
  await redisClient.ping();
}


module.exports = {
  getRedis: () => redisClient,
  connectRedis,
};
