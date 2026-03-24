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

// ✅ AUTOCOMPLETE ENDPOINT
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

// Ports
const routes = [
  { eu: "Rotterdam", fi: "Helsinki", ferry: 300 },
  { eu: "Hamburg", fi: "Turku", ferry: 280 }
];

// ✅ MAIN CALCULATION
app.post("/calculate", async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end" });
  }

  let results = [];

  for (const r of routes) {
    try {
      const url1 = `https://maps.googleapis.com/maps/api/directions/json?origin=${start}&destination=${r.eu}&key=${API_KEY}`;
      const url2 = `https://maps.googleapis.com/maps/api/directions/json?origin=${r.fi}&destination=${end}&key=${API_KEY}`;

      const [res1, res2] = await Promise.all([
        fetch(url1).then(r => r.json()),
        fetch(url2).then(r => r.json())
      ]);

      if (!res1.routes.length || !res2.routes.length) continue;

      const leg1 = res1.routes[0].legs[0];
      const leg2 = res2.routes[0].legs[0];

      const distance = (leg1.distance.value + leg2.distance.value) / 1000;
      const time = (leg1.duration.value + leg2.duration.value) / 3600;

      const fuelCost = distance * 0.2;
      const total = fuelCost + r.ferry;

      results.push({
        route: `${r.eu} → ${r.fi}`,
        distance,
        time,
        total
      });

    } catch (err) {
      console.log(err);
    }
  }

  results.sort((a, b) => a.total - b.total);

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));