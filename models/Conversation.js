const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Validate exactly 2 participants
conversationSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Conversation must have exactly 2 participants'));
  }
  
  // Ensure participants are unique
  if (this.participants[0].equals(this.participants[1])) {
    return next(new Error('Participants must be different users'));
  }
  
  next();
});

// Indexes for performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ isActive: 1 });

// Static method to find conversation between two users
conversationSchema.statics.findBetweenUsers = function(user1Id, user2Id) {
  return this.findOne({
    participants: { $all: [user1Id, user2Id] }
  });
};

// Static method to get user's conversations
conversationSchema.statics.getUserConversations = function(userId) {
  return this.find({
    participants: userId,
    isActive: true
  })
  .populate('participants', 'name email lastSeen isOnline')
  .populate('lastMessage')
  .sort({ lastMessageAt: -1 });
};

// Method to get the other participant
conversationSchema.methods.getOtherParticipant = function(currentUserId) {
  return this.participants.find(participant => !participant.equals(currentUserId));
};

// Method to update last message
conversationSchema.methods.updateLastMessage = function(messageId) {
  this.lastMessage = messageId;
  this.lastMessageAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);
