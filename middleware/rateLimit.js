const rateLimit = require('express-rate-limit');
const RateLimitService = require('../services/rateLimitService');
const { RATE_LIMIT_CONSTANTS, HTTP_STATUS } = require('../constants');

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: RATE_LIMIT_CONSTANTS.GENERAL.windowMs,
  max: RATE_LIMIT_CONSTANTS.GENERAL.max,
  message: {
    success: false,
    message: RATE_LIMIT_CONSTANTS.GENERAL.message
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiting
const authRateLimit = {
  login: rateLimit({
    windowMs: RATE_LIMIT_CONSTANTS.AUTH.LOGIN.windowMs,
    max: RATE_LIMIT_CONSTANTS.AUTH.LOGIN.max,
    message: {
      success: false,
      message: RATE_LIMIT_CONSTANTS.AUTH.LOGIN.message
    },
    skipSuccessfulRequests: true
  }),
  
  register: rateLimit({
    windowMs: RATE_LIMIT_CONSTANTS.AUTH.REGISTER.windowMs,
    max: RATE_LIMIT_CONSTANTS.AUTH.REGISTER.max,
    message: {
      success: false,
      message: RATE_LIMIT_CONSTANTS.AUTH.REGISTER.message
    }
  })
};

// Upload rate limiting
const uploadRateLimit = rateLimit({
  windowMs: RATE_LIMIT_CONSTANTS.UPLOAD.windowMs,
  max: RATE_LIMIT_CONSTANTS.UPLOAD.max,
  message: {
    success: false,
    message: RATE_LIMIT_CONSTANTS.UPLOAD.message
  }
});

// Profile update rate limiting
const profileUpdateRateLimit = rateLimit({
  windowMs: RATE_LIMIT_CONSTANTS.PROFILE_UPDATE.windowMs,
  max: RATE_LIMIT_CONSTANTS.PROFILE_UPDATE.max,
  message: {
    success: false,
    message: RATE_LIMIT_CONSTANTS.PROFILE_UPDATE.message
  }
});

// Feature-based rate limiting middleware
const videoCallRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canMakeCall = await RateLimitService.checkVideoCallLimit(userId);
    
    if (!canMakeCall) {
      const remaining = await RateLimitService.getRemainingLimit(userId, 'videoCalls');
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Daily video call limit reached',
        data: {
          remaining: remaining,
          resetTime: 'tomorrow'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking video call limit'
    });
  }
};

const voiceCallRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canMakeCall = await RateLimitService.checkVoiceCallLimit(userId);
    
    if (!canMakeCall) {
      const remaining = await RateLimitService.getRemainingLimit(userId, 'voiceCalls');
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Daily voice call limit reached',
        data: {
          remaining: remaining,
          resetTime: 'tomorrow'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking voice call limit'
    });
  }
};

const likeRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canLike = await RateLimitService.checkLikeLimit(userId);
    
    if (!canLike) {
      const remaining = await RateLimitService.getRemainingLimit(userId, 'likes');
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Daily like limit reached',
        data: {
          remaining: remaining,
          resetTime: 'tomorrow'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking like limit'
    });
  }
};

const superLikeRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canSuperLike = await RateLimitService.checkSuperLikeLimit(userId);
    
    if (!canSuperLike) {
      const remaining = await RateLimitService.getRemainingLimit(userId, 'superLikes');
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Daily super like limit reached',
        data: {
          remaining: remaining,
          resetTime: 'tomorrow'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking super like limit'
    });
  }
};

const messageRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const canMessage = await RateLimitService.checkMessageLimit(userId);
    
    if (!canMessage) {
      const remaining = await RateLimitService.getRemainingLimit(userId, 'messages');
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Hourly message limit reached',
        data: {
          remaining: remaining,
          resetTime: 'next hour'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking message limit'
    });
  }
};

// Middleware to increment usage after successful action
const incrementUsage = (actionType) => {
  return async (req, res, next) => {
    // Store the original res.json function
    const originalJson = res.json;
    
    // Override res.json to intercept successful responses
    res.json = function(data) {
      // Check if the response indicates success
      if (data && data.success !== false && res.statusCode < 400) {
        // Increment usage asynchronously
        RateLimitService.incrementUsage(req.user.id, actionType)
          .catch(error => console.error(`Error incrementing ${actionType} usage:`, error));
      }
      
      // Call the original res.json function
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  profileUpdateRateLimit,
  videoCallRateLimit,
  voiceCallRateLimit,
  likeRateLimit,
  superLikeRateLimit,
  messageRateLimit,
  incrementUsage
};
