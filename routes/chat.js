const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Match = require('../models/Match');
const CloudinaryService = require('../services/cloudinaryService');
const NotificationService = require('../services/notificationService');
const {
  authenticate,
  requireEmailVerification,
  requireProfileCompletion
} = require('../middleware/auth');
const {
  messageRateLimit,
  uploadRateLimit,
  incrementUsage
} = require('../middleware/rateLimit');
const { uploadChatFile } = require('../middleware/upload');
const {
  validateMessage,
  validatePagination,
  validateObjectId
} = require('../middleware/validation');
const { HTTP_STATUS, MESSAGE_CONSTANTS } = require('../constants');

const router = express.Router();

// @desc    Get user's conversations
// @route   GET /api/chat/conversations
// @access  Private
router.get('/conversations',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validatePagination,
  async (req, res, next) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user.id;

      const conversations = await Conversation.find({
        participants: userId,
        isActive: true
      })
      .populate('participants', 'name')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

      // Get conversation details with unread count
      const conversationDetails = await Promise.all(
        conversations.map(async (conversation) => {
          const otherParticipant = conversation.participants.find(
            p => p._id.toString() !== userId
          );

          // Get unread message count
          const unreadCount = await Message.countDocuments({
            conversationId: conversation._id,
            senderId: { $ne: userId },
            isRead: false
          });

          // Get other participant's profile
          const Profile = require('../models/Profile');
          const otherProfile = await Profile.findOne({ 
            userId: otherParticipant._id 
          }).select('photos');

          return {
            id: conversation._id,
            participant: {
              id: otherParticipant._id,
              name: otherParticipant.name,
              photo: otherProfile?.photos?.find(p => p.isMain)?.url || null
            },
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
            unreadCount,
            isActive: conversation.isActive
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          conversations: conversationDetails,
          hasMore: conversations.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversation/:conversationId/messages
// @access  Private
router.get('/conversation/:conversationId/messages',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('conversationId'),
  validatePagination,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { limit = 50, offset = 0, before } = req.query;
      const userId = req.user.id;

      // Verify user is participant in conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      if (!conversation.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      // Build query for messages
      let messageQuery = {
        conversationId,
        expiresAt: { $or: [{ $exists: false }, { $gt: new Date() }] }
      };

      // Add 'before' filter for pagination
      if (before) {
        messageQuery.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(messageQuery)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('senderId', 'name');

      // Mark messages as read (for messages sent to current user)
      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: userId },
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      // Reverse to show chronological order
      messages.reverse();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          messages,
          hasMore: messages.length === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Send a new message
// @route   POST /api/chat/send-message
// @access  Private
router.post('/send-message',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  messageRateLimit,
  incrementUsage('messages'),
  validateMessage,
  async (req, res, next) => {
    try {
      const { conversationId, content, type = 'text', isDisappearing = false, disappearTime = 24 } = req.body;
      const userId = req.user.id;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      if (!conversation.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      // Create message
      const messageData = {
        conversationId,
        senderId: userId,
        content,
        type,
        isDisappearing
      };

      // Set expiry for disappearing messages
      if (isDisappearing) {
        messageData.expiresAt = new Date(Date.now() + disappearTime * 60 * 60 * 1000);
        messageData.disappearTime = disappearTime;
      }

      const message = new Message(messageData);
      await message.save();

      // Update conversation's last message
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Populate sender info
      await message.populate('senderId', 'name');

      // Send notification to other participant
      const otherParticipantId = conversation.participants.find(
        id => id.toString() !== userId
      );

      await NotificationService.createNotification(otherParticipantId, 'message', {
        title: 'New Message',
        message: `${req.user.name} sent you a message`,
        fromUserId: userId
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          message
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Upload media for chat
// @route   POST /api/chat/upload-media
// @access  Private
router.post('/upload-media',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  uploadRateLimit,
  uploadChatFile('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No file provided'
        });
      }

      // Upload to Cloudinary
      const uploadResult = await CloudinaryService.uploadImage(
        req.file.buffer,
        'chat',
        `${req.user.id}_${Date.now()}`
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          file: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            originalName: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Mark conversation messages as read
// @route   PUT /api/chat/mark-read/:conversationId
// @access  Private
router.put('/mark-read/:conversationId',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('conversationId'),
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      if (!conversation.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      // Mark all unread messages in this conversation as read
      const result = await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: userId },
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Messages marked as read',
        data: {
          markedCount: result.modifiedCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get or create conversation between matched users
// @route   POST /api/chat/conversation
// @access  Private
router.post('/conversation',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  async (req, res, next) => {
    try {
      const { otherUserId } = req.body;
      const userId = req.user.id;

      if (!otherUserId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Other user ID is required'
        });
      }

      // Verify users are matched
      const match = await Match.findOne({
        $or: [
          { user1Id: userId, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: userId }
        ],
        isMatch: true
      });

      if (!match) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Users are not matched. Cannot create conversation.'
        });
      }

      // Check if conversation already exists
      let conversation = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] }
      });

      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          participants: [userId, otherUserId],
          isActive: true
        });
        await conversation.save();
      }

      // Populate participants
      await conversation.populate('participants', 'name');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          conversation
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete conversation
// @route   DELETE /api/chat/conversation/:conversationId
// @access  Private
router.delete('/conversation/:conversationId',
  authenticate,
  requireEmailVerification,
  requireProfileCompletion,
  validateObjectId('conversationId'),
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      if (!conversation.participants.includes(userId)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      // Mark conversation as inactive instead of deleting
      conversation.isActive = false;
      await conversation.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Conversation deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
