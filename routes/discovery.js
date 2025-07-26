const express = require('express');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const User = require('../models/User');
const MatchingService = require('../services/matchingService');
const NotificationService = require('../services/notificationService');
const {
  authenticate,
  requireEmailVerification,
  requireProfileCompletion
} = require('../middleware/auth');
const {
  likeRateLimit,
  superLikeRateLimit,
  incrementUsage
} = require('../middleware/rateLimit');
const {
  validateSwipe,
  validatePagination
} = require('../middleware/validation');
const { HTTP_STATUS } = require('../constants');

const router = express.Router();

// @desc    Get potential matches for swiping
// @route   GET /api/discovery/profiles
// @access  Private
router.get('/profiles',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validatePagination,
  async (req, res, next) => {
    try {
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.user.id;

      // Get discovery profiles using matching service
      const profiles = await MatchingService.getDiscoveryProfiles(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          profiles,
          hasMore: profiles.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Record swipe action
// @route   POST /api/discovery/swipe
// @access  Private
router.post('/swipe',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateSwipe,
  async (req, res, next) => {
    try {
      const { targetUserId, action } = req.body;
      const userId = req.user.id;

      // Check if target user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Target user not found'
        });
      }

      // Check if user is trying to swipe on themselves
      if (userId === targetUserId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Cannot swipe on yourself'
        });
      }

      // Check if user has already swiped on this person
      const existingMatch = await Match.findOne({
        $or: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId }
        ]
      });

      if (existingMatch) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'You have already swiped on this user'
        });
      }

      // Apply rate limiting based on action type
      if (action === 'super_like') {
        // Super like rate limiting will be handled by middleware
      } else if (action === 'like') {
        // Like rate limiting will be handled by middleware
      }

      // Process the swipe
      const result = await MatchingService.processSwipe(userId, targetUserId, action);

      // Check if it's a match
      if (result.isMatch) {
        // Send match notifications to both users
        await Promise.all([
          NotificationService.createNotification(userId, 'match', {
            title: 'New Match!',
            message: `You and ${targetUser.name} liked each other!`,
            fromUserId: targetUserId
          }),
          NotificationService.createNotification(targetUserId, 'match', {
            title: 'New Match!',
            message: `You and ${req.user.name} liked each other!`,
            fromUserId: userId
          })
        ]);
      } else if (action === 'like' || action === 'super_like') {
        // Send like notification to target user
        await NotificationService.createNotification(targetUserId, 'like', {
          title: action === 'super_like' ? 'Super Like!' : 'New Like!',
          message: `${req.user.name} ${action === 'super_like' ? 'super ' : ''}liked you!`,
          fromUserId: userId
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.isMatch ? 'It\'s a match!' : 'Swipe recorded successfully',
        data: {
          isMatch: result.isMatch,
          matchId: result.matchId,
          compatibility: result.compatibility
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply rate limiting and usage tracking based on action
router.post('/swipe',
  (req, res, next) => {
    const { action } = req.body;
    if (action === 'super_like') {
      return superLikeRateLimit(req, res, next);
    } else if (action === 'like') {
      return likeRateLimit(req, res, next);
    }
    next();
  },
  (req, res, next) => {
    const { action } = req.body;
    if (action === 'super_like') {
      return incrementUsage('superLikes')(req, res, next);
    } else if (action === 'like') {
      return incrementUsage('likes')(req, res, next);
    }
    next();
  }
);

// @desc    Undo last swipe (premium feature)
// @route   POST /api/discovery/undo
// @access  Private
router.post('/undo',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check if user has premium subscription
      if (req.user.subscription.plan === 'free') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Undo feature requires premium subscription'
        });
      }

      // Find the most recent swipe by this user
      const lastMatch = await Match.findOne({
        user1Id: userId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
      }).sort({ createdAt: -1 });

      if (!lastMatch) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'No recent swipe found to undo'
        });
      }

      // Delete the match record
      await Match.findByIdAndDelete(lastMatch._id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Last swipe undone successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get user's matches
// @route   GET /api/discovery/matches
// @access  Private
router.get('/matches',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validatePagination,
  async (req, res, next) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user.id;

      // Find all matches for the user
      const matches = await Match.find({
        $or: [
          { user1Id: userId },
          { user2Id: userId }
        ],
        isMatch: true
      })
      .sort({ matchedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('user1Id', 'name')
      .populate('user2Id', 'name');

      // Get match details with last message info
      const matchDetails = await Promise.all(
        matches.map(async (match) => {
          const otherUserId = match.user1Id._id.toString() === userId ? 
            match.user2Id._id : match.user1Id._id;
          
          const otherUserName = match.user1Id._id.toString() === userId ? 
            match.user2Id.name : match.user1Id.name;

          // Get other user's profile
          const otherUserProfile = await Profile.findOne({ userId: otherUserId })
            .select('photos age location bio');

          // Get conversation for last message
          const Conversation = require('../models/Conversation');
          const conversation = await Conversation.findOne({
            participants: { $all: [userId, otherUserId] }
          }).populate('lastMessage');

          return {
            id: match._id,
            user: {
              id: otherUserId,
              name: otherUserName,
              profile: otherUserProfile
            },
            matchedAt: match.matchedAt,
            compatibility: match.compatibility,
            conversation: conversation ? {
              id: conversation._id,
              lastMessage: conversation.lastMessage,
              lastMessageAt: conversation.lastMessageAt
            } : null
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          matches: matchDetails,
          hasMore: matches.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get likes received
// @route   GET /api/discovery/likes
// @access  Private
router.get('/likes',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validatePagination,
  async (req, res, next) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user.id;

      // Find users who liked this user but haven't been swiped back
      const likesReceived = await Match.find({
        user2Id: userId,
        user1Action: { $in: ['like', 'super_like'] },
        user2Action: 'pending'
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('user1Id', 'name');

      // Get profile details for users who liked
      const likesWithProfiles = await Promise.all(
        likesReceived.map(async (like) => {
          const profile = await Profile.findOne({ userId: like.user1Id._id })
            .select('photos age location bio');

          return {
            id: like._id,
            user: {
              id: like.user1Id._id,
              name: like.user1Id.name,
              profile: profile
            },
            action: like.user1Action,
            likedAt: like.createdAt
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          likes: likesWithProfiles,
          hasMore: likesReceived.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
