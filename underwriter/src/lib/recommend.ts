// "Recommended" values: a fixed, defensible reference for each key assumption, derived from the property's facts and
// data, never from the slider's current position. Sliders can move away from it; the recommendation stays put.
import stateData from "../../shared/stateData.json";
import type { CompResult } from "./comps";

export type RecKey = "rent" | "taxRatePct" | "mgmtPct" | "vacancyPct" | "repairsPct" | "capexPct" | "insuranceAnnual";

export interface Rec {
  value: number;
  why: string;
  /** Which side of the recommendation counts as aggressive (makes the deal look better than it likely is). */
  aggressive: "above" | "below";
}

export interface RecInputs {
  units: number;
  state: string | null;
  yearBuilt?: number;
  marketValue: number;
  comps: CompResult | null;
  rentAvmPerUnit?: number | null;
  rentAvmSource?: string;
  /** Tax rate already worked out by the server from the actual bill / county / state. */
  lookupTaxRate?: number | null;
  lookupTaxSource?: string;
  lookupInsurance?: number | null;
  currentRent: number; // fallback for the management minimum when no rent recommendation exists
}

const TAX = stateData.taxRate as Record<string, number>;
const UPLIFT = stateData.nonHomesteadUplift as Record<string, number>;
const INS = stateData.insRate as Record<string, number>;

export function stateFromAddress(addr: string): string | null {
  const m = addr.toUpperCase().match(/\b([A-Z]{2})\b[\s,]*\d{5}(-\d{4})?\s*$/) || addr.toUpperCase().match(/,\s*([A-Z]{2})\s*$/);
  return m && TAX[m[1]] != null ? m[1] : null;
}

export function recommend(i: RecInputs): Partial<Record<RecKey, Rec>> {
  const r: Partial<Record<RecKey, Rec>> = {};
  const units = Math.max(1, i.units);

  // ---- Rent: comps first, AVM second ----
  if (i.comps?.recommended) {
    r.rent = {
      value: i.comps.recommended * units,
      why: `Weighted median of ${i.comps.used} adjusted rent comp${i.comps.used === 1 ? "" : "s"} ($${i.comps.recommended.toLocaleString()}/unit${units > 1 ? ` × ${units}` : ""}), ${i.comps.confidence.toLowerCase()} confidence`,
      aggressive: "above",
    };
  } else if (i.rentAvmPerUnit) {
    r.rent = { value: Math.round((i.rentAvmPerUnit * units) / 25) * 25, why: `${i.rentAvmSource ?? "Rent AVM"}; no usable comps yet`, aggressive: "above" };
  }

  // ---- Property tax: the investor's bill, reassessed at purchase ----
  if (i.lookupTaxRate) {
    r.taxRatePct = { value: +i.lookupTaxRate.toFixed(3), why: i.lookupTaxSource || "From property data", aggressive: "below" };
  } else if (i.state && TAX[i.state] != null) {
    const up = UPLIFT[i.state] ?? 1;
    r.taxRatePct = {
      value: +(TAX[i.state] * up).toFixed(3),
      why: `${i.state} average effective rate${up > 1 ? ` × ${up} for non-owner-occupied` : ""}. Check the county assessor for this parcel.`,
      aggressive: "below",
    };
  }

  // ---- Management: fee + leasing fees spread over the average tenancy, with the typical $100/door minimum ----
  const rentPerDoor = (r.rent?.value ?? i.currentRent) / units;
  const base = units >= 50 ? 5 : units >= 5 ? 7 : 9;
  const minFeePct = rentPerDoor > 0 ? (100 / rentPerDoor) * 100 : base;
  const fee = Math.max(base, Math.min(minFeePct, 15));
  // Leasing fee ≈ 50% of one month's rent, roughly every 24 months on 1–4 units (larger PMs fold it into the fee).
  const leasing = units >= 5 ? 0 : (0.5 / 24) * 100;
  r.mgmtPct = {
    value: +(fee + leasing).toFixed(1),
    why:
      `${fee.toFixed(1)}% monthly fee${fee > base ? " ($100/door minimum)" : ""}` +
      (leasing ? ` + ${leasing.toFixed(1)}% for leasing fees (½ month's rent every ~24 mo)` : "") +
      ". Budget it even if you self-manage.",
    aggressive: "below",
  };

  // ---- Vacancy & credit loss ----
  r.vacancyPct = {
    value: units >= 5 ? 6 : 7,
    why: units >= 5 ? "6% vacancy & credit loss for 5+ units" : "7%: about 3–4 weeks of turnover a year plus bad debt",
    aggressive: "below",
  };

  // ---- Repairs and CapEx by building age ----
  const yb = i.yearBuilt;
  const age = yb ? new Date().getFullYear() - yb : null;
  const [rep, cap] = age == null ? [7, 7] : age > 45 ? [9, 9] : age > 25 ? [7, 8] : age > 10 ? [6, 6] : [5, 5];
  const ageNote = age == null ? "age unknown, so mid-life assumptions" : `built ${yb} (${age} yrs old)`;
  r.repairsPct = { value: rep, why: `Repairs at ${rep}% of collected rent; ${ageNote}`, aggressive: "below" };
  r.capexPct = { value: cap, why: `Roof, HVAC, water heater and turnover reserves at ${cap}% of rent; ${ageNote}`, aggressive: "below" };

  // ---- Insurance ----
  if (i.lookupInsurance) {
    r.insuranceAnnual = { value: i.lookupInsurance, why: "State average landlord premium for this value. Get a real quote.", aggressive: "below" };
  } else if (i.state && INS[i.state] != null && i.marketValue > 0) {
    r.insuranceAnnual = {
      value: Math.round((i.marketValue * INS[i.state]) / 100 / 50) * 50,
      why: `${i.state} average landlord premium (${INS[i.state]}% of value). Get a real quote.`,
      aggressive: "below",
    };
  }
  return r;
}

/** How far a slider sits from its recommendation, and whether that direction flatters the deal. */
export function deviation(value: number, rec: Rec): { pct: number; aggressive: boolean } {
  const pct = rec.value ? ((value - rec.value) / rec.value) * 100 : 0;
  const aggressive = rec.aggressive === "above" ? pct > 2 : pct < -2;
  return { pct, aggressive };
}
