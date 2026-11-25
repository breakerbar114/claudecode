import { pmt } from "./finance";

// Freddie Mac PMMS 30-yr annual averages — used to guess the seller's existing note for Sub-To.
const PMMS_AVG: Record<number, number> = {
  2000: 8.05, 2001: 6.97, 2002: 6.54, 2003: 5.83, 2004: 5.84, 2005: 5.87, 2006: 6.41, 2007: 6.34,
  2008: 6.03, 2009: 5.04, 2010: 4.69, 2011: 4.45, 2012: 3.66, 2013: 3.98, 2014: 4.17, 2015: 3.85,
  2016: 3.65, 2017: 3.99, 2018: 4.54, 2019: 3.94, 2020: 3.11, 2021: 2.96, 2022: 5.34, 2023: 6.81,
  2024: 6.72, 2025: 6.62,
};

/**
 * Rough guess at the seller's current mortgage from their last purchase: 80% LTV at that
 * year's average rate, amortized to today. Replace with the actual mortgage statement.
 */
export function estimateExistingLoan(lastSalePrice?: number, lastSaleDate?: string, fallbackRate = 6.5) {
  if (!lastSalePrice || !lastSaleDate) return null;
  const sale = new Date(lastSaleDate);
  if (Number.isNaN(sale.getTime())) return null;
  const year = sale.getFullYear();
  const monthsPaid = Math.max(0, Math.round((Date.now() - sale.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (monthsPaid >= 360) return { balance: 0, ratePct: 0, yearsLeft: 0, year };
  const ratePct = PMMS_AVG[year] ?? fallbackRate;
  const principal = lastSalePrice * 0.8;
  const r = ratePct / 1200;
  const p = pmt(principal, ratePct, 30);
  const balance = principal * Math.pow(1 + r, monthsPaid) - (p * (Math.pow(1 + r, monthsPaid) - 1)) / r;
  return { balance: Math.max(0, Math.round(balance / 100) * 100), ratePct, yearsLeft: +((360 - monthsPaid) / 12).toFixed(1), year };
}
