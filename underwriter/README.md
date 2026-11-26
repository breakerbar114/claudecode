# Deal Underwriter

Type an address and the AI underwrites it: every assumption is filled in from data (rent comps, tax bill, PM rates, building age, Freddie Mac, FRED) with its source shown. You get the **max offer that cash flows**, under 8 financing structures. Change any number and it turns amber, shows what the AI said, and can be undone one at a time or all at once.

## Run it

```bash
cd underwriter
npm install
cp .env.example .env    # add keys (optional, see below)
npm run dev             # http://localhost:5173  (API on :8787)
# production:
npm run build && npm start   # serves app + API on :8787
```

## Put it on your phone (private)

The hosted claude.ai page can't call outside data services, so live RentCast data needs this app's own server. Deploy it once, then install it on your phone:

1. **Get a RentCast key** at https://app.rentcast.io/app/api (free tier: 50 calls/mo; each new address uses 3, and repeats are cached for 14 days). Optional: a free Census key at https://api.census.gov/data/key_signup.html.
2. **Deploy on Render**: render.com → New → Blueprint → connect this GitHub repo and pick the branch. Render reads `render.yaml` at the repo root and asks for:
   - `RENTCAST_API_KEY`: your key
   - `APP_PASSWORD`: the password you'll type on your phone (use something long)
   - `CENSUS_API_KEY`: optional
   It builds, then gives you a URL like `https://deal-underwriter.onrender.com`. The blueprint uses the $7/mo Starter plan; change `plan: starter` to `plan: free` if you're fine with a 30–50 s wake-up after 15 idle minutes.
3. **Install on your phone**: open the URL, sign in once.
   - iPhone (Safari): Share → **Add to Home Screen**.
   - Android (Chrome): ⋮ → **Install app**.
   It opens full screen from its own icon and stays signed in for a year. "Sign out" is in the footer.

Without `APP_PASSWORD` the server is open, which is fine on your own computer but not on the internet.

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

Conventional · DSCR · FHA house hack · **Subject-To** · **Hybrid (Sub-To + seller carry)** · **Seller finance** (IO, amortization, balloon with refi at market) · **Morby Method** (bank 1st + seller-carried 2nd for the down payment) · **BRRRR** (hard money → cash-out refi on ARV).

For Sub-To, the seller's existing loan is estimated from their last sale price, date and that year's average rate. Replace the estimate with the real mortgage statement.

## Inflation & the Fed rate

- **Beat inflation** (on by default): cash-on-cash must be at least the latest CPI year-over-year, so the cash you put in isn't losing buying power.
- **Your cash vs. the Fed rate** panel: the same dollars in the property vs. parked at the Fed rate. It shows year-1 income, real yield, ending wealth in nominal and today's dollars, and real IRR.

## Max-offer solver

`maxPrice()` in `src/lib/model.ts` bisects on price to find the highest price that meets your targets: cash flow per door, beating inflation, plus optional DSCR and cash-on-cash. For BRRRR it also caps the cash left in the deal.

## Tests

`npm test` covers the amortization, IO/balloon schedules, IRR, structure cash-to-close and the solver.
