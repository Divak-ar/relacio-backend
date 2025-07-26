const mongoose = require('mongoose');
const { NOTIFICATION_CONSTANTS } = require('../constants');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_CONSTANTS.TYPES),
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

// Mark notification as read
notificationSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const {
    limit = 20,
    offset = 0,
    unreadOnly = false
  } = options;

  let query = { userId };
  
  if (unreadOnly) {
    query.isRead = false;
  }

  return this.find(query)
    .populate('fromUserId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to mark all user notifications as read
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { userId: userId, isRead: false },
    { 
      isRead: true,
      readAt: new Date()
    }
  );
};

// Static method to count unread notifications
notificationSchema.statics.countUnread = function(userId) {
  return this.countDocuments({
    userId: userId,
    isRead: false
  });
};

// Static method to create notification
notificationSchema.statics.createNotification = function(notificationData) {
  const notification = new this(notificationData);
  return notification.save();
};

// Static method to cleanup old notifications (older than 30 days)
notificationSchema.statics.cleanupOldNotifications = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.deleteMany({
    createdAt: { $lt: thirtyDaysAgo },
    isRead: true
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
