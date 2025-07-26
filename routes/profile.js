const express = require('express');
const Profile = require('../models/Profile');
const User = require('../models/User');
const CloudinaryService = require('../services/cloudinaryService');
const { 
  authenticate, 
  requireEmailVerification 
} = require('../middleware/auth');
const { 
  uploadSingle, 
  uploadMultiple, 
  validateImageUpload 
} = require('../middleware/upload');
const { profileUpdateRateLimit, uploadRateLimit } = require('../middleware/rateLimit');
const {
  validateProfileSetup,
  validateProfileUpdate,
  validateObjectId
} = require('../middleware/validation');
const { HTTP_STATUS, USER_CONSTANTS } = require('../constants');

const router = express.Router();

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
router.get('/me', authenticate, requireEmailVerification, async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
      // Return empty profile structure if not found
      profile = {
        userId: req.user.id,
        photos: [],
        interests: [],
        preferences: {
          ageRange: { min: 18, max: 50 },
          maxDistance: 25,
          lookingFor: 'anything'
        },
        profileScore: 0,
        profileViews: 0,
        likesReceived: 0
      };
    }

    // Calculate profile completion score
    const profileScore = calculateProfileScore(profile);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        profile: {
          ...profile._doc || profile,
          profileScore
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Complete profile setup after registration
// @route   PUT /api/profile/setup
// @access  Private
router.put('/setup', 
  authenticate, 
  requireEmailVerification,
  profileUpdateRateLimit,
  uploadMultiple('photos', USER_CONSTANTS.MAX_PHOTOS),
  validateImageUpload,
  validateProfileSetup,
  async (req, res, next) => {
    try {
      const { 
        age, 
        location, 
        occupation, 
        education, 
        bio, 
        interests,
        preferences 
      } = req.body;

      // Check if profile already exists
      let profile = await Profile.findOne({ userId: req.user.id });
      
      const profileData = {
        userId: req.user.id,
        age,
        location,
        occupation,
        education,
        bio,
        interests: interests || [],
        preferences: {
          ageRange: {
            min: preferences?.ageRange?.min || 18,
            max: preferences?.ageRange?.max || 50
          },
          maxDistance: preferences?.maxDistance || 25,
          lookingFor: preferences?.lookingFor || 'anything'
        }
      };

      // Handle photo uploads
      if (req.files && req.files.length > 0) {
        const photoUploads = [];
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const uploadResult = await CloudinaryService.uploadImage(
            file.buffer,
            'profiles',
            `${req.user.id}_${Date.now()}_${i}`
          );
          
          photoUploads.push({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            isMain: i === 0, // First photo is main
            uploadedAt: new Date()
          });
        }
        
        profileData.photos = photoUploads;
      }

      if (profile) {
        // Update existing profile
        Object.assign(profile, profileData);
        await profile.save();
      } else {
        // Create new profile
        profile = new Profile(profileData);
        await profile.save();
      }

      // Update user's hasCompletedProfile status
      await User.findByIdAndUpdate(req.user.id, { 
        hasCompletedProfile: true 
      });

      // Calculate profile score
      const profileScore = calculateProfileScore(profile);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Profile setup completed successfully',
        data: {
          profile: {
            ...profile._doc,
            profileScore
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update existing profile
// @route   PUT /api/profile/update
// @access  Private
router.put('/update',
  authenticate,
  requireEmailVerification,
  profileUpdateRateLimit,
  validateProfileUpdate,
  async (req, res, next) => {
    try {
      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Profile not found. Please complete profile setup first.'
        });
      }

      // Update fields
      const updateFields = [
        'age', 'location', 'occupation', 'education', 'bio', 'interests'
      ];
      
      updateFields.forEach(field => {
        if (req.body[field] !== undefined) {
          profile[field] = req.body[field];
        }
      });

      // Update preferences if provided
      if (req.body.preferences) {
        if (req.body.preferences.ageRange) {
          profile.preferences.ageRange = {
            ...profile.preferences.ageRange,
            ...req.body.preferences.ageRange
          };
        }
        if (req.body.preferences.maxDistance !== undefined) {
          profile.preferences.maxDistance = req.body.preferences.maxDistance;
        }
        if (req.body.preferences.lookingFor) {
          profile.preferences.lookingFor = req.body.preferences.lookingFor;
        }
      }

      await profile.save();

      // Calculate updated profile score
      const profileScore = calculateProfileScore(profile);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: {
            ...profile._doc,
            profileScore
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Upload profile photo
// @route   POST /api/profile/upload-photo
// @access  Private
router.post('/upload-photo',
  authenticate,
  requireEmailVerification,
  uploadRateLimit,
  uploadSingle('photo'),
  validateImageUpload,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No photo file provided'
        });
      }

      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Profile not found. Please complete profile setup first.'
        });
      }

      // Check photo limit
      if (profile.photos.length >= USER_CONSTANTS.MAX_PHOTOS) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Maximum of ${USER_CONSTANTS.MAX_PHOTOS} photos allowed`
        });
      }

      // Upload to Cloudinary
      const uploadResult = await CloudinaryService.uploadImage(
        req.file.buffer,
        'profiles',
        `${req.user.id}_${Date.now()}`
      );

      // Add photo to profile
      const newPhoto = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        isMain: profile.photos.length === 0, // First photo is main
        uploadedAt: new Date()
      };

      profile.photos.push(newPhoto);
      await profile.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Photo uploaded successfully',
        data: {
          photo: newPhoto
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete profile photo
// @route   DELETE /api/profile/photo/:photoId
// @access  Private
router.delete('/photo/:photoId',
  authenticate,
  requireEmailVerification,
  validateObjectId('photoId'),
  async (req, res, next) => {
    try {
      const { photoId } = req.params;
      
      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Profile not found'
        });
      }

      // Find photo by ID
      const photoIndex = profile.photos.findIndex(photo => 
        photo._id.toString() === photoId
      );

      if (photoIndex === -1) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Photo not found'
        });
      }

      const photo = profile.photos[photoIndex];

      // Delete from Cloudinary
      await CloudinaryService.deleteImage(photo.publicId);

      // Remove from profile
      profile.photos.splice(photoIndex, 1);

      // If deleted photo was main and there are other photos, make first one main
      if (photo.isMain && profile.photos.length > 0) {
        profile.photos[0].isMain = true;
      }

      await profile.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Photo deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Set main photo
// @route   PUT /api/profile/photo/:photoId/main
// @access  Private
router.put('/photo/:photoId/main',
  authenticate,
  requireEmailVerification,
  validateObjectId('photoId'),
  async (req, res, next) => {
    try {
      const { photoId } = req.params;
      
      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Profile not found'
        });
      }

      // Find photo by ID
      const photo = profile.photos.find(photo => 
        photo._id.toString() === photoId
      );

      if (!photo) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Photo not found'
        });
      }

      // Update main photo status
      profile.photos.forEach(p => {
        p.isMain = p._id.toString() === photoId;
      });

      await profile.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Main photo updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to calculate profile completion score
function calculateProfileScore(profile) {
  let score = 0;
  const maxScore = 100;
  
  // Basic info (40 points)
  if (profile.age) score += 10;
  if (profile.location) score += 10;
  if (profile.bio && profile.bio.trim().length > 0) score += 20;
  
  // Photos (30 points)
  if (profile.photos && profile.photos.length > 0) {
    score += Math.min(profile.photos.length * 10, 30);
  }
  
  // Interests (20 points)
  if (profile.interests && profile.interests.length > 0) {
    score += Math.min(profile.interests.length * 4, 20);
  }
  
  // Additional info (10 points)
  if (profile.occupation) score += 5;
  if (profile.education) score += 5;
  
  return Math.min(score, maxScore);
}

module.exports = router;
