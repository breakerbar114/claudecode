export interface Comp {
  address: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  distance?: number;
  daysOnMarket?: number;
  date?: string;
  status?: string;
  correlation?: number;
}

export interface Lookup {
  input: string;
  address: string;
  geo: { lat: number; lon: number; state: string; zip: string } | null;
  property: {
    type?: string;
    beds?: number;
    baths?: number;
    sqft?: number;
    lotSize?: number;
    yearBuilt?: number;
    units: number;
    lastSalePrice?: number;
    lastSaleDate?: string;
    hoaMonthly?: number;
    ownerOccupied?: boolean;
    ownerName?: string;
    assessedValue?: number | null;
    county?: string;
  };
  value: { estimate: number; low: number | null; high: number | null; source: string; comps: Comp[] } | null;
  rent: { perUnit: number; low: number | null; high: number | null; source: string; comps: Comp[] } | null;
  taxes: { annualActual: number | null; year: number | null; ratePct: number | null; source: string };
  insurance: { annual: number; ratePct: number; source: string };
  rates: Rates;
  sources: string[];
  warnings: string[];
}

export interface Rates {
  thirtyYear: number;
  fifteenYear: number;
  asOf: string | null;
  source: string;
  investorSpread: number;
  dscrSpread: number;
  fedFunds: number | null;
  fedFundsAsOf: string | null;
  tbill3m: number | null;
  inflation: number | null;
  inflationAsOf: string | null;
}

export interface Keys {
  rentcast: string;
  census: string;
}

function headers(keys: Keys): Record<string, string> {
  const h: Record<string, string> = {};
  if (keys.rentcast) h["x-rentcast-key"] = keys.rentcast;
  if (keys.census) h["x-census-key"] = keys.census;
  return h;
}

export async function lookup(address: string, keys: Keys): Promise<Lookup> {
  const r = await fetch(`/api/lookup?address=${encodeURIComponent(address)}`, { headers: headers(keys) });
  if (r.status === 401) {
    location.href = "/login";
    throw new Error("Signed out. Sign in again.");
  }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `Lookup failed (${r.status})`);
  return j;
}

/** Hosted (artifact) build: no server, so no live lookup. Rates are a snapshot baked in at build time. */
export const STATIC = import.meta.env.MODE === "artifact";
declare const __RATES_SNAPSHOT__: Rates | null;

export async function getRates(): Promise<Rates | null> {
  if (STATIC) return typeof __RATES_SNAPSHOT__ !== "undefined" ? __RATES_SNAPSHOT__ : null;
  try {
    const r = await fetch("/api/rates");
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

/** Width of the AVM range relative to the estimate → rough ± accuracy band. */
export function confidence(est?: number, low?: number | null, high?: number | null): { pct: number | null; label: string } {
  if (!est || !low || !high) return { pct: null, label: "Low — area average, verify" };
  const pct = ((high - low) / 2 / est) * 100;
  const label = pct <= 5 ? "High" : pct <= 10 ? "Good" : pct <= 15 ? "Fair" : "Low";
  return { pct, label: `${label} (±${pct.toFixed(1)}%)` };
}

export const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

export interface ServerStatus {
  rentcast: boolean;
  census: boolean;
  auth: boolean;
}

export async function getStatus(): Promise<ServerStatus | null> {
  if (STATIC) return null;
  try {
    const r = await fetch("/api/status");
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
