const mongoose = require('mongoose');

const coordinateSchema = new mongoose.Schema({
  address: { type: String, required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (v) => v.length === 2,
      message: 'Coordinates must be [lng, lat]',
    },
  },
}, { _id: false });

const rideSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // ── Locations ─────────────────────────────────────────
    pickupLocation: {
      address: { type: String, required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      type: { type: String, enum: ['Point'], default: 'Point' },
    },
    dropoffLocation: {
      address: { type: String, required: true },
      coordinates: { type: [Number], required: true },
      type: { type: String, enum: ['Point'], default: 'Point' },
    },

    // ── Ride lifecycle ────────────────────────────────────
    status: {
      type: String,
      enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'requested',
      index: true,
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    cancelledBy: { type: String, enum: ['passenger', 'driver', 'system'] },
    cancellationReason: String,

    // ── Fare & distance ───────────────────────────────────
    distanceKm: { type: Number },
    estimatedDurationMin: { type: Number },
    estimatedFare: { type: Number },
    actualFare: { type: Number },
    surgeMultiplier: { type: Number, default: 1.0 },

    vehicleType: {
      type: String,
      enum: ['economy', 'comfort', 'xl'],
      default: 'economy',
    },

    // ── Timestamps for SLA tracking ───────────────────────
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,

    // ── Payment ───────────────────────────────────────────
    paymentMethod: { type: String, default: 'card' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'charged', 'refunded'],
      default: 'pending',
    },
    transactionId: String,

    // ── Driver route tracking (array of [lng,lat] pairs) ──
    routeCoordinates: { type: [[Number]], default: [] },

    // ── Ratings ───────────────────────────────────────────
    passengerRated: { type: Boolean, default: false },
    driverRated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Geospatial indexes for location-based ride queries
rideSchema.index({ 'pickupLocation': '2dsphere' });
rideSchema.index({ 'dropoffLocation': '2dsphere' });
rideSchema.index({ status: 1, createdAt: -1 });

/** Push a status change into history and update current status */
rideSchema.methods.updateStatus = async function (newStatus, note, extra = {}) {
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, note, timestamp: new Date() });

  const now = new Date();
  if (newStatus === 'accepted') this.acceptedAt = now;
  if (newStatus === 'in_progress') this.startedAt = now;
  if (newStatus === 'completed') {
    this.completedAt = now;
    this.actualFare = extra.fare ?? this.estimatedFare;
  }

  Object.assign(this, extra);
  return this.save();
};

module.exports = mongoose.model('Ride', rideSchema);
