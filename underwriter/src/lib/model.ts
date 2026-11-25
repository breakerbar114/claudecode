import { Loan, initialPayment, irr, schedule } from "./finance";

export type StructureId =
  | "conventional"
  | "dscr"
  | "fha"
  | "cash"
  | "subto"
  | "hybrid"
  | "sellerFinance"
  | "morby"
  | "brrrr";

/** Property + operating assumptions shared by every structure. */
export interface Deal {
  price: number;
  marketValue: number; // AVM / as-is value
  arv: number; // after-repair value (BRRRR / exit)
  units: number;
  rent: number; // total monthly gross scheduled rent
  otherIncome: number; // monthly (laundry, pet, parking…)
  vacancyPct: number;
  mgmtPct: number;
  repairsPct: number;
  capexPct: number;
  taxRatePct: number; // effective rate applied to price when reassessing
  taxesAnnualActual: number; // current tax bill
  reassessTaxes: boolean; // Ken: underwrite taxes at YOUR price, not the seller's
  insuranceAnnual: number;
  hoaMonthly: number;
  utilitiesMonthly: number;
  otherExpMonthly: number;
  closingCostPct: number;
  rehab: number;
  marketRatePct: number; // today's 30-yr fixed (FRED)
  rentGrowthPct: number;
  expenseGrowthPct: number;
  appreciationPct: number;
  holdYears: number;
  sellingCostPct: number;
  inflationPct: number; // CPI-U year over year
  riskFreePct: number; // effective Fed funds rate — what idle cash earns in T-bills / money market
}

/** Financing knobs. Every structure reads the subset it needs. */
export interface Terms {
  downPct: number;
  ratePct: number;
  amortYears: number;
  pointsPct: number;
  ioYears: number;
  // FHA
  mipPct: number;
  // Subject-To / Hybrid (existing loan stays in seller's name)
  existingBalance: number;
  existingRatePct: number;
  existingYearsLeft: number;
  arrears: number;
  sellerCarryPct: number; // % of seller's equity carried back as a note
  // Seller finance / seller carry note
  sellerRatePct: number;
  sellerAmortYears: number;
  balloonYears: number; // 0 = none
  sellerIO: boolean;
  // Morby method: bank 1st + seller-carried 2nd for the down payment
  bankLtvPct: number;
  morbyCarryPct: number; // % of price seller carries in 2nd position
  // BRRRR
  hmLtcPct: number;
  hmRatePct: number;
  hmPointsPct: number;
  rehabMonths: number;
  refiLtvPct: number;
  refiRatePct: number;
}

export interface Financing {
  loans: Loan[];
  cashToClose: number; // buyer cash at close incl. rehab
  notes: string[];
  /** For BRRRR: cash left in deal after refi (replaces cashToClose for returns). */
  cashLeftInDeal?: number;
  holdingCosts?: number;
}

export interface Result {
  structure: StructureId;
  price: number;
  gsi: number; // monthly
  egi: number; // monthly effective gross income
  opex: number; // monthly
  opexLines: { label: string; monthly: number }[];
  noi: number; // monthly
  debtService: number; // monthly
  cashFlow: number; // monthly
  cashInvested: number;
  capRate: number; // %
  coc: number; // %
  dscr: number;
  breakEvenOcc: number; // %
  expenseRatio: number; // % of EGI
  loanConstant: number; // % annual debt service / total debt
  onePct: number; // monthly rent / price %
  grm: number;
  irr: number;
  equityMultiple: number;
  totalProfit: number;
  financing: Financing;
  projection: YearRow[];
  stress: { cashFlow: number; dscr: number };
}

export interface YearRow {
  year: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  loanBalance: number;
  value: number;
  equity: number;
}

const closing = (d: Deal, p: number) => (p * d.closingCostPct) / 100;

export function finance(id: StructureId, d: Deal, t: Terms, price = d.price): Financing {
  const cc = closing(d, price);
  const notes: string[] = [];
  switch (id) {
    case "cash":
      return { loans: [], cashToClose: price + cc + d.rehab, notes: ["All cash. No debt service, lowest risk, lowest return on equity."] };

    case "conventional":
    case "dscr": {
      const loanAmt = price * (1 - t.downPct / 100);
      const pts = (loanAmt * t.pointsPct) / 100;
      if (id === "dscr") notes.push("DSCR lenders typically require DSCR ≥ 1.20–1.25 on market rent; qualifies on the property, not your W-2.");
      else notes.push("Conventional investor loan: 15–25% down, max 10 financed properties.");
      return {
        loans: [{ name: id === "dscr" ? "DSCR loan" : "Conventional", lien: "1st", principal: loanAmt, ratePct: t.ratePct, amortYears: t.amortYears, ioMonths: t.ioYears * 12 }],
        cashToClose: price - loanAmt + cc + pts + d.rehab,
        notes,
      };
    }

    case "fha": {
      const base = price * (1 - t.downPct / 100);
      const ufmip = base * 0.0175;
      const loanAmt = base + ufmip;
      notes.push("FHA requires owner-occupancy for 12 months (1–4 units). 1.75% UFMIP financed; annual MIP included in payment.");
      return {
        loans: [{ name: "FHA", lien: "1st", principal: loanAmt, ratePct: t.ratePct, amortYears: 30, extraMonthly: (base * t.mipPct) / 1200 }],
        cashToClose: price - base + cc + d.rehab,
        notes,
      };
    }

    case "subto":
    case "hybrid": {
      const equity = Math.max(0, price - t.existingBalance);
      const carry = (equity * t.sellerCarryPct) / 100;
      const cashToSeller = equity - carry;
      const loans: Loan[] = [
        { name: "Existing loan (subject-to)", lien: "1st", principal: t.existingBalance, ratePct: t.existingRatePct, amortYears: t.existingYearsLeft },
      ];
      if (carry > 0)
        loans.push(sellerNote("Seller carry (equity)", "2nd", carry, t, d));
      notes.push(
        `Take over the seller's ${t.existingRatePct}% loan. Seller equity $${fmt(equity)}: $${fmt(cashToSeller)} cash, $${fmt(carry)} carried.`,
        "Due-on-sale clause risk: lender may call the loan. Keep payments current, use a servicer, and keep insurance properly endorsed.",
      );
      if (price < t.existingBalance) notes.push("Price is below the loan balance — seller would need to bring cash or short-sale.");
      return { loans, cashToClose: cashToSeller + t.arrears + cc + d.rehab, notes };
    }

    case "sellerFinance": {
      const down = (price * t.downPct) / 100;
      notes.push(
        `Seller is the bank: ${t.downPct}% down, ${t.sellerRatePct}% ${t.sellerIO ? "interest-only" : `amortized over ${t.sellerAmortYears} yrs`}${t.balloonYears ? `, balloon in ${t.balloonYears} yrs` : ""}.`,
        "Works best with free-and-clear sellers. Negotiate price OR terms — give them their price, you set the terms.",
      );
      return { loans: [sellerNote("Seller note", "1st", price - down, t, d)], cashToClose: down + cc + d.rehab, notes };
    }

    case "morby": {
      const bank = (price * t.bankLtvPct) / 100;
      const carry = (price * t.morbyCarryPct) / 100;
      const buyerDown = Math.max(0, price - bank - carry);
      const pts = (bank * t.pointsPct) / 100;
      notes.push(
        `Bank/DSCR 1st at ${t.bankLtvPct}% LTV + seller carries ${t.morbyCarryPct}% as a 2nd = ${fmt(buyerDown)} buyer down.`,
        "Confirm your lender allows subordinate seller financing (many DSCR lenders cap CLTV at 85–90%).",
      );
      return {
        loans: [
          { name: "Bank / DSCR 1st", lien: "1st", principal: bank, ratePct: t.ratePct, amortYears: t.amortYears },
          sellerNote("Seller carry 2nd", "2nd", carry, t, d),
        ],
        cashToClose: buyerDown + cc + pts + d.rehab,
        notes,
      };
    }

    case "brrrr": {
      const totalCost = price + d.rehab;
      const hm = (totalCost * t.hmLtcPct) / 100;
      const hmPts = (hm * t.hmPointsPct) / 100;
      const hmInterest = ((hm * t.hmRatePct) / 1200) * t.rehabMonths;
      const carryCosts = t.rehabMonths * (taxesMonthly(d, price) + d.insuranceAnnual / 12 + d.utilitiesMonthly);
      const cashIn = totalCost - hm + cc + hmPts + hmInterest + carryCosts;
      const refi = (d.arv * t.refiLtvPct) / 100;
      const refiCosts = refi * 0.02;
      const cashLeft = cashIn - (refi - hm - refiCosts);
      notes.push(
        `Buy + rehab with hard money (${t.hmLtcPct}% LTC), refi at ${t.refiLtvPct}% of $${fmt(d.arv)} ARV after ${t.rehabMonths} mo.`,
        cashLeft <= 0 ? `All cash back out at refi (+$${fmt(-cashLeft)}). Infinite return.` : `$${fmt(cashLeft)} stays in the deal after refi.`,
        "Most lenders require 6-month seasoning before cash-out refi on ARV.",
      );
      return {
        loans: [{ name: "Cash-out refi", lien: "1st", principal: refi, ratePct: t.refiRatePct, amortYears: 30 }],
        cashToClose: cashIn,
        cashLeftInDeal: cashLeft,
        holdingCosts: hmInterest + carryCosts + hmPts,
        notes,
      };
    }
  }
}

function sellerNote(name: string, lien: string, principal: number, t: Terms, d: Deal): Loan {
  return {
    name,
    lien,
    principal,
    ratePct: t.sellerRatePct,
    amortYears: t.sellerAmortYears,
    ioMonths: t.sellerIO ? (t.balloonYears || 30) * 12 : 0,
    balloonMonths: t.balloonYears ? t.balloonYears * 12 : undefined,
    refiRatePct: d.marketRatePct + 0.75,
  };
}

export function taxesMonthly(d: Deal, price: number): number {
  return (d.reassessTaxes ? (price * d.taxRatePct) / 100 : d.taxesAnnualActual) / 12;
}

function operating(d: Deal, price: number, rentMult = 1, vacAdd = 0, expMult = 1) {
  const gsi = (d.rent * rentMult + d.otherIncome);
  const egi = gsi * (1 - (d.vacancyPct + vacAdd) / 100);
  const rentEgi = d.rent * rentMult * (1 - (d.vacancyPct + vacAdd) / 100);
  const lines = [
    { label: "Property taxes", monthly: taxesMonthly(d, price) },
    { label: "Insurance", monthly: d.insuranceAnnual / 12 },
    { label: "Management", monthly: (egi * d.mgmtPct) / 100 },
    { label: "Repairs & maintenance", monthly: (rentEgi * d.repairsPct) / 100 },
    { label: "CapEx reserves", monthly: (d.rent * rentMult * d.capexPct) / 100 },
    { label: "HOA", monthly: d.hoaMonthly },
    { label: "Utilities (owner-paid)", monthly: d.utilitiesMonthly },
    { label: "Other", monthly: d.otherExpMonthly },
  ].map((l) => ({ ...l, monthly: l.monthly * expMult }));
  const opex = lines.reduce((s, l) => s + l.monthly, 0);
  return { gsi, egi, opex, lines, noi: egi - opex };
}

export function underwrite(id: StructureId, d: Deal, t: Terms, price = d.price, light = false): Result {
  const fin = finance(id, d, t, price);
  const op = operating(d, price);
  const debtService = fin.loans.reduce((s, l) => s + initialPayment(l), 0);
  const cashFlow = op.noi - debtService;
  const cashInvested = fin.cashLeftInDeal !== undefined ? Math.max(fin.cashLeftInDeal, 0) : fin.cashToClose;
  const totalDebt = fin.loans.reduce((s, l) => s + l.principal, 0);
  const basis = price + d.rehab;

  // Stress test, Ken-style: rents -5%, vacancy +5 pts, expenses +10%.
  const st = operating(d, price, 0.95, 5, 1.1);

  const fixedOpex = op.opex - op.lines.filter((l) => l.label === "Management").reduce((s, l) => s + l.monthly, 0);

  const projection = light ? [] : project(d, fin, price);
  const sale = projection[projection.length - 1];
  const saleNet = sale ? sale.value * (1 - d.sellingCostPct / 100) - sale.loanBalance : 0;
  const flows = [-(fin.cashLeftInDeal !== undefined ? fin.cashLeftInDeal : fin.cashToClose), ...projection.map((y) => y.cashFlow)];
  if (flows.length > 1) flows[flows.length - 1] += saleNet;
  const totalReturned = flows.slice(1).reduce((s, v) => s + v, 0);

  return {
    structure: id,
    price,
    gsi: op.gsi,
    egi: op.egi,
    opex: op.opex,
    opexLines: op.lines,
    noi: op.noi,
    debtService,
    cashFlow,
    cashInvested,
    capRate: basis > 0 ? ((op.noi * 12) / basis) * 100 : 0,
    coc: cashInvested > 0 ? ((cashFlow * 12) / cashInvested) * 100 : cashFlow > 0 ? Infinity : -Infinity,
    dscr: debtService > 0 ? op.noi / debtService : Infinity,
    breakEvenOcc: op.gsi > 0 ? ((fixedOpex + debtService) / (op.gsi * (1 - d.mgmtPct / 100))) * 100 : 0,
    expenseRatio: op.egi > 0 ? (op.opex / op.egi) * 100 : 0,
    loanConstant: totalDebt > 0 ? ((debtService * 12) / totalDebt) * 100 : 0,
    onePct: price > 0 ? (d.rent / price) * 100 : 0,
    grm: d.rent > 0 ? price / (d.rent * 12) : 0,
    irr: light ? NaN : irr(flows),
    equityMultiple: cashInvested > 0 ? totalReturned / cashInvested : Infinity,
    totalProfit: totalReturned - Math.max(cashInvested, 0),
    financing: fin,
    projection,
    stress: { cashFlow: st.noi - debtService, dscr: debtService > 0 ? st.noi / debtService : Infinity },
  };
}

function project(d: Deal, fin: Financing, price: number): YearRow[] {
  const months = d.holdYears * 12;
  const scheds = fin.loans.map((l) => schedule(l, months));
  const rows: YearRow[] = [];
  const baseValue = d.arv > 0 && d.rehab > 0 ? d.arv : d.marketValue || price;
  for (let y = 1; y <= d.holdYears; y++) {
    const g = Math.pow(1 + d.rentGrowthPct / 100, y - 1);
    const eg = Math.pow(1 + d.expenseGrowthPct / 100, y - 1);
    const op = operating({ ...d, otherIncome: d.otherIncome * g }, price, g, 0, 1);
    // percentage-based lines grow with rent already; scale fixed lines by expense growth
    const fixed = op.lines.filter((l) => !["Management", "Repairs & maintenance", "CapEx reserves"].includes(l.label)).reduce((s, l) => s + l.monthly, 0);
    const noi = op.noi - fixed * (eg - 1);
    let ds = 0;
    let bal = 0;
    for (const s of scheds) {
      for (let m = (y - 1) * 12; m < y * 12; m++) ds += s[m]?.payment ?? 0;
      bal += s[y * 12 - 1]?.balance ?? 0;
    }
    const value = baseValue * Math.pow(1 + d.appreciationPct / 100, y);
    rows.push({ year: y, noi: noi * 12, debtService: ds, cashFlow: noi * 12 - ds, loanBalance: bal, value, equity: value - bal });
  }
  return rows;
}

export interface Targets {
  minCashFlow: number; // $/door/month
  minDscr: number;
  minCoc: number; // %
  useDscr: boolean;
  useCoc: boolean;
  /** BRRRR only: most cash you're willing to leave in after the refi. */
  maxCashLeft: number;
  /** Cash-on-cash must at least match inflation, so cash flow isn't shrinking in real terms. */
  beatInflation: boolean;
  /** All-cash buys: the yield the cash must earn to justify the property over the alternative. */
  cashHurdle: "inflation" | "fed" | "fedPlus";
  cashPremiumPct: number; // added to the Fed rate for "fedPlus"
  /** Internal: price a hurdle on its own, without the inflation floor (used for the comparison ladder). */
  noInflationFloor?: boolean;
}

export const HURDLE_LABEL: Record<Targets["cashHurdle"], string> = {
  inflation: "beats inflation",
  fed: "beats the Fed rate",
  fedPlus: "beats the Fed rate + premium",
};

/** The cash-on-cash floor a deal must clear under these targets. */
export function requiredCoc(id: StructureId, d: Deal, tg: Targets): number {
  let req = -Infinity;
  if (tg.useCoc) req = Math.max(req, tg.minCoc);
  if (tg.beatInflation && !tg.noInflationFloor) req = Math.max(req, d.inflationPct);
  if (id === "cash") {
    const h = tg.cashHurdle === "inflation" ? d.inflationPct : tg.cashHurdle === "fed" ? d.riskFreePct : d.riskFreePct + tg.cashPremiumPct;
    // Never let an all-cash hurdle fall below zero real return.
    req = Math.max(req, h, tg.noInflationFloor ? -Infinity : d.inflationPct);
  }
  return req;
}

export function meetsTargets(r: Result, tg: Targets, d: Deal): boolean {
  if (r.cashFlow < tg.minCashFlow * d.units - 1e-6) return false;
  if (tg.useDscr && r.dscr < tg.minDscr) return false;
  if (r.coc < requiredCoc(r.structure, d, tg)) return false;
  if (r.structure === "brrrr" && (r.financing.cashLeftInDeal ?? 0) > tg.maxCashLeft) return false;
  return true;
}

/**
 * Highest purchase price that still meets the targets under a given structure.
 * Bisection on price — cash flow, DSCR and CoC all fall monotonically as price rises.
 * Returns null if not even a $1k price works; `capped` if every price up to the ceiling works.
 */
export function maxPrice(id: StructureId, d: Deal, t: Terms, tg: Targets): { price: number | null; capped: boolean } {
  const ok = (p: number) => meetsTargets(underwrite(id, d, t, p, true), tg, d);
  const ceiling = Math.max(d.price, d.marketValue, d.arv) * 2.5;
  if (ok(ceiling)) return { price: ceiling, capped: true };
  let lo = 1000;
  if (!ok(lo)) return { price: null, capped: false };
  let hi = ceiling;
  for (let i = 0; i < 60 && hi - lo > 50; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return { price: Math.floor(lo / 500) * 500, capped: false };
}

export interface Check {
  label: string;
  pass: boolean;
  detail: string;
  weight: number;
}

/** Ken McElroy-style deal discipline: conservative inputs, NOI first, debt must be covered, survive a downturn. */
export function scorecard(r: Result, d: Deal): { checks: Check[]; grade: string; score: number } {
  const perDoorCapex = (d.rent * d.capexPct * 12) / 100 / Math.max(d.units, 1);
  const checks: Check[] = [
    { label: "DSCR ≥ 1.25", pass: r.dscr >= 1.25, detail: `NOI covers debt ${fx(r.dscr)}×`, weight: 3 },
    { label: "Positive cash flow after reserves", pass: r.cashFlow > 0, detail: `$${fmt(r.cashFlow)}/mo`, weight: 3 },
    { label: "Survives stress test", pass: r.stress.cashFlow >= 0, detail: `Rent −5%, vacancy +5 pts, expenses +10% → $${fmt(r.stress.cashFlow)}/mo`, weight: 3 },
    { label: "Break-even occupancy ≤ 85%", pass: r.breakEvenOcc <= 85, detail: `${r.breakEvenOcc.toFixed(1)}% occupied to cover all costs`, weight: 2 },
    { label: "Beats inflation", pass: r.coc - d.inflationPct >= 0, detail: Number.isFinite(r.coc) ? `Real cash yield ${(r.coc - d.inflationPct).toFixed(1)}% (CoC ${r.coc.toFixed(1)}% − CPI ${d.inflationPct}%)` : "No cash left in", weight: 2 },
    { label: "Beats the Fed rate", pass: r.coc >= d.riskFreePct, detail: Number.isFinite(r.coc) ? `${(r.coc - d.riskFreePct).toFixed(1)} pts vs ${d.riskFreePct}% risk-free` : "No cash left in", weight: 1 },
    { label: "Cash-on-cash ≥ 8%", pass: r.coc >= 8, detail: Number.isFinite(r.coc) ? `${r.coc.toFixed(1)}%` : "∞ (no cash left in)", weight: 2 },
    { label: "Positive leverage", pass: r.debtService === 0 || r.capRate > r.loanConstant, detail: `Cap ${r.capRate.toFixed(2)}% vs loan constant ${r.loanConstant.toFixed(2)}%`, weight: 2 },
    { label: "Realistic expense ratio (≥ 35%)", pass: r.expenseRatio >= 35, detail: `${r.expenseRatio.toFixed(1)}% of EGI — under 35% usually means a pro-forma fantasy`, weight: 2 },
    { label: "Vacancy underwritten ≥ 5%", pass: d.vacancyPct >= 5, detail: `${d.vacancyPct}%`, weight: 1 },
    { label: "Management budgeted ≥ 8%", pass: d.mgmtPct >= 8, detail: `${d.mgmtPct}% — pay yourself or a PM, it's a business`, weight: 1 },
    { label: "CapEx reserves ≥ $300/door/yr", pass: perDoorCapex >= 300, detail: `$${fmt(perDoorCapex)}/door/yr`, weight: 1 },
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((got / total) * 100);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
  return { checks, grade, score };
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "−∞";
  return Math.round(n).toLocaleString("en-US");
}
const fx = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "∞");

/** Currency with the sign in front: −$310, $1,250. */
export function money(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "−∞";
  return (n < -0.5 ? "−$" : "$") + fmt(Math.abs(n));
}

export interface Opportunity {
  cash: number;
  years: number;
  assetIncome: number; // year-1 cash flow
  fedIncome: number; // year-1 interest at Fed rate
  assetYield: number; // CoC %
  realAssetYield: number;
  realFedYield: number;
  assetEndWealth: number; // all cash flows + sale proceeds (not reinvested)
  fedEndWealth: number; // cash compounded at the Fed rate
  inflationEndWealth: number; // what the cash must grow to just to keep purchasing power
  assetReal: number; // end wealth in today's dollars
  fedReal: number;
  irr: number;
  realIrr: number;
}

/** Same dollars, two homes: this property vs. parking the cash at the Fed rate. */
export function vsRiskFree(r: Result, d: Deal): Opportunity | null {
  const cash = r.cashInvested;
  if (!(cash > 0)) return null;
  const n = d.holdYears;
  const inf = Math.pow(1 + d.inflationPct / 100, n);
  const assetEndWealth = cash + r.totalProfit;
  const fedEndWealth = cash * Math.pow(1 + d.riskFreePct / 100, n);
  return {
    cash,
    years: n,
    assetIncome: r.cashFlow * 12,
    fedIncome: (cash * d.riskFreePct) / 100,
    assetYield: r.coc,
    realAssetYield: r.coc - d.inflationPct,
    realFedYield: d.riskFreePct - d.inflationPct,
    assetEndWealth,
    fedEndWealth,
    inflationEndWealth: cash * inf,
    assetReal: assetEndWealth / inf,
    fedReal: fedEndWealth / inf,
    irr: r.irr,
    realIrr: Number.isFinite(r.irr) ? ((1 + r.irr / 100) / (1 + d.inflationPct / 100) - 1) * 100 : NaN,
  };
}
