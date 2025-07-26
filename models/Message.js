const mongoose = require('mongoose');
const { MESSAGE_CONSTANTS } = require('../constants');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return this.type === MESSAGE_CONSTANTS.TYPES.TEXT;
    },
    maxlength: [MESSAGE_CONSTANTS.MAX_MESSAGE_LENGTH, `Message cannot exceed ${MESSAGE_CONSTANTS.MAX_MESSAGE_LENGTH} characters`]
  },
  type: {
    type: String,
    enum: Object.values(MESSAGE_CONSTANTS.TYPES),
    default: MESSAGE_CONSTANTS.TYPES.TEXT
  },
  fileName: {
    type: String,
    required: function() {
      return this.type === MESSAGE_CONSTANTS.TYPES.FILE;
    }
  },
  fileUrl: {
    type: String,
    required: function() {
      return this.type === MESSAGE_CONSTANTS.TYPES.IMAGE || this.type === MESSAGE_CONSTANTS.TYPES.FILE;
    }
  },
  isDisappearing: {
    type: Boolean,
    default: false
  },
  disappearTime: {
    type: Number,
    default: MESSAGE_CONSTANTS.DEFAULT_DISAPPEAR_TIME // hours
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Set expiry date for disappearing messages
messageSchema.pre('save', function(next) {
  if (this.isDisappearing && !this.expiresAt) {
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + this.disappearTime);
    this.expiresAt = expiryTime;
  }
  next();
});

// Mark message as read
messageSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get conversation messages
messageSchema.statics.getConversationMessages = function(conversationId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    before = null
  } = options;

  let query = { conversationId };
  
  if (before) {
    query.createdAt = { $lt: before };
  }

  return this.find(query)
    .populate('senderId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to mark conversation messages as read
messageSchema.statics.markConversationAsRead = function(conversationId, userId) {
  return this.updateMany(
    { 
      conversationId: conversationId,
      senderId: { $ne: userId },
      isRead: false
    },
    { 
      isRead: true,
      readAt: new Date()
    }
  );
};

// Static method to count unread messages in conversation
messageSchema.statics.countUnreadInConversation = function(conversationId, userId) {
  return this.countDocuments({
    conversationId: conversationId,
    senderId: { $ne: userId },
    isRead: false
  });
};

module.exports = mongoose.model('Message', messageSchema);
