import { useState } from "react";
import { CompResult, RentComp, Subject } from "../lib/comps";
import { money } from "../lib/model";

interface Props {
  result: CompResult;
  subject: Subject & { yearBuilt?: number };
  setSubject: (s: Subject & { yearBuilt?: number }) => void;
  comps: RentComp[];
  setComps: (c: RentComp[]) => void;
  units: number;
  currentRent: number;
  onUse: (totalRent: number) => void;
  hosted: boolean;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const signed = (n: number) => (Math.abs(n) < 0.5 ? "–" : `${n > 0 ? "+" : "−"}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`);

export function RentCompsPanel({ result, subject, setSubject, comps, setComps, units, currentRent, onUse, hosted }: Props) {
  const [draft, setDraft] = useState({ address: "", rent: "", beds: "", baths: "", sqft: "", distance: "" });
  const update = (id: string, patch: Partial<RentComp>) => setComps(comps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const rent = Number(draft.rent.replace(/[$,]/g, ""));
    if (!(rent > 0)) return;
    setComps([
      ...comps,
      {
        id: `m${Date.now()}`,
        address: draft.address.trim() || `Comp ${comps.length + 1}`,
        rent,
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
  const perUnitNow = currentRent / Math.max(units, 1);

  return (
    <div className="card">
      <h3>Rent comps</h3>
      <div className="comp-summary">
        <div>
          <div className="kpi-label">Recommended rent</div>
          <div className="comp-rec">{result.recommended ? `${money(result.recommended)}/unit` : "Add comps"}</div>
          {result.recommended && (
            <div className="muted small">
              Middle half of comps {money(result.low!)}–{money(result.high!)} · {result.used} used · {result.confidence} confidence
            </div>
          )}
        </div>
        {result.recommended && Math.abs(perUnitNow - result.recommended) >= 1 && (
          <div className="comp-actions">
            <div className="muted small">You're using {money(perUnitNow)}/unit ({(((perUnitNow - result.recommended) / result.recommended) * 100).toFixed(0)}% vs comps)</div>
            <button className="rec-use big" onClick={() => onUse(result.recommended! * Math.max(units, 1))}>Use {money(result.recommended * Math.max(units, 1))}{units > 1 ? " total" : ""}</button>
          </div>
        )}
      </div>

      <div className="subject">
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
      </div>

      {comps.length > 0 && (
        <div className="table-scroll">
          <table className="plain comps">
            <thead>
              <tr>
                <th>Use</th><th>Comp</th><th>Rent</th><th>Bd/Ba</th><th>Sqft</th><th>Dist</th><th>Size</th><th>Beds</th><th>Baths</th><th>Adjusted</th><th>Weight</th><th></th>
              </tr>
            </thead>
            <tbody>
              {result.comps.map((c) => (
                <tr key={c.id} className={c.weight === 0 ? "dim" : ""}>
                  <td><input type="checkbox" aria-label={`Use ${c.address}`} checked={c.include} onChange={(e) => update(c.id, { include: e.target.checked })} /></td>
                  <td className="addr">{c.address}<div className="muted small">{c.source === "manual" ? "added by you" : "RentCast"}{c.date ? ` · ${c.date.slice(0, 10)}` : ""}</div></td>
                  <td>{money(c.rent)}</td>
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
        <input id="comp-address" placeholder="Comp address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
        <input id="comp-rent" placeholder="Rent $/mo" inputMode="decimal" value={draft.rent} onChange={(e) => setDraft({ ...draft, rent: e.target.value })} />
        <input id="comp-beds" placeholder="Beds" inputMode="decimal" value={draft.beds} onChange={(e) => setDraft({ ...draft, beds: e.target.value })} />
        <input id="comp-baths" placeholder="Baths" inputMode="decimal" value={draft.baths} onChange={(e) => setDraft({ ...draft, baths: e.target.value })} />
        <input id="comp-sqft" placeholder="Sqft" inputMode="decimal" value={draft.sqft} onChange={(e) => setDraft({ ...draft, sqft: e.target.value })} />
        <input id="comp-dist" placeholder="Miles" inputMode="decimal" value={draft.distance} onChange={(e) => setDraft({ ...draft, distance: e.target.value })} />
        <button type="submit">Add comp</button>
      </form>
      <p className="muted small">
        Each comp is adjusted to your property: size ±3.5% rent per 10% sqft (max ±15%), {subject.sqft ? "4%" : "8%"} per bedroom, 3% per bathroom.
        It's then weighted by similarity, distance and how recent the listing is. Comps more than 40% off in size, 2+ bedrooms apart, or needing over 30% in adjustments are dropped.
        {hosted ? " Add comps from rentals you see on Zillow, Apartments.com or Rentometer: 3–6 within a mile and listed in the last 4 months works best." : ""}
      </p>
    </div>
  );
}
