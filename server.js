const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;

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
    const response = await fetch(url).then(r => r.json());
    const results = response.predictions.map(p => p.description);
    res.json(results);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// LOAD ROUTES
const routes = require("./routes.json");

// 🔥 GOOGLE ROUTES API FUNCTION
async function getRouteData(origin, destination) {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: "DRIVE",
    extraComputations: ["TOLLS"]
  };

  try {
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

    // ✅ SAFE TOLL
    let toll = 0;
    const tollInfo = route.travelAdvisory?.tollInfo;

    if (tollInfo?.estimatedPrice?.length) {
      const price = tollInfo.estimatedPrice[0];

      const units = Number(price.units);
      const nanos = Number(price.nanos) / 1e9;

      if (!isNaN(units)) {
        toll = units + (isNaN(nanos) ? 0 : nanos);
      }
    }

    return {
      distance,
      duration,
      toll
    };

  } catch (err) {
    console.log("Route API error:", err);
    return null;
  }
}

// ✅ MAIN CALCULATION
app.post("/calculate", async (req, res) => {
  const { start, end, fuel, driver } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end" });
  }

  try {
    const results = await Promise.all(
      routes.slice(0, 5).map(async (r) => {
        try {
          const [leg1, leg2] = await Promise.all([
            getRouteData(start, r.eu),
            getRouteData(r.fi, end)
          ]);

          if (!leg1 || !leg2) return null;

          const distance = leg1.distance + leg2.distance;
          const time = leg1.duration + leg2.duration;
          const toll = (leg1.toll || 0) + (leg2.toll || 0);

          const fuelCost = distance * (fuel || 0.2);
          const driverCost = time * (driver || 20);
          const ferryCost = r.total || r.ferry;

          return {
            route: `${r.eu} → ${r.fi}`,
            distance,
            time,
            toll,
            total: fuelCost + driverCost + ferryCost + toll
          };
        } catch (err) {
          console.log("Route error:", err);
          return null;
        }
      })
    );

    const filtered = results.filter(r => r);
    filtered.sort((a, b) => a.total - b.total);

    res.json(filtered);

  } catch (err) {
    console.log("Calculation error:", err);
    res.status(500).json({ error: "Calculation failed" });
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));