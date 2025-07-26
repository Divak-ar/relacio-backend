// Rate Limiting Constants
const RATE_LIMIT_CONSTANTS = {
  // General API Rate Limits
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per window
    message: 'Too many requests, please try again later'
  },

  // Authentication Rate Limits
  AUTH: {
    LOGIN: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per 15 minutes
      message: 'Too many login attempts, please try again later'
    },
    REGISTER: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registration attempts per hour
      message: 'Too many registration attempts, please try again later'
    }
  },

  // Feature-based Rate Limits (per subscription plan)
  FEATURES: {
    VIDEO_CALLS: {
      FREE: { max: 2, window: 24 * 60 * 60 * 1000 }, // 2 per day
      PREMIUM: { max: 10, window: 24 * 60 * 60 * 1000 }, // 10 per day
      PLATINUM: { max: -1, window: 24 * 60 * 60 * 1000 } // unlimited
    },
    VOICE_CALLS: {
      FREE: { max: 5, window: 24 * 60 * 60 * 1000 },
      PREMIUM: { max: 20, window: 24 * 60 * 60 * 1000 },
      PLATINUM: { max: -1, window: 24 * 60 * 60 * 1000 }
    },
    LIKES: {
      FREE: { max: 20, window: 24 * 60 * 60 * 1000 },
      PREMIUM: { max: 50, window: 24 * 60 * 60 * 1000 },
      PLATINUM: { max: -1, window: 24 * 60 * 60 * 1000 }
    },
    SUPER_LIKES: {
      FREE: { max: 1, window: 24 * 60 * 60 * 1000 },
      PREMIUM: { max: 5, window: 24 * 60 * 60 * 1000 },
      PLATINUM: { max: 10, window: 24 * 60 * 60 * 1000 }
    },
    MESSAGES: {
      FREE: { max: 100, window: 60 * 60 * 1000 }, // 100 per hour
      PREMIUM: { max: 200, window: 60 * 60 * 1000 }, // 200 per hour
      PLATINUM: { max: 500, window: 60 * 60 * 1000 } // 500 per hour
    }
  },

  // File Upload Rate Limits
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later'
  },

  // Profile Update Rate Limits
  PROFILE_UPDATE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 profile updates per hour
    message: 'Too many profile updates, please try again later'
  }
};

// Redis Keys for Rate Limiting
const REDIS_KEYS = {
  RATE_LIMIT: {
    VIDEO_CALLS: (userId) => `rate_limit:video_calls:${userId}`,
    VOICE_CALLS: (userId) => `rate_limit:voice_calls:${userId}`,
    LIKES: (userId) => `rate_limit:likes:${userId}`,
    SUPER_LIKES: (userId) => `rate_limit:super_likes:${userId}`,
    MESSAGES: (userId) => `rate_limit:messages:${userId}`,
    GENERAL: (ip) => `rate_limit:general:${ip}`,
    AUTH: (ip) => `rate_limit:auth:${ip}`,
    UPLOAD: (userId) => `rate_limit:upload:${userId}`
  },
  USER_SESSION: (userId) => `user_session:${userId}`,
  ONLINE_USERS: 'online_users',
  BLACKLISTED_TOKENS: (tokenId) => `blacklisted_token:${tokenId}`
};

module.exports = {
  RATE_LIMIT_CONSTANTS,
  REDIS_KEYS
};
