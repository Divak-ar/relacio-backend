class ValidationUtils {
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPassword(password) {
    // At least 6 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/;
    return passwordRegex.test(password);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove HTML tags and dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  static validateAge(age) {
    return age >= 18 && age <= 100;
  }

  static validateLocation(location) {
    return location && location.trim().length >= 2 && location.trim().length <= 100;
  }

  static validateBio(bio) {
    return !bio || (bio.trim().length <= 500);
  }

  static validateInterests(interests) {
    if (!Array.isArray(interests)) return false;
    if (interests.length > 10) return false;
    
    return interests.every(interest => 
      typeof interest === 'string' && 
      interest.trim().length >= 1 && 
      interest.trim().length <= 50
    );
  }

  static validatePhoneNumber(phone) {
    // Basic phone number validation (can be enhanced based on requirements)
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateAgeRange(ageRange) {
    if (!ageRange || typeof ageRange !== 'object') return false;
    
    const { min, max } = ageRange;
    return this.validateAge(min) && 
           this.validateAge(max) && 
           min <= max;
  }

  static validateDistance(distance) {
    return distance >= 1 && distance <= 500;
  }

  static validateRelationshipPreference(preference) {
    const validPreferences = ['casual', 'serious', 'friendship', 'anything'];
    return validPreferences.includes(preference);
  }

  static validateMessageContent(content) {
    return content && 
           typeof content === 'string' && 
           content.trim().length >= 1 && 
           content.trim().length <= 1000;
  }

  static validateSwipeAction(action) {
    const validActions = ['like', 'pass', 'super_like'];
    return validActions.includes(action);
  }

  static validateNotificationType(type) {
    const validTypes = ['match', 'message', 'like', 'view', 'video_call'];
    return validTypes.includes(type);
  }

  static validateSubscriptionPlan(plan) {
    const validPlans = ['free', 'premium', 'platinum'];
    return validPlans.includes(plan);
  }

  static validatePaginationParams(page, limit) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    return {
      page: Math.max(1, pageNum),
      limit: Math.min(100, Math.max(1, limitNum))
    };
  }

  static validateFileType(mimetype, allowedTypes) {
    return allowedTypes.includes(mimetype);
  }

  static validateFileSize(size, maxSize) {
    return size <= maxSize;
  }

  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static validateSearchQuery(query) {
    if (!query || typeof query !== 'string') return false;
    
    const trimmed = query.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  }

  static validateCallId(callId) {
    return callId && 
           typeof callId === 'string' && 
           callId.trim().length >= 10 && 
           callId.trim().length <= 100;
  }

  static validateConversationId(conversationId) {
    const mongoose = require('mongoose');
    return mongoose.Types.ObjectId.isValid(conversationId);
  }

  static normalizeEmail(email) {
    return email.toLowerCase().trim();
  }

  static normalizeName(name) {
    return name.trim().replace(/\s+/g, ' ');
  }

  static normalizeLocation(location) {
    return location.trim().toLowerCase();
  }
}

module.exports = ValidationUtils;
