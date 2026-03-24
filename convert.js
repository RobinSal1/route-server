const XLSX = require("xlsx");
const fs = require("fs");

const workbook = XLSX.readFile("Merirahti excel.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log("DEBUG:", data[0]); // 👈 keep this for now

const routes = data
  .map(row => {
    const values = Object.values(row);

    const routeText = values[0];
    const ferry = Number(values[1]) || 0;
    const ets = Number(values[2]) || 0;
    const baf = Number(values[3]) || 0;
    const total = Number(values[5]) || 0;

    if (!routeText) return null;

    const [ports] = routeText.split(" (");
    const [eu, fi] = ports.split("-");

    if (!eu || !fi) return null;

    return {
      eu: eu.trim(),
      fi: fi.trim(),
      ferry,
      ets,
      baf,
      total
    };
  })
  .filter(r => r !== null);


fs.writeFileSync("routes.json", JSON.stringify(routes, null, 2));

console.log("✅ routes.json created!");