const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const AuthService = require('../services/authService');
const NotificationService = require('../services/notificationService');
const { authenticate } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');
const {
  validateRegistration,
  validateLogin,
  validateEmailVerification
} = require('../middleware/validation');
const { HTTP_STATUS } = require('../constants');

const router = express.Router();

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', authRateLimit.register, validateRegistration, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate email verification token
    const emailVerificationToken = AuthService.generateEmailVerificationToken();

    // Create user
    const user = new User({
      email,
      password,
      name,
      emailVerificationToken
    });

    await user.save();

    // Generate JWT token
    const token = AuthService.generateToken(user);

    // Send verification email (don't wait for it)
    NotificationService.sendVerificationEmail(user.email, emailVerificationToken, name)
      .catch(error => console.error('Failed to send verification email:', error));

    // Return user data without password
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      hasCompletedProfile: user.hasCompletedProfile,
      isEmailVerified: user.isEmailVerified,
      subscription: user.subscription,
      createdAt: user.createdAt
    };

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    User login
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authRateLimit.login, validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last seen and online status
    await user.setOnlineStatus(true);

    // Generate JWT token
    const token = AuthService.generateToken(user);

    // Return user data without password
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      hasCompletedProfile: user.hasCompletedProfile,
      isEmailVerified: user.isEmailVerified,
      subscription: user.subscription,
      lastSeen: user.lastSeen,
      isOnline: user.isOnline
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    User logout
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Update user online status
    await req.user.setOnlineStatus(false);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
router.post('/verify-email', validateEmailVerification, async (req, res, next) => {
  try {
    const { token } = req.body;

    // Find user with verification token
    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
router.post('/resend-verification', authenticate, async (req, res, next) => {
  try {
    if (req.user.isEmailVerified) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const emailVerificationToken = AuthService.generateEmailVerificationToken();
    req.user.emailVerificationToken = emailVerificationToken;
    await req.user.save();

    // Send verification email
    await NotificationService.sendVerificationEmail(
      req.user.email,
      emailVerificationToken,
      req.user.name
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('profile');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          hasCompletedProfile: user.hasCompletedProfile,
          isEmailVerified: user.isEmailVerified,
          subscription: user.subscription,
          lastSeen: user.lastSeen,
          isOnline: user.isOnline,
          role: user.role,
          profile: user.profile
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
