# Deal Underwriter

Type an address and get the **maximum price that cash flows for you**, under 9 financing structures at once. Every input is a slider.

## Run it

```bash
cd underwriter
npm install
cp .env.example .env    # add keys (optional, see below)
npm run dev             # http://localhost:5173  (API on :8787)
# production:
npm run build && npm start   # serves app + API on :8787
```

## Where the numbers come from

| Data | Source | Key |
|---|---|---|
| Address match, lat/lon, census tract | US Census geocoder | none |
| Mortgage rates (30 / 15 yr) | Freddie Mac PMMS via FRED, weekly | none |
| Beds/baths/sqft/year, last sale, owner, HOA, **actual tax bill** | RentCast property record | `RENTCAST_API_KEY` |
| **Value AVM + sale comps** | RentCast `/avm/value` | `RENTCAST_API_KEY` |
| **Rent AVM + rent comps** | RentCast `/avm/rent/long-term` | `RENTCAST_API_KEY` |
| Fallback rent by bedroom, county tax rate | Census ACS 5-yr | `CENSUS_API_KEY` (free) |
| Fallback tax rate / insurance | State averages (`server/stateData.mjs`) | none |

Keys can go in `.env` or in the app under **Data keys** (stored only in your browser). RentCast responses are cached on disk for 14 days (`server/.cache.json`) because each lookup uses 3 metered calls.

Each value and rent figure shows a confidence label taken from the AVM's range (±%). Without RentCast the app still runs, but value and rent are area averages and you should type in real numbers.

## How it underwrites (Ken McElroy discipline)

- **Taxes reassessed at YOUR price**, not the seller's bill (toggle).
- Vacancy, management, repairs and CapEx reserves are always budgeted. Repairs and CapEx default higher for older buildings.
- NOI → debt service → cash flow, cap rate, cash-on-cash, DSCR, break-even occupancy, loan constant (positive leverage), IRR and equity multiple over the hold.
- **Stress test**: rent −5%, vacancy +5 pts, expenses +10%.
- A 10-point **scorecard** (DSCR ≥ 1.25, survives stress, break-even ≤ 85%, expense ratio ≥ 35%, reserves ≥ $300/door…) graded A–F.

## Structures

Conventional · DSCR · FHA house hack · All cash · **Subject-To** · **Hybrid (Sub-To + seller carry)** · **Seller finance** (IO, amortization, balloon with refi at market) · **Morby Method** (bank 1st + seller-carried 2nd for the down payment) · **BRRRR** (hard money → cash-out refi on ARV).

For Sub-To, the seller's existing loan is estimated from their last sale price, date and that year's average rate. Replace the estimate with the real mortgage statement.

## Max-offer solver

`maxPrice()` in `src/lib/model.ts` bisects on price to find the highest price that meets your targets: cash flow per door, plus optional DSCR and cash-on-cash. For all cash it requires the cash-on-cash target. For BRRRR it also caps the cash left in the deal.

## Tests

`npm test` covers the amortization, IO/balloon schedules, IRR, structure cash-to-close and the solver.
