const mongoose = require('mongoose');
const { USER_CONSTANTS } = require('../constants');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [18, 'Must be at least 18 years old'],
    max: [100, 'Age cannot exceed 100']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  occupation: {
    type: String,
    trim: true,
    maxlength: [100, 'Occupation cannot exceed 100 characters']
  },
  education: {
    type: String,
    trim: true,
    maxlength: [100, 'Education cannot exceed 100 characters']
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [USER_CONSTANTS.MAX_BIO_LENGTH, `Bio cannot exceed ${USER_CONSTANTS.MAX_BIO_LENGTH} characters`]
  },
  interests: [{
    type: String,
    trim: true,
    validate: {
      validator: function(interests) {
        return interests.length <= USER_CONSTANTS.MAX_INTERESTS;
      },
      message: `Cannot have more than ${USER_CONSTANTS.MAX_INTERESTS} interests`
    }
  }],
  photos: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    isMain: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  preferences: {
    ageRange: {
      min: {
        type: Number,
        default: 18,
        min: 18
      },
      max: {
        type: Number,
        default: 35,
        max: 100
      }
    },
    maxDistance: {
      type: Number,
      default: 50, // miles
      min: 1,
      max: 500
    },
    lookingFor: {
      type: String,
      enum: ['casual', 'serious', 'friendship', 'anything'],
      default: 'anything'
    }
  },
  profileScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  profileViews: {
    type: Number,
    default: 0
  },
  likesReceived: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
profileSchema.index({ userId: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ location: 1 });
profileSchema.index({ 'preferences.ageRange.min': 1, 'preferences.ageRange.max': 1 });
profileSchema.index({ profileScore: -1 });

// Validate photos array length
profileSchema.pre('save', function(next) {
  if (this.photos.length > USER_CONSTANTS.MAX_PHOTOS) {
    return next(new Error(`Cannot have more than ${USER_CONSTANTS.MAX_PHOTOS} photos`));
  }
  
  // Ensure only one main photo
  const mainPhotos = this.photos.filter(photo => photo.isMain);
  if (mainPhotos.length > 1) {
    return next(new Error('Only one photo can be set as main'));
  }
  
  next();
});

// Calculate profile completion score
profileSchema.methods.calculateProfileScore = function() {
  let score = 0;
  const fields = {
    age: 10,
    location: 10,
    occupation: 10,
    education: 10,
    bio: 15,
    interests: 15,
    photos: 30
  };

  if (this.age) score += fields.age;
  if (this.location) score += fields.location;
  if (this.occupation) score += fields.occupation;
  if (this.education) score += fields.education;
  if (this.bio && this.bio.length > 20) score += fields.bio;
  if (this.interests && this.interests.length >= 3) score += fields.interests;
  if (this.photos && this.photos.length >= 2) score += fields.photos;

  this.profileScore = score;
  return score;
};

// Get main photo
profileSchema.methods.getMainPhoto = function() {
  return this.photos.find(photo => photo.isMain) || this.photos[0] || null;
};

module.exports = mongoose.model('Profile', profileSchema);
