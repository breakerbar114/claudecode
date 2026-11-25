// Fallback data used only when parcel-level data is unavailable.
// Effective property-tax rate (% of market value, owner-occupied; Tax Foundation / ACS, ~2023).
// Non-homestead (investor) bills are often higher — especially FL, TX, MI, SC.
export const STATE_TAX_RATE = {
  AL: 0.38, AK: 1.04, AZ: 0.45, AR: 0.56, CA: 0.71, CO: 0.49, CT: 1.48, DE: 0.51, DC: 0.57,
  FL: 0.79, GA: 0.81, HI: 0.27, ID: 0.47, IL: 1.95, IN: 0.75, IA: 1.43, KS: 1.29, KY: 0.73,
  LA: 0.53, ME: 1.0, MD: 0.99, MA: 1.04, MI: 1.24, MN: 1.0, MS: 0.67, MO: 0.88, MT: 0.66,
  NE: 1.5, NV: 0.49, NH: 1.61, NJ: 2.08, NM: 0.62, NY: 1.54, NC: 0.7, ND: 0.92, OH: 1.36,
  OK: 0.79, OR: 0.82, PA: 1.36, RI: 1.27, SC: 0.51, SD: 1.1, TN: 0.55, TX: 1.47, UT: 0.52,
  VT: 1.71, VA: 0.8, WA: 0.84, WV: 0.55, WI: 1.51, WY: 0.55,
};

// States where a non-owner-occupied bill is materially higher than the homestead rate.
export const NON_HOMESTEAD_UPLIFT = { SC: 1.5, MI: 1.45, TX: 1.15, FL: 1.2, IN: 1.3, OH: 1.1, GA: 1.1 };

// Approximate annual landlord/dwelling insurance as % of dwelling value (state averages, 2025).
export const STATE_INS_RATE = {
  AL: 1.05, AK: 0.5, AZ: 0.65, AR: 1.15, CA: 0.55, CO: 1.05, CT: 0.6, DE: 0.4, DC: 0.4,
  FL: 1.6, GA: 0.8, HI: 0.4, ID: 0.45, IL: 0.75, IN: 0.7, IA: 0.85, KS: 1.25, KY: 0.95,
  LA: 1.55, ME: 0.45, MD: 0.5, MA: 0.55, MI: 0.7, MN: 0.85, MS: 1.15, MO: 0.95, MT: 0.85,
  NE: 1.35, NV: 0.45, NH: 0.4, NJ: 0.45, NM: 0.7, NY: 0.55, NC: 0.75, ND: 0.95, OH: 0.55,
  OK: 1.45, OR: 0.4, PA: 0.45, RI: 0.65, SC: 0.75, SD: 1.05, TN: 0.85, TX: 1.25, UT: 0.4,
  VT: 0.35, VA: 0.5, WA: 0.45, WV: 0.6, WI: 0.45, WY: 0.6,
};
