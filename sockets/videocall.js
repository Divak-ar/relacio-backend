const VideoCall = require('../models/VideoCall');
const DailyService = require('../services/dailyService');
const NotificationService = require('../services/notificationService');
const { SOCKET_EVENTS } = require('../constants');

module.exports = (socket, io) => {

  // Initiate video call
  socket.on(SOCKET_EVENTS.CALL_INITIATE, async (data) => {
    try {
      const { recipientUserId } = data;
      const initiatorId = socket.userId;

      // Check if recipient is online
      const recipientSockets = await io.in(`user_${recipientUserId}`).fetchSockets();
      
      if (recipientSockets.length === 0) {
        socket.emit('call_error', {
          message: 'Recipient is not online',
          code: 'RECIPIENT_OFFLINE'
        });
        return;
      }

      // Check for existing active call
      const activeCall = await VideoCall.findOne({
        participants: { $all: [initiatorId, recipientUserId] },
        status: { $in: ['pending', 'active'] }
      });

      if (activeCall) {
        socket.emit('call_error', {
          message: 'There is already an active call between these users',
          code: 'CALL_EXISTS'
        });
        return;
      }

      // Generate call ID
      const callId = DailyService.generateCallId();

      // Create Daily.co room
      const roomData = await DailyService.createRoom(callId, [initiatorId, recipientUserId]);

      // Create video call record
      const videoCall = new VideoCall({
        callId,
        participants: [initiatorId, recipientUserId],
        initiatorId,
        status: 'pending',
        dailyRoomUrl: roomData.roomUrl,
        startTime: new Date()
      });

      await videoCall.save();

      // Join call room
      socket.join(`call_${videoCall._id}`);

      // Notify recipient
      io.to(`user_${recipientUserId}`).emit(SOCKET_EVENTS.CALL_INITIATE, {
        call: {
          id: videoCall._id,
          callId: videoCall.callId,
          initiator: {
            id: initiatorId,
            name: socket.user.name
          },
          roomUrl: videoCall.dailyRoomUrl,
          timestamp: new Date()
        }
      });

      // Send notification
      await NotificationService.createNotification(recipientUserId, 'video_call', {
        title: 'Incoming Video Call',
        message: `${socket.user.name} is calling you`,
        fromUserId: initiatorId
      });

      // Confirm to initiator
      socket.emit('call_initiated', {
        call: {
          id: videoCall._id,
          callId: videoCall.callId,
          status: 'pending',
          roomUrl: videoCall.dailyRoomUrl
        }
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      socket.emit('call_error', {
        message: 'Failed to initiate call',
        code: 'INITIATION_FAILED'
      });
    }
  });

  // Accept video call
  socket.on(SOCKET_EVENTS.CALL_ACCEPT, async (data) => {
    try {
      const { callId } = data;
      const userId = socket.userId;

      const videoCall = await VideoCall.findById(callId);
      
      if (!videoCall) {
        socket.emit('call_error', {
          message: 'Video call not found',
          code: 'CALL_NOT_FOUND'
        });
        return;
      }

      if (!videoCall.participants.includes(userId)) {
        socket.emit('call_error', {
          message: 'Access denied to this video call',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      if (videoCall.status !== 'pending') {
        socket.emit('call_error', {
          message: `Call is already ${videoCall.status}`,
          code: 'INVALID_STATUS'
        });
        return;
      }

      // Update call status
      videoCall.status = 'active';
      videoCall.startTime = new Date();
      await videoCall.save();

      // Join call room
      socket.join(`call_${videoCall._id}`);

      // Generate room token for user
      const roomToken = await DailyService.generateRoomToken(
        videoCall.callId,
        userId
      );

      // Notify all participants
      io.to(`call_${videoCall._id}`).emit(SOCKET_EVENTS.CALL_ACCEPT, {
        call: {
          id: videoCall._id,
          status: 'active',
          acceptedBy: {
            id: userId,
            name: socket.user.name
          },
          roomUrl: videoCall.dailyRoomUrl,
          roomToken,
          startTime: videoCall.startTime,
          timestamp: new Date()
        }
      });

      // Notify initiator specifically
      const initiatorId = videoCall.participants.find(id => id.toString() !== userId);
      await NotificationService.createNotification(initiatorId, 'video_call', {
        title: 'Call Accepted',
        message: `${socket.user.name} accepted your video call`,
        fromUserId: userId
      });

    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('call_error', {
        message: 'Failed to accept call',
        code: 'ACCEPT_FAILED'
      });
    }
  });

  // Decline video call
  socket.on(SOCKET_EVENTS.CALL_DECLINE, async (data) => {
    try {
      const { callId } = data;
      const userId = socket.userId;

      const videoCall = await VideoCall.findById(callId);
      
      if (!videoCall) {
        socket.emit('call_error', {
          message: 'Video call not found',
          code: 'CALL_NOT_FOUND'
        });
        return;
      }

      if (!videoCall.participants.includes(userId)) {
        socket.emit('call_error', {
          message: 'Access denied to this video call',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      if (videoCall.status !== 'pending') {
        socket.emit('call_error', {
          message: `Call is already ${videoCall.status}`,
          code: 'INVALID_STATUS'
        });
        return;
      }

      // Update call status
      videoCall.status = 'declined';
      videoCall.endTime = new Date();
      await videoCall.save();

      // Clean up Daily.co room
      await DailyService.deleteRoom(videoCall.callId);

      // Notify all participants
      io.to(`call_${videoCall._id}`).emit(SOCKET_EVENTS.CALL_DECLINE, {
        call: {
          id: videoCall._id,
          status: 'declined',
          declinedBy: {
            id: userId,
            name: socket.user.name
          },
          timestamp: new Date()
        }
      });

      // Notify initiator
      const initiatorId = videoCall.participants.find(id => id.toString() !== userId);
      await NotificationService.createNotification(initiatorId, 'video_call', {
        title: 'Call Declined',
        message: `${socket.user.name} declined your video call`,
        fromUserId: userId
      });

    } catch (error) {
      console.error('Error declining call:', error);
      socket.emit('call_error', {
        message: 'Failed to decline call',
        code: 'DECLINE_FAILED'
      });
    }
  });

  // End video call
  socket.on(SOCKET_EVENTS.CALL_END, async (data) => {
    try {
      const { callId } = data;
      const userId = socket.userId;

      const videoCall = await VideoCall.findById(callId);
      
      if (!videoCall) {
        socket.emit('call_error', {
          message: 'Video call not found',
          code: 'CALL_NOT_FOUND'
        });
        return;
      }

      if (!videoCall.participants.includes(userId)) {
        socket.emit('call_error', {
          message: 'Access denied to this video call',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // Calculate duration if call was active
      let duration = 0;
      if (videoCall.status === 'active' && videoCall.startTime) {
        const endTime = new Date();
        duration = Math.floor((endTime - videoCall.startTime) / 1000);
        videoCall.endTime = endTime;
        videoCall.duration = duration;
      }

      // Update call status
      videoCall.status = 'ended';
      await videoCall.save();

      // Clean up Daily.co room
      await DailyService.deleteRoom(videoCall.callId);

      // Notify all participants
      io.to(`call_${videoCall._id}`).emit(SOCKET_EVENTS.CALL_END, {
        call: {
          id: videoCall._id,
          status: 'ended',
          endedBy: {
            id: userId,
            name: socket.user.name
          },
          duration,
          endTime: videoCall.endTime,
          timestamp: new Date()
        }
      });

      // Leave call room
      socket.leave(`call_${videoCall._id}`);

      // Notify other participant
      const otherParticipantId = videoCall.participants.find(id => id.toString() !== userId);
      if (otherParticipantId) {
        await NotificationService.createNotification(otherParticipantId, 'video_call', {
          title: 'Call Ended',
          message: `${socket.user.name} ended the video call`,
          fromUserId: userId
        });
      }

    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit('call_error', {
        message: 'Failed to end call',
        code: 'END_FAILED'
      });
    }
  });

  // Handle call room join
  socket.on('join_call', async (data) => {
    try {
      const { callId } = data;
      const userId = socket.userId;

      const videoCall = await VideoCall.findById(callId);
      
      if (videoCall && videoCall.participants.includes(userId)) {
        socket.join(`call_${videoCall._id}`);
        
        socket.emit('call_joined', {
          callId: videoCall._id,
          roomUrl: videoCall.dailyRoomUrl,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error joining call room:', error);
    }
  });

  // Handle call room leave
  socket.on('leave_call', (data) => {
    try {
      const { callId } = data;
      socket.leave(`call_${callId}`);
      
      socket.emit('call_left', {
        callId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error leaving call room:', error);
    }
  });
};
