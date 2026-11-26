// "Why this number": the math, the comps and the sources behind each value the AI filled in.
import { CompResult } from "../lib/comps";
import { Deal, Terms, StructureId, money } from "../lib/model";
import { Lookup, Rates } from "../lib/api";
import { Rec, RecKey } from "../lib/recommend";
import { estimateExistingLoan } from "../lib/estimate";
import stateData from "../../shared/stateData.json";

type CalcRow = [label: string, value: string, strong?: boolean];
interface Source { name: string; detail?: string; url?: string }

const pct = (n: number, d = 2) => `${(+n.toFixed(d)).toString()}%`;
const ago = (iso?: string | null) => {
  if (!iso) return "";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  return days < 1 ? "today" : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} mo ago`;
};

export function Calc({ rows }: { rows: CalcRow[] }) {
  return (
    <table className="ev-calc">
      <tbody>
        {rows.map(([l, v, strong], i) => (
          <tr key={i} className={strong ? "strong" : ""}>
            <td>{l}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Sources({ list }: { list: Source[] }) {
  if (!list.length) return null;
  return (
    <div className="ev-sources">
      <span className="ev-h">Sources</span>
      <ul>
        {list.map((s, i) => (
          <li key={i}>
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a> : <span>{s.name}</span>}
            {s.detail && <span className="muted"> · {s.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompsMini({ r, unit, onOpen }: { r: CompResult; unit: string; onOpen: () => void }) {
  const used = [...r.comps].filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight);
  const dropped = r.comps.length - used.length;
  return (
    <div className="ev-comps">
      <span className="ev-h">
        {used.length} comp{used.length === 1 ? "" : "s"} used{dropped ? `, ${dropped} dropped` : ""}
      </span>
      <table>
        <thead>
          <tr><th>Comp</th><th>{unit}</th><th>Adj.</th><th>Wt</th></tr>
        </thead>
        <tbody>
          {used.slice(0, 6).map((c) => (
            <tr key={c.id}>
              <td>
                {c.address}
                <div className="muted">
                  {c.beds ?? "?"}bd/{c.baths ?? "?"}ba{c.sqft ? ` · ${c.sqft.toLocaleString()} sf` : ""}
                  {c.distance != null ? ` · ${c.distance.toFixed(2)} mi` : ""}
                  {c.date ? ` · ${ago(c.date)}` : ""}
                </div>
              </td>
              <td>{money(c.amount)}</td>
              <td><b>{money(c.adjusted)}</b></td>
              <td>{Math.round(c.weight * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="link" onClick={onOpen}>All comps & adjustments →</button>
    </div>
  );
}

export interface EvCtx {
  deal: Deal;
  ai: Deal;
  data: Lookup | null;
  recs: Partial<Record<RecKey, Rec>>;
  rentComps: CompResult;
  saleComps: CompResult;
  yearBuilt?: number;
  state: string | null;
  macro: Rates | null;
  address: string;
  openComps: () => void;
}

const TAX = stateData.taxRate as Record<string, number>;
const UPLIFT = stateData.nonHomesteadUplift as Record<string, number>;
const INS = stateData.insRate as Record<string, number>;
const RENTCAST: Source = { name: "RentCast property data", url: "https://www.rentcast.io/" };
const fred = (id: string, name: string, detail?: string): Source => ({ name, detail, url: `https://fred.stlouisfed.org/series/${id}` });
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Evidence for a deal field. Returns null when there's nothing more to say than the row itself. */
export function dealEvidence(k: keyof Deal, x: EvCtx): React.ReactNode {
  const { deal, data, recs } = x;
  const units = Math.max(deal.units, 1);
  switch (k) {
    case "marketValue": {
      const avm = data?.value;
      return (
        <>
          {x.saleComps.used > 0 ? (
            <>
              <p className="ev-lead">
                Weighted median of {x.saleComps.used} sale comps, each adjusted to this house: <b>{money(x.saleComps.recommended!)}</b>. The middle half falls between {money(x.saleComps.low!)} and {money(x.saleComps.high!)} ({x.saleComps.confidence.toLowerCase()} confidence).
              </p>
              <CompsMini r={x.saleComps} unit="Price" onOpen={x.openComps} />
              {avm && (
                <p className="ev-note">
                  Cross-check: RentCast's AVM says {money(avm.estimate)}
                  {avm.low && avm.high ? ` (range ${money(avm.low)}–${money(avm.high)})` : ""}. {(() => {
                    const diff = ((x.saleComps.recommended! - avm.estimate) / avm.estimate) * 100;
                    return Math.abs(diff) < 0.5 ? "The comps agree with it." : `The comps come in ${Math.abs(diff).toFixed(1)}% ${diff < 0 ? "below" : "above"} it.`;
                  })()}
                </p>
              )}
            </>
          ) : avm ? (
            <p className="ev-lead">
              RentCast's automated valuation: <b>{money(avm.estimate)}</b>{avm.low && avm.high ? `, range ${money(avm.low)}–${money(avm.high)}` : ""}. It didn't return usable sale comps, so add recent sales in the Comps tab to check it.
            </p>
          ) : (
            <p className="ev-lead">
              No property data in this version, so this is a placeholder. Add 3–6 recent nearby sales in the Comps tab and the AI will value the house from them.{" "}
              {x.address && <a href={`https://www.zillow.com/homes/${encodeURIComponent(x.address)}_rb/`} target="_blank" rel="noreferrer">Find sales on Zillow ↗</a>}
            </p>
          )}
          <Sources list={[...(avm || x.saleComps.comps.some((c) => c.source === "rentcast") ? [RENTCAST] : []), ...(x.saleComps.comps.some((c) => c.source === "manual") ? [{ name: "Sale comps you added" }] : [])]} />
        </>
      );
    }
    case "rent": {
      const avm = data?.rent;
      return (
        <>
          {x.rentComps.used > 0 ? (
            <>
              <p className="ev-lead">
                Weighted median of {x.rentComps.used} rent comps, adjusted to this {units > 1 ? "unit mix" : "house"}: <b>{money(x.rentComps.recommended!)}/unit</b>
                {units > 1 ? ` × ${units} units = ${money(x.rentComps.recommended! * units)}` : ""}. Middle half {money(x.rentComps.low!)}–{money(x.rentComps.high!)}.
              </p>
              <CompsMini r={x.rentComps} unit="Rent" onOpen={x.openComps} />
              {avm && <p className="ev-note">Cross-check: RentCast rent AVM {money(avm.perUnit)}/unit{avm.low && avm.high ? ` (${money(avm.low)}–${money(avm.high)})` : ""}.</p>}
            </>
          ) : avm ? (
            <p className="ev-lead">RentCast rent estimate <b>{money(avm.perUnit)}/unit</b>{avm.low && avm.high ? ` (range ${money(avm.low)}–${money(avm.high)})` : ""}. No usable comps came back, so add some in the Comps tab.</p>
          ) : (
            <p className="ev-lead">No rental data in this version, so this is a placeholder. Add 3–6 nearby rentals in the Comps tab and the AI will set rent from them.</p>
          )}
          <Sources list={[...(avm || x.rentComps.comps.some((c) => c.source === "rentcast") ? [RENTCAST] : []), ...(x.rentComps.comps.some((c) => c.source === "manual") ? [{ name: "Rent comps you added" }] : [])]} />
        </>
      );
    }
    case "taxRatePct": {
      const rate = recs.taxRatePct?.value ?? deal.taxRatePct;
      const bill = data?.taxes.annualActual;
      const value = data?.value?.estimate;
      const st = x.state;
      const up = st ? UPLIFT[st] : undefined;
      const rows: CalcRow[] = [];
      const src: Source[] = [];
      if (bill && value) {
        const base = (bill / value) * 100;
        rows.push([`${data!.taxes.year ?? "Latest"} tax bill`, money(bill)], ["÷ current value (AVM)", money(value)], ["= current effective rate", pct(base)]);
        if (Math.abs(rate - base) > 0.005) rows.push([`× non-owner-occupied factor (${st})`, `×${(rate / base).toFixed(2)}`]);
        src.push({ ...RENTCAST, name: "County tax record via RentCast" });
      } else if (data?.taxes.ratePct && data.taxes.source.includes("ACS")) {
        rows.push(["County median tax ÷ median value", pct(data.taxes.ratePct)]);
        src.push({ name: "US Census ACS 5-year", url: "https://data.census.gov/" });
      } else if (st && TAX[st] != null) {
        rows.push([`${st} average effective rate`, pct(TAX[st])]);
        if (up) rows.push(["× non-owner-occupied factor", `×${up}`]);
        src.push({ name: "Tax Foundation, effective property tax rates by state", url: "https://taxfoundation.org/data/all/state/property-taxes-by-state-county/" });
      }
      rows.push(["= rate used", pct(rate), true]);
      rows.push([`At your ${money(deal.price)} price`, `${money((deal.price * deal.taxRatePct) / 100)}/yr`]);
      src.push({ name: "Look up this parcel's bill", url: google(`${x.address || "county"} property tax assessor`) });
      return (
        <>
          <p className="ev-lead">Counties usually reassess after a sale, so the AI taxes you at your purchase price, not the seller's bill.</p>
          <Calc rows={rows} />
          <Sources list={src} />
        </>
      );
    }
    case "insuranceAnnual": {
      const st = x.state;
      const r = st ? INS[st] : undefined;
      const value = x.recs.marketValue?.value ?? data?.value?.estimate ?? deal.marketValue;
      return (
        <>
          <Calc rows={[[x.saleComps.used ? "Value (from sale comps)" : "Value", money(value)], [`× ${st ?? "US"} average landlord premium`, r ? pct(r) : "—"], ["= insurance used", `${money(recs.insuranceAnnual?.value ?? deal.insuranceAnnual)}/yr`, true]]} />
          <p className="ev-note">A landlord (DP-3) policy usually costs about 15–25% more than a homeowner's policy. Coastal, wind and hail areas can run far above the state average.</p>
          <Sources list={[{ name: "State average premiums (2025 industry data), built into the app" }, { name: "Get a quote", url: google(`landlord insurance quote ${st ?? ""}`) }]} />
        </>
      );
    }
    case "mgmtPct": {
      const perDoor = (recs.rent?.value ?? deal.rent) / units;
      const base = units >= 50 ? 5 : units >= 5 ? 7 : 9;
      const minPct = perDoor > 0 ? (100 / perDoor) * 100 : base;
      const fee = Math.max(base, Math.min(minPct, 15));
      const leasing = units >= 5 ? 0 : (0.5 / 24) * 100;
      const rows: CalcRow[] = [[`Monthly fee (${units >= 5 ? "5+ units" : "1–4 units"})`, pct(base, 1)]];
      if (fee > base) rows.push([`$100/door minimum at ${money(perDoor)} rent`, pct(fee, 1)]);
      if (leasing) rows.push(["+ leasing fee: ½ month's rent ÷ 24-mo tenancy", pct(leasing, 1)]);
      rows.push(["= management", pct(fee + leasing, 1), true], ["≈ per month", money(((recs.rent?.value ?? deal.rent) * (fee + leasing)) / 100)]);
      return (
        <>
          <Calc rows={rows} />
          <p className="ev-note">Budget management even if you self-manage. Your time costs money, and a lender or buyer will underwrite it anyway.</p>
          <Sources list={[{ name: "Typical 1–4 unit property-management pricing (8–10% plus leasing fee)" }, { name: "Compare local PMs", url: google(`property management fees ${x.state ?? ""} single family`) }]} />
        </>
      );
    }
    case "vacancyPct":
      return (
        <>
          <Calc rows={[["Turnover: ~3–4 weeks empty per year", "≈ 6–7%"], ["+ bad debt / concessions", "≈ 0.5–1%"], ["= vacancy & credit loss", pct(deal.vacancyPct, 1), true], ["≈ per year", money((deal.rent * 12 * deal.vacancyPct) / 100)]]} />
          <p className="ev-note">Ken McElroy's rule: never underwrite below 5%, even if it's 100% leased today.</p>
        </>
      );
    case "repairsPct":
    case "capexPct": {
      const yb = x.yearBuilt;
      const age = yb ? new Date().getFullYear() - yb : null;
      const amt = (deal.rent * 12 * (deal[k] as number)) / 100;
      return (
        <>
          <Calc
            rows={[
              ["Built", yb ? `${yb} (${age} yrs)` : "unknown"],
              ["Age bracket", age == null ? "unknown → mid-life" : age > 45 ? "45+ yrs" : age > 25 ? "26–45 yrs" : age > 10 ? "11–25 yrs" : "≤10 yrs"],
              [k === "repairsPct" ? "= repairs" : "= CapEx reserve", pct(deal[k] as number, 1), true],
              ["≈ per year, per door", money(amt / units)],
            ]}
          />
          <p className="ev-note">
            {k === "capexPct"
              ? "Reserves for big-ticket replacements: roof (20–25 yrs), HVAC (15–20), water heater (10–12), flooring and appliances at turnover."
              : "Day-to-day fixes: plumbing, appliances, small repairs between tenants. Older houses need more."}
          </p>
          {!yb && <p className="ev-note">Add the year built in the Comps tab to sharpen this.</p>}
        </>
      );
    }
    case "hoaMonthly":
    case "units":
      return data ? <Sources list={[{ ...RENTCAST, name: "Property record via RentCast", detail: data.property.type }]} /> : <p className="ev-note">No property record in this version. Enter it if you know it.</p>;
    case "inflationPct":
      return <Sources list={[fred("CPIAUCSL", "CPI-U, year over year", x.macro?.inflationAsOf ? `latest ${x.macro.inflationAsOf.slice(0, 7)}` : undefined)]} />;
    case "riskFreePct":
      return <Sources list={[fred("DFF", "Effective Fed funds rate", x.macro?.fedFundsAsOf ?? undefined), fred("DTB3", "3-month T-bill", x.macro?.tbill3m != null ? `${x.macro.tbill3m}%` : undefined)]} />;
    case "closingCostPct":
      return <p className="ev-note">Buyer closing costs usually run 2–4%: lender fees, title and escrow, recording, prepaid insurance and taxes.</p>;
    case "rentGrowthPct":
    case "expenseGrowthPct":
    case "appreciationPct":
      return <p className="ev-note">A conservative long-run assumption, close to inflation. The max offer doesn't depend on it; only the {deal.holdYears}-year return does.</p>;
    case "sellingCostPct":
      return <p className="ev-note">Agent commissions (~5–6%) plus seller closing costs.</p>;
    default:
      return null;
  }
}

/** Evidence for loan terms. */
export function termEvidence(k: keyof Terms, structure: StructureId, t: Terms, d: Deal, data: Lookup | null, macro: Rates | null): React.ReactNode {
  const pmms = d.marketRatePct;
  const asOf = macro?.asOf ?? data?.rates.asOf;
  if (k === "ratePct" || k === "refiRatePct") {
    const spread = +(t[k] - pmms).toFixed(3);
    return (
      <>
        <Calc rows={[["Freddie Mac 30-yr average", pct(pmms)], [`+ ${structure === "fha" ? "FHA" : structure === "conventional" ? "investor" : "DSCR / non-QM"} spread`, `${spread >= 0 ? "+" : ""}${pct(spread)}`], ["= rate used", pct(t[k] as number, 3), true]]} />
        <Sources list={[fred("MORTGAGE30US", "Freddie Mac PMMS 30-yr fixed", asOf ? `week of ${asOf}` : undefined), { name: "Get a real quote; spreads vary by lender and credit" }]} />
      </>
    );
  }
  if (k === "existingBalance" || k === "existingRatePct" || k === "existingYearsLeft") {
    const p = data?.property;
    const est = estimateExistingLoan(p?.lastSalePrice, p?.lastSaleDate, pmms);
    if (!est || !p?.lastSalePrice) return <p className="ev-note">No sale history, so the AI assumes 70% of value at 3.5%. Ask the seller for their mortgage statement.</p>;
    return (
      <>
        <Calc
          rows={[
            ["Last sale", `${money(p.lastSalePrice)} (${p.lastSaleDate?.slice(0, 10)})`],
            ["Assumed loan (80%)", money(p.lastSalePrice * 0.8)],
            [`${est.year} average 30-yr rate`, pct(est.ratePct)],
            ["Paid down to today", money(est.balance), true],
            ["Years left", `${est.yearsLeft}`],
          ]}
        />
        <p className="ev-note">An estimate. Many sellers refinanced or put down more or less than 20%. Get the mortgage statement before you offer.</p>
        <Sources list={[{ ...RENTCAST, name: "Sale history via RentCast" }, fred("MORTGAGE30US", "Freddie Mac rate history")]} />
      </>
    );
  }
  const notes: Partial<Record<keyof Terms, string>> = {
    downPct: structure === "fha" ? "FHA minimum is 3.5% with a 580+ credit score." : structure === "sellerFinance" ? "Sellers commonly ask 5–20% down. Lower down usually means a higher price or rate." : "Investor loans typically need 20–25% down; 25% gets the best pricing.",
    amortYears: "Standard 30-year amortization.",
    pointsPct: "Points are upfront fees, 1% of the loan each. DSCR lenders often charge 1–2.",
    ioYears: "Interest-only periods raise early cash flow but build no equity.",
    mipPct: "FHA annual mortgage insurance has been 0.55% for most 30-year loans since HUD's 2023 cut.",
    bankLtvPct: "Most DSCR lenders cap loan-to-value at 75–80% and combined (with a seller 2nd) at 85–90%.",
    morbyCarryPct: "Seller carries part of the down payment as a 2nd lien, often at 0% and deferred.",
    sellerRatePct: "Sellers who own free and clear often accept 0–6% in exchange for their price.",
    hmLtcPct: "Hard-money lenders typically fund 85–90% of purchase plus rehab.",
    hmRatePct: "Hard money usually costs 10–13% interest plus 2 points.",
    refiLtvPct: "Cash-out refis on rentals typically top out at 70–75% of appraised value after 6 months' seasoning.",
    rehabMonths: "Most lenders require 6 months of ownership before a cash-out refi at the new value.",
    sellerCarryPct: "0% means pure subject-to: you pay the seller's equity in cash. Raise it to have them carry part as a note.",
    arrears: "Missed payments you'd have to catch up at closing to reinstate the loan.",
  };
  return notes[k] ? <p className="ev-note">{notes[k]}</p> : null;
}
