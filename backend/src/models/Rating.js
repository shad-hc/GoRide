const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },
    raterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ratedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    raterRole: {
      type: String,
      enum: ['passenger', 'driver'],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    // Structured feedback tags
    tags: [
      {
        type: String,
        enum: [
          'great_driving', 'on_time', 'clean_vehicle', 'friendly',
          'safe_driving', 'good_route', 'great_passenger', 'respectful',
          'on_time_pickup', 'clear_communication',
        ],
      },
    ],
  },
  { timestamps: true }
);

// One rating per rater per ride (prevent duplicate submissions)
ratingSchema.index({ rideId: 1, raterId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
