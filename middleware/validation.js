const { body, param, query, validationResult } = require('express-validator');
const { HTTP_STATUS, USER_CONSTANTS, MESSAGE_CONSTANTS } = require('../constants');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: USER_CONSTANTS.MIN_PASSWORD_LENGTH })
    .withMessage(`Password must be at least ${USER_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  handleValidationErrors
];

// Login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Profile setup validation
const validateProfileSetup = [
  body('age')
    .isInt({ min: 18, max: 100 })
    .withMessage('Age must be between 18 and 100'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Occupation cannot exceed 100 characters'),
  body('education')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Education cannot exceed 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: USER_CONSTANTS.MAX_BIO_LENGTH })
    .withMessage(`Bio cannot exceed ${USER_CONSTANTS.MAX_BIO_LENGTH} characters`),
  body('interests')
    .optional()
    .isArray({ max: USER_CONSTANTS.MAX_INTERESTS })
    .withMessage(`Cannot have more than ${USER_CONSTANTS.MAX_INTERESTS} interests`),
  body('interests.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each interest must be between 1 and 50 characters'),
  body('preferences.ageRange.min')
    .optional()
    .isInt({ min: 18, max: 100 })
    .withMessage('Minimum age preference must be between 18 and 100'),
  body('preferences.ageRange.max')
    .optional()
    .isInt({ min: 18, max: 100 })
    .withMessage('Maximum age preference must be between 18 and 100'),
  body('preferences.maxDistance')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Maximum distance must be between 1 and 500 miles'),
  body('preferences.lookingFor')
    .optional()
    .isIn(['casual', 'serious', 'friendship', 'anything'])
    .withMessage('Invalid relationship preference'),
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('age')
    .optional()
    .isInt({ min: 18, max: 100 })
    .withMessage('Age must be between 18 and 100'),
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Occupation cannot exceed 100 characters'),
  body('education')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Education cannot exceed 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: USER_CONSTANTS.MAX_BIO_LENGTH })
    .withMessage(`Bio cannot exceed ${USER_CONSTANTS.MAX_BIO_LENGTH} characters`),
  body('interests')
    .optional()
    .isArray({ max: USER_CONSTANTS.MAX_INTERESTS })
    .withMessage(`Cannot have more than ${USER_CONSTANTS.MAX_INTERESTS} interests`),
  handleValidationErrors
];

// Message validation
const validateMessage = [
  body('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: MESSAGE_CONSTANTS.MAX_MESSAGE_LENGTH })
    .withMessage(`Message must be between 1 and ${MESSAGE_CONSTANTS.MAX_MESSAGE_LENGTH} characters`),
  body('type')
    .optional()
    .isIn(Object.values(MESSAGE_CONSTANTS.TYPES))
    .withMessage('Invalid message type'),
  body('isDisappearing')
    .optional()
    .isBoolean()
    .withMessage('isDisappearing must be a boolean'),
  body('disappearTime')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Disappear time must be between 1 and 168 hours'),
  handleValidationErrors
];

// Swipe validation
const validateSwipe = [
  body('targetUserId')
    .isMongoId()
    .withMessage('Invalid target user ID'),
  body('action')
    .isIn(['like', 'pass', 'super_like'])
    .withMessage('Invalid swipe action'),
  handleValidationErrors
];

// Video call validation
const validateVideoCall = [
  body('recipientUserId')
    .isMongoId()
    .withMessage('Invalid recipient user ID'),
  handleValidationErrors
];

// Notification validation
const validateNotification = [
  body('type')
    .isIn(['match', 'message', 'like', 'view', 'video_call'])
    .withMessage('Invalid notification type'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  handleValidationErrors
];

// Email verification validation
const validateEmailVerification = [
  body('token')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid verification token'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  handleValidationErrors
];

// MongoDB ObjectId validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`),
  handleValidationErrors
];

// Custom validation middleware
const validateRequest = (validations) => {
  return [
    ...validations,
    handleValidationErrors
  ];
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfileSetup,
  validateProfileUpdate,
  validateMessage,
  validateSwipe,
  validateVideoCall,
  validateNotification,
  validateEmailVerification,
  validatePagination,
  validateObjectId,
  validateRequest,
  handleValidationErrors
};
