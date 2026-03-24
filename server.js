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

  typingTimer = setTimeout(() => {
    google.script.run.withSuccessHandler(data => {
      let html = "";

      data.forEach(item => {
        html += `<div onclick="selectOption('${item}', '${inputElement.id}', '${listId}')"
                  style="padding:6px; cursor:pointer; border-bottom:1px solid #eee;"
                  onmouseover="this.style.background='#f0f0f0'"
                  onmouseout="this.style.background='white'"
                  ${item}
                </div>`;
      });

      document.getElementById(listId).innerHTML = html;
    }).getAutocomplete(value);
  }, 300); // ⏱ wait 300ms after typing stops
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