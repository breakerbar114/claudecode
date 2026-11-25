import { useMemo } from "react";
import { Deal, StructureId, Terms, underwrite, money } from "../lib/model";

/** Monthly cash flow across a range of purchase prices, with the target line and your max offer marked. */
export function PriceCurve({ id, deal, terms, target, maxOffer }: { id: StructureId; deal: Deal; terms: Terms; target: number; maxOffer: number | null }) {
  const W = 640, H = 220, P = { l: 56, r: 16, t: 14, b: 30 };
  const ref = deal.marketValue || deal.price;
  const pts = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const price = ref * (0.5 + i * 0.025);
      out.push({ x: price, y: underwrite(id, deal, terms, price, true).cashFlow });
    }
    return out;
  }, [id, deal, terms, ref]);

  const xMin = pts[0].x, xMax = pts[pts.length - 1].x;
  const ys = pts.map((p) => p.y).concat([target, 0]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = (yMax - yMin) * 0.08 || 100;
  const sx = (x: number) => P.l + ((x - xMin) / (xMax - xMin)) * (W - P.l - P.r);
  const sy = (y: number) => P.t + (1 - (y - (yMin - pad)) / (yMax - yMin + 2 * pad)) * (H - P.t - P.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xTicks = [xMin, ref, xMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Monthly cash flow by purchase price">
      {yTicks.map((y, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={sy(y)} y2={sy(y)} className="grid" />
          <text x={P.l - 6} y={sy(y) + 4} textAnchor="end" className="tick">{money(y)}</text>
        </g>
      ))}
      {xTicks.map((x, i) => (
        <text key={i} x={sx(x)} y={H - 8} textAnchor="middle" className="tick">
          {money(x / 1000)}k{i === 1 ? " (value)" : ""}
        </text>
      ))}
      <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="zero" />
      <line x1={P.l} x2={W - P.r} y1={sy(target)} y2={sy(target)} className="target" />
      <text x={W - P.r} y={sy(target) - 5} textAnchor="end" className="tick target-label">target {money(target)}/mo</text>
      <path d={path} className="curve" />
      {deal.price >= xMin && deal.price <= xMax && (
        <circle cx={sx(deal.price)} cy={sy(underwrite(id, deal, terms, deal.price, true).cashFlow)} r={5} className="dot-current">
          <title>Your price</title>
        </circle>
      )}
      {maxOffer && maxOffer >= xMin && maxOffer <= xMax && (
        <g>
          <line x1={sx(maxOffer)} x2={sx(maxOffer)} y1={P.t} y2={H - P.b} className="max-line" />
          <text x={sx(maxOffer) + 5} y={P.t + 10} className="tick max-label">max {money(maxOffer / 1000)}k</text>
        </g>
      )}
    </svg>
  );
}

/** Price × rent grid of monthly cash flow. */
export function Sensitivity({ id, deal, terms, target }: { id: StructureId; deal: Deal; terms: Terms; target: number }) {
  const priceSteps = [-0.15, -0.1, -0.05, 0, 0.05, 0.1];
  const rentSteps = [0.1, 0.05, 0, -0.05, -0.1];
  return (
    <div className="table-scroll">
      <table className="sens">
        <thead>
          <tr>
            <th>Rent ↓ / Price →</th>
            {priceSteps.map((p) => (
              <th key={p}>{money((deal.price * (1 + p)) / 1000)}k</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rentSteps.map((r) => (
            <tr key={r}>
              <th>{money(deal.rent * (1 + r))}</th>
              {priceSteps.map((p) => {
                const cf = underwrite(id, { ...deal, rent: deal.rent * (1 + r) }, terms, deal.price * (1 + p), true).cashFlow;
                const cls = cf >= target ? "good" : cf >= 0 ? "ok" : "bad";
                return (
                  <td key={p} className={`${cls} ${p === 0 && r === 0 ? "current" : ""}`}>
                    {money(cf)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
