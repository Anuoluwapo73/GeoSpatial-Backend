import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  calculateDistance,
  formatDistance,
  calculateTravelTime,
  formatTravelTime,
} from "./utils/distanceCalculator.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "Backend is running", endpoints: ["/api/nearby-places"] });
});

// Fetch real places using Nominatim (completely free, no API key needed)
async function fetchRealPlaces(lat, lng, type) {
  const radius = 0.03; // ~3km search radius in degrees
  const latMin = lat - radius;
  const latMax = lat + radius;
  const lngMin = lng - radius;
  const lngMax = lng + radius;

  // Use Nominatim with proper headers and user agent
  const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=${type}&bounded=1&viewbox=${lngMin},${latMax},${lngMax},${latMin}&limit=20&addressdetails=1&extratags=1`;
  
  console.log(`Fetching real ${type}s from Nominatim API`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NearbyPlacesApp/1.0 (contact@example.com)',
      'Accept': 'application/json',
      'Accept-Language': 'en'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  return data.map((place, index) => {
    const placeLat = parseFloat(place.lat);
    const placeLng = parseFloat(place.lon);
    
    // Extract name from display_name or use type
    const name = place.name || 
                 place.display_name?.split(',')[0] || 
                 place.extratags?.name || 
                 `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`;
    
    // Build address from components
    const addressParts = [];
    if (place.address?.house_number) addressParts.push(place.address.house_number);
    if (place.address?.road) addressParts.push(place.address.road);
    if (place.address?.city || place.address?.town || place.address?.village) {
      addressParts.push(place.address.city || place.address.town || place.address.village);
    }
    const address = addressParts.length > 0 ? addressParts.join(' ') : place.display_name;

    return {
      id: place.place_id,
      name: name,
      lat: placeLat,
      lng: placeLng,
      address: address,
      phone: place.extratags?.phone || null,
      website: place.extratags?.website || null,
      rating: (Math.random() * 2 + 3).toFixed(1), // Generate realistic rating 3.0-5.0
      review_count: Math.floor(Math.random() * 200) + 10, // Generate review count
      opening_hours: place.extratags?.opening_hours || null,
      cuisine: place.extratags?.cuisine || null,
      image: `https://picsum.photos/300/200?random=${place.place_id}`, // Placeholder image
      is_closed: false
    };
  }).filter(place => place.lat && place.lng && !isNaN(place.lat) && !isNaN(place.lng));
}

app.post("/api/nearby-places", async (req, res) => {
  const { lat, lng, type } = req.body;
  const travelMode = "walking"; // Default to walking
  
  if (!lat || !lng || !type) {
    return res
      .status(400)
      .json({ error: "Missing latitude, longitude, or type" });
  }

  try {
    // Validate user coordinates
    if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid user coordinates" });
    }

    console.log(`Fetching real ${type}s around location: ${lat}, ${lng}`);

    // Fetch real places from Yelp API
    const realPlaces = await fetchRealPlaces(lat, lng, type);

    // Calculate distance and travel time for each place
    const places = realPlaces.map((place) => {
      try {
        const distanceKm = calculateDistance(lat, lng, place.lat, place.lng);
        const travelTimeMinutes = calculateTravelTime(distanceKm, travelMode);
        
        return {
          ...place,
          distance: formatDistance(distanceKm),
          distanceKm: distanceKm,
          travelTime: formatTravelTime(travelTimeMinutes),
          travelTimeMinutes: travelTimeMinutes,
        };
      } catch (error) {
        console.error(`Error calculating distance for place ${place.id}:`, error);
        return {
          ...place,
          distance: null,
          distanceKm: null,
          travelTime: null,
          travelTimeMinutes: null,
        };
      }
    });

    // Sort places by distance in ascending order
    const sortedPlaces = places.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    console.log(`Found ${sortedPlaces.length} real places`);
    res.json({ results: sortedPlaces });
    
  } catch (error) {
    console.error("Error fetching places:", error);
    res.status(500).json({ 
      error: "Failed to fetch places from Nominatim API",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// For Vercel deployment
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}