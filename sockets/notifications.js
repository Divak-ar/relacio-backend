const Notification = require('../models/Notification');
const { SOCKET_EVENTS } = require('../constants');

module.exports = (socket, io) => {

  // Send real-time notification to user
  socket.on(SOCKET_EVENTS.NEW_NOTIFICATION, async (data) => {
    try {
      const { recipientId, type, title, message, fromUserId } = data;
      
      // Only allow sending notifications if user is admin or sending to themselves
      if (socket.user.role !== 'admin' && recipientId !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized to send notifications to other users' });
        return;
      }

      // Create notification record
      const notification = new Notification({
        userId: recipientId,
        type,
        title,
        message,
        fromUserId: fromUserId || socket.userId
      });

      await notification.save();
      await notification.populate('fromUserId', 'name');

      // Send to recipient if online
      io.to(`user_${recipientId}`).emit(SOCKET_EVENTS.NEW_NOTIFICATION, {
        notification: {
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
        },
        timestamp: new Date()
      });

      // Confirm to sender
      socket.emit('notification_sent', {
        notificationId: notification._id,
        recipientId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      socket.emit('error', { message: 'Failed to send notification' });
    }
  });

  // Mark notification as read
  socket.on(SOCKET_EVENTS.NOTIFICATION_READ, async (data) => {
    try {
      const { notificationId } = data;
      const userId = socket.userId;

      const notification = await Notification.findOne({
        _id: notificationId,
        userId
      });

      if (!notification) {
        socket.emit('error', { message: 'Notification not found' });
        return;
      }

      if (notification.isRead) {
        socket.emit('error', { message: 'Notification is already read' });
        return;
      }

      notification.isRead = true;
      await notification.save();

      // Confirm to user
      socket.emit('notification_read_confirmed', {
        notificationId,
        readAt: new Date(),
        timestamp: new Date()
      });

      // Update unread count
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false
      });

      socket.emit('unread_count_updated', {
        unreadCount,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  socket.on('mark_all_notifications_read', async () => {
    try {
      const userId = socket.userId;

      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true }
      );

      socket.emit('all_notifications_read', {
        markedCount: result.modifiedCount,
        timestamp: new Date()
      });

      socket.emit('unread_count_updated', {
        unreadCount: 0,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      socket.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  });

  // Get unread notification count
  socket.on('get_unread_count', async () => {
    try {
      const userId = socket.userId;
      
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false
      });

      socket.emit('unread_count', {
        unreadCount,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error getting unread count:', error);
      socket.emit('error', { message: 'Failed to get unread count' });
    }
  });

  // Subscribe to notification types
  socket.on('subscribe_notifications', (data) => {
    try {
      const { types } = data; // Array of notification types to subscribe to
      
      if (Array.isArray(types)) {
        types.forEach(type => {
          socket.join(`notifications_${type}`);
        });
        
        socket.emit('subscribed_to_notifications', {
          types,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  });

  // Unsubscribe from notification types
  socket.on('unsubscribe_notifications', (data) => {
    try {
      const { types } = data;
      
      if (Array.isArray(types)) {
        types.forEach(type => {
          socket.leave(`notifications_${type}`);
        });
        
        socket.emit('unsubscribed_from_notifications', {
          types,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
    }
  });

  // Broadcast notification to all users of a specific type (admin only)
  socket.on('broadcast_notification', async (data) => {
    try {
      if (socket.user.role !== 'admin') {
        socket.emit('error', { message: 'Admin access required' });
        return;
      }

      const { type, title, message, targetUsers } = data;
      
      if (targetUsers && Array.isArray(targetUsers)) {
        // Send to specific users
        for (const userId of targetUsers) {
          const notification = new Notification({
            userId,
            type,
            title,
            message,
            fromUserId: socket.userId
          });
          
          await notification.save();
          
          io.to(`user_${userId}`).emit(SOCKET_EVENTS.NEW_NOTIFICATION, {
            notification: {
              id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              fromUser: {
                id: socket.userId,
                name: socket.user.name
              },
              isRead: notification.isRead,
              createdAt: notification.createdAt
            },
            timestamp: new Date()
          });
        }
      } else {
        // Broadcast to all users subscribed to this notification type
        io.to(`notifications_${type}`).emit(SOCKET_EVENTS.NEW_NOTIFICATION, {
          notification: {
            type,
            title,
            message,
            fromUser: {
              id: socket.userId,
              name: socket.user.name
            },
            isRead: false,
            createdAt: new Date()
          },
          isBroadcast: true,
          timestamp: new Date()
        });
      }

      socket.emit('broadcast_sent', {
        type,
        targetCount: targetUsers ? targetUsers.length : 'all',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error broadcasting notification:', error);
      socket.emit('error', { message: 'Failed to broadcast notification' });
    }
  });
};
