import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_TAX_RATE, STATE_INS_RATE, NON_HOMESTEAD_UPLIFT } from "./stateData.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const CACHE_FILE = path.join(__dirname, ".cache.json");
const CACHE_TTL = 1000 * 60 * 60 * 24 * 14; // RentCast calls are metered — keep lookups for 2 weeks

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
} catch {}
const saveCache = () => fs.writeFile(CACHE_FILE, JSON.stringify(cache), () => {});

async function cached(key, ttl, fn) {
  const hit = cache[key];
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  if (v !== undefined && v !== null) {
    cache[key] = { t: Date.now(), v };
    saveCache();
  }
  return v;
}

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "deal-underwriter/0.1", ...headers } });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`${new URL(url).host} ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

// ---------- Rates, Fed funds, inflation (FRED, no key) ----------
async function fredSeries(series) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 800).toISOString().slice(0, 10);
  return cached(`fred:${series}`, 1000 * 60 * 60 * 12, async () => {
    const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${since}`, {
      headers: { "User-Agent": "deal-underwriter/0.1", Accept: "*/*" },
    });
    if (!r.ok) return null;
    const rows = (await r.text())
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => l.split(","))
      .map(([date, v]) => ({ date, value: parseFloat(v) }))
      .filter((x) => !Number.isNaN(x.value));
    return rows.length ? rows : null;
  });
}

const last = (rows) => (rows ? rows[rows.length - 1] : null);

/** CPI-U year-over-year % from the latest monthly print. */
function cpiYoY(rows) {
  if (!rows || rows.length < 13) return null;
  const now = rows[rows.length - 1];
  const yearAgo = rows[rows.length - 13];
  return { date: now.date, value: +((now.value / yearAgo.value - 1) * 100).toFixed(2) };
}

async function rates() {
  const safe = (s) => fredSeries(s).catch(() => null);
  const [r30, r15, dff, cpi, tbill] = await Promise.all([safe("MORTGAGE30US"), safe("MORTGAGE15US"), safe("DFF"), safe("CPIAUCSL"), safe("DTB3")]);
  const infl = cpiYoY(cpi);
  return {
    thirtyYear: last(r30)?.value ?? 7.0,
    fifteenYear: last(r15)?.value ?? 6.25,
    asOf: last(r30)?.date ?? null,
    source: r30 ? "Freddie Mac PMMS (FRED)" : "default (FRED unavailable)",
    // Typical spreads over owner-occupied PMMS for investor products.
    investorSpread: 0.75,
    dscrSpread: 1.25,
    fedFunds: last(dff)?.value ?? null,
    fedFundsAsOf: last(dff)?.date ?? null,
    tbill3m: last(tbill)?.value ?? null,
    inflation: infl?.value ?? null,
    inflationAsOf: infl?.date ?? null,
  };
}

// ---------- Geocoding (US Census, no key) ----------
async function geocode(address) {
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" +
    new URLSearchParams({ address, benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "Census Tracts", format: "json" });
  const j = await cached(`geo:${address.toLowerCase()}`, CACHE_TTL, () => getJson(url));
  const m = j?.result?.addressMatches?.[0];
  if (!m) return null;
  const tract = m.geographies?.["Census Tracts"]?.[0];
  return {
    matchedAddress: m.matchedAddress,
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    state: m.addressComponents.state,
    zip: m.addressComponents.zip,
    stateFips: tract?.STATE,
    countyFips: tract?.COUNTY,
    tract: tract?.TRACT,
  };
}

// ---------- Census ACS (free key) ----------
async function acs(geo, key) {
  if (!key || !geo?.tract) return null;
  for (const year of [2024, 2023]) {
    try {
      return await acsYear(geo, key, year);
    } catch (e) {
      if (year === 2023) throw e;
    }
  }
}

async function acsYear(geo, key, year) {
  const base = `https://api.census.gov/data/${year}/acs/acs5`;
  const tractVars = ["B25064_001E", "B25077_001E", "B25031_002E", "B25031_003E", "B25031_004E", "B25031_005E", "B25031_006E", "B25031_007E"];
  const tq = new URLSearchParams({ get: tractVars.join(","), for: `tract:${geo.tract}`, in: `state:${geo.stateFips} county:${geo.countyFips}`, key });
  const cq = new URLSearchParams({ get: "NAME,B25103_001E,B25077_001E", for: `county:${geo.countyFips}`, in: `state:${geo.stateFips}`, key });
  const [t, c] = await Promise.all([
    cached(`acs${year}:t:${geo.stateFips}${geo.countyFips}${geo.tract}`, CACHE_TTL * 6, () => getJson(`${base}?${tq}`)),
    cached(`acs${year}:c:${geo.stateFips}${geo.countyFips}`, CACHE_TTL * 6, () => getJson(`${base}?${cq}`)),
  ]);
  const n = (v) => {
    const x = Number(v);
    return x > 0 ? x : null; // ACS uses large negatives for suppressed values
  };
  const tr = t?.[1] ?? [];
  const co = c?.[1] ?? [];
  const countyTax = n(co[1]);
  const countyValue = n(co[2]);
  return {
    vintage: `ACS ${year - 4}–${year} 5-yr`,
    tractMedianRent: n(tr[0]),
    tractMedianValue: n(tr[1]),
    rentByBeds: { 0: n(tr[2]), 1: n(tr[3]), 2: n(tr[4]), 3: n(tr[5]), 4: n(tr[6]), 5: n(tr[7]) },
    countyName: co[0],
    countyEffectiveTaxRate: countyTax && countyValue ? (countyTax / countyValue) * 100 : null,
  };
}

// ---------- RentCast (parcel record + AVMs + comps) ----------
async function rentcast(address, key) {
  if (!key) return null;
  const h = { "X-Api-Key": key };
  const q = encodeURIComponent(address);
  const k = address.toLowerCase();
  const [prop, value, rent] = await Promise.allSettled([
    cached(`rc:p:${k}`, CACHE_TTL, () => getJson(`https://api.rentcast.io/v1/properties?address=${q}`, h)),
    cached(`rc:v:${k}`, CACHE_TTL, () => getJson(`https://api.rentcast.io/v1/avm/value?address=${q}&compCount=10`, h)),
    cached(`rc:r:${k}`, CACHE_TTL, () => getJson(`https://api.rentcast.io/v1/avm/rent/long-term?address=${q}&compCount=10`, h)),
  ]);
  const errors = [prop, value, rent].filter((x) => x.status === "rejected").map((x) => String(x.reason?.message || x.reason));
  return {
    property: prop.status === "fulfilled" ? (Array.isArray(prop.value) ? prop.value[0] : prop.value) : null,
    value: value.status === "fulfilled" ? value.value : null,
    rent: rent.status === "fulfilled" ? rent.value : null,
    errors,
  };
}

const latestYear = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  const years = Object.keys(obj).filter((y) => /^\d{4}$/.test(y)).sort();
  return years.length ? obj[years[years.length - 1]] : null;
};

const comp = (c) => ({
  address: c.formattedAddress,
  price: c.price,
  beds: c.bedrooms,
  baths: c.bathrooms,
  sqft: c.squareFootage,
  yearBuilt: c.yearBuilt,
  distance: c.distance,
  daysOnMarket: c.daysOnMarket,
  date: c.removedDate || c.lastSeenDate || c.listedDate,
  status: c.status,
  correlation: c.correlation,
});

app.get("/api/rates", async (_req, res) => res.json(await rates()));

app.get("/api/lookup", async (req, res) => {
  const address = String(req.query.address || "").trim();
  if (address.length < 5) return res.status(400).json({ error: "Enter a full street address" });
  const rcKey = req.get("x-rentcast-key") || process.env.RENTCAST_API_KEY;
  const censusKey = req.get("x-census-key") || process.env.CENSUS_API_KEY;
  const warnings = [];
  const sources = [];

  try {
    const [geo, rc, rt] = await Promise.all([
      geocode(address).catch((e) => (warnings.push(`Geocoder: ${e.message}`), null)),
      rentcast(address, rcKey).catch((e) => (warnings.push(`RentCast: ${e.message}`), null)),
      rates(),
    ]);
    const census = await acs(geo, censusKey).catch((e) => (warnings.push(`Census ACS: ${e.message}`), null));
    if (rc?.errors?.length) warnings.push(...rc.errors.map((e) => `RentCast: ${e}`));
    if (!rcKey) warnings.push("No RentCast key — value, rent, taxes and comps fall back to area averages. Add one in Settings for parcel-level data.");

    const p = rc?.property;
    const state = p?.state || geo?.state || null;
    const units = p?.features?.unitCount || (p?.propertyType === "Duplex" ? 2 : p?.propertyType === "Triplex" ? 3 : p?.propertyType === "Quadruplex" ? 4 : 1);

    // ---- Value ----
    let value = null;
    if (rc?.value?.price) {
      value = { estimate: rc.value.price, low: rc.value.priceRangeLow, high: rc.value.priceRangeHigh, source: "RentCast AVM", comps: (rc.value.comparables || []).map(comp) };
      sources.push("RentCast value AVM");
    } else if (census?.tractMedianValue) {
      value = { estimate: census.tractMedianValue, low: null, high: null, source: `${census.vintage} tract median (not this house)`, comps: [] };
    }

    // ---- Rent (per unit from AVM) ----
    let rent = null;
    if (rc?.rent?.rent) {
      rent = { perUnit: rc.rent.rent, low: rc.rent.rentRangeLow, high: rc.rent.rentRangeHigh, source: "RentCast rent AVM", comps: (rc.rent.comparables || []).map(comp) };
      sources.push("RentCast rent AVM");
      if (units > 1) warnings.push(`Rent AVM is for a single unit; multiplied by ${units} units. Verify each unit's bed/bath mix.`);
    } else if (census) {
      const beds = Math.min(p?.bedrooms ?? 3, 5);
      const r = census.rentByBeds?.[beds] || census.tractMedianRent;
      if (r) rent = { perUnit: r, low: null, high: null, source: `${census.vintage} tract median gross rent (${beds}br, lagged, incl. utilities)`, comps: [] };
    }

    // ---- Taxes ----
    const taxBill = latestYear(p?.propertyTaxes);
    const assess = latestYear(p?.taxAssessments);
    let taxRate = null;
    let taxSource = "";
    if (taxBill?.total && value?.estimate && rc?.value?.price) {
      taxRate = (taxBill.total / value.estimate) * 100;
      taxSource = `Actual ${taxBill.year} bill ÷ AVM value`;
    } else if (census?.countyEffectiveTaxRate) {
      taxRate = census.countyEffectiveTaxRate;
      taxSource = `${census.countyName} median effective rate (ACS)`;
    } else if (state && STATE_TAX_RATE[state]) {
      taxRate = STATE_TAX_RATE[state];
      taxSource = `${state} state average effective rate`;
    }
    const uplift = state && NON_HOMESTEAD_UPLIFT[state];
    const fromInvestorBill = taxSource.startsWith("Actual") && p?.ownerOccupied === false;
    if (uplift && !fromInvestorBill) {
      warnings.push(`${state} taxes non-owner-occupied property higher than homestead. Tax rate bumped ${Math.round((uplift - 1) * 100)}% — confirm with the county assessor.`);
      taxRate = taxRate ? taxRate * uplift : taxRate;
      taxSource += ` × ${uplift} non-homestead`;
    }

    // ---- Insurance ----
    const insRate = (state && STATE_INS_RATE[state]) || 0.7;
    const insBase = value?.estimate || 250000;
    const insurance = { annual: Math.round((insBase * insRate) / 100), ratePct: insRate, source: `${state || "US"} average landlord premium estimate — get a real quote` };

    if (geo) sources.push("US Census geocoder");
    if (census) sources.push(census.vintage);
    sources.push(rt.source);

    res.json({
      input: address,
      address: p?.formattedAddress || geo?.matchedAddress || address,
      geo,
      property: p
        ? {
            type: p.propertyType,
            beds: p.bedrooms,
            baths: p.bathrooms,
            sqft: p.squareFootage,
            lotSize: p.lotSize,
            yearBuilt: p.yearBuilt,
            units,
            lastSalePrice: p.lastSalePrice,
            lastSaleDate: p.lastSaleDate,
            hoaMonthly: p.hoa?.fee ?? 0,
            ownerOccupied: p.ownerOccupied,
            ownerName: p.owner?.names?.join(", "),
            assessedValue: assess?.value ?? null,
            county: p.county,
          }
        : { units },
      value,
      rent,
      taxes: { annualActual: taxBill?.total ?? null, year: taxBill?.year ?? null, ratePct: taxRate, source: taxSource || "none" },
      insurance,
      census,
      rates: rt,
      sources,
      warnings,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Serve the built front end in production.
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => console.log(`Underwriter API on http://localhost:${PORT}`));
