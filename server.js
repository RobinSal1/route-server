const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;

// 🔥 YOUR SHEET
const SHEET_ID = "1aatEh9g41NQ-xWiOvetmrtlmSpCNiXGtD0W4JMBpHx4";
const SHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;

// TEST
app.get("/", (req, res) => {
  res.send("Server works!");
});

// AUTOCOMPLETE
app.get("/autocomplete", async (req, res) => {
  const input = req.query.input;
  if (!input) return res.json([]);

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&types=(cities)&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const results = data.predictions.map(p => p.description);
    res.json(results);
  } catch {
    res.json([]);
  }
});

// SAFE SHEET FETCH
async function getRoutes() {
  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();

    return data
      .filter(r => r["EU Port"] && r["FI Port"] && r["Total"])
      .map(r => ({
        eu: r["EU Port"],
        fi: r["FI Port"],
        ferry: parseFloat(r["Total"])
      }));

  } catch (err) {
    console.log("Sheet error:", err);
    return [];
  }
}

// GOOGLE DIRECTIONS
async function getRouteData(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || !data.routes.length) return null;

    const leg = data.routes[0].legs[0];

    return {
      distance: leg.distance.value / 1000,
      duration: leg.duration.value / 3600
    };

  } catch {
    return null;
  }
}

// 🔥 MAIN CALC (SAFE VERSION)
app.post("/calculate", async (req, res) => {
  try {
    const { start, end, fuel, driver, tollRate } = req.body;

    const routes = await getRoutes();

    if (!routes.length) {
      return res.json([]);
    }

    const results = [];

    for (const r of routes) {
      try {
        const leg1 = await getRouteData(start, r.eu);
        const leg2 = await getRouteData(r.fi, end);

        const distance1 = leg1 ? leg1.distance : 0;
        const time1 = leg1 ? leg1.duration : 0;

        const distance2 = leg2 ? leg2.distance : 0;
        const time2 = leg2 ? leg2.duration : 0;

        const distance = distance1 + distance2;
        const time = time1 + time2;

        const safeTollRate = parseFloat(tollRate);
        const toll = distance1 * (isNaN(safeTollRate) ? 0.12 : safeTollRate);

        const fuelCost = distance * (fuel || 0.2);
        const driverCost = time * (driver || 20);

        const total = fuelCost + driverCost + r.ferry + toll;

        results.push({
          route: `${r.eu} → ${r.fi}`,
          distance,
          time,
          toll,
          ferry: r.ferry,
          total,
          valid: distance > 0
        });

      } catch (err) {
        console.log("Route error:", err);
      }
    }

    results.sort((a, b) => a.total - b.total);

    res.json(results.slice(0, 3));

  } catch (err) {
    console.log("FATAL:", err);
    res.json([]); // NEVER BREAK UI
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));