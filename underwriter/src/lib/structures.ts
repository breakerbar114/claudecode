import type { StructureId, Terms } from "./model";

export interface StructureInfo {
  id: StructureId;
  name: string;
  short: string;
  creative: boolean;
  blurb: string;
}

export const STRUCTURES: StructureInfo[] = [
  { id: "conventional", name: "Conventional", short: "Conv", creative: false, blurb: "25% down investor loan at market rate + investor spread." },
  { id: "dscr", name: "DSCR Loan", short: "DSCR", creative: false, blurb: "Qualifies on the property's rent, not your income. Higher rate, 1–2 pts." },
  { id: "fha", name: "FHA House Hack", short: "FHA", creative: false, blurb: "3.5% down on 1–4 units; you live in one for a year." },
  { id: "cash", name: "All Cash", short: "Cash", creative: false, blurb: "No debt. Baseline for the property's true yield (cap rate)." },
  { id: "subto", name: "Subject-To", short: "Sub-To", creative: true, blurb: "Take over the seller's existing low-rate mortgage; pay their equity in cash." },
  { id: "hybrid", name: "Hybrid (Sub-To + Seller Carry)", short: "Hybrid", creative: true, blurb: "Take over the existing loan and have the seller carry their equity as a 2nd." },
  { id: "sellerFinance", name: "Seller Finance", short: "Seller Fin", creative: true, blurb: "Free-and-clear seller becomes the bank. Their price, your terms." },
  { id: "morby", name: "Morby Method", short: "Morby", creative: true, blurb: "Bank/DSCR 1st for most of the price + seller carries the down payment as a 2nd." },
  { id: "brrrr", name: "BRRRR", short: "BRRRR", creative: false, blurb: "Hard money buy + rehab, cash-out refi on ARV, pull your cash back out." },
];

export function defaultTerms(id: StructureId, marketRate: number, price: number): Terms {
  const inv = +(marketRate + 0.75).toFixed(3);
  const base: Terms = {
    downPct: 25,
    ratePct: inv,
    amortYears: 30,
    pointsPct: 0,
    ioYears: 0,
    mipPct: 0.55,
    existingBalance: Math.round(price * 0.7),
    existingRatePct: 3.5,
    existingYearsLeft: 25,
    arrears: 0,
    sellerCarryPct: 0,
    sellerRatePct: 5,
    sellerAmortYears: 30,
    balloonYears: 7,
    sellerIO: false,
    bankLtvPct: 80,
    morbyCarryPct: 15,
    hmLtcPct: 90,
    hmRatePct: 12,
    hmPointsPct: 2,
    rehabMonths: 6,
    refiLtvPct: 75,
    refiRatePct: +(marketRate + 1.25).toFixed(3),
  };
  switch (id) {
    case "dscr":
      return { ...base, downPct: 20, ratePct: +(marketRate + 1.25).toFixed(3), pointsPct: 1.5 };
    case "fha":
      return { ...base, downPct: 3.5, ratePct: marketRate };
    case "hybrid":
      return { ...base, sellerCarryPct: 100, sellerRatePct: 0, sellerIO: false, sellerAmortYears: 20, balloonYears: 0 };
    case "sellerFinance":
      return { ...base, downPct: 10, sellerRatePct: 5, sellerAmortYears: 30, balloonYears: 7 };
    case "morby":
      return { ...base, ratePct: +(marketRate + 1.25).toFixed(3), pointsPct: 1.5, sellerRatePct: 0, sellerIO: true, balloonYears: 10 };
    default:
      return base;
  }
}
