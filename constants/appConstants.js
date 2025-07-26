// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

// User Related Constants
const USER_CONSTANTS = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_BIO_LENGTH: 500,
  MAX_INTERESTS: 10,
  MAX_PHOTOS: 6,
  TOKEN_EXPIRY: '7d',
  EMAIL_TOKEN_EXPIRY: '1h'
};

// Match Related Constants
const MATCH_CONSTANTS = {
  ACTIONS: {
    LIKE: 'like',
    PASS: 'pass',
    SUPER_LIKE: 'super_like',
    PENDING: 'pending'
  },
  MAX_COMPATIBILITY_SCORE: 100,
  MIN_COMPATIBILITY_SCORE: 0
};

// Message Related Constants
const MESSAGE_CONSTANTS = {
  TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file'
  },
  DEFAULT_DISAPPEAR_TIME: 24, // hours
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_MESSAGE_LENGTH: 1000
};

// Video Call Constants
const VIDEOCALL_CONSTANTS = {
  STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    ENDED: 'ended',
    DECLINED: 'declined'
  },
  MAX_CALL_DURATION: 3600 // 1 hour in seconds
};

// Notification Constants
const NOTIFICATION_CONSTANTS = {
  TYPES: {
    MATCH: 'match',
    MESSAGE: 'message',
    LIKE: 'like',
    VIEW: 'view',
    VIDEO_CALL: 'video_call'
  }
};

// Subscription Constants
const SUBSCRIPTION_CONSTANTS = {
  PLANS: {
    FREE: 'free',
    PREMIUM: 'premium',
    PLATINUM: 'platinum'
  },
  FEATURES: {
    FREE: {
      videoCallsPerDay: 2,
      voiceCallsPerDay: 5,
      likesPerDay: 20,
      superLikesPerDay: 1
    },
    PREMIUM: {
      videoCallsPerDay: 10,
      voiceCallsPerDay: 20,
      likesPerDay: 50,
      superLikesPerDay: 5
    },
    PLATINUM: {
      videoCallsPerDay: -1, // unlimited
      voiceCallsPerDay: -1, // unlimited
      likesPerDay: -1, // unlimited
      superLikesPerDay: 10
    }
  }
};

// File Upload Constants
const UPLOAD_CONSTANTS = {
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  CLOUDINARY_FOLDERS: {
    PROFILES: 'relacio/profiles',
    CHAT: 'relacio/chat',
    TEMP: 'relacio/temp'
  }
};

// Database Constants
const DATABASE_CONSTANTS = {
  CONNECTION_TIMEOUT: 30000,
  MAX_POOL_SIZE: 10,
  RETRY_WRITES: true
};

module.exports = {
  HTTP_STATUS,
  USER_CONSTANTS,
  MATCH_CONSTANTS,
  MESSAGE_CONSTANTS,
  VIDEOCALL_CONSTANTS,
  NOTIFICATION_CONSTANTS,
  SUBSCRIPTION_CONSTANTS,
  UPLOAD_CONSTANTS,
  DATABASE_CONSTANTS
};
