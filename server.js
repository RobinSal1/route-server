const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;

const SHEET_ID = "1aatEh9g41NQ-xWiOvetmrtlmSpCNiXGtD0W4JMBpHx4";
const SHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;

// TEST
app.get("/", (req, res) => {
  res.send("Server works!");
});

// AUTOCOMPLETE (EU ONLY)
app.get("/autocomplete", async (req, res) => {
  const input = req.query.input;
  if (!input) return res.json([]);

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&types=(cities)&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const europe = [
      "Finland","Sweden","Norway","Denmark","Germany","France","Spain",
      "Italy","Netherlands","Belgium","Poland","Estonia","Latvia","Lithuania",
      "Czechia","Austria","Switzerland","Portugal","Slovakia","Hungary",
      "Slovenia","Croatia","Greece","Romania","Bulgaria","Ireland","UK"
    ];

    const results = data.predictions
      .map(p => p.description)
      .filter(place => europe.some(c => place.includes(c)));

    res.json(results.slice(0, 5));

  } catch {
    res.json([]);
  }
});

// GET ROUTES
async function getRoutes() {
  const res = await fetch(SHEET_URL);
  const data = await res.json();

  return data
    .filter(r => r["EU Port"] && r["FI Port"] && r["Total"])
    .map(r => ({
      eu: r["EU Port"],
      fi: r["FI Port"],
      ferry: parseFloat(r["Total"])
    }));
}

// GOOGLE ROUTE
async function getRouteData(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes.length) return null;

    const leg = data.routes[0].legs[0];

    return {
      distance: leg.distance.value / 1000,
      duration: leg.duration.value / 3600
    };

  } catch {
    return null;
  }
}

// CALCULATE
app.post("/calculate", async (req, res) => {
  try {
    const { start, end, fuel, driver, tollRate, port } = req.body;

    const routes = await getRoutes();
    let results = [];

    for (const r of routes) {
      const leg1 = await getRouteData(start, r.eu);
      const leg2 = await getRouteData(r.fi, end);

      const distance1 = leg1 ? leg1.distance : 0;
      const distance2 = leg2 ? leg2.distance : 0;

      const time1 = leg1 ? leg1.duration : 0;
      const time2 = leg2 ? leg2.duration : 0;

      const distance = distance1 + distance2;
      const time = time1 + time2;

      const toll = distance1 * (parseFloat(tollRate) || 0.12);
      const fuelCost = distance * (fuel || 0.2);
      const driverCost = time * (driver || 20);

      const total = fuelCost + driverCost + toll + r.ferry;

      results.push({
        route: `${r.eu} → ${r.fi}`,
        distance,
        time,
        toll,
        ferry: r.ferry,
        total
      });
    }

    results.sort((a, b) => a.total - b.total);

    const best = results[0];

    let selected = null;
    if (port) {
      selected = results.find(r =>
        r.route.toLowerCase().includes(port.toLowerCase())
      );
    }

    let finalRoutes = [best];

    if (selected && selected.route !== best.route) {
      finalRoutes.push(selected);
    }

    for (let r of results) {
      if (finalRoutes.length >= 3) break;
      if (!finalRoutes.find(fr => fr.route === r.route)) {
        finalRoutes.push(r);
      }
    }

    res.json(finalRoutes);

  } catch (err) {
    console.log(err);
    res.json([]);
  }
});

app.listen(3000, () => console.log("Server running"));