import { pmt, schedule, irr } from "./finance";
import { underwrite, maxPrice, vsRiskFree, Deal, Targets } from "./model";
import { defaultTerms } from "./structures";

const deal: Deal = {
  price: 250000, marketValue: 260000, arv: 260000, units: 1, rent: 2200, otherIncome: 0,
  vacancyPct: 6, mgmtPct: 10, repairsPct: 6, capexPct: 6, taxRatePct: 1.2, taxesAnnualActual: 2800,
  reassessTaxes: true, insuranceAnnual: 1800, hoaMonthly: 0, utilitiesMonthly: 0, otherExpMonthly: 0,
  closingCostPct: 3, rehab: 0, marketRatePct: 6.5, rentGrowthPct: 3, expenseGrowthPct: 3,
  appreciationPct: 3, holdYears: 5, sellingCostPct: 7, inflationPct: 3, riskFreePct: 4,
};
const tg: Targets = { minCashFlow: 200, minDscr: 1.25, minCoc: 8, useDscr: false, useCoc: false, maxCashLeft: 10000, beatInflation: false, cashHurdle: "inflation", cashPremiumPct: 2 };

test("pmt matches known value", () => {
  expect(pmt(200000, 6, 30)).toBeCloseTo(1199.1, 1);
  expect(pmt(120000, 0, 10)).toBeCloseTo(1000, 6);
});

test("schedule handles IO then amortization and pays to zero", () => {
  const s = schedule({ name: "x", principal: 100000, ratePct: 6, amortYears: 10, ioMonths: 12 }, 132);
  expect(s[0].principal).toBe(0);
  expect(s[0].payment).toBeCloseTo(500, 6);
  expect(s[12].payment).toBeCloseTo(pmt(100000, 6, 10), 6);
  expect(s[131].balance).toBeLessThan(0.01);
});

test("irr of simple flows", () => {
  expect(irr([-100, 110])).toBeCloseTo(10, 3);
});

test("conventional underwrite is internally consistent", () => {
  const r = underwrite("conventional", deal, defaultTerms("conventional", 6.5, 250000));
  expect(r.noi).toBeCloseTo(r.egi - r.opex, 6);
  expect(r.cashFlow).toBeCloseTo(r.noi - r.debtService, 6);
  expect(r.debtService).toBeCloseTo(pmt(187500, 7.25, 30), 4);
  expect(r.cashInvested).toBeCloseTo(62500 + 7500, 4);
});

test("max price solver returns a price that just meets target", () => {
  for (const id of ["conventional", "dscr", "sellerFinance", "morby", "subto", "hybrid"] as const) {
    const t = defaultTerms(id, 6.5, 250000);
    const m = maxPrice(id, deal, t, tg);
    if (m.price === null || m.capped) continue;
    const at = underwrite(id, deal, t, m.price);
    const over = underwrite(id, deal, t, m.price + 1000);
    expect(at.cashFlow).toBeGreaterThanOrEqual(200 - 1);
    expect(over.cashFlow).toBeLessThan(200 + 50);
  }
});

test("subject-to cash to close = equity + closing", () => {
  const t = { ...defaultTerms("subto", 6.5, 250000), existingBalance: 180000 };
  const r = underwrite("subto", deal, t);
  expect(r.financing.cashToClose).toBeCloseTo(70000 + 7500, 4);
});

test("BRRRR all-cash-out gives infinite CoC when cash left <= 0", () => {
  const d = { ...deal, price: 120000, rehab: 40000, arv: 260000, rent: 2900 };
  const r = underwrite("brrrr", d, defaultTerms("brrrr", 6.5, 120000));
  expect(r.financing.cashLeftInDeal!).toBeLessThan(0);
  expect(r.coc).toBe(Infinity);
});

test("all-cash max price is bounded by the hurdle, and tighter at the Fed rate than at inflation", () => {
  const t = defaultTerms("cash", 6.5, 250000);
  const atInfl = maxPrice("cash", deal, t, { ...tg, cashHurdle: "inflation" });
  const atFed = maxPrice("cash", deal, t, { ...tg, cashHurdle: "fed" });
  const atFedPlus = maxPrice("cash", deal, t, { ...tg, cashHurdle: "fedPlus" });
  expect(atInfl.capped).toBe(false);
  expect(atFed.price!).toBeLessThan(atInfl.price!);
  expect(atFedPlus.price!).toBeLessThan(atFed.price!);
  const r = underwrite("cash", deal, t, atFed.price!);
  expect(r.coc).toBeGreaterThanOrEqual(4);
  expect(underwrite("cash", deal, t, atFed.price! + 2000).coc).toBeLessThan(4.05);
});

test("vsRiskFree compares the same cash at the Fed rate", () => {
  const r = underwrite("cash", deal, defaultTerms("cash", 6.5, 250000));
  const o = vsRiskFree(r, deal)!;
  expect(o.cash).toBeCloseTo(r.cashInvested, 6);
  expect(o.fedIncome).toBeCloseTo(r.cashInvested * 0.04, 6);
  expect(o.fedEndWealth).toBeCloseTo(r.cashInvested * Math.pow(1.04, 5), 4);
  expect(o.realFedYield).toBeCloseTo(1, 6);
});
