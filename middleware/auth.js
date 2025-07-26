const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuthService = require('../services/authService');
const { HTTP_STATUS } = require('../constants');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isEmailVerified) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Please verify your email address'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = AuthService.verifyToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isEmailVerified) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Email verification required'
    });
  }
  next();
};

const requireProfileCompletion = (req, res, next) => {
  if (!req.user.hasCompletedProfile) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Profile completion required'
    });
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireEmailVerification,
  requireProfileCompletion
};
