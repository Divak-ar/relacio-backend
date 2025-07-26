const { MATCHING_CONSTANTS } = require('../constants');

class MatchingUtils {
  // Calculate distance between two coordinates using Haversine formula
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  static degToRad(deg) {
    return deg * (Math.PI / 180);
  }

  // Calculate age from birthdate
  static calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Calculate compatibility score based on various factors
  static calculateCompatibilityScore(user1Profile, user2Profile) {
    let score = 0;
    let totalFactors = 0;

    // Interest matching (40% weight)
    const interestScore = this.calculateInterestMatch(user1Profile.interests, user2Profile.interests);
    score += interestScore * 0.4;
    totalFactors += 0.4;

    // Age compatibility (20% weight)
    const ageScore = this.calculateAgeCompatibility(
      this.calculateAge(user1Profile.dateOfBirth),
      this.calculateAge(user2Profile.dateOfBirth)
    );
    score += ageScore * 0.2;
    totalFactors += 0.2;

    // Location proximity (15% weight)
    if (user1Profile.location && user2Profile.location) {
      const locationScore = this.calculateLocationScore(
        user1Profile.location.coordinates[1], // latitude
        user1Profile.location.coordinates[0], // longitude
        user2Profile.location.coordinates[1],
        user2Profile.location.coordinates[0]
      );
      score += locationScore * 0.15;
      totalFactors += 0.15;
    }

    // Education level compatibility (10% weight)
    if (user1Profile.education && user2Profile.education) {
      const educationScore = this.calculateEducationCompatibility(
        user1Profile.education,
        user2Profile.education
      );
      score += educationScore * 0.1;
      totalFactors += 0.1;
    }

    // Lifestyle compatibility (15% weight)
    const lifestyleScore = this.calculateLifestyleCompatibility(user1Profile, user2Profile);
    score += lifestyleScore * 0.15;
    totalFactors += 0.15;

    // Normalize score to 0-100
    return Math.round((score / totalFactors) * 100);
  }

  // Calculate interest match percentage
  static calculateInterestMatch(interests1, interests2) {
    if (!interests1 || !interests2 || interests1.length === 0 || interests2.length === 0) {
      return 0;
    }

    const set1 = new Set(interests1.map(i => i.toLowerCase()));
    const set2 = new Set(interests2.map(i => i.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return (intersection.size / union.size) * 100;
  }

  // Calculate age compatibility score
  static calculateAgeCompatibility(age1, age2) {
    const ageDiff = Math.abs(age1 - age2);
    
    if (ageDiff <= 2) return 100;
    if (ageDiff <= 5) return 80;
    if (ageDiff <= 10) return 60;
    if (ageDiff <= 15) return 40;
    if (ageDiff <= 20) return 20;
    return 10;
  }

  // Calculate location-based score
  static calculateLocationScore(lat1, lon1, lat2, lon2) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    
    if (distance <= 5) return 100;      // Within 5km
    if (distance <= 10) return 90;     // Within 10km
    if (distance <= 25) return 70;     // Within 25km
    if (distance <= 50) return 50;     // Within 50km
    if (distance <= 100) return 30;    // Within 100km
    return 10;                         // Beyond 100km
  }

  // Calculate education compatibility
  static calculateEducationCompatibility(edu1, edu2) {
    const educationLevels = {
      'high_school': 1,
      'bachelor': 2,
      'master': 3,
      'phd': 4,
      'other': 2.5
    };

    const level1 = educationLevels[edu1] || 2.5;
    const level2 = educationLevels[edu2] || 2.5;
    const diff = Math.abs(level1 - level2);

    if (diff === 0) return 100;
    if (diff <= 1) return 80;
    if (diff <= 2) return 60;
    return 40;
  }

  // Calculate lifestyle compatibility
  static calculateLifestyleCompatibility(profile1, profile2) {
    let score = 0;
    let factors = 0;

    // Smoking preference
    if (profile1.smokingHabits && profile2.smokingHabits) {
      score += profile1.smokingHabits === profile2.smokingHabits ? 100 : 30;
      factors++;
    }

    // Drinking preference
    if (profile1.drinkingHabits && profile2.drinkingHabits) {
      score += profile1.drinkingHabits === profile2.drinkingHabits ? 100 : 50;
      factors++;
    }

    // Relationship goals
    if (profile1.relationshipGoals && profile2.relationshipGoals) {
      score += profile1.relationshipGoals === profile2.relationshipGoals ? 100 : 20;
      factors++;
    }

    return factors > 0 ? score / factors : 50;
  }

  // Filter potential matches based on preferences
  static filterByPreferences(userProfile, potentialMatches) {
    return potentialMatches.filter(match => {
      const matchAge = this.calculateAge(match.dateOfBirth);
      
      // Age range filter
      if (userProfile.preferences.ageRange) {
        const { min, max } = userProfile.preferences.ageRange;
        if (matchAge < min || matchAge > max) return false;
      }

      // Distance filter
      if (userProfile.preferences.maxDistance && userProfile.location && match.location) {
        const distance = this.calculateDistance(
          userProfile.location.coordinates[1],
          userProfile.location.coordinates[0],
          match.location.coordinates[1],
          match.location.coordinates[0]
        );
        if (distance > userProfile.preferences.maxDistance) return false;
      }

      // Gender preference filter
      if (userProfile.preferences.interestedIn && userProfile.preferences.interestedIn.length > 0) {
        if (!userProfile.preferences.interestedIn.includes(match.gender)) return false;
      }

      return true;
    });
  }

  // Sort matches by compatibility score
  static sortByCompatibility(userProfile, matches) {
    return matches
      .map(match => ({
        ...match,
        compatibilityScore: this.calculateCompatibilityScore(userProfile, match)
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  // Get top matches with scores
  static getTopMatches(userProfile, potentialMatches, limit = 10) {
    const filteredMatches = this.filterByPreferences(userProfile, potentialMatches);
    const sortedMatches = this.sortByCompatibility(userProfile, filteredMatches);
    
    return sortedMatches.slice(0, limit);
  }

  // Check if two users are compatible based on mutual preferences
  static areMutuallyCompatible(user1Profile, user2Profile) {
    // Check if user1 meets user2's preferences
    const user1Age = this.calculateAge(user1Profile.dateOfBirth);
    const user2Age = this.calculateAge(user2Profile.dateOfBirth);

    // User2's age preferences for User1
    if (user2Profile.preferences.ageRange) {
      const { min, max } = user2Profile.preferences.ageRange;
      if (user1Age < min || user1Age > max) return false;
    }

    // User1's age preferences for User2
    if (user1Profile.preferences.ageRange) {
      const { min, max } = user1Profile.preferences.ageRange;
      if (user2Age < min || user2Age > max) return false;
    }

    // Gender preferences
    if (user1Profile.preferences.interestedIn && user1Profile.preferences.interestedIn.length > 0) {
      if (!user1Profile.preferences.interestedIn.includes(user2Profile.gender)) return false;
    }

    if (user2Profile.preferences.interestedIn && user2Profile.preferences.interestedIn.length > 0) {
      if (!user2Profile.preferences.interestedIn.includes(user1Profile.gender)) return false;
    }

    // Distance preferences
    if (user1Profile.location && user2Profile.location) {
      const distance = this.calculateDistance(
        user1Profile.location.coordinates[1],
        user1Profile.location.coordinates[0],
        user2Profile.location.coordinates[1],
        user2Profile.location.coordinates[0]
      );

      if (user1Profile.preferences.maxDistance && distance > user1Profile.preferences.maxDistance) {
        return false;
      }

      if (user2Profile.preferences.maxDistance && distance > user2Profile.preferences.maxDistance) {
        return false;
      }
    }

    return true;
  }

  // Calculate match quality score
  static calculateMatchQuality(compatibilityScore, distance, commonInterests) {
    let quality = 'low';
    
    if (compatibilityScore >= 80 && distance <= 25 && commonInterests >= 3) {
      quality = 'excellent';
    } else if (compatibilityScore >= 70 && distance <= 50 && commonInterests >= 2) {
      quality = 'high';
    } else if (compatibilityScore >= 60 && distance <= 100 && commonInterests >= 1) {
      quality = 'medium';
    }
    
    return quality;
  }

  // Generate match explanation
  static generateMatchExplanation(userProfile, matchProfile, compatibilityScore) {
    const reasons = [];
    
    // Common interests
    const commonInterests = this.getCommonInterests(userProfile.interests, matchProfile.interests);
    if (commonInterests.length > 0) {
      reasons.push(`You both enjoy ${commonInterests.slice(0, 3).join(', ')}`);
    }

    // Age compatibility
    const user1Age = this.calculateAge(userProfile.dateOfBirth);
    const user2Age = this.calculateAge(matchProfile.dateOfBirth);
    const ageDiff = Math.abs(user1Age - user2Age);
    
    if (ageDiff <= 3) {
      reasons.push('Similar age range');
    }

    // Location
    if (userProfile.location && matchProfile.location) {
      const distance = this.calculateDistance(
        userProfile.location.coordinates[1],
        userProfile.location.coordinates[0],
        matchProfile.location.coordinates[1],
        matchProfile.location.coordinates[0]
      );
      
      if (distance <= 10) {
        reasons.push('Lives nearby');
      }
    }

    // Education
    if (userProfile.education === matchProfile.education) {
      reasons.push('Similar education background');
    }

    return reasons.slice(0, 3); // Return top 3 reasons
  }

  // Get common interests between two users
  static getCommonInterests(interests1, interests2) {
    if (!interests1 || !interests2) return [];
    
    const set1 = new Set(interests1.map(i => i.toLowerCase()));
    const set2 = new Set(interests2.map(i => i.toLowerCase()));
    
    return [...set1].filter(interest => set2.has(interest));
  }

  // Calculate optimal discovery radius based on user density
  static calculateOptimalRadius(userLocation, userDensity) {
    let baseRadius = MATCHING_CONSTANTS.DEFAULT_RADIUS;
    
    if (userDensity < 50) {
      baseRadius *= 2; // Increase radius in low-density areas
    } else if (userDensity > 500) {
      baseRadius *= 0.5; // Decrease radius in high-density areas
    }
    
    return Math.min(baseRadius, MATCHING_CONSTANTS.MAX_RADIUS);
  }

  // Check if user should see this profile again (avoid showing repeatedly)
  static shouldShowProfile(viewHistory, profileId, daysSinceLastView = 7) {
    const lastView = viewHistory.find(view => view.profileId === profileId);
    
    if (!lastView) return true;
    
    const daysSince = (Date.now() - lastView.viewedAt) / (1000 * 60 * 60 * 24);
    return daysSince >= daysSinceLastView;
  }

  // Generate discovery batch with variety
  static generateDiscoveryBatch(userProfile, potentialMatches, batchSize = 10) {
    // Get top matches
    const topMatches = this.getTopMatches(userProfile, potentialMatches, batchSize * 2);
    
    // Ensure variety in the batch
    const batch = [];
    const addedAges = new Set();
    const addedLocations = new Set();
    
    for (const match of topMatches) {
      if (batch.length >= batchSize) break;
      
      const age = this.calculateAge(match.dateOfBirth);
      const ageGroup = Math.floor(age / 5) * 5; // Group by 5-year intervals
      
      let locationKey = 'unknown';
      if (match.location) {
        // Group by approximate location (rounded coordinates)
        locationKey = `${Math.round(match.location.coordinates[1])}_${Math.round(match.location.coordinates[0])}`;
      }
      
      // Add if it brings variety or if we haven't filled minimum requirements
      if (batch.length < batchSize / 2 || !addedAges.has(ageGroup) || !addedLocations.has(locationKey)) {
        batch.push(match);
        addedAges.add(ageGroup);
        addedLocations.add(locationKey);
      }
    }
    
    // Fill remaining slots with best matches
    for (const match of topMatches) {
      if (batch.length >= batchSize) break;
      if (!batch.find(m => m._id.toString() === match._id.toString())) {
        batch.push(match);
      }
    }
    
    return batch;
  }
}

module.exports = MatchingUtils;
