const express = require('express');
const Notification = require('../models/Notification');
const {
  authenticate,
  requireEmailVerification
} = require('../middleware/auth');
const {
  validatePagination,
  validateObjectId
} = require('../middleware/validation');
const { HTTP_STATUS } = require('../constants');

const router = express.Router();

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/',
  authenticate,
  requireEmailVerification,
  validatePagination,
  async (req, res, next) => {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = req.query;
      const userId = req.user.id;

      // Build query
      const query = { userId };
      if (unreadOnly === 'true') {
        query.isRead = false;
      }

      const notifications = await Notification.find(query)
        .populate('fromUserId', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      // Get unread count
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false
      });

      // Format notifications
      const formattedNotifications = notifications.map(notification => ({
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        fromUser: notification.fromUserId ? {
          id: notification.fromUserId._id,
          name: notification.fromUserId.name
        } : null,
        isRead: notification.isRead,
        createdAt: notification.createdAt
      }));

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          notifications: formattedNotifications,
          unreadCount,
          hasMore: notifications.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Mark notification as read
// @route   PUT /api/notifications/:notificationId/read
// @access  Private
router.put('/:notificationId/read',
  authenticate,
  requireEmailVerification,
  validateObjectId('notificationId'),
  async (req, res, next) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        _id: notificationId,
        userId
      });

      if (!notification) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Notification not found'
        });
      }

      if (notification.isRead) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Notification is already read'
        });
      }

      notification.isRead = true;
      await notification.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Notification marked as read',
        data: {
          notification: {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            createdAt: notification.createdAt
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
router.put('/mark-all-read',
  authenticate,
  requireEmailVerification,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true }
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          markedCount: result.modifiedCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
router.delete('/:notificationId',
  authenticate,
  requireEmailVerification,
  validateObjectId('notificationId'),
  async (req, res, next) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        _id: notificationId,
        userId
      });

      if (!notification) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await Notification.findByIdAndDelete(notificationId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete all read notifications
// @route   DELETE /api/notifications/clear-read
// @access  Private
router.delete('/clear-read',
  authenticate,
  requireEmailVerification,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const result = await Notification.deleteMany({
        userId,
        isRead: true
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Read notifications cleared successfully',
        data: {
          deletedCount: result.deletedCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
router.get('/stats',
  authenticate,
  requireEmailVerification,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get notification counts by type
      const stats = await Notification.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            unread: {
              $sum: {
                $cond: [{ $eq: ['$isRead', false] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Get total counts
      const totalNotifications = await Notification.countDocuments({ userId });
      const totalUnread = await Notification.countDocuments({ 
        userId, 
        isRead: false 
      });

      // Format stats
      const formattedStats = {
        total: totalNotifications,
        totalUnread: totalUnread,
        byType: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            total: stat.total,
            unread: stat.unread
          };
          return acc;
        }, {})
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          stats: formattedStats
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences',
  authenticate,
  requireEmailVerification,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { preferences } = req.body;

      // Update user's notification preferences
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update preferences (extend user model to include notification preferences)
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...preferences
      };

      await user.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: {
          preferences: user.notificationPreferences
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences',
  authenticate,
  requireEmailVerification,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Default preferences if not set
      const defaultPreferences = {
        email: {
          matches: true,
          messages: true,
          likes: true,
          videoCalls: true
        },
        push: {
          matches: true,
          messages: true,
          likes: true,
          videoCalls: true
        }
      };

      const preferences = user.notificationPreferences || defaultPreferences;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          preferences
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
