const mongoose = require('mongoose');
const { SUBSCRIPTION_CONSTANTS } = require('../constants');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: Object.values(SUBSCRIPTION_CONSTANTS.PLANS),
    default: SUBSCRIPTION_CONSTANTS.PLANS.FREE
  },
  features: {
    videoCallsPerDay: {
      type: Number,
      default: function() {
        return SUBSCRIPTION_CONSTANTS.FEATURES[this.plan.toUpperCase()].videoCallsPerDay;
      }
    },
    voiceCallsPerDay: {
      type: Number,
      default: function() {
        return SUBSCRIPTION_CONSTANTS.FEATURES[this.plan.toUpperCase()].voiceCallsPerDay;
      }
    },
    likesPerDay: {
      type: Number,
      default: function() {
        return SUBSCRIPTION_CONSTANTS.FEATURES[this.plan.toUpperCase()].likesPerDay;
      }
    },
    superLikesPerDay: {
      type: Number,
      default: function() {
        return SUBSCRIPTION_CONSTANTS.FEATURES[this.plan.toUpperCase()].superLikesPerDay;
      }
    }
  },
  stripeCustomerId: {
    type: String
  },
  stripeSubscriptionId: {
    type: String
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usage: {
    videoCallsToday: {
      type: Number,
      default: 0
    },
    voiceCallsToday: {
      type: Number,
      default: 0
    },
    likesToday: {
      type: Number,
      default: 0
    },
    superLikesToday: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ plan: 1 });
subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ 'usage.lastResetDate': 1 });

// Update features when plan changes
subscriptionSchema.pre('save', function(next) {
  if (this.isModified('plan')) {
    const planFeatures = SUBSCRIPTION_CONSTANTS.FEATURES[this.plan.toUpperCase()];
    this.features = {
      videoCallsPerDay: planFeatures.videoCallsPerDay,
      voiceCallsPerDay: planFeatures.voiceCallsPerDay,
      likesPerDay: planFeatures.likesPerDay,
      superLikesPerDay: planFeatures.superLikesPerDay
    };
  }
  next();
});

// Method to check if user can perform action
subscriptionSchema.methods.canPerformAction = function(actionType) {
  this.resetDailyUsageIfNeeded();
  
  const featureKey = `${actionType}PerDay`;
  const usageKey = `${actionType}Today`;
  
  const limit = this.features[featureKey];
  const currentUsage = this.usage[usageKey];
  
  // -1 means unlimited
  if (limit === -1) return true;
  
  return currentUsage < limit;
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = function(actionType) {
  this.resetDailyUsageIfNeeded();
  
  const usageKey = `${actionType}Today`;
  this.usage[usageKey] += 1;
  
  return this.save();
};

// Method to reset daily usage if needed
subscriptionSchema.methods.resetDailyUsageIfNeeded = function() {
  const now = new Date();
  const lastReset = this.usage.lastResetDate;
  
  // Check if it's a new day
  if (now.getDate() !== lastReset.getDate() || 
      now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()) {
    
    this.usage.videoCallsToday = 0;
    this.usage.voiceCallsToday = 0;
    this.usage.likesToday = 0;
    this.usage.superLikesToday = 0;
    this.usage.lastResetDate = now;
  }
};

// Method to upgrade plan
subscriptionSchema.methods.upgradePlan = function(newPlan, stripeData = {}) {
  this.plan = newPlan;
  
  if (stripeData.customerId) {
    this.stripeCustomerId = stripeData.customerId;
  }
  
  if (stripeData.subscriptionId) {
    this.stripeSubscriptionId = stripeData.subscriptionId;
  }
  
  if (stripeData.currentPeriodStart) {
    this.currentPeriodStart = stripeData.currentPeriodStart;
  }
  
  if (stripeData.currentPeriodEnd) {
    this.currentPeriodEnd = stripeData.currentPeriodEnd;
  }
  
  return this.save();
};

// Static method to reset all daily usage
subscriptionSchema.statics.resetAllDailyUsage = function() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return this.updateMany(
    { 'usage.lastResetDate': { $lt: startOfToday } },
    {
      $set: {
        'usage.videoCallsToday': 0,
        'usage.voiceCallsToday': 0,
        'usage.likesToday': 0,
        'usage.superLikesToday': 0,
        'usage.lastResetDate': now
      }
    }
  );
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
