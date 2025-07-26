const Notification = require('../models/Notification');
const { NOTIFICATION_CONSTANTS, EMAIL_CONSTANTS } = require('../constants');

class NotificationService {
  static async sendNotification(userId, notificationData, socketIo = null) {
    try {
      // Create notification in database
      const notification = await this.createNotification(userId, notificationData);

      // Send real-time notification via Socket.io if available
      if (socketIo) {
        socketIo.to(userId.toString()).emit('new_notification', notification);
      }

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  static async createNotification(userId, notificationData) {
    try {
      const notification = new Notification({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        fromUserId: notificationData.fromUserId,
        data: notificationData.data
      });

      await notification.save();
      await notification.populate('fromUserId', 'name email');
      
      return notification;
    } catch (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  static async sendMatchNotification(userId, matchedUserId, socketIo = null) {
    const notificationData = {
      type: NOTIFICATION_CONSTANTS.TYPES.MATCH,
      title: 'New Match! 💕',
      message: 'You have a new match! Start chatting now.',
      fromUserId: matchedUserId,
      data: {
        matchedUserId: matchedUserId,
        action: 'open_chat'
      }
    };

    return this.sendNotification(userId, notificationData, socketIo);
  }

  static async sendMessageNotification(userId, senderId, messageContent, socketIo = null) {
    const notificationData = {
      type: NOTIFICATION_CONSTANTS.TYPES.MESSAGE,
      title: 'New Message',
      message: messageContent.length > 50 ? `${messageContent.substring(0, 50)}...` : messageContent,
      fromUserId: senderId,
      data: {
        senderId: senderId,
        action: 'open_chat'
      }
    };

    return this.sendNotification(userId, notificationData, socketIo);
  }

  static async sendLikeNotification(userId, likerId, socketIo = null) {
    const notificationData = {
      type: NOTIFICATION_CONSTANTS.TYPES.LIKE,
      title: 'Someone likes you! ❤️',
      message: 'Someone swiped right on your profile.',
      fromUserId: likerId,
      data: {
        likerId: likerId,
        action: 'view_profile'
      }
    };

    return this.sendNotification(userId, notificationData, socketIo);
  }

  static async sendProfileViewNotification(userId, viewerId, socketIo = null) {
    const notificationData = {
      type: NOTIFICATION_CONSTANTS.TYPES.VIEW,
      title: 'Profile View 👀',
      message: 'Someone viewed your profile.',
      fromUserId: viewerId,
      data: {
        viewerId: viewerId,
        action: 'view_profile'
      }
    };

    return this.sendNotification(userId, notificationData, socketIo);
  }

  static async sendVideoCallNotification(userId, callerId, socketIo = null) {
    const notificationData = {
      type: NOTIFICATION_CONSTANTS.TYPES.VIDEO_CALL,
      title: 'Incoming Video Call 📹',
      message: 'You have an incoming video call.',
      fromUserId: callerId,
      data: {
        callerId: callerId,
        action: 'answer_call'
      }
    };

    return this.sendNotification(userId, notificationData, socketIo);
  }

  static async sendPushNotification(userId, message) {
    // Placeholder for push notification implementation
    // In production, you would integrate with services like FCM, APNs, etc.
    try {
      console.log(`Push notification to user ${userId}: ${message}`);
      // Implementation would go here
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  static async sendVerificationEmail(email, verificationToken, name) {
    try {
      const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      
      const emailData = {
        email,
        name,
        verificationUrl,
        verificationToken
      };

      return this.sendEmail(null, EMAIL_CONSTANTS.TEMPLATES.VERIFICATION, emailData);
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  static async sendEmail(userId, templateType, data) {
    // Placeholder for email service implementation
    // In production, you would integrate with services like SendGrid, Mailgun, etc.
    try {
      console.log(`Email to user ${userId} with template ${templateType}:`, data);
      
      // Basic email data structure
      const emailData = {
        to: data.email,
        from: EMAIL_CONSTANTS.FROM_EMAIL,
        fromName: EMAIL_CONSTANTS.FROM_NAME,
        template: templateType,
        templateData: data
      };

      // Implementation would go here
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      return notification;
    } catch (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  static async markAllAsRead(userId) {
    try {
      await Notification.markAllAsRead(userId);
      return true;
    } catch (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  static async getUserNotifications(userId, options = {}) {
    try {
      return await Notification.getUserNotifications(userId, options);
    } catch (error) {
      throw new Error(`Failed to get user notifications: ${error.message}`);
    }
  }

  static async getUnreadCount(userId) {
    try {
      return await Notification.countUnread(userId);
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  static async cleanupOldNotifications() {
    try {
      const result = await Notification.cleanupOldNotifications();
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return null;
    }
  }
}

module.exports = NotificationService;
