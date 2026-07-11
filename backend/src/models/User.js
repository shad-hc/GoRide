const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // never returned in queries by default
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['passenger', 'driver', 'admin'],
      default: 'passenger',
    },

    // ── Rating aggregate ────────────────────────────────
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    ratingCount: { type: Number, default: 0 },

    // ── Driver-only fields ──────────────────────────────
    vehicleInfo: {
      make: String,
      model: String,
      year: Number,
      licensePlate: String,
      color: String,
      type: { type: String, enum: ['economy', 'comfort', 'xl'], default: 'economy' },
    },
    licenseNumber: { type: String },
    isVerified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },

    // ── Last known location (for Mongo 2dsphere queries) ─
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    // ── Stripe / payment ────────────────────────────────
    stripeCustomerId: String,
    stripeAccountId: String,

    // ── Soft delete ─────────────────────────────────────
    isActive: { type: Boolean, default: true },
    deactivatedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// 2dsphere index for MongoDB geospatial queries (backup to Redis)
userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, isOnline: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/** Compare plain password to stored hash */
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

/** Recompute rolling average rating */
userSchema.methods.addRating = async function (newScore) {
  this.ratingCount += 1;
  // Incremental average: avg = avg + (new - avg) / count
  this.rating = parseFloat(
    (this.rating + (newScore - this.rating) / this.ratingCount).toFixed(2)
  );
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
