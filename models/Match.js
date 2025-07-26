const mongoose = require('mongoose');
const { MATCH_CONSTANTS } = require('../constants');

const matchSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user1Action: {
    type: String,
    enum: Object.values(MATCH_CONSTANTS.ACTIONS),
    required: true
  },
  user2Action: {
    type: String,
    enum: Object.values(MATCH_CONSTANTS.ACTIONS),
    default: MATCH_CONSTANTS.ACTIONS.PENDING
  },
  isMatch: {
    type: Boolean,
    default: false
  },
  matchedAt: {
    type: Date
  },
  compatibility: {
    type: Number,
    min: MATCH_CONSTANTS.MIN_COMPATIBILITY_SCORE,
    max: MATCH_CONSTANTS.MAX_COMPATIBILITY_SCORE,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for performance
matchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
matchSchema.index({ user1Id: 1, user1Action: 1 });
matchSchema.index({ user2Id: 1, user2Action: 1 });
matchSchema.index({ isMatch: 1, matchedAt: -1 });

// Ensure users don't match with themselves
matchSchema.pre('save', function(next) {
  if (this.user1Id.equals(this.user2Id)) {
    return next(new Error('Users cannot match with themselves'));
  }
  next();
});

// Check for match when both users have acted
matchSchema.pre('save', function(next) {
  if (this.user1Action === MATCH_CONSTANTS.ACTIONS.LIKE && 
      this.user2Action === MATCH_CONSTANTS.ACTIONS.LIKE) {
    this.isMatch = true;
    if (!this.matchedAt) {
      this.matchedAt = new Date();
    }
  } else {
    this.isMatch = false;
    this.matchedAt = undefined;
  }
  next();
});

// Static method to find existing match
matchSchema.statics.findExistingMatch = function(user1Id, user2Id) {
  return this.findOne({
    $or: [
      { user1Id: user1Id, user2Id: user2Id },
      { user1Id: user2Id, user2Id: user1Id }
    ]
  });
};

// Static method to get user's matches
matchSchema.statics.getUserMatches = function(userId) {
  return this.find({
    $or: [
      { user1Id: userId, isMatch: true },
      { user2Id: userId, isMatch: true }
    ]
  }).populate('user1Id user2Id', 'name email lastSeen isOnline')
    .sort({ matchedAt: -1 });
};

// Method to get the other user in the match
matchSchema.methods.getOtherUser = function(currentUserId) {
  return this.user1Id.equals(currentUserId) ? this.user2Id : this.user1Id;
};

module.exports = mongoose.model('Match', matchSchema);
