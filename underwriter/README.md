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
| Fed funds rate, 3-mo T-bill, CPI inflation (YoY) | FRED (`DFF`, `DTB3`, `CPIAUCSL`) | none |
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

## Inflation & the Fed rate

- **Beat inflation** (on by default): cash-on-cash must be at least the latest CPI year-over-year, so the cash you put in isn't losing buying power.
- **All-cash hurdle**: an all-cash buy has to beat inflation, the Fed rate, or the Fed rate plus a risk premium you choose. It never goes below inflation, so the max offer is always a real number, never "Any".
- **Your cash vs. the Fed rate** panel: the same dollars in the property vs. parked at the Fed rate. It shows year-1 income, real yield, ending wealth in nominal and today's dollars, and real IRR, plus the most you can pay all cash under each hurdle.

## Max-offer solver

`maxPrice()` in `src/lib/model.ts` bisects on price to find the highest price that meets your targets: cash flow per door, beating inflation, plus optional DSCR and cash-on-cash. For all cash it applies the all-cash hurdle. For BRRRR it also caps the cash left in the deal.

## Tests

`npm test` covers the amortization, IO/balloon schedules, IRR, structure cash-to-close and the solver.
