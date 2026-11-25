import { Deal, Result, money, vsRiskFree } from "../lib/model";

const pct = (n: number, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : "∞");
const tone = (n: number) => (n >= 0 ? "good" : "bad");

/** This deal vs. parking the same cash at the Fed rate, in nominal and inflation-adjusted terms. */
export function OpportunityPanel({ result, deal, tbill, asOf }: {
  result: Result;
  deal: Deal;
  tbill: number | null;
  asOf: { fed: string | null; cpi: string | null };
}) {
  const o = vsRiskFree(result, deal);

  return (
    <div>
      <p className="muted small" style={{ marginTop: -6 }}>
        Fed funds {deal.riskFreePct}%{asOf.fed ? ` (${asOf.fed})` : ""} · inflation (CPI, YoY) {deal.inflationPct}%{asOf.cpi ? ` (${asOf.cpi.slice(0, 7)})` : ""}
        {tbill != null ? ` · 3-mo T-bill ${tbill}%` : ""}
      </p>

      {deal.riskFreePct < deal.inflationPct && (
        <p className="verdict warn-bg">
          Right now the Fed rate ({deal.riskFreePct}%) is <b>below</b> inflation ({deal.inflationPct}%). Cash parked in T-bills or a money-market fund is losing about {(deal.inflationPct - deal.riskFreePct).toFixed(2)}% of its buying power a year, so beating inflation is the stricter test.
        </p>
      )}

      {o ? (
        <>
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr><th>Same {money(o.cash)}…</th><th>In this property</th><th>At the Fed rate</th></tr>
              </thead>
              <tbody>
                <tr><td>Year-1 income</td><td>{money(o.assetIncome)}</td><td>{money(o.fedIncome)}</td></tr>
                <tr><td>Cash yield</td><td>{pct(o.assetYield)}</td><td>{pct(deal.riskFreePct, 2)}</td></tr>
                <tr><td>Real yield (after inflation)</td><td className={tone(o.realAssetYield)}>{pct(o.realAssetYield)}</td><td className={tone(o.realFedYield)}>{pct(o.realFedYield)}</td></tr>
                <tr><td>Value after {o.years} yrs</td><td>{money(o.assetEndWealth)}</td><td>{money(o.fedEndWealth)}</td></tr>
                <tr><td>…in today's dollars</td><td className={tone(o.assetReal - o.cash)}>{money(o.assetReal)}</td><td className={tone(o.fedReal - o.cash)}>{money(o.fedReal)}</td></tr>
                <tr className="total"><td>Annual return (IRR)</td><td>{pct(o.irr)} <span className="muted">· real {pct(o.realIrr)}</span></td><td>{pct(deal.riskFreePct, 2)} <span className="muted">· real {pct(o.realFedYield)}</span></td></tr>
              </tbody>
            </table>
          </div>
          <p className="verdict">{verdict(o, deal)}</p>
          <p className="muted small">
            To keep its buying power, {money(o.cash)} has to grow to {money(o.inflationEndWealth)} in {o.years} yrs. "Value after" counts every year's cash flow plus your sale proceeds, with the cash flow not reinvested.
          </p>
        </>
      ) : (
        <p className="muted">All your cash comes back out at the refi, so there's nothing to compare against the Fed rate.</p>
      )}

      <p className="muted small">
        You can't buy the Fed rate directly, but T-bills and money-market funds track it. Their interest is taxed as ordinary income, while rental cash flow is usually sheltered by depreciation, so after tax the gap is usually wider in the property's favor than shown here.
      </p>
    </div>
  );
}

function verdict(o: NonNullable<ReturnType<typeof vsRiskFree>>, d: Deal): string {
  const spread = o.assetYield - d.riskFreePct;
  const wealthGap = o.assetEndWealth - o.fedEndWealth;
  const parts: string[] = [];
  if (o.realAssetYield < 0) parts.push(`At this price the cash flow loses ${Math.abs(o.realAssetYield).toFixed(1)}% a year to inflation.`);
  if (spread >= 0) parts.push(`The property's cash yield beats the Fed rate by ${spread.toFixed(1)} pts.`);
  else parts.push(`Parked at the Fed rate, the cash would earn ${Math.abs(spread).toFixed(1)} pts more a year than this property's cash flow, with no tenants or repairs.`);
  if (wealthGap >= 0) parts.push(`Counting appreciation and paydown, the property comes out ${money(wealthGap)} ahead after ${o.years} yrs.`);
  else parts.push(`Even counting appreciation, it trails the Fed rate by ${money(-wealthGap)} after ${o.years} yrs.`);
  if (spread < 0 && wealthGap >= 0) parts.push("So the return depends on appreciation, not cash flow. Ken would call that speculating.");
  return parts.join(" ");
}
