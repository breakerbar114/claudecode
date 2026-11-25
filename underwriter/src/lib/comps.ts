// Rent comp analysis: adjust each comparable rental to the subject, weight it, take the weighted median.

export interface RentComp {
  id: string;
  address: string;
  rent: number; // monthly, per unit
  beds?: number;
  baths?: number;
  sqft?: number;
  distance?: number; // miles
  date?: string; // listed / last seen
  correlation?: number; // 0–1 similarity score from the data provider
  include: boolean;
  source: "rentcast" | "manual";
}

export interface Subject {
  beds?: number;
  baths?: number;
  sqft?: number;
}

export interface AdjustedComp extends RentComp {
  adjBeds: number;
  adjBaths: number;
  adjSqft: number;
  adjusted: number; // comp rent after adjustments
  grossAdjPct: number; // sum of |adjustments| / rent
  tooDifferent: boolean; // size off by >40% or 2+ bedrooms apart: not a real comp
  weight: number; // normalized 0–1 across included comps
}

export interface CompResult {
  comps: AdjustedComp[];
  used: number;
  recommended: number | null; // weighted median, rounded to $25
  low: number | null; // weighted 25th percentile
  high: number | null; // weighted 75th percentile
  spreadPct: number | null; // half the P25–P75 range as % of the recommendation
  confidence: "High" | "Good" | "Fair" | "Low" | "None";
}

// Adjustment rates, as a share of the comp's rent. Conservative mid-market values for 1–4 unit rentals.
const SQFT_ELASTICITY = 0.35; // +10% size ≈ +3.5% rent
const BED_PCT_WITH_SQFT = 0.04; // a bedroom is worth less once size is already adjusted
const BED_PCT_NO_SQFT = 0.08;
const BATH_PCT = 0.03;
const MAX_SQFT_ADJ = 0.15;
const MAX_GROSS_ADJ = 0.3; // comps needing more than 30% of adjustment are too different to use (also: >40% size gap or 2+ beds apart)

export function adjustComp(c: RentComp, s: Subject): Omit<AdjustedComp, "weight"> {
  const hasSqft = !!(s.sqft && c.sqft);
  const adjSqft = hasSqft ? c.rent * clamp(SQFT_ELASTICITY * ((s.sqft! - c.sqft!) / c.sqft!), -MAX_SQFT_ADJ, MAX_SQFT_ADJ) : 0;
  const bedDiff = s.beds != null && c.beds != null ? clamp(s.beds - c.beds, -2, 2) : 0;
  const adjBeds = c.rent * bedDiff * (hasSqft ? BED_PCT_WITH_SQFT : BED_PCT_NO_SQFT);
  const bathDiff = s.baths != null && c.baths != null ? clamp(s.baths - c.baths, -2, 2) : 0;
  const adjBaths = c.rent * bathDiff * BATH_PCT;
  const gross = (Math.abs(adjSqft) + Math.abs(adjBeds) + Math.abs(adjBaths)) / c.rent;
  const sizeGap = hasSqft ? Math.abs(s.sqft! - c.sqft!) / s.sqft! : 0;
  const bedGap = s.beds != null && c.beds != null ? Math.abs(s.beds - c.beds) : 0;
  const tooDifferent = gross > MAX_GROSS_ADJ || sizeGap > 0.4 || bedGap >= 2;
  return { ...c, adjSqft, adjBeds, adjBaths, adjusted: c.rent + adjSqft + adjBeds + adjBaths, grossAdjPct: gross * 100, tooDifferent };
}

function rawWeight(c: Omit<AdjustedComp, "weight">, now: number): number {
  if (!c.include || !(c.rent > 0) || c.tooDifferent) return 0;
  const similarity = c.correlation != null ? clamp(c.correlation, 0.3, 1) : 0.8;
  const dist = c.distance != null ? 1 / (1 + 1.5 * c.distance) : 0.6; // 0.5 mi → 0.57, 2 mi → 0.25
  const ageDays = c.date ? (now - new Date(c.date).getTime()) / 864e5 : 90;
  const recency = !Number.isFinite(ageDays) ? 0.8 : ageDays <= 120 ? 1 : ageDays <= 240 ? 0.8 : ageDays <= 365 ? 0.6 : 0.4;
  const adjPenalty = 1 - c.grossAdjPct / 100 / (MAX_GROSS_ADJ * 1.5);
  return similarity * dist * recency * adjPenalty;
}

function weightedQuantile(items: { v: number; w: number }[], q: number): number {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of sorted) {
    acc += x.w;
    if (acc >= q * total) return x.v;
  }
  return sorted[sorted.length - 1].v;
}

export function runComps(comps: RentComp[], subject: Subject, now = Date.now()): CompResult {
  const adj = comps.map((c) => adjustComp(c, subject));
  const raw = adj.map((c) => rawWeight(c, now));
  const total = raw.reduce((s, w) => s + w, 0);
  const out: AdjustedComp[] = adj.map((c, i) => ({ ...c, weight: total > 0 ? raw[i] / total : 0 }));
  const pts = out.filter((c) => c.weight > 0).map((c) => ({ v: c.adjusted, w: c.weight }));
  if (!pts.length) return { comps: out, used: 0, recommended: null, low: null, high: null, spreadPct: null, confidence: "None" };
  const med = weightedQuantile(pts, 0.5);
  const low = weightedQuantile(pts, 0.25);
  const high = weightedQuantile(pts, 0.75);
  const recommended = Math.round(med / 25) * 25;
  const spreadPct = ((high - low) / 2 / med) * 100;
  const n = pts.length;
  const confidence = n >= 5 && spreadPct <= 6 ? "High" : n >= 3 && spreadPct <= 10 ? "Good" : n >= 2 && spreadPct <= 15 ? "Fair" : "Low";
  return { comps: out, used: n, recommended, low: Math.round(low), high: Math.round(high), spreadPct, confidence };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
