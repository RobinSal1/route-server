const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY;



let typingTimer;

function autoComplete(inputElement, listId) {
  const value = inputElement.value;

  clearTimeout(typingTimer);

  if (value.length < 3) {
    document.getElementById(listId).innerHTML = "";
    return;
  }

  // ⏳ Show loading
  document.getElementById(listId).innerHTML = "<div style='padding:5px;'>Loading...</div>";

  typingTimer = setTimeout(() => {
    google.script.run.withSuccessHandler(data => {
      let html = "";

      // 🔥 limit results to 5
      data.slice(0, 5).forEach(item => {
        html += `<div onclick="selectOption('${item}', '${inputElement.id}', '${listId}')"
                  style="padding:8px; cursor:pointer; border-bottom:1px solid #eee;"
                  onmouseover="this.style.background='#f5f5f5'"
                  onmouseout="this.style.background='white'">
                  ${item}
                </div>`;
      });

      document.getElementById(listId).innerHTML = html;
    }).getAutocomplete(value);
  }, 300);
}
app.get("/", (req, res) => {
  res.send("Server works!");
});

// Ports
const routes = [
  { eu: "Rotterdam", fi: "Helsinki", ferry: 300 },
  { eu: "Hamburg", fi: "Turku", ferry: 280 }
];

app.post("/calculate", async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end" });
  }

  console.log("Request:", start, "→", end);

  let results = [];

  for (const r of routes) {
    try {
      const url1 = `https://maps.googleapis.com/maps/api/directions/json?origin=${start}&destination=${r.eu}&key=${API_KEY}`;
      const url2 = `https://maps.googleapis.com/maps/api/directions/json?origin=${r.fi}&destination=${end}&key=${API_KEY}`;

      const [res1, res2] = await Promise.all([
        fetch(url1).then(r => r.json()),
        fetch(url2).then(r => r.json())
      ]);

      if (!res1.routes.length || !res2.routes.length) {
        console.log("No route found for:", r);
        continue;
      }

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
      console.log("Error:", err);
    }
  }

  results.sort((a, b) => a.total - b.total);

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));