/**
 * Distance Calculator Utility Module
 * Provides functions for calculating distances, travel times, and formatting
 */

// Travel speed constants in km/h
const TRAVEL_SPEEDS = {
  walking: 5,
  cycling: 15,
  driving: 40
};

/**
 * Calculate Haversine distance between two coordinate pairs
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  
  // Convert degrees to radians
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  
  // Haversine formula
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const distance = R * c;
  
  return distance;
}

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    // Display in meters
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  } else {
    // Display in kilometers with one decimal place
    return `${distanceKm.toFixed(1)} km`;
  }
}

/**
 * Calculate travel time based on distance and mode
 * @param {number} distanceKm - Distance in kilometers
 * @param {string} mode - Travel mode: 'walking', 'cycling', or 'driving'
 * @returns {number} Time in minutes
 */
function calculateTravelTime(distanceKm, mode) {
  // Default to walking if mode is invalid
  const speed = TRAVEL_SPEEDS[mode] || TRAVEL_SPEEDS.walking;
  
  // Time = Distance / Speed (in hours), convert to minutes
  const timeInHours = distanceKm / speed;
  const timeInMinutes = timeInHours * 60;
  
  return timeInMinutes;
}

/**
 * Format travel time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
function formatTravelTime(minutes) {
  if (minutes < 1) {
    return "Less than 1 min";
  } else if (minutes < 60) {
    return `${Math.round(minutes)} mins`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (remainingMinutes === 0) {
      return hours === 1 ? "1 hour" : `${hours} hours`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} mins`;
    }
  }
}

export {
  calculateDistance,
  formatDistance,
  calculateTravelTime,
  formatTravelTime,
  TRAVEL_SPEEDS
};
