const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { SOCKET_EVENTS } = require('../constants');

module.exports = (socket, io) => {
  
  // Join conversation room
  socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, async (data) => {
    try {
      const { conversationId } = data;
      
      // Verify user is participant in the conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join the conversation room
      socket.join(`conversation_${conversationId}`);
      
      socket.emit('conversation_joined', {
        conversationId,
        timestamp: new Date()
      });

      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // Leave conversation room
  socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (data) => {
    try {
      const { conversationId } = data;
      socket.leave(`conversation_${conversationId}`);
      
      socket.emit('conversation_left', {
        conversationId,
        timestamp: new Date()
      });

      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    } catch (error) {
      console.error('Error leaving conversation:', error);
    }
  });

  // Send message (real-time)
  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
    try {
      const { conversationId, content, type = 'text', isDisappearing = false, disappearTime = 24 } = data;
      
      // Verify conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Create message
      const messageData = {
        conversationId,
        senderId: socket.userId,
        content,
        type,
        isDisappearing
      };

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

      // Emit to all participants in the conversation
      io.to(`conversation_${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RECEIVED, {
        message: {
          id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId._id,
          senderName: message.senderId.name,
          content: message.content,
          type: message.type,
          isDisappearing: message.isDisappearing,
          disappearTime: message.disappearTime,
          isRead: message.isRead,
          createdAt: message.createdAt,
          expiresAt: message.expiresAt
        },
        timestamp: new Date()
      });

      // Send notification to offline participants
      const otherParticipantId = conversation.participants.find(
        id => id.toString() !== socket.userId
      );

      if (otherParticipantId) {
        // Check if the other participant is online
        const otherParticipantSockets = await io.in(`user_${otherParticipantId}`).fetchSockets();
        
        if (otherParticipantSockets.length === 0) {
          // User is offline, send push notification
          const NotificationService = require('../services/notificationService');
          await NotificationService.createNotification(otherParticipantId, 'message', {
            title: 'New Message',
            message: `${socket.user.name} sent you a message`,
            fromUserId: socket.userId
          });
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on(SOCKET_EVENTS.TYPING_START, async (data) => {
    try {
      const { conversationId } = data;
      
      // Verify conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        return;
      }

      // Broadcast typing indicator to other participants
      socket.to(`conversation_${conversationId}`).emit(SOCKET_EVENTS.TYPING_START, {
        userId: socket.userId,
        userName: socket.user.name,
        conversationId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling typing start:', error);
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, async (data) => {
    try {
      const { conversationId } = data;
      
      // Verify conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        return;
      }

      // Broadcast typing stop to other participants
      socket.to(`conversation_${conversationId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
        userId: socket.userId,
        userName: socket.user.name,
        conversationId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling typing stop:', error);
    }
  });

  // Message read receipts
  socket.on(SOCKET_EVENTS.MESSAGE_READ, async (data) => {
    try {
      const { messageId, conversationId } = data;
      
      // Verify conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        return;
      }

      // Update message read status
      const message = await Message.findById(messageId);
      if (message && message.senderId.toString() !== socket.userId) {
        message.isRead = true;
        message.readAt = new Date();
        await message.save();

        // Notify sender that message was read
        socket.to(`conversation_${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageId,
          readBy: socket.userId,
          readAt: message.readAt,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error handling message read:', error);
    }
  });

  // Bulk mark messages as read
  socket.on('mark_conversation_read', async (data) => {
    try {
      const { conversationId } = data;
      
      // Verify conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.userId)) {
        return;
      }

      // Mark all unread messages as read
      const result = await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: socket.userId },
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      // Notify other participants
      socket.to(`conversation_${conversationId}`).emit('conversation_read', {
        readBy: socket.userId,
        markedCount: result.modifiedCount,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  });
};
