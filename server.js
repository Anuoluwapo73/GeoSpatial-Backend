import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import {
  calculateDistance,
  formatDistance,
  calculateTravelTime,
  formatTravelTime,
} from "./utils/distanceCalculator.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "Backend is running", endpoints: ["/api/nearby-places"] });
});

app.post("/api/nearby-places", async (req, res) => {
  const { lat, lng, type } = req.body;
  const travelMode = "walking"; // Default to walking
  if (!lat || !lng || !type) {
    return res
      .status(400)
      .json({ error: "Missing latitude, longitude, or type" });
  }

  try {
    const latMin = lat - 0.03;
    const latMax = lat + 0.03;
    const lngMin = lng - 0.03;
    const lngMax = lng + 0.03;

    // Use the "type" from frontend (school, hotel, bank, etc.)
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=${type}&bounded=1&viewbox=${lngMin},${latMax},${lngMax},${latMin}&limit=20`;

    console.log(`Fetching ${type}s from Nominatim API:`, url);

    // Retry logic for Nominatim API
    let data;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { 
            "User-Agent": "NearbyPlacesApp/1.0",
            "Accept": "application/json",
            "Accept-Language": "en"
          }
        });

        if (!response.ok) {
          console.error(`Nominatim API returned status ${response.status}: ${response.statusText}`);
          if (attempt === maxRetries) {
            return res
              .status(response.status)
              .json({ error: `Nominatim API error: ${response.statusText}` });
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        data = await response.json();
        break; // Success, exit retry loop
      } catch (fetchError) {
        console.error(`Attempt ${attempt} failed:`, fetchError.message);
        lastError = fetchError;
        
        if (attempt === maxRetries) {
          throw fetchError; // Throw on last attempt
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    if (!data) {
      throw lastError || new Error("Failed to fetch data from Nominatim");
    }
    console.log(data);

    // Validate user coordinates
    if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) {
      return res.status(400).json({ error: "Invalid user coordinates" });
    }

    // Validate travel mode (default to walking if invalid)
    const validModes = ["walking", "cycling", "driving"];
    const mode = validModes.includes(travelMode) ? travelMode : "walking";
    
    if (!validModes.includes(travelMode)) {
      console.warn(`Invalid travel mode "${travelMode}", defaulting to "walking"`);
    }

    const places = data.map((place) => {
      const placeLat = parseFloat(place.lat);
      const placeLon = parseFloat(place.lon);
      
      // Handle invalid place coordinates
      if (isNaN(placeLat) || isNaN(placeLon)) {
        console.warn(`Invalid coordinates for place ${place.place_id}, skipping distance calculation`);
        return {
          id: place.place_id,
          name: place.display_name.split(",")[0] || `Unnamed ${type}`,
          lat: placeLat,
          lon: placeLon,
          address: place.display_name,
          distance: null,
          distanceKm: null,
          travelTime: null,
          travelTimeMinutes: null,
        };
      }

      try {
        // Calculate distance and travel time
        const distanceKm = calculateDistance(lat, lng, placeLat, placeLon);
        const travelTimeMinutes = calculateTravelTime(distanceKm, mode);
        
        return {
          id: place.place_id,
          name: place.display_name.split(",")[0] || `Unnamed ${type}`,
          lat: placeLat,
          lon: placeLon,
          address: place.display_name,
          distance: formatDistance(distanceKm),
          distanceKm: distanceKm,
          travelTime: formatTravelTime(travelTimeMinutes),
          travelTimeMinutes: travelTimeMinutes,
        };
      } catch (error) {
        console.error(`Error calculating distance for place ${place.place_id}:`, error);
        return {
          id: place.place_id,
          name: place.display_name.split(",")[0] || `Unnamed ${type}`,
          lat: placeLat,
          lon: placeLon,
          address: place.display_name,
          distance: null,
          distanceKm: null,
          travelTime: null,
          travelTimeMinutes: null,
        };
      }
    });

    // Sort places by distance in ascending order
    // Places with null distances go to the end
    const sortedPlaces = places.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    res.json({ results: sortedPlaces });
  } catch (error) {
    console.error("Error fetching places:", error);
    const errorMessage = error.code === 'ECONNREFUSED' 
      ? "Unable to connect to location service. Please try again later."
      : error.message || "Failed to fetch places";
    res.status(500).json({ 
      error: errorMessage,
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
