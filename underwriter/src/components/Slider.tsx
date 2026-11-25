import { useEffect, useState } from "react";
import { Rec, deviation } from "../lib/recommend";

type Unit = "$" | "%" | "yrs" | "mo" | "x" | "" | "units";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: Unit;
  hint?: string;
  marker?: { value: number; label: string };
  /** Fixed recommended value: drawn on the track, explained under it, one click to apply. */
  rec?: Rec;
}

const fmtVal = (v: number, unit: Unit) => {
  if (unit === "$") return "$" + Math.round(v).toLocaleString("en-US");
  if (unit === "%") return `${+v.toFixed(3)}%`;
  if (unit === "x") return `${v.toFixed(2)}×`;
  if (unit === "yrs") return `${v} yr${v === 1 ? "" : "s"}`;
  if (unit === "mo") return `${v} mo`;
  return String(v);
};

export function Slider({ label, value, onChange, min, max, step = 1, unit = "", hint, marker, rec }: Props) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(+value.toFixed(4)));
  }, [value, editing]);

  // Let the track grow if the user types something beyond the preset range.
  const lo = Math.min(min, value, rec?.value ?? Infinity);
  const hi = Math.max(max, value, rec?.value ?? -Infinity);
  const dev = rec ? deviation(value, rec) : null;
  const atRec = rec ? Math.abs(value - rec.value) <= Math.max(step / 2, Math.abs(rec.value) * 0.005) : false;
  const pct = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  return (
    <div className="slider">
      <div className="slider-head">
        <label title={hint}>
          {label}
          {hint && <span className="hint-dot" aria-hidden>?</span>}
        </label>
        {editing ? (
          <input
            className="slider-input"
            autoFocus
            value={text}
            inputMode="decimal"
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const n = parseFloat(text.replace(/[$,%\s]/g, ""));
              if (!Number.isNaN(n)) onChange(n);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button className="slider-value" onClick={() => setEditing(true)} title="Click to type an exact value">
            {fmtVal(value, unit)}
          </button>
        )}
      </div>
      <div className="slider-track-wrap">
        <input
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ["--fill" as string]: `${pct(value)}%` }}
        />
        {marker && marker.value >= lo && marker.value <= hi && (
          <span className="slider-marker" style={{ left: `${pct(marker.value)}%` }} title={`${marker.label}: ${fmtVal(marker.value, unit)}`} />
        )}
        {rec && <span className="slider-rec" style={{ left: `${pct(rec.value)}%` }} title={`Recommended: ${fmtVal(rec.value, unit)}`} />}
      </div>
      {rec && (
        <div className={`rec-line ${atRec ? "at" : dev?.aggressive ? "aggr" : ""}`}>
          <span className="rec-badge">{atRec ? "✓ Recommended" : `Recommended ${fmtVal(rec.value, unit)}`}</span>
          {!atRec && dev && (
            <span className="rec-dev">
              {dev.pct > 0 ? "+" : ""}
              {dev.pct.toFixed(0)}%{dev.aggressive ? " · aggressive" : ""}
            </span>
          )}
          {!atRec && (
            <button className="rec-use" onClick={() => onChange(rec.value)}>
              Use
            </button>
          )}
          <span className="rec-why">{rec.why}</span>
        </div>
      )}
    </div>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" />
      <span>{label}</span>
    </label>
  );
}
