const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;

// 🔥 GOOGLE SHEET
const SHEET_ID = "1aatEh9g41NQ-xWiOvetmrtlmSpCNiXGtD0W4JMBpHx4";
const SHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;

// TEST
app.get("/", (req, res) => {
  res.send("Server works!");
});


// 🌍 AUTOCOMPLETE (EUROPE ONLY)
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
      "Slovenia","Croatia","Greece","Romania","Bulgaria","Ireland",
      "United Kingdom","Luxembourg"
    ];

    const results = data.predictions
      .map(p => p.description)
      .filter(place => europe.some(c => place.includes(c)));

    res.json(results.slice(0, 5));

  } catch (err) {
    console.log(err);
    res.json([]);
  }
});


// 🚢 GET PORTS (FROM SHEET)
app.get("/ports", async (req, res) => {
  try {
    const routes = await getRoutes();

    const ports = routes.map(r => ({
      label: `${r.eu} → ${r.fi}`,
      value: r.eu
    }));

    res.json(ports);

  } catch {
    res.json([]);
  }
});


// 📦 FETCH ROUTES FROM SHEET
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


// 🚗 GOOGLE DIRECTIONS
async function getRouteData(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || !data.routes.length) return null;

    const leg = data.routes[0].legs[0];

    return {
      distance: leg.distance.value / 1000,
      duration: leg.duration.value / 3600
    };

  } catch (err) {
    console.log("Route error:", err);
    return null;
  }
}


// 🔥 MAIN CALCULATION
app.post("/calculate", async (req, res) => {
  try {
    const { start, end, fuel, driver, tollRate, ports } = req.body;

    const routes = await getRoutes();
    let results = [];

    for (const r of routes) {
      try {
        const leg1 = await getRouteData(start, r.eu);
        const leg2 = await getRouteData(r.fi, end);

        const distance1 = leg1 ? leg1.distance : 0;
        const distance2 = leg2 ? leg2.distance : 0;

        const time1 = leg1 ? leg1.duration : 0;
        const time2 = leg2 ? leg2.duration : 0;

        const distance = distance1 + distance2;
        const time = time1 + time2;

        // 🔥 EU TOLL ONLY
        const safeToll = parseFloat(tollRate);
        const toll = distance1 * (isNaN(safeToll) ? 0.12 : safeToll);

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

      } catch (err) {
        console.log("Route calc error:", err);
      }
    }

    // SORT CHEAPEST
    results.sort((a, b) => a.total - b.total);

    const selectedPorts = ports || [];

results.sort((a, b) => a.total - b.total);

let finalRoutes = [];

// 🔍 FIND MATCHES
const selectedMatches = results.filter(r =>
  selectedPorts.some(p =>
    r.route.toLowerCase().includes(p.toLowerCase())
  )
);

// ✅ 0 SELECTED
if (selectedPorts.length === 0) {
  finalRoutes = results.slice(0, 3);
}

// ✅ 1 SELECTED
else if (selectedPorts.length === 1) {
  finalRoutes = [
    results[0],
    ...selectedMatches,
    ...results.filter(r => !selectedMatches.includes(r))
  ].slice(0, 3);
}

// ✅ 2 SELECTED
else if (selectedPorts.length === 2) {
  finalRoutes = [
    ...selectedMatches,
    results[0]
  ].slice(0, 3);
}

// ✅ 3 SELECTED
else if (selectedPorts.length === 3) {
  finalRoutes = selectedMatches.slice(0, 3);
}

res.json(finalRoutes);

  } catch (err) {
    console.log("FATAL:", err);
    res.json([]);
  }
});


// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));