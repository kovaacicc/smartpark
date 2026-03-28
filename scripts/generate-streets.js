/**
 * Generates a synthetic Zagreb-centric dataset for the parking heatmap.
 * Run: node scripts/generate-streets.js
 */
const fs = require("fs");
const path = require("path");

const center = { lat: 45.815, lon: 15.9819 };
const count = Number(process.env.STREET_COUNT) || 1200;
const names = [
  "Ilica",
  "Vlaška",
  "Maksimirska",
  "Savska",
  "Heinzelova",
  "Slavonska",
  "Zagrebačka",
  "Vukovarska",
  "Miramarska",
  "Trnjanska",
  "Zadarska",
  "Folnegovićeva",
  "Dubrovačka",
  "Zelengaj",
];

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x9e3779b9);

const streets = [];
for (let i = 0; i < count; i += 1) {
  const jitterLat = (rand() - 0.5) * 0.12;
  const jitterLon = (rand() - 0.5) * 0.14;
  const lat = center.lat + jitterLat;
  const lon = center.lon + jitterLon;
  const base = names[i % names.length];
  const street = `${base}${i % 7 === 0 ? ` ul. ${20 + (i % 80)}` : ""}`;
  const address_count = 3 + Math.floor(rand() * 40);
  const capacity = Math.max(8, Math.floor(rand() * 120) + address_count * 2);
  const occupancy = Math.min(0.98, Math.max(0.05, rand() * rand() * 0.95 + rand() * 0.25));
  const current_cars = Math.min(capacity, Math.floor(capacity * occupancy));
  streets.push({
    street,
    lat,
    lon,
    address_count,
    capacity,
    current_cars,
    occupancy: Math.round(occupancy * 1000) / 1000,
  });
}

const out = path.join(__dirname, "..", "public", "streets_with_parking.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(streets), "utf8");
console.log(`Wrote ${streets.length} streets to ${out}`);
