import { useEffect, useMemo, useState } from "react";
import { Assumption, AssumptionToggle, AsmGroup, isEdited } from "./components/Assumption";
import { PriceCurve, Sensitivity } from "./components/Charts";
import { OpportunityPanel } from "./components/Opportunity";
import { RentCompsPanel } from "./components/RentComps";
import { Unit } from "./components/Slider";
import { Deal, Result, StructureId, Targets, Terms, fmt, money, maxPrice, scorecard, underwrite } from "./lib/model";
import { STRUCTURES, defaultTerms } from "./lib/structures";
import { Keys, Lookup, Rates, STATIC, getRates, lookup, store } from "./lib/api";
import { estimateExistingLoan } from "./lib/estimate";
import { initialPayment } from "./lib/finance";
import { RentComp, Subject, runComps } from "./lib/comps";
import { Rec, RecKey, recommend, stateFromAddress } from "./lib/recommend";

// The deal the AI starts from before any lookup: a typical suburban single-family rental.
const SAMPLE: Deal = {
  price: 285000, marketValue: 295000, arv: 295000, units: 1, rent: 2250, otherIncome: 0,
  vacancyPct: 7, mgmtPct: 10, repairsPct: 7, capexPct: 7, taxRatePct: 1.1, taxesAnnualActual: 2900,
  reassessTaxes: true, insuranceAnnual: 2100, hoaMonthly: 0, utilitiesMonthly: 0, otherExpMonthly: 0,
  closingCostPct: 3, rehab: 0, marketRatePct: 6.5, rentGrowthPct: 3, expenseGrowthPct: 3.5,
  appreciationPct: 3, holdYears: 7, sellingCostPct: 7, inflationPct: 3, riskFreePct: 4,
};
const SAMPLE_SUBJECT = { beds: 3, baths: 2, sqft: 1500, yearBuilt: 1995 };

const DEFAULT_TARGETS: Targets = { minCashFlow: 200, minDscr: 1.25, minCoc: 8, useDscr: true, useCoc: false, maxCashLeft: 10000, beatInflation: true, cashHurdle: "inflation", cashPremiumPct: 2 };

type TermsMap = Record<StructureId, Terms>;
type SubjectFacts = Subject & { yearBuilt?: number };
type LoanEst = { balance: number; ratePct: number; yearsLeft: number } | null;

/**
 * Two layers: what the AI set (aiDeal + live recommendations + default terms) and what you changed (overrides).
 * The deal on screen is always AI ⊕ overrides, so every edit is visible, countable and undoable.
 */
interface Saved {
  name: string;
  aiDeal: Deal;
  dealOv: Partial<Deal>;
  termsOv: Partial<Record<StructureId, Partial<Terms>>>;
  loanEst: LoanEst;
  structure: StructureId;
  lookup: Lookup | null;
  comps: RentComp[];
  subject: SubjectFacts;
  address: string;
}

function compsFromLookup(l: Lookup): RentComp[] {
  return (l.rent?.comps ?? [])
    .filter((c) => c.price > 0)
    .map((c, i) => ({ id: `rc${i}`, address: c.address, rent: c.price, beds: c.beds, baths: c.baths, sqft: c.sqft, distance: c.distance, date: c.date, correlation: c.correlation, include: true, source: "rentcast" as const }));
}

const recPatch = (r: Partial<Record<RecKey, Rec>>): Partial<Deal> => {
  const p: Partial<Deal> = {};
  for (const [k, v] of Object.entries(r)) if (v) (p as Record<string, number>)[k] = v.value;
  if (r.taxRatePct) p.reassessTaxes = true;
  return p;
};

const LABELS: Partial<Record<keyof Deal | keyof Terms, string>> = {
  rent: "Rent", vacancyPct: "Vacancy", taxRatePct: "Tax rate", insuranceAnnual: "Insurance", mgmtPct: "Management",
  repairsPct: "Repairs", capexPct: "CapEx", marketValue: "Value", rehab: "Rehab", arv: "ARV", closingCostPct: "Closing costs",
  units: "Units", otherIncome: "Other income", hoaMonthly: "HOA", utilitiesMonthly: "Utilities", otherExpMonthly: "Other expenses",
  reassessTaxes: "Tax reassessment", rentGrowthPct: "Rent growth", expenseGrowthPct: "Expense growth", appreciationPct: "Appreciation",
  holdYears: "Hold period", sellingCostPct: "Selling costs", inflationPct: "Inflation", riskFreePct: "Fed rate",
  taxesAnnualActual: "Tax bill", marketRatePct: "Market rate",
};

type Tab = "checks" | "comps" | "proforma" | "loans" | "projection" | "sensitivity" | "fed" | "sources";

export default function App() {
  const saved = store.get<Saved | null>("uw:v2", null);
  const [aiDeal, setAiDeal] = useState<Deal>({ ...SAMPLE, ...(saved?.aiDeal ?? {}) });
  const [dealOv, setDealOv] = useState<Partial<Deal>>(saved?.dealOv ?? {});
  const [termsOv, setTermsOv] = useState<Partial<Record<StructureId, Partial<Terms>>>>(saved?.termsOv ?? {});
  const [loanEst, setLoanEst] = useState<LoanEst>(saved?.loanEst ?? null);
  const [structure, setStructure] = useState<StructureId>(saved?.structure && STRUCTURES.some((s) => s.id === saved.structure) ? saved.structure : "conventional");
  const [targets, setTargets] = useState<Targets>({ ...DEFAULT_TARGETS, ...store.get<Partial<Targets>>("uw:targets", {}) });
  const [macro, setMacro] = useState<Rates | null>(saved?.lookup?.rates ?? null);
  const [data, setData] = useState<Lookup | null>(saved?.lookup ?? null);
  const [address, setAddress] = useState(saved?.address ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<Keys>(store.get("uw:keys", { rentcast: "", census: "" }));
  const [showKeys, setShowKeys] = useState(false);
  const [library, setLibrary] = useState<Saved[]>(store.get("uw:library2", []));
  const [comps, setComps] = useState<RentComp[]>(saved?.comps ?? []);
  const [subject, setSubject] = useState<SubjectFacts>(saved?.subject ?? SAMPLE_SUBJECT);
  const [tab, setTab] = useState<Tab>("checks");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const toggleRow = (id: string) => setOpenRow((o) => (o === id ? null : id));

  useEffect(
    () => store.set("uw:v2", { name: "current", aiDeal, dealOv, termsOv, loanEst, structure, lookup: data, comps, subject, address }),
    [aiDeal, dealOv, termsOv, loanEst, structure, data, comps, subject, address],
  );
  useEffect(() => store.set("uw:targets", targets), [targets]);
  useEffect(() => store.set("uw:keys", keys), [keys]);
  useEffect(() => store.set("uw:library2", library), [library]);
  // Market data refreshes every load and flows into the AI layer.
  useEffect(() => {
    getRates().then((r) => {
      if (!r) return;
      setMacro(r);
      setAiDeal((d) => ({ ...d, marketRatePct: r.thirtyYear, ...macroFields(r) }));
    });
  }, []);

  // ---------- AI layer ----------
  const preRec = { ...aiDeal, ...dealOv };
  const compResult = useMemo(() => runComps(comps, subject), [comps, subject]);
  const propState = data?.geo?.state ?? stateFromAddress(address);
  const recs = useMemo(
    () =>
      recommend({
        units: preRec.units,
        state: propState,
        yearBuilt: subject.yearBuilt,
        marketValue: data?.value?.estimate ?? preRec.marketValue,
        comps: compResult,
        rentAvmPerUnit: data?.rent?.perUnit,
        rentAvmSource: data?.rent?.source,
        lookupTaxRate: data?.taxes.ratePct,
        lookupTaxSource: data?.taxes.source,
        lookupInsurance: data?.insurance.annual,
        currentRent: aiDeal.rent,
      }),
    [preRec.units, propState, subject.yearBuilt, data, preRec.marketValue, compResult, aiDeal.rent],
  );
  const aiFull: Deal = useMemo(() => ({ ...aiDeal, ...recPatch(recs) }), [aiDeal, recs]);
  const deal: Deal = useMemo(() => ({ ...aiFull, ...dealOv }), [aiFull, dealOv]);

  const aiTerms: TermsMap = useMemo(() => {
    const t = Object.fromEntries(STRUCTURES.map((s) => [s.id, defaultTerms(s.id, aiDeal.marketRatePct, aiDeal.marketValue)])) as TermsMap;
    if (loanEst && loanEst.balance > 0)
      for (const id of ["subto", "hybrid"] as const) t[id] = { ...t[id], existingBalance: loanEst.balance, existingRatePct: loanEst.ratePct, existingYearsLeft: Math.max(1, Math.round(loanEst.yearsLeft)) };
    return t;
  }, [aiDeal.marketRatePct, aiDeal.marketValue, loanEst]);
  const termsBy: TermsMap = useMemo(
    () => Object.fromEntries(STRUCTURES.map((s) => [s.id, { ...aiTerms[s.id], ...(termsOv[s.id] ?? {}) }])) as TermsMap,
    [aiTerms, termsOv],
  );
  const terms = termsBy[structure];

  // Setting a value equal to the AI's drops the override, so "edited" always means "different from the AI".
  const setD = (k: keyof Deal) => (v: number | boolean) =>
    setDealOv((o) => {
      const n = { ...o };
      const ai = aiFull[k];
      if (k !== "price" && (typeof v === "boolean" ? v === ai : !isEdited(v, ai as number))) delete n[k];
      else (n as Record<string, unknown>)[k] = v;
      return n;
    });
  const resetD = (k: keyof Deal) => () => setDealOv((o) => { const n = { ...o }; delete n[k]; return n; });
  const setT = (k: keyof Terms) => (v: number | boolean) =>
    setTermsOv((m) => {
      const cur = { ...(m[structure] ?? {}) };
      const ai = aiTerms[structure][k];
      if (typeof v === "boolean" ? v === ai : !isEdited(v, ai as number)) delete cur[k];
      else (cur as Record<string, unknown>)[k] = v;
      return { ...m, [structure]: cur };
    });
  const resetT = (k: keyof Terms) => () => setTermsOv((m) => { const cur = { ...(m[structure] ?? {}) }; delete cur[k]; return { ...m, [structure]: cur }; });
  const setTg = (k: keyof Targets) => (v: number | boolean) => setTargets((t) => ({ ...t, [k]: v }));

  const edits = [
    ...(Object.keys(dealOv) as (keyof Deal)[]).filter((k) => k !== "price").map((k) => LABELS[k] ?? k),
    ...(Object.keys(termsOv[structure] ?? {}) as (keyof Terms)[]).map((k) => TERM_LABEL[k] ?? k),
  ];
  const resetAll = () => {
    setDealOv((o) => (o.price != null ? { price: o.price } : {}));
    setTermsOv({});
  };

  async function runLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim()) return;
    if (STATIC) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const l = await lookup(address.trim(), keys);
      setData(l);
      setMacro(l.rates);
      const units = Math.max(1, l.property.units || 1);
      const value = l.value?.estimate ?? aiDeal.marketValue;
      const taxRate = l.taxes.ratePct ?? aiDeal.taxRatePct;
      setAiDeal({
        ...SAMPLE,
        price: Math.round(value / 1000) * 1000,
        marketValue: value,
        arv: value,
        units,
        rent: l.rent ? Math.round(l.rent.perUnit * units) : aiDeal.rent,
        taxRatePct: +taxRate.toFixed(3),
        taxesAnnualActual: l.taxes.annualActual ?? Math.round((value * taxRate) / 100),
        insuranceAnnual: l.insurance.annual,
        hoaMonthly: l.property.hoaMonthly ?? 0,
        marketRatePct: l.rates.thirtyYear,
        ...macroFields(l.rates),
      });
      setDealOv({});
      setTermsOv({});
      const est = estimateExistingLoan(l.property.lastSalePrice, l.property.lastSaleDate, l.rates.thirtyYear);
      setLoanEst(est && est.balance > 0 ? { balance: est.balance, ratePct: est.ratePct, yearsLeft: est.yearsLeft } : null);
      setComps(compsFromLookup(l));
      setSubject({ beds: l.property.beds, baths: l.property.baths, sqft: l.property.sqft, yearBuilt: l.property.yearBuilt });
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }

  // ---------- Results ----------
  const result = useMemo(() => underwrite(structure, deal, terms), [structure, deal, terms]);
  const score = useMemo(() => scorecard(result, deal), [result, deal]);
  const offers = useMemo(() => STRUCTURES.map((s) => ({ s, ...maxPrice(s.id, deal, termsBy[s.id], targets) })), [deal, termsBy, targets]);
  const current = offers.find((o) => o.s.id === structure)!;
  const aiOffer = useMemo(
    () => (edits.length ? maxPrice(structure, { ...aiFull, price: deal.price }, aiTerms[structure], targets) : current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edits.length, structure, aiFull, deal.price, aiTerms, targets, current],
  );
  const targetCF = targets.minCashFlow * deal.units;
  const ref = deal.marketValue || deal.price;
  const info = STRUCTURES.find((s) => s.id === structure)!;
  const sourcesUsed = data ? data.sources.length : 0;

  const saveDeal = () => {
    const name = data?.address || address.trim() || `Deal ${library.length + 1}`;
    setLibrary((lib) => [{ name, aiDeal, dealOv, termsOv, loanEst, structure, lookup: data, comps, subject, address }, ...lib.filter((x) => x.name !== name)].slice(0, 30));
  };
  const loadDeal = (s: Saved) => {
    setAiDeal(s.aiDeal);
    setDealOv(s.dealOv);
    setTermsOv(s.termsOv);
    setLoanEst(s.loanEst);
    setStructure(STRUCTURES.some((x) => x.id === s.structure) ? s.structure : "conventional");
    setData(s.lookup);
    setComps(s.comps);
    setSubject(s.subject);
    setAddress(s.address);
  };

  // Shared props for number rows on the deal.
  const dRow = (k: keyof Deal, label: string, unit: Unit, min: number, max: number, step: number, source?: string, why?: string, extra?: Partial<React.ComponentProps<typeof Assumption>>) => (
    <Assumption
      key={k}
      id={k}
      label={label}
      value={deal[k] as number}
      ai={k === "price" ? undefined : (aiFull[k] as number)}
      unit={unit}
      min={min}
      max={max}
      step={step}
      source={source}
      why={why}
      open={openRow === k}
      onToggle={toggleRow}
      onChange={setD(k)}
      onReset={resetD(k)}
      {...extra}
    />
  );
  const recSource = (k: RecKey, fallback: string) => (recs[k] ? fallback : "Default");
  const rentSource = compResult.recommended ? `${compResult.used} comps` : data?.rent ? "Rent AVM" : "Estimate";
  const taxSource = data?.taxes.annualActual ? "Tax bill" : data?.taxes.ratePct ? "County data" : propState ? `${propState} avg` : "Estimate";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">▲</span> Deal Underwriter</div>
        <form className="search" onSubmit={runLookup}>
          <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Type a property address — e.g. 123 Main St, Columbus, OH 43215" aria-label="Property address" />
          <button type="submit" disabled={loading}>{loading ? "Underwriting…" : STATIC ? "Set address" : "Underwrite"}</button>
        </form>
        <div className="top-actions">
          <button className="ghost" onClick={saveDeal}>Save</button>
          {library.length > 0 && (
            <select className="ghost" value="" onChange={(e) => { const s = library[+e.target.value]; if (s) loadDeal(s); }} aria-label="Saved deals">
              <option value="">Saved ({library.length})</option>
              {library.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          )}
          {!STATIC && <button className="ghost" onClick={() => setShowKeys((v) => !v)}>Data keys</button>}
        </div>
      </header>

      {showKeys && (
        <div className="keys card">
          <p>Keys are stored only in this browser and sent to your own server. Or set them in <code>.env</code> on the server.</p>
          <label>RentCast API key <a href="https://app.rentcast.io/app/api" target="_blank" rel="noreferrer">get one</a>: property record, value, rent comps, tax bill
            <input type="password" value={keys.rentcast} onChange={(e) => setKeys({ ...keys, rentcast: e.target.value })} />
          </label>
          <label>Census API key <a href="https://api.census.gov/data/key_signup.html" target="_blank" rel="noreferrer">free</a>: area rents and county tax rates when RentCast has nothing
            <input type="password" value={keys.census} onChange={(e) => setKeys({ ...keys, census: e.target.value })} />
          </label>
        </div>
      )}
      {error && <div className="banner bad">{error}</div>}

      {/* ---------- The answer ---------- */}
      <section className="hero card">
        <div className="hero-main">
          <div className="eyebrow">
            {data?.address || address.trim() || "Sample deal · type an address above"}
            {subject.beds != null && <> · {subject.beds} bd / {subject.baths ?? "?"} ba</>}
            {subject.sqft ? <> · {fmt(subject.sqft)} sqft</> : null}
            {subject.yearBuilt ? <> · built {subject.yearBuilt}</> : null}
            {deal.units > 1 && <> · {deal.units} units</>}
          </div>
          <div className="hero-label">Max offer · {info.name}</div>
          <div className="hero-price">{current.price === null ? "No price works" : `${money(current.price)}${current.capped ? "+" : ""}`}</div>
          <p className="hero-verdict">{verdict(result, current.price, ref, targets, deal, score, info.name)}</p>
          <div className={`ai-status ${edits.length ? "has-edits" : ""}`}>
            {edits.length ? (
              <>
                <span className="dot" />
                <span className="ai-text">
                  You changed {edits.length} of the AI's numbers: {edits.slice(0, 4).join(", ")}{edits.length > 4 ? "…" : ""}.
                  {aiOffer.price !== null && current.price !== null && aiOffer.price !== current.price && (
                    <> AI max offer: <b>{money(aiOffer.price)}</b> ({current.price > aiOffer.price ? "+" : "−"}{money(Math.abs(current.price - aiOffer.price))} from your edits).</>
                  )}
                </span>
                <button className="asm-reset" onClick={resetAll}>↺ Reset all to AI</button>
              </>
            ) : (
              <>
                <span className="dot" />
                <span className="ai-text">
                  Every number is set by the AI
                  {sourcesUsed ? ` from ${sourcesUsed} data sources` : compResult.used ? ` from ${compResult.used} rent comps and state data` : " from defaults and state data"}.
                  Tap any assumption to see why or change it.
                </span>
              </>
            )}
          </div>
        </div>
        <div className="grade" data-grade={score.grade}>
          <div className="grade-letter">{score.grade}</div>
          <div className="grade-label">McElroy score {score.score}</div>
        </div>
      </section>

      {STATIC && <LookupLinks address={address.trim()} asOf={macro?.asOf ?? null} />}
      {data?.warnings?.length ? <details className="banner warn"><summary>{data.warnings.length} data note{data.warnings.length > 1 ? "s" : ""}</summary>{data.warnings.map((w, i) => <div key={i}>{w}</div>)}</details> : null}

      {/* ---------- Structures ---------- */}
      <nav className="struct-tabs" aria-label="Financing structure">
        {offers.map(({ s, price, capped }) => (
          <button key={s.id} className={s.id === structure ? "active" : ""} onClick={() => setStructure(s.id)} title={s.blurb}>
            <span className="st-name">{s.short}{s.creative && <i>creative</i>}</span>
            <span className="st-price">{price === null ? "—" : `${money(price / 1000)}k${capped ? "+" : ""}`}</span>
          </button>
        ))}
      </nav>

      <main className="grid">
        {/* ---------- Assumptions ---------- */}
        <aside className="inputs card">
          <div className="asm-head">
            <h3>Assumptions</h3>
            <span className="legend"><span className="chip chip-ai">AI</span> source · <span className="chip chip-edited">You</span> changed</span>
          </div>

          <AsmGroup title="Price">
            {dRow("price", "Purchase price", "$", Math.round(ref * 0.4), Math.round(ref * 1.4), 1000, undefined, "Your offer. Everything else follows from it.", {
              marker: current.price && !current.capped ? { value: current.price, label: "Max offer" } : undefined,
              extra: current.price !== null && !current.capped ? <button className="link" onClick={() => setD("price")(current.price!)}>Set to max offer ({money(current.price)})</button> : undefined,
            })}
            {dRow("marketValue", "As-is value", "$", Math.round(ref * 0.5), Math.round(ref * 1.5), 1000, data?.value ? "AVM" : "Estimate", data?.value?.source)}
            {dRow("rehab", "Rehab budget", "$", 0, Math.max(150000, ref * 0.4), 1000, "None assumed")}
            {(deal.rehab > 0 || structure === "brrrr") && dRow("arv", "After-repair value", "$", Math.round(ref * 0.6), Math.round(ref * 1.8), 1000, "= value")}
          </AsmGroup>

          <AsmGroup title="Income">
            {dRow("rent", "Rent / mo (all units)", "$", 0, Math.max(6000, deal.rent * 2), 25, rentSource, recs.rent?.why, { marker: data?.rent && compResult.recommended ? { value: data.rent.perUnit * deal.units, label: "Rent AVM" } : undefined })}
            {dRow("vacancyPct", "Vacancy & credit loss", "%", 0, 25, 0.5, recSource("vacancyPct", "Ken's rule"), recs.vacancyPct?.why)}
            {dRow("otherIncome", "Other income / mo", "$", 0, 1000, 10, "None assumed")}
          </AsmGroup>

          <AsmGroup title="Expenses">
            {dRow("taxRatePct", "Property tax rate", "%", 0, 4, 0.01, taxSource, recs.taxRatePct?.why)}
            <AssumptionToggle id="reassess" label="Reassess taxes at my price" value={deal.reassessTaxes} ai={aiFull.reassessTaxes} onChange={setD("reassessTaxes")} onReset={resetD("reassessTaxes")} source="Ken's rule" open={false} onToggle={toggleRow} />
            {!deal.reassessTaxes && dRow("taxesAnnualActual", "Current tax bill / yr", "$", 0, 30000, 50, data?.taxes.annualActual ? "Tax bill" : "Estimate")}
            {dRow("insuranceAnnual", "Insurance / yr", "$", 0, 15000, 50, recSource("insuranceAnnual", propState ? `${propState} avg` : "Estimate"), recs.insuranceAnnual?.why)}
            {dRow("mgmtPct", "Property management", "%", 0, 15, 0.5, "PM rates", recs.mgmtPct?.why)}
            {dRow("repairsPct", "Repairs & maintenance", "%", 0, 20, 0.5, "Building age", recs.repairsPct?.why)}
            {dRow("capexPct", "CapEx reserves", "%", 0, 20, 0.5, "Building age", recs.capexPct?.why)}
            {dRow("hoaMonthly", "HOA / mo", "$", 0, 1000, 5, data ? "Property record" : "None assumed")}
            {dRow("utilitiesMonthly", "Owner-paid utilities / mo", "$", 0, 2000, 10, "Tenant pays")}
            {dRow("otherExpMonthly", "Other (lawn, pest) / mo", "$", 0, 1000, 5, "None assumed")}
          </AsmGroup>

          <AsmGroup title={`Loan · ${info.name}`} note={<span className="muted small">{info.blurb}</span>}>
            {TERM_SPECS[structure].filter((f) => !f.show || f.show(terms)).map((f) =>
              f.toggle ? (
                <AssumptionToggle key={f.key} id={f.key} label={f.label} value={terms[f.key] as boolean} ai={aiTerms[structure][f.key] as boolean} onChange={setT(f.key)} onReset={resetT(f.key)} source={typeof f.source === "function" ? f.source(deal) : f.source} open={false} onToggle={toggleRow} />
              ) : (
                <Assumption
                  key={f.key}
                  id={`t-${f.key}`}
                  label={f.label}
                  value={terms[f.key] as number}
                  ai={aiTerms[structure][f.key] as number}
                  unit={f.unit!}
                  min={f.min!}
                  max={f.max!}
                  step={f.step}
                  source={typeof f.source === "function" ? f.source(deal) : f.source}
                  why={typeof f.why === "function" ? f.why(deal, loanEst) : f.why}
                  open={openRow === `t-${f.key}`}
                  onToggle={toggleRow}
                  onChange={setT(f.key)}
                  onReset={resetT(f.key)}
                />
              ),
            )}
          </AsmGroup>

          <AsmGroup title="Your buy box" collapsed note={<span className="muted small">{money(targets.minCashFlow)}/door{targets.useDscr ? ` · DSCR ${targets.minDscr}` : ""}{targets.useCoc ? ` · CoC ${targets.minCoc}%` : ""}{targets.beatInflation ? " · beats inflation" : ""}</span>}>
            <Assumption id="tg-cf" label="Min cash flow / door / mo" value={targets.minCashFlow} unit="$" min={0} max={1000} step={25} onChange={setTg("minCashFlow")} why="After every expense and reserve." open={openRow === "tg-cf"} onToggle={toggleRow} />
            <AssumptionToggle id="tg-dscr" label={`Require DSCR ≥ ${targets.minDscr}`} value={targets.useDscr} onChange={setTg("useDscr")} open={false} onToggle={toggleRow} />
            {targets.useDscr && <Assumption id="tg-dscrv" label="Min DSCR" value={targets.minDscr} unit="x" min={1} max={2} step={0.05} onChange={setTg("minDscr")} open={openRow === "tg-dscrv"} onToggle={toggleRow} />}
            <AssumptionToggle id="tg-coc" label={`Require cash-on-cash ≥ ${targets.minCoc}%`} value={targets.useCoc} onChange={setTg("useCoc")} open={false} onToggle={toggleRow} />
            {targets.useCoc && <Assumption id="tg-cocv" label="Min cash-on-cash" value={targets.minCoc} unit="%" min={0} max={25} step={0.5} onChange={setTg("minCoc")} open={openRow === "tg-cocv"} onToggle={toggleRow} />}
            <AssumptionToggle id="tg-infl" label={`Beat inflation (${deal.inflationPct}%)`} value={targets.beatInflation} onChange={setTg("beatInflation")} open={false} onToggle={toggleRow} />
            {structure === "brrrr" && <Assumption id="tg-left" label="Max cash left after refi" value={targets.maxCashLeft} unit="$" min={0} max={100000} step={1000} onChange={setTg("maxCashLeft")} open={openRow === "tg-left"} onToggle={toggleRow} />}
          </AsmGroup>

          <AsmGroup title="Market & exit" collapsed>
            {dRow("inflationPct", "Inflation (CPI)", "%", 0, 10, 0.05, macro?.inflation != null ? "FRED" : "Default", macro?.inflationAsOf ? `CPI year over year, ${macro.inflationAsOf.slice(0, 7)}` : undefined)}
            {dRow("riskFreePct", "Fed funds rate", "%", 0, 8, 0.05, macro?.fedFunds != null ? "FRED" : "Default", macro?.fedFundsAsOf ? `Effective Fed funds, ${macro.fedFundsAsOf}` : undefined)}
            {dRow("closingCostPct", "Closing costs", "%", 0, 6, 0.25, "Typical")}
            {dRow("rentGrowthPct", "Rent growth / yr", "%", -3, 8, 0.25, "Long-run avg")}
            {dRow("expenseGrowthPct", "Expense growth / yr", "%", 0, 8, 0.25, "Long-run avg")}
            {dRow("appreciationPct", "Appreciation / yr", "%", -3, 8, 0.25, "Long-run avg")}
            {dRow("holdYears", "Hold period", "yrs", 1, 30, 1, "Default")}
            {dRow("sellingCostPct", "Selling costs", "%", 0, 10, 0.5, "Typical")}
            {dRow("units", "Units", "units", 1, 20, 1, data ? "Property record" : "Default")}
          </AsmGroup>
        </aside>

        {/* ---------- Results ---------- */}
        <section className="results">
          <div className="kpis">
            <Kpi label="Cash flow / mo" value={money(result.cashFlow)} tone={result.cashFlow >= targetCF ? "good" : result.cashFlow >= 0 ? "ok" : "bad"} sub={`at ${money(deal.price)} · target ${money(targetCF)}`} />
            <Kpi label="Cash-on-cash" value={Number.isFinite(result.coc) ? `${result.coc.toFixed(1)}%` : "∞"} tone={result.coc >= 8 ? "good" : result.coc >= deal.inflationPct ? "ok" : "bad"} sub={`real ${Number.isFinite(result.coc) ? (result.coc - deal.inflationPct).toFixed(1) + "%" : "∞"} after inflation`} />
            <Kpi label="DSCR" value={Number.isFinite(result.dscr) ? `${result.dscr.toFixed(2)}×` : "n/a"} tone={result.dscr >= 1.25 ? "good" : result.dscr >= 1 ? "ok" : "bad"} sub={`cap rate ${result.capRate.toFixed(2)}%`} />
            <Kpi label="Cash to close" value={money(result.financing.cashToClose)} sub={result.financing.cashLeftInDeal !== undefined ? `${money(result.financing.cashLeftInDeal)} left after refi` : "incl. closing & rehab"} />
          </div>

          <div className="card">
            <h3>Cash flow vs. price</h3>
            <PriceCurve id={structure} deal={deal} terms={terms} target={targetCF} maxOffer={current.capped ? null : current.price} />
          </div>

          <div className="card tab-card">
            <div className="tabs" role="tablist">
              {([
                ["checks", `Checks ${score.checks.filter((c) => c.pass).length}/${score.checks.length}`],
                ["comps", `Rent comps${compResult.used ? ` (${compResult.used})` : ""}`],
                ["proforma", "Pro forma"],
                ["loans", "Loans"],
                ["projection", `${deal.holdYears}-yr return`],
                ["sensitivity", "Sensitivity"],
                ["fed", "vs. Fed rate"],
                ["sources", "Sources"],
              ] as [Tab, string][]).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <div className="tab-body">
              {tab === "checks" && <Checks score={score} result={result} />}
              {tab === "comps" && (
                <RentCompsPanel result={compResult} subject={subject} setSubject={setSubject} comps={comps} setComps={setComps} units={deal.units} currentRent={deal.rent} onUse={(v) => setD("rent")(v)} hosted={STATIC} />
              )}
              {tab === "proforma" && <ProForma result={result} deal={deal} />}
              {tab === "loans" && <Loans result={result} />}
              {tab === "projection" && <Projection result={result} deal={deal} />}
              {tab === "sensitivity" && (
                <>
                  <Sensitivity id={structure} deal={deal} terms={terms} target={targetCF} />
                  <p className="muted small">Stress test (rent −5%, vacancy +5 pts, expenses +10%): {money(result.stress.cashFlow)}/mo, DSCR {Number.isFinite(result.stress.dscr) ? result.stress.dscr.toFixed(2) : "n/a"}.</p>
                </>
              )}
              {tab === "fed" && <OpportunityPanel result={result} deal={deal} tbill={macro?.tbill3m ?? null} asOf={{ fed: macro?.fedFundsAsOf ?? null, cpi: macro?.inflationAsOf ?? null }} />}
              {tab === "sources" && <CompsPanel data={data} />}
            </div>
          </div>
        </section>
      </main>
      <footer className="muted small">
        Estimates only. Before you offer, verify rent with local property managers, taxes with the assessor, insurance with a quote, and any existing loan with the seller's mortgage statement.
      </footer>
    </div>
  );
}

/** One or two plain sentences: what the deal does at your price and the biggest thing to know. */
function verdict(r: Result, max: number | null, value: number, tg: Targets, d: Deal, score: ReturnType<typeof scorecard>, name: string): string {
  const parts: string[] = [];
  const tgt = tg.minCashFlow * d.units;
  parts.push(`At ${money(r.price)} this cash flows ${money(r.cashFlow)}/mo after reserves${r.cashFlow >= tgt ? `, clearing your ${money(tgt)} target` : `, short of your ${money(tgt)} target`}.`);
  if (max !== null && value > 0) {
    const pct = (max / value) * 100;
    parts.push(pct >= 100 ? `It works up to ${pct.toFixed(0)}% of value with a ${name.toLowerCase()}.` : `To hit your numbers, offer ${(100 - pct).toFixed(0)}% under value.`);
  }
  const worst = score.checks.filter((c) => !c.pass).sort((a, b) => b.weight - a.weight)[0];
  parts.push(worst ? `Biggest issue: ${issue(worst.label, r, d)}.` : "Passes every McElroy check.");
  return parts.join(" ");
}

function issue(label: string, r: Result, d: Deal): string {
  const x = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "∞");
  const map: Record<string, string> = {
    "DSCR ≥ 1.25": `rent covers the loan payment only ${x(r.dscr, 2)}× (lenders want 1.25×)`,
    "Positive cash flow after reserves": "it loses money every month once reserves are set aside",
    "Survives stress test": "a small dip in rent or occupancy turns cash flow negative",
    "Break-even occupancy ≤ 85%": `it has to be ${x(r.breakEvenOcc)}% occupied just to break even`,
    "Beats inflation": `your cash return (${x(r.coc)}%) doesn't keep up with ${d.inflationPct}% inflation`,
    "Beats the Fed rate": `the same cash at the Fed rate would earn more (${d.riskFreePct}%)`,
    "Cash-on-cash ≥ 8%": `cash-on-cash is only ${x(r.coc)}%`,
    "Positive leverage": `the loan costs ${x(r.loanConstant, 2)}% a year but the property only yields ${x(r.capRate, 2)}%`,
    "Realistic expense ratio (≥ 35%)": `expenses are only ${x(r.expenseRatio, 0)}% of income, which is usually too optimistic`,
    "Vacancy underwritten ≥ 5%": "vacancy is set below 5%",
    "Management budgeted ≥ 8%": "management is budgeted under 8%",
    "CapEx reserves ≥ $300/door/yr": "CapEx reserves are under $300 per door a year",
  };
  return map[label] ?? label;
}

function Checks({ score, result }: { score: ReturnType<typeof scorecard>; result: Result }) {
  return (
    <>
      <ul className="checks">
        {score.checks.map((c) => (
          <li key={c.label} className={c.pass ? "pass" : "fail"}>
            <span className="mark">{c.pass ? "✓" : "✕"}</span>
            <div>
              <div>{c.label}</div>
              <div className="muted small">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">Quick rules: 1% rule {result.onePct.toFixed(2)}% · GRM {result.grm.toFixed(1)} · expense ratio {result.expenseRatio.toFixed(0)}%</p>
    </>
  );
}

function ProForma({ result, deal }: { result: Result; deal: Deal }) {
  return (
    <table className="plain proforma">
      <thead><tr><th></th><th>Monthly</th><th>Annual</th><th>% EGI</th></tr></thead>
      <tbody>
        <Row label="Gross scheduled rent" m={deal.rent} egi={result.egi} />
        {deal.otherIncome > 0 && <Row label="Other income" m={deal.otherIncome} egi={result.egi} />}
        <Row label={`Vacancy & credit loss (${deal.vacancyPct}%)`} m={result.egi - result.gsi} egi={result.egi} />
        <Row label="Effective gross income" m={result.egi} egi={result.egi} bold />
        {result.opexLines.filter((l) => l.monthly > 0).map((l) => <Row key={l.label} label={l.label} m={-l.monthly} egi={result.egi} />)}
        <Row label="Total operating expenses" m={-result.opex} egi={result.egi} bold />
        <Row label="Net operating income" m={result.noi} egi={result.egi} bold />
        <Row label="Debt service" m={-result.debtService} egi={result.egi} />
        <Row label="Cash flow" m={result.cashFlow} egi={result.egi} bold />
      </tbody>
    </table>
  );
}

function Loans({ result }: { result: Result }) {
  return (
    <>
      <table className="plain">
        <thead><tr><th>Source</th><th>Amount</th><th>Rate</th><th>Pmt/mo</th></tr></thead>
        <tbody>
          {result.financing.loans.map((l) => (
            <tr key={l.name}>
              <td>{l.lien} · {l.name}{l.balloonMonths ? <div className="muted small">balloon yr {l.balloonMonths / 12}</div> : null}{l.ioMonths ? <div className="muted small">interest-only {Math.round(l.ioMonths / 12)} yrs</div> : null}</td>
              <td>{money(l.principal)}</td>
              <td>{l.ratePct}%</td>
              <td>{money(initialPayment(l))}</td>
            </tr>
          ))}
          <tr className="total"><td>Your cash in</td><td>{money(result.financing.cashToClose)}</td><td></td><td></td></tr>
        </tbody>
      </table>
      <ul className="notes">{result.financing.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </>
  );
}

function Projection({ result, deal }: { result: Result; deal: Deal }) {
  const realIrr = Number.isFinite(result.irr) ? ((1 + result.irr / 100) / (1 + deal.inflationPct / 100) - 1) * 100 : NaN;
  return (
    <>
      <p className="proj-sum">
        <b>{Number.isFinite(result.irr) ? `${result.irr.toFixed(1)}%` : "∞"}</b> a year over {deal.holdYears} years
        {Number.isFinite(realIrr) ? ` (${realIrr.toFixed(1)}% after inflation)` : ""} · {Number.isFinite(result.equityMultiple) ? `${result.equityMultiple.toFixed(2)}× your money` : "no cash left in"} · {money(result.totalProfit)} profit
      </p>
      <div className="table-scroll">
        <table className="plain">
          <thead><tr><th>Year</th><th>NOI</th><th>Debt service</th><th>Cash flow</th><th>Loan bal.</th><th>Value</th><th>Equity</th></tr></thead>
          <tbody>
            {result.projection.map((y) => (
              <tr key={y.year}><td>{y.year}</td><td>{money(y.noi)}</td><td>{money(y.debtService)}</td><td className={y.cashFlow >= 0 ? "" : "neg"}>{money(y.cashFlow)}</td><td>{money(y.loanBalance)}</td><td>{money(y.value)}</td><td>{money(y.equity)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Loan term rows per structure ----------
interface TermSpec {
  key: keyof Terms;
  label: string;
  unit?: Unit;
  min?: number;
  max?: number;
  step?: number;
  toggle?: boolean;
  source?: string | ((d: Deal) => string);
  why?: string | ((d: Deal, est: LoanEst) => string);
  show?: (t: Terms) => boolean;
}
const rateRow = (label: string, key: keyof Terms, spread: number): TermSpec => ({
  key, label, unit: "%", min: 0, max: 14, step: 0.125,
  source: spread ? `PMMS +${spread}` : "PMMS",
  why: (d) => `Freddie Mac 30-yr average ${d.marketRatePct}%${spread ? ` plus a typical ${spread}% for this loan type` : ""}. Get a real quote.`,
});
const sellerNote: TermSpec[] = [
  { key: "sellerRatePct", label: "Seller note rate", unit: "%", min: 0, max: 10, step: 0.25, source: "Typical ask" },
  { key: "sellerIO", label: "Interest-only seller note", toggle: true, source: "Typical" },
  { key: "sellerAmortYears", label: "Seller note amortization", unit: "yrs", min: 5, max: 40, step: 1, source: "Typical", show: (t) => !t.sellerIO },
  { key: "balloonYears", label: "Balloon (0 = none)", unit: "yrs", min: 0, max: 30, step: 1, source: "Typical", why: "At the balloon the model refinances what's left at market + 0.75%." },
];
const TERM_SPECS: Record<StructureId, TermSpec[]> = {
  cash: [],
  conventional: [
    { key: "downPct", label: "Down payment", unit: "%", min: 0, max: 50, step: 0.5, source: "Investor min" },
    rateRow("Interest rate", "ratePct", 0.75),
    { key: "amortYears", label: "Amortization", unit: "yrs", min: 10, max: 40, step: 5, source: "Standard" },
    { key: "pointsPct", label: "Points", unit: "%", min: 0, max: 4, step: 0.25, source: "Typical" },
  ],
  dscr: [
    { key: "downPct", label: "Down payment", unit: "%", min: 0, max: 50, step: 0.5, source: "DSCR min" },
    rateRow("Interest rate", "ratePct", 1.25),
    { key: "amortYears", label: "Amortization", unit: "yrs", min: 10, max: 40, step: 5, source: "Standard" },
    { key: "pointsPct", label: "Points", unit: "%", min: 0, max: 4, step: 0.25, source: "Typical" },
    { key: "ioYears", label: "Interest-only period", unit: "yrs", min: 0, max: 10, step: 1, source: "None assumed" },
  ],
  fha: [
    { key: "downPct", label: "Down payment", unit: "%", min: 3.5, max: 20, step: 0.5, source: "FHA min" },
    rateRow("Interest rate", "ratePct", 0),
    { key: "mipPct", label: "Annual MIP", unit: "%", min: 0, max: 1, step: 0.05, source: "HUD 2024" },
  ],
  subto: [
    { key: "existingBalance", label: "Seller's loan balance", unit: "$", min: 0, max: 1500000, step: 1000, source: "Est. from sale", why: (_d, est) => (est ? `Estimated from the last sale: 80% loan at that year's average rate, paid down since. Get the mortgage statement.` : "No sale history, so 70% of value is assumed. Get the mortgage statement.") },
    { key: "existingRatePct", label: "Seller's rate", unit: "%", min: 0, max: 10, step: 0.125, source: "Est. from sale" },
    { key: "existingYearsLeft", label: "Years left on loan", unit: "yrs", min: 1, max: 30, step: 1, source: "Est. from sale" },
    { key: "arrears", label: "Arrears to catch up", unit: "$", min: 0, max: 50000, step: 250, source: "None assumed" },
    { key: "sellerCarryPct", label: "Seller equity carried as a note", unit: "%", min: 0, max: 100, step: 5, source: "Pure sub-to" },
    ...sellerNote.map((s) => ({ ...s, show: (t: Terms) => t.sellerCarryPct > 0 && (!s.show || s.show(t)) })),
  ],
  hybrid: [],
  sellerFinance: [{ key: "downPct", label: "Down payment to seller", unit: "%", min: 0, max: 40, step: 0.5, source: "Typical" }, ...sellerNote],
  morby: [
    { key: "bankLtvPct", label: "Bank loan (LTV)", unit: "%", min: 50, max: 90, step: 0.5, source: "DSCR max" },
    rateRow("Bank rate", "ratePct", 1.25),
    { key: "amortYears", label: "Bank amortization", unit: "yrs", min: 15, max: 40, step: 5, source: "Standard" },
    { key: "pointsPct", label: "Bank points", unit: "%", min: 0, max: 4, step: 0.25, source: "Typical" },
    { key: "morbyCarryPct", label: "Seller carry 2nd (% of price)", unit: "%", min: 0, max: 50, step: 0.5, source: "Morby std" },
    ...sellerNote,
  ],
  brrrr: [
    { key: "hmLtcPct", label: "Hard money (% of cost)", unit: "%", min: 0, max: 100, step: 1, source: "Typical" },
    { key: "hmRatePct", label: "Hard money rate", unit: "%", min: 0, max: 18, step: 0.25, source: "Typical" },
    { key: "hmPointsPct", label: "Hard money points", unit: "%", min: 0, max: 5, step: 0.25, source: "Typical" },
    { key: "rehabMonths", label: "Rehab + seasoning", unit: "mo", min: 1, max: 18, step: 1, source: "6-mo seasoning" },
    { key: "refiLtvPct", label: "Refi loan (% of ARV)", unit: "%", min: 50, max: 80, step: 0.5, source: "DSCR max" },
    rateRow("Refi rate", "refiRatePct", 1.25),
  ],
};
TERM_SPECS.hybrid = TERM_SPECS.subto;
const TERM_LABEL: Partial<Record<keyof Terms, string>> = Object.fromEntries(
  Object.values(TERM_SPECS).flat().map((s) => [s.key, s.label]),
);

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "ok" | "bad" }) {
  return (
    <div className={`kpi card ${tone ?? ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Row({ label, m, egi, bold }: { label: string; m: number; egi: number; bold?: boolean }) {
  return (
    <tr className={bold ? "total" : ""}>
      <td>{label}</td>
      <td className={m < 0 ? "neg" : ""}>{money(m)}</td>
      <td className={m < 0 ? "neg" : ""}>{money(m * 12)}</td>
      <td className="muted">{egi ? `${((Math.abs(m) / egi) * 100).toFixed(1)}%` : ""}</td>
    </tr>
  );
}

function CompsPanel({ data }: { data: Lookup | null }) {
  if (!data) return <p className="muted">Look up an address to see comps and data sources.</p>;
  const table = (title: string, comps: { address: string; price: number; beds?: number; baths?: number; sqft?: number; distance?: number; date?: string; correlation?: number }[], unit: string) =>
    comps.length ? (
      <>
        <h4>{title}</h4>
        <div className="table-scroll">
          <table className="plain">
            <thead><tr><th>Address</th><th>{unit}</th><th>Bd/Ba</th><th>Sqft</th><th>Dist</th><th>Date</th><th>Match</th></tr></thead>
            <tbody>
              {comps.map((c, i) => (
                <tr key={i}><td>{c.address}</td><td>{money(c.price)}</td><td>{c.beds ?? "–"}/{c.baths ?? "–"}</td><td>{c.sqft ? fmt(c.sqft) : "–"}</td><td>{c.distance != null ? `${c.distance.toFixed(2)} mi` : "–"}</td><td>{c.date?.slice(0, 10) ?? "–"}</td><td>{c.correlation != null ? `${Math.round(c.correlation * 100)}%` : "–"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ) : null;
  return (
    <div>
      <dl className="sources">
        <dt>Value</dt><dd>{data.value ? `${money(data.value.estimate)}${data.value.low ? ` (range ${money(data.value.low)}–${money(data.value.high!)})` : ""} — ${data.value.source}` : "Not available — enter manually"}</dd>
        <dt>Rent</dt><dd>{data.rent ? `${money(data.rent.perUnit)}/unit${data.rent.low ? ` (range ${money(data.rent.low)}–${money(data.rent.high!)})` : ""} — ${data.rent.source}` : "Not available — enter manually"}</dd>
        <dt>Taxes</dt><dd>{data.taxes.annualActual ? `${money(data.taxes.annualActual)} (${data.taxes.year}) · ` : ""}{data.taxes.ratePct ? `${data.taxes.ratePct.toFixed(2)}% effective — ${data.taxes.source}` : "—"}</dd>
        <dt>Insurance</dt><dd>{money(data.insurance.annual)}/yr — {data.insurance.source}</dd>
        <dt>Rates</dt><dd>30-yr {data.rates.thirtyYear}% · 15-yr {data.rates.fifteenYear}% — {data.rates.source}{data.rates.asOf ? `, ${data.rates.asOf}` : ""}</dd>
        {data.property.ownerName && (<><dt>Owner</dt><dd>{data.property.ownerName}{data.property.ownerOccupied === false ? " (absentee)" : ""}</dd></>)}
        <dt>Sources</dt><dd>{data.sources.join(" · ")}</dd>
      </dl>
      {table("Rent comps", data.rent?.comps ?? [], "Rent")}
      {table("Sale comps", data.value?.comps ?? [], "Price")}
    </div>
  );
}

function macroFields(r: Rates): Partial<Deal> {
  const out: Partial<Deal> = {};
  if (r.inflation != null) out.inflationPct = r.inflation;
  if (r.fedFunds != null) out.riskFreePct = r.fedFunds;
  return out;
}

function LookupLinks({ address, asOf }: { address: string; asOf: string | null }) {
  const q = encodeURIComponent(address);
  const links = address
    ? [
        { label: "Value & rent estimate (Zillow)", href: `https://www.zillow.com/homes/${q}_rb/` },
        { label: "Tax bill (county assessor)", href: `https://www.google.com/search?q=${encodeURIComponent(address + " property tax assessor")}` },
        { label: "Rent comps", href: `https://www.google.com/search?q=${encodeURIComponent(address.replace(/^\d+\s+/, "") + " homes for rent")}` },
        { label: "Insurance quote", href: "https://www.google.com/search?q=landlord+insurance+quote" },
      ]
    : [];
  return (
    <div className="banner info">
      <div>
        <b>Hosted version.</b> Live property lookup needs the local app with a RentCast key, so set price, rent, taxes and insurance with the sliders.
        Rates, CPI and the Fed rate below are a snapshot{asOf ? ` from the week of ${asOf}` : ""}.
      </div>
      {links.length > 0 && (
        <div className="lookup-links">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">{l.label} ↗</a>
          ))}
        </div>
      )}
    </div>
  );
}
