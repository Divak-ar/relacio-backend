const express = require('express');
const VideoCall = require('../models/VideoCall');
const Match = require('../models/Match');
const User = require('../models/User');
const DailyService = require('../services/dailyService');
const NotificationService = require('../services/notificationService');
const {
  authenticate,
  requireEmailVerification,
  requireProfileCompletion
} = require('../middleware/auth');
const {
  videoCallRateLimit,
  incrementUsage
} = require('../middleware/rateLimit');
const {
  validateVideoCall,
  validateObjectId
} = require('../middleware/validation');
const { HTTP_STATUS, VIDEOCALL_CONSTANTS } = require('../constants');

const router = express.Router();

// @desc    Initiate video call
// @route   POST /api/videocall/initiate
// @access  Private
router.post('/initiate',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  videoCallRateLimit,
  incrementUsage('videoCalls'),
  validateVideoCall,
  async (req, res, next) => {
    try {
      const { recipientUserId } = req.body;
      const initiatorId = req.user.id;

      // Check if recipient exists
      const recipient = await User.findById(recipientUserId);
      if (!recipient) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Recipient not found'
        });
      }

      // Verify users are matched
      const match = await Match.findOne({
        $or: [
          { user1Id: initiatorId, user2Id: recipientUserId },
          { user1Id: recipientUserId, user2Id: initiatorId }
        ],
        isMatch: true
      });

      if (!match) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Users are not matched. Cannot initiate video call.'
        });
      }

      // Check if there's already an active call between these users
      const activeCall = await VideoCall.findOne({
        participants: { $all: [initiatorId, recipientUserId] },
        status: { $in: ['pending', 'active'] }
      });

      if (activeCall) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'There is already an active call between these users'
        });
      }

      // Generate unique call ID
      const callId = `call_${initiatorId}_${recipientUserId}_${Date.now()}`;

      // Create Daily.co room
      const roomData = await DailyService.createRoom(callId, [initiatorId, recipientUserId]);

      // Create video call record
      const videoCall = new VideoCall({
        callId,
        participants: [initiatorId, recipientUserId],
        initiatorId,
        status: 'pending',
        dailyRoomUrl: roomData.url,
        startTime: new Date()
      });

      await videoCall.save();

      // Send call notification to recipient
      await NotificationService.createNotification(recipientUserId, 'video_call', {
        title: 'Incoming Video Call',
        message: `${req.user.name} is calling you`,
        fromUserId: initiatorId
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Video call initiated successfully',
        data: {
          call: {
            id: videoCall._id,
            callId: videoCall.callId,
            roomUrl: videoCall.dailyRoomUrl,
            status: videoCall.status,
            participants: videoCall.participants,
            initiatorId: videoCall.initiatorId
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Accept video call
// @route   PUT /api/videocall/:callId/accept
// @access  Private
router.put('/:callId/accept',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('callId'),
  async (req, res, next) => {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find the call
      const videoCall = await VideoCall.findById(callId);
      if (!videoCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Video call not found'
        });
      }

      // Verify user is a participant
      if (!videoCall.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this video call'
        });
      }

      // Check if call is still pending
      if (videoCall.status !== 'pending') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Call is already ${videoCall.status}`
        });
      }

      // Update call status to active
      videoCall.status = 'active';
      videoCall.startTime = new Date();
      await videoCall.save();

      // Generate room token for the user
      const roomToken = await DailyService.generateRoomToken(
        videoCall.callId,
        userId
      );

      // Notify the initiator that call was accepted
      const otherParticipantId = videoCall.participants.find(
        id => id.toString() !== userId
      );

      await NotificationService.createNotification(otherParticipantId, 'video_call', {
        title: 'Call Accepted',
        message: `${req.user.name} accepted your video call`,
        fromUserId: userId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Video call accepted successfully',
        data: {
          call: {
            id: videoCall._id,
            callId: videoCall.callId,
            roomUrl: videoCall.dailyRoomUrl,
            roomToken,
            status: videoCall.status,
            startTime: videoCall.startTime
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Decline video call
// @route   PUT /api/videocall/:callId/decline
// @access  Private
router.put('/:callId/decline',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('callId'),
  async (req, res, next) => {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find the call
      const videoCall = await VideoCall.findById(callId);
      if (!videoCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Video call not found'
        });
      }

      // Verify user is a participant
      if (!videoCall.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this video call'
        });
      }

      // Check if call is still pending
      if (videoCall.status !== 'pending') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Call is already ${videoCall.status}`
        });
      }

      // Update call status to declined
      videoCall.status = 'declined';
      videoCall.endTime = new Date();
      await videoCall.save();

      // Clean up Daily.co room
      await DailyService.deleteRoom(videoCall.callId);

      // Notify the initiator that call was declined
      const otherParticipantId = videoCall.participants.find(
        id => id.toString() !== userId
      );

      await NotificationService.createNotification(otherParticipantId, 'video_call', {
        title: 'Call Declined',
        message: `${req.user.name} declined your video call`,
        fromUserId: userId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Video call declined successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    End video call
// @route   PUT /api/videocall/:callId/end
// @access  Private
router.put('/:callId/end',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('callId'),
  async (req, res, next) => {
    try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find the call
      const videoCall = await VideoCall.findById(callId);
      if (!videoCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Video call not found'
        });
      }

      // Verify user is a participant
      if (!videoCall.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this video call'
        });
      }

      // Check if call is active
      if (videoCall.status !== 'active') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Call is not active'
        });
      }

      // Calculate call duration
      const endTime = new Date();
      const duration = Math.floor((endTime - videoCall.startTime) / 1000); // in seconds

      // Update call status
      videoCall.status = 'ended';
      videoCall.endTime = endTime;
      videoCall.duration = duration;
      await videoCall.save();

      // Clean up Daily.co room
      await DailyService.deleteRoom(videoCall.callId);

      // Notify the other participant that call was ended
      const otherParticipantId = videoCall.participants.find(
        id => id.toString() !== userId
      );

      await NotificationService.createNotification(otherParticipantId, 'video_call', {
        title: 'Call Ended',
        message: `${req.user.name} ended the video call`,
        fromUserId: userId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Video call ended successfully',
        data: {
          call: {
            id: videoCall._id,
            duration: duration,
            endTime: endTime
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get call history
// @route   GET /api/videocall/history
// @access  Private
router.get('/history',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  async (req, res, next) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user.id;

      const calls = await VideoCall.find({
        participants: userId,
        status: { $in: ['ended', 'declined'] }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('participants', 'name')
      .populate('initiatorId', 'name');

      // Format call history
      const callHistory = calls.map(call => {
        const otherParticipant = call.participants.find(
          p => p._id.toString() !== userId
        );

        return {
          id: call._id,
          otherUser: {
            id: otherParticipant._id,
            name: otherParticipant.name
          },
          initiator: call.initiatorId.name,
          isInitiatedByMe: call.initiatorId._id.toString() === userId,
          status: call.status,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime,
          createdAt: call.createdAt
        };
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          calls: callHistory,
          hasMore: calls.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get active call status
// @route   GET /api/videocall/active
// @access  Private
router.get('/active',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const activeCall = await VideoCall.findOne({
        participants: userId,
        status: { $in: ['pending', 'active'] }
      }).populate('participants', 'name');

      if (!activeCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'No active call found'
        });
      }

      const otherParticipant = activeCall.participants.find(
        p => p._id.toString() !== userId
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          call: {
            id: activeCall._id,
            callId: activeCall.callId,
            roomUrl: activeCall.dailyRoomUrl,
            status: activeCall.status,
            otherUser: {
              id: otherParticipant._id,
              name: otherParticipant.name
            },
            isInitiatedByMe: activeCall.initiatorId.toString() === userId,
            startTime: activeCall.startTime
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
