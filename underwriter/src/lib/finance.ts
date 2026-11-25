// Core time-value-of-money helpers. All rates are annual percentages (e.g. 7.25 = 7.25%).

/** Monthly principal & interest payment for a fully amortizing loan. */
export function pmt(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export interface Loan {
  name: string;
  principal: number;
  ratePct: number;
  amortYears: number;
  /** Months of interest-only payments before amortization begins. */
  ioMonths?: number;
  /** Balloon due after this many months. Balance is refinanced at refiRatePct over 30 yrs. */
  balloonMonths?: number;
  refiRatePct?: number;
  /** Extra monthly cost tied to the loan (e.g. FHA MIP). */
  extraMonthly?: number;
  /** Position label, e.g. "1st", "2nd". */
  lien?: string;
}

export interface LoanMonth {
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Monthly schedule for a loan over `months` months, handling IO periods and balloon refi. */
export function schedule(loan: Loan, months: number): LoanMonth[] {
  const out: LoanMonth[] = [];
  let bal = loan.principal;
  let rate = loan.ratePct;
  const io = loan.ioMonths ?? 0;
  let amortYears = loan.amortYears;
  let amortizing = io === 0;
  let payment = io > 0 ? (bal * rate) / 1200 : pmt(bal, rate, amortYears);

  for (let m = 0; m < months; m++) {
    if (bal <= 0.005) {
      out.push({ payment: 0, interest: 0, principal: 0, balance: 0 });
      continue;
    }
    if (loan.balloonMonths && m === loan.balloonMonths) {
      // Balloon hits: refinance remaining balance at market rate, new 30-yr amortization.
      rate = loan.refiRatePct ?? rate;
      amortYears = 30;
      amortizing = true;
      payment = pmt(bal, rate, amortYears);
    } else if (!amortizing && m === io) {
      amortizing = true;
      payment = pmt(bal, rate, amortYears);
    }
    const interest = (bal * rate) / 1200;
    let principal = amortizing ? payment - interest : 0;
    if (principal > bal) principal = bal;
    bal -= principal;
    out.push({ payment: interest + principal + (loan.extraMonthly ?? 0), interest, principal, balance: bal });
  }
  return out;
}

/** First-month total payment (incl. extras) — what you'll actually pay on day one. */
export function initialPayment(loan: Loan): number {
  return schedule(loan, 1)[0]?.payment ?? 0;
}

/** Internal rate of return for annual cash flows (index 0 = today). Returns % or NaN. */
export function irr(flows: number[]): number {
  const npv = (r: number) => flows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (Number.isNaN(fLo) || fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}
