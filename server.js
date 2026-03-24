const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;

// Test route
app.get("/", (req, res) => {
  res.send("Server works!");
});

// AUTOCOMPLETE
app.get("/autocomplete", async (req, res) => {
  const input = req.query.input;
  if (!input) return res.json([]);

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&types=(cities)&key=${API_KEY}`;
    const response = await fetch(url).then(r => r.json());
    const results = response.predictions.map(p => p.description);
    res.json(results);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// PORT ROUTES
const routes = [
  { eu: "Rotterdam", fi: "Helsinki", ferry: 300 },
  { eu: "Hamburg", fi: "Turku", ferry: 280 }
];

// 🔥 FUNCTION: CALL GOOGLE ROUTES API (WITH TOLLS)
async function getRouteData(origin, destination) {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: "DRIVE",
    extraComputations: ["TOLLS"]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!data.routes || !data.routes.length) return null;

  const route = data.routes[0];

  const distance = route.distanceMeters / 1000;
  const duration = parseInt(route.duration.replace("s", "")) / 3600;

  // 🔥 Extract toll
let toll = 0;

const tollInfo = route.travelAdvisory?.tollInfo;

if (tollInfo?.estimatedPrice?.length) {
  const price = tollInfo.estimatedPrice[0];

  if (price.units) {
    toll = parseFloat(price.units);
  } else {
    toll = 0;
  }
}
// CALCULATE ROUTE
app.post("/calculate", async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end" });
  }

  let results = [];

  for (const r of routes) {
    try {
      // Two legs
      const leg1 = await getRouteData(start, r.eu);
      const leg2 = await getRouteData(r.fi, end);

      if (!leg1 || !leg2) continue;

      const distance = leg1.distance + leg2.distance;
      const time = leg1.duration + leg2.duration;

      const toll = leg1.toll + leg2.toll;

      const fuelCost = distance * 0.2;
      const total = fuelCost + r.ferry + toll;

      results.push({
        route: `${r.eu} → ${r.fi}`,
        distance,
        time,
        toll,
        total
      });

    } catch (err) {
      console.log("Error:", err);
    }
  }

  results.sort((a, b) => a.total - b.total);

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));