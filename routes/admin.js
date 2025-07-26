const express = require('express');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const VideoCall = require('../models/VideoCall');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const {
  authenticate,
  requireAdmin
} = require('../middleware/auth');
const {
  validatePagination
} = require('../middleware/validation');
const { HTTP_STATUS } = require('../constants');

const router = express.Router();

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users',
  authenticate,
  requireAdmin,
  validatePagination,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (page - 1) * limit;

      // Build search query
      let searchQuery = {};
      if (search) {
        searchQuery = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        };
      }

      const users = await User.find(searchQuery)
        .select('-password -emailVerificationToken')
        .populate('profile')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const totalUsers = await User.countDocuments(searchQuery);

      // Get user statistics
      const userStats = await Promise.all(
        users.map(async (user) => {
          const [matchCount, messageCount, callCount] = await Promise.all([
            Match.countDocuments({
              $or: [
                { user1Id: user._id },
                { user2Id: user._id }
              ],
              isMatch: true
            }),
            Message.countDocuments({ senderId: user._id }),
            VideoCall.countDocuments({
              participants: user._id,
              status: 'ended'
            })
          ]);

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            hasCompletedProfile: user.hasCompletedProfile,
            isEmailVerified: user.isEmailVerified,
            subscription: user.subscription,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
            profile: user.profile,
            stats: {
              matches: matchCount,
              messages: messageCount,
              calls: callCount
            }
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          users: userStats,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
            hasMore: users.length === parseInt(limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get app statistics
// @route   GET /api/admin/statistics
// @access  Private/Admin
router.get('/statistics',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      // User statistics
      const totalUsers = await User.countDocuments();
      const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
      const completedProfiles = await User.countDocuments({ hasCompletedProfile: true });
      const onlineUsers = await User.countDocuments({ isOnline: true });
      
      // Subscription statistics
      const subscriptionStats = await User.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 }
          }
        }
      ]);

      // Match statistics
      const totalMatches = await Match.countDocuments({ isMatch: true });
      const todayMatches = await Match.countDocuments({
        isMatch: true,
        matchedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      });

      // Message statistics
      const totalMessages = await Message.countDocuments();
      const todayMessages = await Message.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      });

      // Video call statistics
      const totalCalls = await VideoCall.countDocuments();
      const completedCalls = await VideoCall.countDocuments({ status: 'ended' });
      const averageCallDuration = await VideoCall.aggregate([
        { $match: { status: 'ended', duration: { $exists: true } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]);

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const [recentUsers, recentMatches, recentMessages, recentCalls] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        Match.countDocuments({ 
          isMatch: true, 
          matchedAt: { $gte: thirtyDaysAgo } 
        }),
        Message.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        VideoCall.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
      ]);

      // Daily activity for the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dailyActivity = await User.aggregate([
        {
          $match: { createdAt: { $gte: sevenDaysAgo } }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            newUsers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const statistics = {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          completedProfiles: completedProfiles,
          online: onlineUsers,
          verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0,
          completionRate: totalUsers > 0 ? (completedProfiles / totalUsers * 100).toFixed(2) : 0
        },
        subscriptions: subscriptionStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        matches: {
          total: totalMatches,
          today: todayMatches,
          matchRate: totalUsers > 0 ? (totalMatches / totalUsers).toFixed(2) : 0
        },
        messages: {
          total: totalMessages,
          today: todayMessages,
          averagePerUser: totalUsers > 0 ? (totalMessages / totalUsers).toFixed(2) : 0
        },
        videoCalls: {
          total: totalCalls,
          completed: completedCalls,
          averageDuration: averageCallDuration.length > 0 ? 
            Math.round(averageCallDuration[0].avgDuration) : 0,
          completionRate: totalCalls > 0 ? (completedCalls / totalCalls * 100).toFixed(2) : 0
        },
        recentActivity: {
          newUsers: recentUsers,
          newMatches: recentMatches,
          newMessages: recentMessages,
          newCalls: recentCalls
        },
        dailyActivity
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { statistics }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get user details by ID
// @route   GET /api/admin/user/:userId
// @access  Private/Admin
router.get('/user/:userId',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('-password -emailVerificationToken')
        .populate('profile');

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user activity
      const [matches, messages, calls, notifications] = await Promise.all([
        Match.find({
          $or: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }).populate('user1Id user2Id', 'name'),
        Message.find({ senderId: userId })
          .populate('conversationId')
          .sort({ createdAt: -1 })
          .limit(10),
        VideoCall.find({ participants: userId })
          .sort({ createdAt: -1 })
          .limit(10),
        Notification.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
      ]);

      const userDetails = {
        user,
        activity: {
          matches: matches.length,
          messages: messages.length,
          calls: calls.length,
          notifications: notifications.length
        },
        recentActivity: {
          matches: matches.slice(0, 5),
          messages: messages.slice(0, 5),
          calls: calls.slice(0, 5),
          notifications: notifications.slice(0, 5)
        }
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: userDetails
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update user status (admin only)
// @route   PUT /api/admin/user/:userId/status
// @access  Private/Admin
router.put('/user/:userId/status',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { isEmailVerified, hasCompletedProfile, subscription } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user fields
      if (typeof isEmailVerified === 'boolean') {
        user.isEmailVerified = isEmailVerified;
      }
      if (typeof hasCompletedProfile === 'boolean') {
        user.hasCompletedProfile = hasCompletedProfile;
      }
      if (subscription) {
        user.subscription = { ...user.subscription, ...subscription };
      }

      await user.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'User status updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete user (admin only)
// @route   DELETE /api/admin/user/:userId
// @access  Private/Admin
router.delete('/user/:userId',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      // Delete related data
      await Promise.all([
        Profile.findOneAndDelete({ userId }),
        Match.deleteMany({
          $or: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }),
        Message.deleteMany({ senderId: userId }),
        VideoCall.deleteMany({ participants: userId }),
        Notification.deleteMany({
          $or: [
            { userId },
            { fromUserId: userId }
          ]
        }),
        User.findByIdAndDelete(userId)
      ]);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'User and all related data deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get system health
// @route   GET /api/admin/health
// @access  Private/Admin
router.get('/health',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const dbStatus = await checkDatabaseHealth();
      const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          database: dbStatus,
          system: systemInfo,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to check database health
async function checkDatabaseHealth() {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      status: states[dbState],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections).length
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

module.exports = router;
