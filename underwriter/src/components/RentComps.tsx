import { useState } from "react";
import { CompResult, Comp, Subject, PROFILES } from "../lib/comps";
import { money } from "../lib/model";

interface Props {
  result: CompResult;
  subject: Subject & { yearBuilt?: number };
  setSubject: (s: Subject & { yearBuilt?: number }) => void;
  comps: Comp[];
  setComps: (c: Comp[]) => void;
  units: number;
  currentRent: number;
  onUse: (total: number) => void;
  hosted: boolean;
  kind?: "rent" | "sale";
  /** Hide the subject editor (shown once, above both comp sets). */
  hideSubject?: boolean;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const signed = (n: number) => (Math.abs(n) < 0.5 ? "–" : `${n > 0 ? "+" : "−"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`);

export function RentCompsPanel({ result, subject, setSubject, comps, setComps, units, currentRent, onUse, hosted, kind = "rent", hideSubject }: Props) {
  const sale = kind === "sale";
  const P = PROFILES[kind];
  const u = sale ? 1 : Math.max(units, 1);
  const [draft, setDraft] = useState({ address: "", rent: "", beds: "", baths: "", sqft: "", distance: "" });
  const update = (id: string, patch: Partial<Comp>) => setComps(comps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(draft.rent.replace(/[$,]/g, ""));
    if (!(amount > 0)) return;
    setComps([
      ...comps,
      {
        id: `m${Date.now()}`,
        address: draft.address.trim() || `Comp ${comps.length + 1}`,
        amount,
        beds: num(draft.beds),
        baths: num(draft.baths),
        sqft: num(draft.sqft),
        distance: num(draft.distance),
        date: new Date().toISOString().slice(0, 10),
        include: true,
        source: "manual",
      },
    ]);
    setDraft({ address: "", rent: "", beds: "", baths: "", sqft: "", distance: "" });
  };
  const perUnitNow = currentRent / u;

  return (
    <div className="card">
      <h3>{sale ? "Sale comps" : "Rent comps"}</h3>
      <div className="comp-summary">
        <div>
          <div className="kpi-label">{sale ? "Value from sale comps" : "Recommended rent"}</div>
          <div className="comp-rec">{result.recommended ? `${money(result.recommended)}${sale ? "" : "/unit"}` : "Add comps"}</div>
          {result.recommended && (
            <div className="muted small">
              Middle half of comps {money(result.low!)}–{money(result.high!)} · {result.used} used · {result.confidence} confidence
            </div>
          )}
        </div>
        {result.recommended && Math.abs(perUnitNow - result.recommended) >= 1 && (
          <div className="comp-actions">
            <div className="muted small">You're using {money(perUnitNow)}{sale ? "" : "/unit"} ({(((perUnitNow - result.recommended) / result.recommended) * 100).toFixed(0)}% vs comps)</div>
            <button className="rec-use big" onClick={() => onUse(result.recommended! * u)}>Use {money(result.recommended * u)}{u > 1 ? " total" : ""}</button>
          </div>
        )}
      </div>

      {!hideSubject && <div className="subject">
        <span className="muted small">Subject property</span>
        {(["beds", "baths", "sqft", "yearBuilt"] as const).map((k) => (
          <label key={k}>
            {k === "yearBuilt" ? "Year built" : k === "sqft" ? "Sqft" : k[0].toUpperCase() + k.slice(1)}
            <input
              id={`subject-${k}`}
              inputMode="decimal"
              value={subject[k] ?? ""}
              onChange={(e) => setSubject({ ...subject, [k]: num(e.target.value) })}
            />
          </label>
        ))}
      </div>}

      {comps.length > 0 && (
        <div className="table-scroll">
          <table className="plain comps">
            <thead>
              <tr>
                <th>Use</th><th>Comp</th><th>{sale ? "Price" : "Rent"}</th><th>Bd/Ba</th><th>Sqft</th><th>Dist</th><th>Size</th><th>Beds</th><th>Baths</th><th>Adjusted</th><th>Weight</th><th></th>
              </tr>
            </thead>
            <tbody>
              {result.comps.map((c) => (
                <tr key={c.id} className={c.weight === 0 ? "dim" : ""}>
                  <td><input type="checkbox" aria-label={`Use ${c.address}`} checked={c.include} onChange={(e) => update(c.id, { include: e.target.checked })} /></td>
                  <td className="addr">{c.address}<div className="muted small">{c.source === "manual" ? "added by you" : "RentCast"}{c.status ? ` · ${c.status}` : ""}{c.date ? ` · ${c.date.slice(0, 10)}` : ""}</div></td>
                  <td>{money(c.amount)}</td>
                  <td>{c.beds ?? "–"}/{c.baths ?? "–"}</td>
                  <td>{c.sqft ? c.sqft.toLocaleString("en-US") : "–"}</td>
                  <td>{c.distance != null ? `${c.distance.toFixed(2)} mi` : "–"}</td>
                  <td>{signed(c.adjSqft)}</td>
                  <td>{signed(c.adjBeds)}</td>
                  <td>{signed(c.adjBaths)}</td>
                  <td><b>{money(c.adjusted)}</b>{c.tooDifferent && <div className="small bad">too different</div>}</td>
                  <td>{c.weight > 0 ? `${Math.round(c.weight * 100)}%` : "–"}</td>
                  <td>{c.source === "manual" && <button className="link" onClick={() => setComps(comps.filter((x) => x.id !== c.id))} aria-label="Remove comp">✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="comp-add" onSubmit={add}>
        <input id={`${kind}-comp-address`} placeholder="Comp address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
        <input id={`${kind}-comp-rent`} placeholder={sale ? "Price $" : "Rent $/mo"} inputMode="decimal" value={draft.rent} onChange={(e) => setDraft({ ...draft, rent: e.target.value })} />
        <input id={`${kind}-comp-beds`} placeholder="Beds" inputMode="decimal" value={draft.beds} onChange={(e) => setDraft({ ...draft, beds: e.target.value })} />
        <input id={`${kind}-comp-baths`} placeholder="Baths" inputMode="decimal" value={draft.baths} onChange={(e) => setDraft({ ...draft, baths: e.target.value })} />
        <input id={`${kind}-comp-sqft`} placeholder="Sqft" inputMode="decimal" value={draft.sqft} onChange={(e) => setDraft({ ...draft, sqft: e.target.value })} />
        <input id={`${kind}-comp-dist`} placeholder="Miles" inputMode="decimal" value={draft.distance} onChange={(e) => setDraft({ ...draft, distance: e.target.value })} />
        <button type="submit">Add comp</button>
      </form>
      <p className="muted small">
        Each comp is adjusted to your property: size ±{(P.sqft * 10).toFixed(1)}% {sale ? "price" : "rent"} per 10% sqft (max ±{P.maxSqft * 100}%), {((subject.sqft ? P.bedWithSqft : P.bedNoSqft) * 100).toFixed(0)}% per bedroom, {(P.bath * 100).toFixed(1)}% per bathroom.
        It's then weighted by similarity, distance and how recent it is. Comps more than 40% off in size, 2+ bedrooms apart, or needing over 30% in adjustments are dropped.
        {hosted ? (sale ? " Add recent sales from Zillow or Redfin: 3–6 within a mile, sold in the last 6 months, works best." : " Add comps from rentals you see on Zillow, Apartments.com or Rentometer: 3–6 within a mile and listed in the last 4 months works best.") : ""}
      </p>
    </div>
  );
}
