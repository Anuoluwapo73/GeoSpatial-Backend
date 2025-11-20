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

// Fetch real places from Overpass API (OpenStreetMap data)
async function fetchRealPlaces(lat, lng, type) {
  const radius = 3000; // 3km radius in meters
  
  // Overpass QL query to find real places around the location
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="${type}"](around:${radius},${lat},${lng});
      way["amenity"="${type}"](around:${radius},${lat},${lng});
      relation["amenity"="${type}"](around:${radius},${lat},${lng});
    );
    out center meta;
  `;

  const url = 'https://overpass-api.de/api/interpreter';
  
  console.log(`Fetching real ${type}s from Overpass API`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'NearbyPlacesApp/1.0'
    },
    body: `data=${encodeURIComponent(overpassQuery)}`
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  return data.elements.map(element => {
    // Handle different element types (node, way, relation)
    const lat = element.lat || element.center?.lat;
    const lng = element.lon || element.center?.lon;
    
    const name = element.tags?.name || 
                 element.tags?.brand || 
                 element.tags?.[`name:en`] || 
                 `Unnamed ${type}`;
    
    const address = [
      element.tags?.['addr:housenumber'],
      element.tags?.['addr:street'],
      element.tags?.['addr:city']
    ].filter(Boolean).join(' ') || 'Address not available';

    return {
      id: element.id,
      name: name,
      lat: lat,
      lng: lng,
      address: address,
      phone: element.tags?.phone || null,
      website: element.tags?.website || null,
      opening_hours: element.tags?.opening_hours || null,
      cuisine: element.tags?.cuisine || null,
      image: `https://picsum.photos/300/200?random=${element.id}` // Placeholder image
    };
  }).filter(place => place.lat && place.lng); // Filter out places without coordinates
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

    // Fetch real places from Overpass API with timeout
    let realPlaces;
    try {
      realPlaces = await Promise.race([
        fetchRealPlaces(lat, lng, type),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API timeout')), 15000)
        )
      ]);
    } catch (apiError) {
      console.error('Overpass API failed:', apiError.message);
      return res.status(503).json({ 
        error: "Unable to fetch places at the moment. Please try again later.",
        details: apiError.message
      });
    }

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
    console.error("Error generating places:", error);
    res.status(500).json({ 
      error: "Failed to generate places",
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