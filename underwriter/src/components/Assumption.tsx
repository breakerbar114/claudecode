import { Slider, Unit, fmtVal } from "./Slider";

interface Base {
  id: string;
  label: string;
  /** Where the AI's value came from, shown as a chip: "Rent comps", "County bill", "Freddie Mac"… */
  source?: string;
  /** One-line reasoning for the AI value, shown when the row is open. */
  why?: string;
  open: boolean;
  onToggle: (id: string) => void;
}

interface NumProps extends Base {
  value: number;
  /** The AI's value. Omit for inputs that are purely yours (purchase price, targets). */
  ai?: number;
  unit: Unit;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  marker?: { value: number; label: string };
  extra?: React.ReactNode;
}

// Sources that are plain defaults rather than data get a quiet gray chip.
const DEFAULT_SOURCES = new Set(["None assumed", "Default", "Typical", "Standard", "Tenant pays", "Long-run avg", "= value", "Pure sub-to"]);
const chipClass = (src: string) => (DEFAULT_SOURCES.has(src) ? "chip chip-default" : "chip chip-ai");

export function isEdited(value: number, ai: number | undefined, step = 0): boolean {
  if (ai === undefined) return false;
  return Math.abs(value - ai) > Math.max(step / 2, Math.abs(ai) * 0.002, 1e-6);
}

export function Assumption(p: NumProps) {
  const edited = isEdited(p.value, p.ai, p.step);
  const aiRec = p.ai !== undefined ? { value: p.ai, why: "", aggressive: "above" as const } : undefined;
  return (
    <div className={`asm ${edited ? "edited" : ""} ${p.open ? "open" : ""}`}>
      <button className="asm-row" onClick={() => p.onToggle(p.id)} aria-expanded={p.open}>
        <span className="asm-label">{p.label}</span>
        <span className="asm-value">{fmtVal(p.value, p.unit)}</span>
        {edited ? <span className="chip chip-edited">You</span> : p.source ? <span className={chipClass(p.source)}>{p.source}</span> : null}
      </button>
      {edited && p.ai !== undefined && (
        <div className="asm-edit">
          AI said {fmtVal(p.ai, p.unit)}
          {p.onReset && (
            <button className="asm-reset" onClick={p.onReset}>
              ↺ Undo
            </button>
          )}
        </div>
      )}
      {p.open && (
        <div className="asm-body">
          {p.why && <p className="asm-why">{p.why}</p>}
          <Slider bare label={p.label} value={p.value} onChange={p.onChange} min={p.min} max={p.max} step={p.step} unit={p.unit} marker={p.marker} rec={aiRec} />
          {p.extra}
        </div>
      )}
    </div>
  );
}

interface ToggleProps extends Base {
  value: boolean;
  ai?: boolean;
  onChange: (v: boolean) => void;
  onReset?: () => void;
}

export function AssumptionToggle(p: ToggleProps) {
  const edited = p.ai !== undefined && p.value !== p.ai;
  return (
    <div className={`asm ${edited ? "edited" : ""}`}>
      <label className="asm-row asm-toggle-row">
        <span className="asm-label">{p.label}</span>
        <input type="checkbox" checked={p.value} onChange={(e) => p.onChange(e.target.checked)} />
        <span className="toggle-ui" />
        {edited ? <span className="chip chip-edited">You</span> : p.source ? <span className={chipClass(p.source)}>{p.source}</span> : null}
      </label>
      {edited && (
        <div className="asm-edit">
          AI said {p.ai ? "on" : "off"}
          {p.onReset && <button className="asm-reset" onClick={p.onReset}>↺ Undo</button>}
        </div>
      )}
    </div>
  );
}

export function AsmGroup({ title, note, children, collapsed }: { title: string; note?: React.ReactNode; children: React.ReactNode; collapsed?: boolean }) {
  return (
    <details className="asm-group" open={!collapsed}>
      <summary>
        <span>{title}</span>
        {note && <span className="asm-group-note">{note}</span>}
      </summary>
      <div>{children}</div>
    </details>
  );
}
