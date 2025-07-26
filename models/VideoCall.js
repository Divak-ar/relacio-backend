const mongoose = require('mongoose');
const { VIDEOCALL_CONSTANTS } = require('../constants');

const videoCallSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    unique: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  initiatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(VIDEOCALL_CONSTANTS.STATUS),
    default: VIDEOCALL_CONSTANTS.STATUS.PENDING
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  dailyRoomUrl: {
    type: String,
    required: true
  },
  dailyRoomName: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
videoCallSchema.index({ callId: 1 });
videoCallSchema.index({ participants: 1 });
videoCallSchema.index({ initiatorId: 1 });
videoCallSchema.index({ status: 1 });
videoCallSchema.index({ createdAt: -1 });

// Validate participants
videoCallSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Video call must have exactly 2 participants'));
  }
  
  if (this.participants[0].equals(this.participants[1])) {
    return next(new Error('Participants must be different users'));
  }
  
  if (!this.participants.some(p => p.equals(this.initiatorId))) {
    return next(new Error('Initiator must be one of the participants'));
  }
  
  next();
});

// Calculate duration when call ends
videoCallSchema.pre('save', function(next) {
  if (this.status === VIDEOCALL_CONSTANTS.STATUS.ENDED && this.startTime && this.endTime && !this.duration) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Method to start call
videoCallSchema.methods.startCall = function() {
  this.status = VIDEOCALL_CONSTANTS.STATUS.ACTIVE;
  this.startTime = new Date();
  return this.save();
};

// Method to end call
videoCallSchema.methods.endCall = function() {
  this.status = VIDEOCALL_CONSTANTS.STATUS.ENDED;
  this.endTime = new Date();
  if (this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  return this.save();
};

// Method to decline call
videoCallSchema.methods.declineCall = function() {
  this.status = VIDEOCALL_CONSTANTS.STATUS.DECLINED;
  return this.save();
};

// Method to get other participant
videoCallSchema.methods.getOtherParticipant = function(currentUserId) {
  return this.participants.find(participant => !participant.equals(currentUserId));
};

// Static method to get user's call history
videoCallSchema.statics.getUserCallHistory = function(userId, options = {}) {
  const {
    limit = 20,
    offset = 0,
    status = null
  } = options;

  let query = { participants: userId };
  
  if (status) {
    query.status = status;
  }

  return this.find(query)
    .populate('participants', 'name email')
    .populate('initiatorId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to find active call for user
videoCallSchema.statics.findActiveCallForUser = function(userId) {
  return this.findOne({
    participants: userId,
    status: { $in: [VIDEOCALL_CONSTANTS.STATUS.PENDING, VIDEOCALL_CONSTANTS.STATUS.ACTIVE] }
  }).populate('participants', 'name email');
};

module.exports = mongoose.model('VideoCall', videoCallSchema);
