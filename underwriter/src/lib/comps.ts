// Comp analysis for rents and sale prices: adjust each comparable to the subject, weight it, take the weighted median.

export type CompKind = "rent" | "sale";

export interface Comp {
  id: string;
  address: string;
  amount: number; // monthly rent per unit, or sale/list price
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  distance?: number; // miles
  date?: string; // listed / sold / last seen
  status?: string;
  correlation?: number; // 0–1 similarity score from the data provider
  include: boolean;
  source: "rentcast" | "manual";
}
/** @deprecated name kept for older imports */
export type RentComp = Comp;

export interface Subject {
  beds?: number;
  baths?: number;
  sqft?: number;
}

export interface AdjustedComp extends Comp {
  adjBeds: number;
  adjBaths: number;
  adjSqft: number;
  adjusted: number; // comp amount after adjustments
  grossAdjPct: number; // sum of |adjustments| / amount
  tooDifferent: boolean; // size off by >40% or 2+ bedrooms apart: not a real comp
  weight: number; // normalized 0–1 across included comps
}

export interface CompResult {
  kind: CompKind;
  comps: AdjustedComp[];
  used: number;
  recommended: number | null; // weighted median, rounded ($25 rent / $1,000 price)
  low: number | null; // weighted 25th percentile
  high: number | null; // weighted 75th percentile
  spreadPct: number | null; // half the P25–P75 range as % of the recommendation
  confidence: "High" | "Good" | "Fair" | "Low" | "None";
}

/**
 * Adjustment rates as a share of the comp's amount. Price is more sensitive to size than rent is,
 * and sale comps stay relevant longer than rental listings.
 */
export const PROFILES: Record<CompKind, { sqft: number; bedWithSqft: number; bedNoSqft: number; bath: number; maxSqft: number; round: number; recencyDays: [number, number, number] }> = {
  rent: { sqft: 0.35, bedWithSqft: 0.04, bedNoSqft: 0.08, bath: 0.03, maxSqft: 0.15, round: 25, recencyDays: [120, 240, 365] },
  sale: { sqft: 0.6, bedWithSqft: 0.02, bedNoSqft: 0.08, bath: 0.025, maxSqft: 0.2, round: 1000, recencyDays: [180, 365, 540] },
};
const MAX_GROSS_ADJ = 0.3; // comps needing more than 30% of adjustment are too different to use (also: >40% size gap or 2+ beds apart)

export function adjustComp(c: Comp, s: Subject, kind: CompKind = "rent"): Omit<AdjustedComp, "weight"> {
  const P = PROFILES[kind];
  const hasSqft = !!(s.sqft && c.sqft);
  const adjSqft = hasSqft ? c.amount * clamp(P.sqft * ((s.sqft! - c.sqft!) / c.sqft!), -P.maxSqft, P.maxSqft) : 0;
  const bedDiff = s.beds != null && c.beds != null ? clamp(s.beds - c.beds, -2, 2) : 0;
  const adjBeds = c.amount * bedDiff * (hasSqft ? P.bedWithSqft : P.bedNoSqft);
  const bathDiff = s.baths != null && c.baths != null ? clamp(s.baths - c.baths, -2, 2) : 0;
  const adjBaths = c.amount * bathDiff * P.bath;
  const gross = (Math.abs(adjSqft) + Math.abs(adjBeds) + Math.abs(adjBaths)) / c.amount;
  const sizeGap = hasSqft ? Math.abs(s.sqft! - c.sqft!) / s.sqft! : 0;
  const bedGap = s.beds != null && c.beds != null ? Math.abs(s.beds - c.beds) : 0;
  const tooDifferent = gross > MAX_GROSS_ADJ || sizeGap > 0.4 || bedGap >= 2;
  return { ...c, adjSqft, adjBeds, adjBaths, adjusted: c.amount + adjSqft + adjBeds + adjBaths, grossAdjPct: gross * 100, tooDifferent };
}

function rawWeight(c: Omit<AdjustedComp, "weight">, now: number, kind: CompKind): number {
  if (!c.include || !(c.amount > 0) || c.tooDifferent) return 0;
  const [d1, d2, d3] = PROFILES[kind].recencyDays;
  const similarity = c.correlation != null ? clamp(c.correlation, 0.3, 1) : 0.8;
  const dist = c.distance != null ? 1 / (1 + 1.5 * c.distance) : 0.6; // 0.5 mi → 0.57, 2 mi → 0.25
  const ageDays = c.date ? (now - new Date(c.date).getTime()) / 864e5 : 90;
  const recency = !Number.isFinite(ageDays) ? 0.8 : ageDays <= d1 ? 1 : ageDays <= d2 ? 0.8 : ageDays <= d3 ? 0.6 : 0.4;
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

export function runComps(comps: Comp[], subject: Subject, now = Date.now(), kind: CompKind = "rent"): CompResult {
  const adj = comps.map((c) => adjustComp(c, subject, kind));
  const raw = adj.map((c) => rawWeight(c, now, kind));
  const total = raw.reduce((s, w) => s + w, 0);
  const out: AdjustedComp[] = adj.map((c, i) => ({ ...c, weight: total > 0 ? raw[i] / total : 0 }));
  const pts = out.filter((c) => c.weight > 0).map((c) => ({ v: c.adjusted, w: c.weight }));
  if (!pts.length) return { kind, comps: out, used: 0, recommended: null, low: null, high: null, spreadPct: null, confidence: "None" };
  const med = weightedQuantile(pts, 0.5);
  const low = weightedQuantile(pts, 0.25);
  const high = weightedQuantile(pts, 0.75);
  const step = PROFILES[kind].round;
  const recommended = Math.round(med / step) * step;
  const spreadPct = ((high - low) / 2 / med) * 100;
  const n = pts.length;
  const confidence = n >= 5 && spreadPct <= 6 ? "High" : n >= 3 && spreadPct <= 10 ? "Good" : n >= 2 && spreadPct <= 15 ? "Fair" : "Low";
  return { kind, comps: out, used: n, recommended, low: Math.round(low), high: Math.round(high), spreadPct, confidence };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
