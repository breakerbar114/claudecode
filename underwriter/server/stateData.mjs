// State fallback tables live in shared/stateData.json so the browser (hosted build) uses the same numbers.
// Tax: effective property-tax rate, % of market value, owner-occupied (Tax Foundation / ACS, ~2023).
// Uplift: states that tax non-owner-occupied property materially higher. Ins: landlord premium, % of value (2025 averages).
import data from "../shared/stateData.json" with { type: "json" };
export const STATE_TAX_RATE = data.taxRate;
export const NON_HOMESTEAD_UPLIFT = data.nonHomesteadUplift;
export const STATE_INS_RATE = data.insRate;
