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

// Generate realistic mock data around user location
function generateMockPlaces(lat, lng, type, count = 10) {
  const placeNames = {
    restaurant: [
      "Pizza Palace", "Burger King", "Sushi Express", "Taco Bell", "KFC",
      "McDonald's", "Subway", "Domino's Pizza", "Starbucks", "Local Diner",
      "Italian Bistro", "Chinese Garden", "Thai Kitchen", "Mexican Grill", "Cafe Central"
    ],
    school: [
      "Central High School", "Elementary School", "Community College", "Private Academy", "Public School",
      "St. Mary's School", "Lincoln Elementary", "Washington High", "Roosevelt Middle", "Jefferson Academy",
      "Oak Tree School", "Riverside Elementary", "Hillside High", "Valley School", "Maple Leaf Academy"
    ],
    hotel: [
      "Grand Hotel", "Budget Inn", "Luxury Suites", "City Lodge", "Comfort Inn",
      "Holiday Inn", "Best Western", "Marriott", "Hilton", "Motel 6",
      "Royal Hotel", "Plaza Inn", "Garden Suites", "Downtown Lodge", "Riverside Hotel"
    ],
    hospital: [
      "General Hospital", "Medical Center", "City Clinic", "Emergency Care", "Health Center",
      "St. Joseph Hospital", "Memorial Medical", "Community Clinic", "Regional Hospital", "Family Care",
      "Central Medical", "Urgent Care", "Specialty Hospital", "Children's Hospital", "Veterans Hospital"
    ],
    bank: [
      "First National Bank", "City Bank", "Community Credit Union", "Wells Fargo", "Bank of America",
      "Chase Bank", "TD Bank", "PNC Bank", "Capital One", "Local Credit Union",
      "Savings & Loan", "Investment Bank", "Trust Bank", "Regional Bank", "Federal Credit Union"
    ]
  };

  const names = placeNames[type] || placeNames.restaurant;
  const places = [];

  for (let i = 0; i < Math.min(count, names.length); i++) {
    // Generate coordinates within ~3km radius
    const latOffset = (Math.random() - 0.5) * 0.05; // ~2.5km range
    const lngOffset = (Math.random() - 0.5) * 0.05;
    
    const placeLat = lat + latOffset;
    const placeLng = lng + lngOffset;
    
    places.push({
      id: `mock_${type}_${i}`,
      name: names[i],
      lat: placeLat,
      lng: placeLng,
      address: `${Math.floor(Math.random() * 9999) + 1} Main Street, City`,
      rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0 rating
      image: `https://picsum.photos/300/200?random=${i}` // Random placeholder images
    });
  }

  return places;
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

    console.log(`Generating mock ${type}s around location: ${lat}, ${lng}`);

    // Generate mock places around the user's location
    const mockPlaces = generateMockPlaces(lat, lng, type);

    // Calculate distance and travel time for each place
    const places = mockPlaces.map((place) => {
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

    console.log(`Generated ${sortedPlaces.length} mock places`);
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