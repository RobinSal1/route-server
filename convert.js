const XLSX = require("xlsx");
const fs = require("fs");

const workbook = XLSX.readFile("Merirahti excel.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log("DEBUG:", data[0]); // 👈 keep this for now

const routes = data
  .map(row => {
    const routeText = Object.values(row)[0]; // 👈 take first column automatically
    const ferry = Object.values(row)[1];     // 👈 second column

    if (!routeText) return null;

    const [ports] = routeText.split(" (");
    const [eu, fi] = ports.split("-");

    if (!eu || !fi) return null;

    return {
      eu: eu.trim(),
      fi: fi.trim(),
      ferry: Number(ferry) || 0
    };
  })
  .filter(r => r !== null);

fs.writeFileSync("routes.json", JSON.stringify(routes, null, 2));

console.log("✅ routes.json created!");