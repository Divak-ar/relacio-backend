const AuthService = require('../services/authService');
const User = require('../models/User');
const { SOCKET_EVENTS } = require('../constants');

// Import socket handlers
const chatHandler = require('./chat');
const videocallHandler = require('./videocall');
const notificationHandler = require('./notifications');

module.exports = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = AuthService.verifyToken(token);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
    console.log(`User ${socket.userId} connected`);

    // Update user online status
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      // Broadcast online status to friends/matches
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
        userId: socket.userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error updating user online status:', error);
    }

    // Register event handlers
    chatHandler(socket, io);
    videocallHandler(socket, io);
    notificationHandler(socket, io);

    // Handle disconnection
    socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`);
      
      try {
        // Update user offline status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Broadcast offline status
        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
          userId: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error updating user offline status:', error);
      }
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle manual online status updates
    socket.on(SOCKET_EVENTS.ONLINE_STATUS, async (data) => {
      try {
        const { isOnline } = data;
        await User.findByIdAndUpdate(socket.userId, {
          isOnline,
          lastSeen: new Date()
        });

        if (isOnline) {
          socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
            userId: socket.userId,
            timestamp: new Date()
          });
        } else {
          socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
            userId: socket.userId,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    });
  });

  return io;
};
