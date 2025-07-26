// Cloudinary Configuration Constants
const CLOUDINARY_CONSTANTS = {
  UPLOAD_PRESETS: {
    PROFILE_PHOTOS: 'relacio_profile_photos',
    CHAT_MEDIA: 'relacio_chat_media'
  },
  
  FOLDERS: {
    PROFILES: 'relacio/profiles',
    CHAT: 'relacio/chat',
    TEMP: 'relacio/temp'
  },

  TRANSFORMATIONS: {
    PROFILE_THUMBNAIL: {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    },
    PROFILE_MEDIUM: {
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    },
    PROFILE_LARGE: {
      width: 800,
      height: 800,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    },
    CHAT_IMAGE: {
      width: 600,
      quality: 'auto',
      fetch_format: 'auto'
    }
  }
};

// Daily.co API Constants
const DAILY_CONSTANTS = {
  API_BASE_URL: 'https://api.daily.co/v1',
  ROOM_CONFIG: {
    privacy: 'private',
    enable_screenshare: true,
    enable_chat: false,
    enable_knocking: true,
    start_video_off: false,
    start_audio_off: false,
    max_participants: 2,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2) // 2 hours from now
  },
  TOKEN_CONFIG: {
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // 2 hours from now
    enable_screenshare: true,
    start_video_off: false,
    start_audio_off: false
  }
};

// Email Service Constants
const EMAIL_CONSTANTS = {
  TEMPLATES: {
    VERIFICATION: 'email_verification',
    WELCOME: 'welcome',
    MATCH_NOTIFICATION: 'match_notification',
    PASSWORD_RESET: 'password_reset',
    REENGAGEMENT: 'reengagement'
  },
  FROM_EMAIL: 'noreply@relacio.com',
  FROM_NAME: 'Relacio Team'
};

// Socket.io Event Constants
const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // Chat Events
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  SEND_MESSAGE: 'send_message',
  MESSAGE_RECEIVED: 'message_received',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MESSAGE_READ: 'message_read',
  
  // Video Call Events
  CALL_INITIATE: 'call_initiate',
  CALL_ACCEPT: 'call_accept',
  CALL_DECLINE: 'call_decline',
  CALL_END: 'call_end',
  
  // Notification Events
  NEW_NOTIFICATION: 'new_notification',
  NOTIFICATION_READ: 'notification_read',
  
  // User Status Events
  ONLINE_STATUS: 'online_status',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline'
};

module.exports = {
  CLOUDINARY_CONSTANTS,
  DAILY_CONSTANTS,
  EMAIL_CONSTANTS,
  SOCKET_EVENTS
};
