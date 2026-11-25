import { useEffect, useMemo, useState } from "react";
import { Slider, Toggle } from "./components/Slider";
import { PriceCurve, Sensitivity } from "./components/Charts";
import { Deal, HURDLE_LABEL, StructureId, Targets, Terms, fmt, money, maxPrice, requiredCoc, scorecard, underwrite } from "./lib/model";
import { OpportunityPanel } from "./components/Opportunity";
import { STRUCTURES, defaultTerms } from "./lib/structures";
import { Keys, Lookup, Rates, STATIC, confidence, getRates, lookup, store } from "./lib/api";
import { estimateExistingLoan } from "./lib/estimate";
import { initialPayment } from "./lib/finance";

const SAMPLE: Deal = {
  price: 285000, marketValue: 295000, arv: 295000, units: 1, rent: 2250, otherIncome: 0,
  vacancyPct: 7, mgmtPct: 10, repairsPct: 7, capexPct: 7, taxRatePct: 1.1, taxesAnnualActual: 2900,
  reassessTaxes: true, insuranceAnnual: 2100, hoaMonthly: 0, utilitiesMonthly: 0, otherExpMonthly: 0,
  closingCostPct: 3, rehab: 0, marketRatePct: 6.5, rentGrowthPct: 3, expenseGrowthPct: 3.5,
  appreciationPct: 3, holdYears: 7, sellingCostPct: 7, inflationPct: 3, riskFreePct: 4,
};

const DEFAULT_TARGETS: Targets = { minCashFlow: 200, minDscr: 1.25, minCoc: 8, useDscr: true, useCoc: false, maxCashLeft: 10000, beatInflation: true, cashHurdle: "inflation", cashPremiumPct: 2 };

type TermsMap = Record<StructureId, Terms>;
const allTerms = (rate: number, price: number, prev?: Partial<TermsMap>): TermsMap =>
  Object.fromEntries(STRUCTURES.map((s) => [s.id, { ...defaultTerms(s.id, rate, price), ...(prev?.[s.id] ?? {}) }])) as TermsMap;

interface Saved {
  name: string;
  deal: Deal;
  terms: TermsMap;
  structure: StructureId;
  lookup: Lookup | null;
}

export default function App() {
  const saved = store.get<Saved | null>("uw:current", null);
  const [deal, setDeal] = useState<Deal>({ ...SAMPLE, ...(saved?.deal ?? {}) });
  const [termsBy, setTermsBy] = useState<TermsMap>(saved?.terms ? allTerms(SAMPLE.marketRatePct, SAMPLE.price, saved.terms) : allTerms(SAMPLE.marketRatePct, SAMPLE.price));
  const [structure, setStructure] = useState<StructureId>(saved?.structure ?? "conventional");
  const [targets, setTargets] = useState<Targets>({ ...DEFAULT_TARGETS, ...store.get<Partial<Targets>>("uw:targets", {}) });
  const [macro, setMacro] = useState<Rates | null>(saved?.lookup?.rates ?? null);
  const [data, setData] = useState<Lookup | null>(saved?.lookup ?? null);
  const [address, setAddress] = useState(saved?.lookup?.address ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<Keys>(store.get("uw:keys", { rentcast: "", census: "" }));
  const [showKeys, setShowKeys] = useState(false);
  const [library, setLibrary] = useState<Saved[]>(store.get("uw:library", []));
  const [tab, setTab] = useState<"proforma" | "projection" | "comps">("proforma");

  const terms = termsBy[structure];
  const setD = (k: keyof Deal) => (v: number | boolean) => setDeal((d) => ({ ...d, [k]: v }));
  const setT = (k: keyof Terms) => (v: number | boolean) => setTermsBy((m) => ({ ...m, [structure]: { ...m[structure], [k]: v } }));
  const setTg = (k: keyof Targets) => (v: number | boolean) => setTargets((t) => ({ ...t, [k]: v }));

  useEffect(() => store.set("uw:current", { name: "current", deal, terms: termsBy, structure, lookup: data }), [deal, termsBy, structure, data]);
  useEffect(() => store.set("uw:targets", targets), [targets]);
  useEffect(() => store.set("uw:keys", keys), [keys]);
  useEffect(() => store.set("uw:library", library), [library]);
  // Inflation and the Fed rate are refreshed on every load. They're market data, not deal assumptions.
  useEffect(() => {
    getRates().then((r) => {
      if (!r) return;
      setMacro(r);
      setDeal((d) => ({ ...d, ...macroFields(r), ...(saved ? {} : { marketRatePct: r.thirtyYear }) }));
      if (!saved) setTermsBy(allTerms(r.thirtyYear, SAMPLE.price));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim()) return;
    if (STATIC) {
      // Hosted version: no data server. The address labels the deal and drives the lookup links.
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
      const value = l.value?.estimate ?? deal.marketValue;
      const rate = l.rates.thirtyYear;
      const taxRate = l.taxes.ratePct ?? deal.taxRatePct;
      const next: Deal = {
        ...deal,
        price: Math.round(value / 1000) * 1000,
        marketValue: value,
        arv: value,
        units,
        rent: l.rent ? Math.round(l.rent.perUnit * units) : deal.rent,
        taxRatePct: +taxRate.toFixed(3),
        taxesAnnualActual: l.taxes.annualActual ?? Math.round((value * taxRate) / 100),
        insuranceAnnual: l.insurance.annual,
        hoaMonthly: l.property.hoaMonthly ?? 0,
        marketRatePct: rate,
        ...macroFields(l.rates),
        rehab: 0,
        // Older buildings need more maintenance and bigger reserves — underwrite them that way.
        repairsPct: (l.property.yearBuilt ?? 2000) < 1980 ? 9 : (l.property.yearBuilt ?? 2000) < 2000 ? 7 : 5,
        capexPct: (l.property.yearBuilt ?? 2000) < 1980 ? 9 : (l.property.yearBuilt ?? 2000) < 2000 ? 7 : 5,
        mgmtPct: units >= 5 ? 8 : 10,
      };
      setDeal(next);
      const t = allTerms(rate, next.price);
      const est = estimateExistingLoan(l.property.lastSalePrice, l.property.lastSaleDate, rate);
      if (est && est.balance > 0) {
        for (const id of ["subto", "hybrid"] as const) t[id] = { ...t[id], existingBalance: est.balance, existingRatePct: est.ratePct, existingYearsLeft: Math.max(1, Math.round(est.yearsLeft)) };
      }
      setTermsBy(t);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }

  const result = useMemo(() => underwrite(structure, deal, terms), [structure, deal, terms]);
  const score = useMemo(() => scorecard(result, deal), [result, deal]);
  const offers = useMemo(
    () => STRUCTURES.map((s) => ({ s, ...maxPrice(s.id, deal, termsBy[s.id], targets) })),
    [deal, termsBy, targets],
  );
  const current = offers.find((o) => o.s.id === structure)!;
  const reqCoc = requiredCoc(structure, deal, targets);
  const targetCF = targets.minCashFlow * deal.units;
  const ref = deal.marketValue || deal.price;
  const valConf = confidence(data?.value?.estimate, data?.value?.low, data?.value?.high);
  const rentConf = confidence(data?.rent?.perUnit, data?.rent?.low, data?.rent?.high);
  const info = STRUCTURES.find((s) => s.id === structure)!;

  const saveDeal = () => {
    const name = data?.address || address.trim() || `Deal ${library.length + 1}`;
    setLibrary((lib) => [{ name, deal, terms: termsBy, structure, lookup: data }, ...lib.filter((x) => x.name !== name)].slice(0, 30));
  };
  const loadDeal = (s: Saved) => {
    setDeal(s.deal);
    setTermsBy(allTerms(s.deal.marketRatePct, s.deal.price, s.terms));
    setStructure(s.structure);
    setData(s.lookup);
    setAddress(s.lookup?.address ?? "");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▲</span> Deal Underwriter
        </div>
        <form className="search" onSubmit={runLookup}>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Type a property address — e.g. 123 Main St, Columbus, OH 43215" aria-label="Property address" />
          <button type="submit" disabled={loading}>{loading ? "Pulling data…" : STATIC ? "Set address" : "Underwrite"}</button>
        </form>
        <div className="top-actions">
          <button className="ghost" onClick={saveDeal}>Save</button>
          {library.length > 0 && (
            <select className="ghost" value="" onChange={(e) => { const s = library[+e.target.value]; if (s) loadDeal(s); }} aria-label="Saved deals">
              <option value="">Saved deals ({library.length})</option>
              {library.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          )}
          {!STATIC && <button className="ghost" onClick={() => setShowKeys((v) => !v)}>Data keys</button>}
        </div>
      </header>

      {showKeys && (
        <div className="keys card">
          <p>Keys are stored only in this browser and sent to your own server. Or set them in <code>.env</code> on the server.</p>
          <label>RentCast API key <a href="https://app.rentcast.io/app/api" target="_blank" rel="noreferrer">get one</a> — parcel record, value AVM, rent AVM, comps, tax bill
            <input type="password" value={keys.rentcast} onChange={(e) => setKeys({ ...keys, rentcast: e.target.value })} />
          </label>
          <label>Census API key <a href="https://api.census.gov/data/key_signup.html" target="_blank" rel="noreferrer">free</a> — tract rents, county tax rates (fallback)
            <input type="password" value={keys.census} onChange={(e) => setKeys({ ...keys, census: e.target.value })} />
          </label>
        </div>
      )}

      {error && <div className="banner bad">{error}</div>}

      {/* ---------- Answer first ---------- */}
      <section className="hero card">
        <div className="hero-main">
          <div className="eyebrow">{data ? data.address : address.trim() ? address.trim() : "Sample deal — type an address above"}</div>
          <div className="hero-answer">
            {current.price === null ? (
              <>No price works under <b>{info.name}</b> for {money(targets.minCashFlow)}/door/mo{Number.isFinite(reqCoc) ? ` at ≥ ${reqCoc.toFixed(2)}% cash-on-cash` : ""}{targets.useDscr && structure !== "cash" ? ` & DSCR ≥ ${targets.minDscr}` : ""}.</>
            ) : (
              <>
                Cash flows <b>{money(targets.minCashFlow)}/door</b>
                {Number.isFinite(reqCoc) && <> and <b>{reqCoc.toFixed(2)}%</b> cash-on-cash</>} at{" "}
                <span className="big">{money(current.price)}{current.capped ? "+" : ""}</span> or less
              </>
            )}
          </div>
          <div className="hero-sub">
            {info.name}
            {Number.isFinite(reqCoc) && <> · {structure === "cash" && reqCoc > deal.inflationPct ? `cash yield ${HURDLE_LABEL[targets.cashHurdle]}` : targets.cashHurdle !== "inflation" && structure === "cash" ? "cash yield beats inflation (stricter than the Fed rate today)" : "cash yield beats inflation"}</>}
            {current.price !== null && !current.capped && ref > 0 && (
              <> · {((current.price / ref) * 100).toFixed(0)}% of {money(ref)} value · {current.price >= ref ? "works at full value" : `offer ${money(ref - current.price)} below value`}</>
            )}
            {current.price !== null && !current.capped && (
              <button className="link" onClick={() => setDeal((d) => ({ ...d, price: current.price! }))}>Set price to max →</button>
            )}
          </div>
          {data && (
            <div className="facts">
              {data.property.type && <span>{data.property.type}</span>}
              {data.property.beds != null && <span>{data.property.beds} bd / {data.property.baths} ba</span>}
              {data.property.sqft && <span>{fmt(data.property.sqft)} sqft</span>}
              {data.property.yearBuilt && <span>Built {data.property.yearBuilt}</span>}
              {deal.units > 1 && <span>{deal.units} units</span>}
              {data.property.lastSalePrice && <span>Last sold {money(data.property.lastSalePrice)} ({data.property.lastSaleDate?.slice(0, 10)})</span>}
              <span>Value conf: {valConf.label}</span>
              <span>Rent conf: {rentConf.label}</span>
            </div>
          )}
        </div>
        <div className="grade" data-grade={score.grade}>
          <div className="grade-letter">{score.grade}</div>
          <div className="grade-label">McElroy score {score.score}</div>
        </div>
      </section>

      {STATIC && <LookupLinks address={address.trim()} asOf={macro?.asOf ?? null} />}

      {data?.warnings?.length ? (
        <div className="banner warn">{data.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
      ) : null}

      {/* ---------- Structure comparison ---------- */}
      <section className="structures">
        {offers.map(({ s, price, capped }) => {
          const r = underwrite(s.id, deal, termsBy[s.id], deal.price, true);
          return (
            <button key={s.id} className={`struct ${s.id === structure ? "active" : ""}`} onClick={() => setStructure(s.id)} title={s.blurb}>
              <div className="struct-name">{s.short}{s.creative && <span className="tag">creative</span>}</div>
              <div className="struct-max">{price === null ? "—" : `${money(price / 1000)}k${capped ? "+" : ""}`}</div>
              <div className="struct-sub">max offer</div>
              <div className={`struct-cf ${r.cashFlow >= targetCF ? "good" : r.cashFlow >= 0 ? "ok" : "bad"}`}>{money(r.cashFlow)}/mo @ your price</div>
            </button>
          );
        })}
      </section>

      <main className="grid">
        {/* ---------- Inputs ---------- */}
        <aside className="inputs">
          <Group title="Your targets">
            <Slider label="Min cash flow / door / mo" unit="$" value={targets.minCashFlow} min={0} max={1000} step={25} onChange={setTg("minCashFlow")} hint="After ALL expenses and reserves" />
            <Toggle label={`Require DSCR ≥ ${targets.minDscr}`} value={targets.useDscr} onChange={setTg("useDscr")} />
            {targets.useDscr && <Slider label="Min DSCR" unit="x" value={targets.minDscr} min={1} max={2} step={0.05} onChange={setTg("minDscr")} />}
            <Toggle label={`Require cash-on-cash ≥ ${targets.minCoc}%`} value={targets.useCoc} onChange={setTg("useCoc")} />
            {targets.useCoc && <Slider label="Min cash-on-cash" unit="%" value={targets.minCoc} min={0} max={25} step={0.5} onChange={setTg("minCoc")} />}
            <Toggle label={`Cash-on-cash must beat inflation (${deal.inflationPct}%)`} value={targets.beatInflation} onChange={setTg("beatInflation")} hint="Your cash flow has to at least keep pace with CPI, or the money you put in is losing buying power." />
            <div className="field">
              <label htmlFor="hurdle">All-cash hurdle</label>
              <select id="hurdle" value={targets.cashHurdle} onChange={(e) => setTargets((t) => ({ ...t, cashHurdle: e.target.value as Targets["cashHurdle"] }))}>
                <option value="inflation">Beat inflation ({deal.inflationPct}%)</option>
                <option value="fed">Beat the Fed rate ({deal.riskFreePct}%)</option>
                <option value="fedPlus">Fed rate + premium ({(deal.riskFreePct + targets.cashPremiumPct).toFixed(2)}%)</option>
              </select>
            </div>
            {targets.cashHurdle === "fedPlus" && <Slider label="Risk premium over Fed rate" unit="%" value={targets.cashPremiumPct} min={0} max={8} step={0.25} onChange={setTg("cashPremiumPct")} hint="Extra yield you want for taking on tenants, repairs and illiquidity instead of holding T-bills" />}
            {structure === "brrrr" && <Slider label="Max cash left in deal" unit="$" value={targets.maxCashLeft} min={0} max={100000} step={1000} onChange={setTg("maxCashLeft")} />}
          </Group>

          <Group title="Purchase">
            <Slider label="Purchase price" unit="$" value={deal.price} min={Math.round(ref * 0.4)} max={Math.round(ref * 1.4)} step={1000} onChange={setD("price")} marker={current.price && !current.capped ? { value: current.price, label: "Max offer" } : undefined} />
            <Slider label="As-is value (AVM)" unit="$" value={deal.marketValue} min={Math.round(ref * 0.5)} max={Math.round(ref * 1.5)} step={1000} onChange={setD("marketValue")} />
            <Slider label="Rehab budget" unit="$" value={deal.rehab} min={0} max={Math.max(150000, ref * 0.4)} step={1000} onChange={setD("rehab")} />
            {(deal.rehab > 0 || structure === "brrrr") && <Slider label="ARV" unit="$" value={deal.arv} min={Math.round(ref * 0.6)} max={Math.round(ref * 1.8)} step={1000} onChange={setD("arv")} />}
            <Slider label="Closing costs" unit="%" value={deal.closingCostPct} min={0} max={6} step={0.25} onChange={setD("closingCostPct")} />
            <Slider label="Units" unit="units" value={deal.units} min={1} max={20} onChange={setD("units")} />
          </Group>

          <Group title="Income">
            <Slider label="Gross rent (all units) / mo" unit="$" value={deal.rent} min={0} max={Math.max(6000, deal.rent * 2)} step={25} onChange={setD("rent")} marker={data?.rent ? { value: data.rent.perUnit * deal.units, label: "Rent AVM" } : undefined} />
            <Slider label="Other income / mo" unit="$" value={deal.otherIncome} min={0} max={1000} step={10} onChange={setD("otherIncome")} />
            <Slider label="Vacancy & credit loss" unit="%" value={deal.vacancyPct} min={0} max={25} step={0.5} onChange={setD("vacancyPct")} hint="Ken: never underwrite less than 5%, even if it's 100% full today" />
          </Group>

          <Group title="Expenses">
            <Slider label="Property tax rate" unit="%" value={deal.taxRatePct} min={0} max={4} step={0.01} onChange={setD("taxRatePct")} hint={data?.taxes.source} />
            <Toggle label="Reassess taxes at my purchase price" value={deal.reassessTaxes} onChange={setD("reassessTaxes")} hint="Ken's rule: the county re-assesses after a sale. Underwrite YOUR tax bill, not the seller's." />
            {!deal.reassessTaxes && <Slider label="Current tax bill / yr" unit="$" value={deal.taxesAnnualActual} min={0} max={30000} step={50} onChange={setD("taxesAnnualActual")} />}
            <Slider label="Insurance / yr" unit="$" value={deal.insuranceAnnual} min={0} max={15000} step={50} onChange={setD("insuranceAnnual")} hint={data?.insurance.source} />
            <Slider label="Property management" unit="%" value={deal.mgmtPct} min={0} max={15} step={0.5} onChange={setD("mgmtPct")} />
            <Slider label="Repairs & maintenance" unit="%" value={deal.repairsPct} min={0} max={20} step={0.5} onChange={setD("repairsPct")} />
            <Slider label="CapEx reserves" unit="%" value={deal.capexPct} min={0} max={20} step={0.5} onChange={setD("capexPct")} />
            <Slider label="HOA / mo" unit="$" value={deal.hoaMonthly} min={0} max={1000} step={5} onChange={setD("hoaMonthly")} />
            <Slider label="Owner-paid utilities / mo" unit="$" value={deal.utilitiesMonthly} min={0} max={2000} step={10} onChange={setD("utilitiesMonthly")} />
            <Slider label="Other (lawn, pest, admin) / mo" unit="$" value={deal.otherExpMonthly} min={0} max={1000} step={5} onChange={setD("otherExpMonthly")} />
          </Group>

          <Group title={`Financing — ${info.name}`}>
            <p className="blurb">{info.blurb}</p>
            <FinancingInputs id={structure} t={terms} set={setT} marketRate={deal.marketRatePct} />
            <div className="rate-note">PMMS 30-yr today: {deal.marketRatePct}%{data?.rates.asOf ? ` (${data.rates.asOf})` : ""}</div>
            <button className="link" onClick={() => setTermsBy((m) => ({ ...m, [structure]: defaultTerms(structure, deal.marketRatePct, deal.price) }))}>Reset {info.short} terms</button>
          </Group>

          <Group title="Inflation & Fed rate">
            <Slider label="Inflation (CPI, YoY)" unit="%" value={deal.inflationPct} min={0} max={10} step={0.05} onChange={setD("inflationPct")} marker={macro?.inflation != null ? { value: macro.inflation, label: "Latest CPI" } : undefined} />
            <Slider label="Fed funds rate" unit="%" value={deal.riskFreePct} min={0} max={8} step={0.05} onChange={setD("riskFreePct")} marker={macro?.fedFunds != null ? { value: macro.fedFunds, label: "Effective Fed funds" } : undefined} />
            <div className="rate-note">{macro?.inflation != null ? `Live from FRED: CPI ${macro.inflation}% (${macro.inflationAsOf?.slice(0, 7)}), Fed funds ${macro.fedFunds}% (${macro.fedFundsAsOf})` : "Couldn't load live FRED data, so these are defaults."}</div>
          </Group>

          <Group title="Growth & exit" collapsed>
            <Slider label="Rent growth / yr" unit="%" value={deal.rentGrowthPct} min={-3} max={8} step={0.25} onChange={setD("rentGrowthPct")} />
            <Slider label="Expense growth / yr" unit="%" value={deal.expenseGrowthPct} min={0} max={8} step={0.25} onChange={setD("expenseGrowthPct")} />
            <Slider label="Appreciation / yr" unit="%" value={deal.appreciationPct} min={-3} max={8} step={0.25} onChange={setD("appreciationPct")} />
            <Slider label="Hold period" unit="yrs" value={deal.holdYears} min={1} max={30} onChange={setD("holdYears")} />
            <Slider label="Selling costs" unit="%" value={deal.sellingCostPct} min={0} max={10} step={0.5} onChange={setD("sellingCostPct")} />
          </Group>
        </aside>

        {/* ---------- Results ---------- */}
        <section className="results">
          <div className="kpis">
            <Kpi label="Cash flow / mo" value={`${money(result.cashFlow)}`} tone={result.cashFlow >= targetCF ? "good" : result.cashFlow >= 0 ? "ok" : "bad"} sub={`${money(result.cashFlow * 12)}/yr · ${money(result.cashFlow / deal.units)}/door`} />
            <Kpi label="Cash-on-cash" value={Number.isFinite(result.coc) ? `${result.coc.toFixed(1)}%` : "∞"} tone={result.coc >= Math.max(8, reqCoc) ? "good" : result.coc >= deal.inflationPct ? "ok" : "bad"} sub={`on ${money(result.cashInvested)} · real ${Number.isFinite(result.coc) ? (result.coc - deal.inflationPct).toFixed(1) + "%" : "∞"}`} />
            <Kpi label="Cap rate" value={`${result.capRate.toFixed(2)}%`} sub={`NOI ${money(result.noi * 12)}/yr`} />
            <Kpi label="DSCR" value={Number.isFinite(result.dscr) ? `${result.dscr.toFixed(2)}×` : "n/a"} tone={result.dscr >= 1.25 ? "good" : result.dscr >= 1 ? "ok" : "bad"} sub={`Debt ${money(result.debtService)}/mo`} />
            <Kpi label="Cash to close" value={`${money(result.financing.cashToClose)}`} sub={result.financing.cashLeftInDeal !== undefined ? `${money(result.financing.cashLeftInDeal)} left after refi` : `incl. closing & rehab`} />
            <Kpi label={`${deal.holdYears}-yr IRR`} value={Number.isFinite(result.irr) ? `${result.irr.toFixed(1)}%` : "∞"} sub={`${Number.isFinite(result.irr) ? `real ${(((1 + result.irr / 100) / (1 + deal.inflationPct / 100) - 1) * 100).toFixed(1)}% · ` : ""}${Number.isFinite(result.equityMultiple) ? result.equityMultiple.toFixed(2) + "× equity" : "no cash in"} · ${money(result.totalProfit)} profit`} />
          </div>

          <div className="card">
            <h3>Cash flow vs. purchase price</h3>
            <PriceCurve id={structure} deal={deal} terms={terms} target={targetCF} maxOffer={current.capped ? null : current.price} />
          </div>

          <div className="two-col">
            <div className="card">
              <h3>McElroy discipline check <span className="muted">— grade {score.grade}</span></h3>
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
              <div className="muted small">Quick rules: 1% rule {result.onePct.toFixed(2)}% · GRM {result.grm.toFixed(1)} · expense ratio {result.expenseRatio.toFixed(0)}% (50% rule ≈ 50%)</div>
            </div>

            <div className="card">
              <h3>Capital stack</h3>
              <table className="plain">
                <thead><tr><th>Source</th><th>Amount</th><th>Rate</th><th>Pmt/mo</th></tr></thead>
                <tbody>
                  {result.financing.loans.map((l) => (
                    <tr key={l.name}>
                      <td>{l.lien} · {l.name}{l.balloonMonths ? <div className="muted small">balloon yr {l.balloonMonths / 12}</div> : null}{l.ioMonths ? <div className="muted small">IO {Math.round(l.ioMonths / 12)} yrs</div> : null}</td>
                      <td>{money(l.principal)}</td>
                      <td>{l.ratePct}%</td>
                      <td>{money(initialPayment(l))}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>Your cash in</td><td>{money(result.financing.cashToClose)}</td><td></td><td></td></tr>
                </tbody>
              </table>
              <ul className="notes">{result.financing.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          </div>

          <OpportunityPanel
            result={result}
            deal={deal}
            cashTerms={termsBy.cash}
            targets={targets}
            tbill={macro?.tbill3m ?? null}
            asOf={{ fed: macro?.fedFundsAsOf ?? null, cpi: macro?.inflationAsOf ?? null }}
            onSetPrice={(p) => { setStructure("cash"); setDeal((d) => ({ ...d, price: p })); }}
          />

          <div className="card">
            <div className="tabs">
              <button className={tab === "proforma" ? "active" : ""} onClick={() => setTab("proforma")}>Pro forma</button>
              <button className={tab === "projection" ? "active" : ""} onClick={() => setTab("projection")}>{deal.holdYears}-yr projection</button>
              <button className={tab === "comps" ? "active" : ""} onClick={() => setTab("comps")}>Comps & sources</button>
            </div>
            {tab === "proforma" && (
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
            )}
            {tab === "projection" && (
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
            )}
            {tab === "comps" && <CompsPanel data={data} />}
          </div>

          <div className="card">
            <h3>Sensitivity — monthly cash flow</h3>
            <Sensitivity id={structure} deal={deal} terms={terms} target={targetCF} />
            <div className="muted small">Stress test (rent −5%, vacancy +5 pts, expenses +10%): {money(result.stress.cashFlow)}/mo, DSCR {Number.isFinite(result.stress.dscr) ? result.stress.dscr.toFixed(2) : "n/a"}</div>
          </div>
        </section>
      </main>
      <footer className="muted small">
        Estimates only — AVMs, area averages and insurance figures are starting points. Verify rent with local PMs, taxes with the assessor, insurance with a quote, and the existing loan with the seller's mortgage statement before you offer.
      </footer>
    </div>
  );
}


function FinancingInputs({ id, t, set, marketRate }: { id: StructureId; t: Terms; set: (k: keyof Terms) => (v: number | boolean) => void; marketRate: number }) {
  const rate = (label = "Interest rate", k: keyof Terms = "ratePct") => <Slider label={label} unit="%" value={t[k] as number} min={0} max={14} step={0.125} onChange={set(k)} marker={{ value: marketRate, label: "PMMS" }} />;
  const sellerNote = (
    <>
      <Slider label="Seller note rate" unit="%" value={t.sellerRatePct} min={0} max={10} step={0.25} onChange={set("sellerRatePct")} />
      <Toggle label="Interest-only seller note" value={t.sellerIO} onChange={set("sellerIO")} />
      {!t.sellerIO && <Slider label="Seller note amortization" unit="yrs" value={t.sellerAmortYears} min={5} max={40} onChange={set("sellerAmortYears")} />}
      <Slider label="Balloon (0 = none)" unit="yrs" value={t.balloonYears} min={0} max={30} onChange={set("balloonYears")} hint="At the balloon, the model refinances the remaining balance at market + 0.75%" />
    </>
  );
  switch (id) {
    case "cash":
      return <p className="muted small">No financing inputs.</p>;
    case "conventional":
    case "dscr":
      return (
        <>
          <Slider label="Down payment" unit="%" value={t.downPct} min={0} max={50} step={0.5} onChange={set("downPct")} />
          {rate()}
          <Slider label="Amortization" unit="yrs" value={t.amortYears} min={10} max={40} step={5} onChange={set("amortYears")} />
          <Slider label="Points" unit="%" value={t.pointsPct} min={0} max={4} step={0.25} onChange={set("pointsPct")} />
          {id === "dscr" && <Slider label="Interest-only period" unit="yrs" value={t.ioYears} min={0} max={10} onChange={set("ioYears")} />}
        </>
      );
    case "fha":
      return (
        <>
          <Slider label="Down payment" unit="%" value={t.downPct} min={3.5} max={20} step={0.5} onChange={set("downPct")} />
          {rate()}
          <Slider label="Annual MIP" unit="%" value={t.mipPct} min={0} max={1} step={0.05} onChange={set("mipPct")} />
        </>
      );
    case "subto":
    case "hybrid":
      return (
        <>
          <Slider label="Existing loan balance" unit="$" value={t.existingBalance} min={0} max={1500000} step={1000} onChange={set("existingBalance")} hint="Estimated from last sale if available — get the mortgage statement" />
          <Slider label="Existing rate" unit="%" value={t.existingRatePct} min={0} max={10} step={0.125} onChange={set("existingRatePct")} />
          <Slider label="Years left on loan" unit="yrs" value={t.existingYearsLeft} min={1} max={30} onChange={set("existingYearsLeft")} />
          <Slider label="Arrears / reinstatement" unit="$" value={t.arrears} min={0} max={50000} step={250} onChange={set("arrears")} />
          <Slider label="Seller equity carried as note" unit="%" value={t.sellerCarryPct} min={0} max={100} step={5} onChange={set("sellerCarryPct")} />
          {t.sellerCarryPct > 0 && sellerNote}
        </>
      );
    case "sellerFinance":
      return (
        <>
          <Slider label="Down payment to seller" unit="%" value={t.downPct} min={0} max={40} step={0.5} onChange={set("downPct")} />
          {sellerNote}
        </>
      );
    case "morby":
      return (
        <>
          <Slider label="Bank / DSCR loan (LTV)" unit="%" value={t.bankLtvPct} min={50} max={90} step={0.5} onChange={set("bankLtvPct")} />
          {rate("Bank rate")}
          <Slider label="Bank amortization" unit="yrs" value={t.amortYears} min={15} max={40} step={5} onChange={set("amortYears")} />
          <Slider label="Bank points" unit="%" value={t.pointsPct} min={0} max={4} step={0.25} onChange={set("pointsPct")} />
          <Slider label="Seller carry 2nd (% of price)" unit="%" value={t.morbyCarryPct} min={0} max={50} step={0.5} onChange={set("morbyCarryPct")} />
          {sellerNote}
        </>
      );
    case "brrrr":
      return (
        <>
          <Slider label="Hard money (% of price + rehab)" unit="%" value={t.hmLtcPct} min={0} max={100} step={1} onChange={set("hmLtcPct")} />
          {rate("Hard money rate", "hmRatePct")}
          <Slider label="Hard money points" unit="%" value={t.hmPointsPct} min={0} max={5} step={0.25} onChange={set("hmPointsPct")} />
          <Slider label="Rehab + season months" unit="mo" value={t.rehabMonths} min={1} max={18} onChange={set("rehabMonths")} />
          <Slider label="Refi LTV (of ARV)" unit="%" value={t.refiLtvPct} min={50} max={80} step={0.5} onChange={set("refiLtvPct")} />
          {rate("Refi rate", "refiRatePct")}
        </>
      );
  }
}

function Group({ title, children, collapsed }: { title: string; children: React.ReactNode; collapsed?: boolean }) {
  return (
    <details className="group card" open={!collapsed}>
      <summary>{title}</summary>
      <div className="group-body">{children}</div>
    </details>
  );
}

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
