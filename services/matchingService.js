const Profile = require('../models/Profile');
const Match = require('../models/Match');
const { MATCH_CONSTANTS } = require('../constants');

class MatchingService {
  static calculateCompatibility(user1Profile, user2Profile) {
    let score = 0;
    let maxScore = 0;

    // Age compatibility (20 points)
    maxScore += 20;
    const ageDiff = Math.abs(user1Profile.age - user2Profile.age);
    if (ageDiff <= 2) score += 20;
    else if (ageDiff <= 5) score += 15;
    else if (ageDiff <= 10) score += 10;
    else if (ageDiff <= 15) score += 5;

    // Interest compatibility (30 points)
    maxScore += 30;
    if (user1Profile.interests && user2Profile.interests) {
      const commonInterests = user1Profile.interests.filter(interest => 
        user2Profile.interests.includes(interest)
      );
      const interestScore = (commonInterests.length / Math.max(user1Profile.interests.length, user2Profile.interests.length)) * 30;
      score += Math.round(interestScore);
    }

    // Location compatibility (15 points)
    maxScore += 15;
    if (user1Profile.location && user2Profile.location) {
      if (user1Profile.location.toLowerCase() === user2Profile.location.toLowerCase()) {
        score += 15;
      } else {
        // Could implement distance calculation here
        score += 5; // Basic points for having location data
      }
    }

    // Education compatibility (10 points)
    maxScore += 10;
    if (user1Profile.education && user2Profile.education) {
      if (user1Profile.education.toLowerCase() === user2Profile.education.toLowerCase()) {
        score += 10;
      } else {
        score += 3; // Basic points for having education data
      }
    }

    // Occupation compatibility (10 points)
    maxScore += 10;
    if (user1Profile.occupation && user2Profile.occupation) {
      if (user1Profile.occupation.toLowerCase() === user2Profile.occupation.toLowerCase()) {
        score += 10;
      } else {
        score += 3; // Basic points for having occupation data
      }
    }

    // Profile completeness bonus (15 points)
    maxScore += 15;
    const avgProfileScore = (user1Profile.profileScore + user2Profile.profileScore) / 2;
    score += Math.round((avgProfileScore / 100) * 15);

    // Normalize score to 0-100
    const finalScore = Math.round((score / maxScore) * 100);
    return Math.min(finalScore, MATCH_CONSTANTS.MAX_COMPATIBILITY_SCORE);
  }

  static async getDiscoveryProfiles(userId, preferences, options = {}) {
    const { limit = 10, excludeIds = [] } = options;

    try {
      // Get user's own profile to exclude
      const userProfile = await Profile.findOne({ userId });
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Get users already swiped on
      const existingMatches = await Match.find({
        $or: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      });

      const swipedUserIds = existingMatches.reduce((acc, match) => {
        if (match.user1Id.toString() === userId.toString()) {
          acc.push(match.user2Id.toString());
        } else {
          acc.push(match.user1Id.toString());
        }
        return acc;
      }, []);

      // Build query for potential matches
      const query = {
        userId: { 
          $nin: [userId, ...swipedUserIds, ...excludeIds] 
        }
      };

      // Apply age preferences
      if (preferences.ageRange) {
        query.age = {
          $gte: preferences.ageRange.min,
          $lte: preferences.ageRange.max
        };
      }

      // Get potential matches
      const potentialMatches = await Profile.find(query)
        .populate('userId', 'name email lastSeen isOnline')
        .limit(limit * 3) // Get more to filter and randomize
        .lean();

      // Calculate compatibility scores and sort
      const profilesWithScores = potentialMatches.map(profile => ({
        ...profile,
        compatibility: this.calculateCompatibility(userProfile, profile)
      }));

      // Sort by compatibility and return top matches
      const sortedProfiles = profilesWithScores
        .sort((a, b) => b.compatibility - a.compatibility)
        .slice(0, limit);

      // Randomize the top matches to avoid predictability
      return this.shuffleArray(sortedProfiles);

    } catch (error) {
      throw new Error(`Failed to get discovery profiles: ${error.message}`);
    }
  }

  static async processSwipe(userId, targetUserId, action) {
    try {
      // Check if match already exists
      const existingMatch = await Match.findExistingMatch(userId, targetUserId);

      if (existingMatch) {
        // Update existing match if current user hasn't acted yet
        if (existingMatch.user1Id.toString() === userId.toString()) {
          if (existingMatch.user1Action === MATCH_CONSTANTS.ACTIONS.PENDING) {
            existingMatch.user1Action = action;
          } else {
            throw new Error('User has already swiped on this profile');
          }
        } else {
          if (existingMatch.user2Action === MATCH_CONSTANTS.ACTIONS.PENDING) {
            existingMatch.user2Action = action;
          } else {
            throw new Error('User has already swiped on this profile');
          }
        }

        await existingMatch.save();
        return existingMatch;
      } else {
        // Create new match
        const newMatch = new Match({
          user1Id: userId,
          user2Id: targetUserId,
          user1Action: action,
          user2Action: MATCH_CONSTANTS.ACTIONS.PENDING
        });

        // Calculate compatibility
        const user1Profile = await Profile.findOne({ userId });
        const user2Profile = await Profile.findOne({ userId: targetUserId });

        if (user1Profile && user2Profile) {
          newMatch.compatibility = this.calculateCompatibility(user1Profile, user2Profile);
        }

        await newMatch.save();
        return newMatch;
      }
    } catch (error) {
      throw new Error(`Failed to process swipe: ${error.message}`);
    }
  }

  static async checkForMatch(userId, targetUserId) {
    try {
      const match = await Match.findExistingMatch(userId, targetUserId);
      return match && match.isMatch;
    } catch (error) {
      throw new Error(`Failed to check for match: ${error.message}`);
    }
  }

  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static calculateDistance(location1, location2) {
    // Simple string comparison for now
    // In production, you would use proper geocoding and distance calculation
    if (location1.toLowerCase() === location2.toLowerCase()) {
      return 0;
    }
    return 50; // Default distance
  }

  static calculateAgeCompatibility(age1, age2) {
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 2) return 100;
    if (ageDiff <= 5) return 80;
    if (ageDiff <= 10) return 60;
    if (ageDiff <= 15) return 40;
    return 20;
  }

  static calculateInterestCompatibility(interests1, interests2) {
    if (!interests1 || !interests2 || interests1.length === 0 || interests2.length === 0) {
      return 0;
    }

    const commonInterests = interests1.filter(interest => 
      interests2.includes(interest)
    );

    const totalInterests = new Set([...interests1, ...interests2]).size;
    return (commonInterests.length / totalInterests) * 100;
  }
}

module.exports = MatchingService;
