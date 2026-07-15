/**
 * Queue Manager — Redis-backed Bull queues for async background tasks
 *
 * Queues:
 *   ride-completion  → post-ride analytics, payout, notifications
 *   ride-timeout     → auto-cancel unclaimed ride requests
 *   driver-ranking   → periodic driver ranking refreshes
 */
const Bull = require('bull');
const logger = require('../utils/logger');

const REDIS_URL = process.env.BULL_REDIS_URL || process.env.REDIS_URL;

let rideCompletionQueue;
let rideTimeoutQueue;
let driverRankingQueue;

async function initQueues() {
  const opts = {
    redis: REDIS_URL,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  };

  rideCompletionQueue = new Bull('ride-completion', opts);
  rideTimeoutQueue    = new Bull('ride-timeout', opts);
  driverRankingQueue  = new Bull('driver-ranking', opts);

  // ── Processors ──────────────────────────────────────────
  rideCompletionQueue.process(async (job) => {
    const { rideId } = job.data;
    logger.info(`[Queue] Processing ride completion: ${rideId}`);
    // In production: trigger payout, update analytics, send push notification
    // await payoutService.processDriverPayout(rideId);
    // await analyticsService.trackRideCompletion(rideId);
  });

  rideTimeoutQueue.process(async (job) => {
    const { rideId } = job.data;
    const Ride = require('../models/Ride');
    const { publishRideStatus } = require('../config/redis');
    const { emitToRide } = require('../config/socket');

    const ride = await Ride.findById(rideId);
    if (ride && ride.status === 'requested') {
      await ride.updateStatus('cancelled', 'Timed out — no driver accepted', {
        cancelledBy: 'system',
        cancellationReason: 'No driver accepted within time limit',
      });
      const payload = { rideId, status: 'cancelled', reason: 'timeout' };
      await publishRideStatus(rideId, payload);
      emitToRide(rideId, 'ride:status_update', payload);
      logger.info(`[Queue] Ride ${rideId} auto-cancelled (timeout)`);
    }
  });

  driverRankingQueue.process(async (job) => {
    const { lat, lng } = job.data;
    logger.debug(`[Queue] Refreshing driver rankings near ${lat},${lng}`);
    // Re-run geo queries and update sorted sets
  });

  // ── Event logging ─────────────────────────────────────────
  for (const [name, q] of [
    ['ride-completion', rideCompletionQueue],
    ['ride-timeout', rideTimeoutQueue],
    ['driver-ranking', driverRankingQueue],
  ]) {
    q.on('completed', (job) => logger.debug(`[Queue:${name}] Job ${job.id} done`));
    q.on('failed', (job, err) => logger.error(`[Queue:${name}] Job ${job.id} failed: ${err.message}`));
    q.on('stalled', (job) => logger.warn(`[Queue:${name}] Job ${job.id} stalled`));
  }

  logger.info('✅ Bull queues initialized');
}

async function addRideCompletionJob(rideId) {
  return rideCompletionQueue?.add({ rideId }, { delay: 1000 });
}

async function addRideTimeoutJob(rideId, timeoutSeconds) {
  return rideTimeoutQueue?.add({ rideId }, { delay: timeoutSeconds * 1000, jobId: `timeout:${rideId}` });
}

async function removeRideTimeoutJob(rideId) {
  try {
    const job = await rideTimeoutQueue?.getJob(`timeout:${rideId}`);
    if (job) await job.remove();
  } catch { /* ignore */ }
}

module.exports = {
  initQueues,
  addRideCompletionJob,
  addRideTimeoutJob,
  removeRideTimeoutJob,
};
