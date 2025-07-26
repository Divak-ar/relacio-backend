const redis = require('redis');
const Subscription = require('../models/Subscription');
const { RATE_LIMIT_CONSTANTS, REDIS_KEYS } = require('../constants');

class RateLimitService {
  constructor() {
    this.redisClient = null;
    this.initRedis();
  }

  async initRedis() {
    try {
      // Redis disabled for development - no Redis server running
      console.log('⚠️  Redis disabled - using in-memory fallback');
      this.redisClient = null;
      
      // Uncomment below lines when Redis is available:
      /*
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
      console.log('Redis connected successfully');
      */
    } catch (error) {
      console.error('Redis connection failed:', error);
      // Fallback to in-memory storage for development
      this.redisClient = null;
    }
  }

  async checkVideoCallLimit(userId) {
    return this.checkFeatureLimit(userId, 'videoCalls');
  }

  async checkVoiceCallLimit(userId) {
    return this.checkFeatureLimit(userId, 'voiceCalls');
  }

  async checkLikeLimit(userId) {
    return this.checkFeatureLimit(userId, 'likes');
  }

  async checkSuperLikeLimit(userId) {
    return this.checkFeatureLimit(userId, 'superLikes');
  }

  async checkMessageLimit(userId) {
    return this.checkFeatureLimit(userId, 'messages');
  }

  async checkFeatureLimit(userId, featureType) {
    try {
      // Get user subscription
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Check if user can perform action
      return subscription.canPerformAction(featureType);
    } catch (error) {
      console.error(`Error checking ${featureType} limit:`, error);
      return false;
    }
  }

  async incrementUsage(userId, featureType) {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await subscription.incrementUsage(featureType);

      // Also update Redis cache if available
      if (this.redisClient) {
        const key = REDIS_KEYS.RATE_LIMIT[featureType.toUpperCase()](userId);
        const current = await this.redisClient.get(key) || 0;
        await this.redisClient.setEx(key, 86400, parseInt(current) + 1); // 24 hours TTL
      }

      return true;
    } catch (error) {
      console.error(`Error incrementing ${featureType} usage:`, error);
      return false;
    }
  }

  async getRemainingLimit(userId, featureType) {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        return 0;
      }

      subscription.resetDailyUsageIfNeeded();

      const featureKey = `${featureType}PerDay`;
      const usageKey = `${featureType}Today`;

      const limit = subscription.features[featureKey];
      const used = subscription.usage[usageKey];

      if (limit === -1) return -1; // Unlimited
      return Math.max(0, limit - used);
    } catch (error) {
      console.error(`Error getting remaining ${featureType} limit:`, error);
      return 0;
    }
  }

  async resetDailyLimits() {
    try {
      await Subscription.resetAllDailyUsage();

      // Clear Redis cache if available
      if (this.redisClient) {
        const pattern = 'rate_limit:*';
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }

      console.log('Daily limits reset successfully');
      return true;
    } catch (error) {
      console.error('Error resetting daily limits:', error);
      return false;
    }
  }

  async checkGeneralRateLimit(identifier, action = 'general') {
    if (!this.redisClient) {
      return true; // Allow if Redis is not available
    }

    try {
      const key = `rate_limit:${action}:${identifier}`;
      const limit = RATE_LIMIT_CONSTANTS.GENERAL;
      
      const current = await this.redisClient.get(key);
      
      if (!current) {
        await this.redisClient.setEx(key, Math.floor(limit.windowMs / 1000), 1);
        return true;
      }

      if (parseInt(current) >= limit.max) {
        return false;
      }

      await this.redisClient.incr(key);
      return true;
    } catch (error) {
      console.error('Error checking general rate limit:', error);
      return true; // Allow on error
    }
  }

  async getUserUsageStats(userId) {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        return null;
      }

      subscription.resetDailyUsageIfNeeded();

      return {
        plan: subscription.plan,
        features: subscription.features,
        usage: subscription.usage,
        remaining: {
          videoCalls: this.calculateRemaining(subscription.features.videoCallsPerDay, subscription.usage.videoCallsToday),
          voiceCalls: this.calculateRemaining(subscription.features.voiceCallsPerDay, subscription.usage.voiceCallsToday),
          likes: this.calculateRemaining(subscription.features.likesPerDay, subscription.usage.likesToday),
          superLikes: this.calculateRemaining(subscription.features.superLikesPerDay, subscription.usage.superLikesToday)
        }
      };
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      return null;
    }
  }

  calculateRemaining(limit, used) {
    if (limit === -1) return -1; // Unlimited
    return Math.max(0, limit - used);
  }

  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

module.exports = new RateLimitService();
