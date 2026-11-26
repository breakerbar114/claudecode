import { adjustComp, runComps, RentComp } from "./comps";
import { recommend, stateFromAddress, deviation } from "./recommend";

const base = (o: Partial<RentComp>): RentComp => ({ id: Math.random().toString(), address: "x", amount: 2000, include: true, source: "manual", date: new Date().toISOString(), ...o });

test("adjusts a smaller, fewer-bedroom comp upward", () => {
  const a = adjustComp(base({ beds: 2, baths: 1, sqft: 1000 }), { beds: 3, baths: 2, sqft: 1200 });
  expect(a.adjSqft).toBeCloseTo(2000 * 0.35 * 0.2, 6); // +$140
  expect(a.adjBeds).toBeCloseTo(80, 6); // 4% with sqft known
  expect(a.adjBaths).toBeCloseTo(60, 6);
  expect(a.adjusted).toBeCloseTo(2280, 6);
});

test("size adjustment is capped at 15%", () => {
  const a = adjustComp(base({ sqft: 800 }), { sqft: 2400 });
  expect(a.adjSqft).toBeCloseTo(300, 6);
});

test("weighted median ignores excluded and too-different comps", () => {
  const s = { beds: 3, baths: 2, sqft: 1400 };
  const comps = [
    base({ amount: 2000, beds: 3, baths: 2, sqft: 1400, distance: 0.3 }),
    base({ amount: 2100, beds: 3, baths: 2, sqft: 1400, distance: 0.5 }),
    base({ amount: 2050, beds: 3, baths: 2, sqft: 1400, distance: 0.4 }),
    base({ amount: 9000, beds: 3, baths: 2, sqft: 1400, include: false }),
    base({ amount: 1000, beds: 1, baths: 1, sqft: 500 }), // needs >30% adjustment → dropped
  ];
  const r = runComps(comps, s);
  expect(r.used).toBe(3);
  expect(r.recommended).toBe(2050);
  expect(["High", "Good"]).toContain(r.confidence);
});

test("no usable comps → no recommendation", () => {
  expect(runComps([], {}).recommended).toBeNull();
});

test("recommendations stay fixed regardless of the current rent slider when comps exist", () => {
  const comps = runComps([base({ amount: 1800 }), base({ amount: 1850 }), base({ amount: 1900 })], {});
  const a = recommend({ units: 1, state: "OH", yearBuilt: 1965, marketValue: 250000, comps, currentRent: 1500 });
  const b = recommend({ units: 1, state: "OH", yearBuilt: 1965, marketValue: 250000, comps, currentRent: 3000 });
  expect(a.rent!.value).toBe(1850);
  expect(a.mgmtPct!.value).toBe(b.mgmtPct!.value);
  expect(a.taxRatePct!.value).toBeCloseTo(1.36 * 1.1, 3); // OH avg × non-homestead uplift
  expect(a.repairsPct!.value).toBe(9); // 60-yr-old building
});

test("management includes the $100/door minimum and leasing fees for small rentals", () => {
  const comps = runComps([base({ amount: 800 })], {});
  const r = recommend({ units: 1, state: null, marketValue: 100000, comps, currentRent: 800 });
  expect(r.mgmtPct!.value).toBeCloseTo(12.5 + 2.1, 1);
});

test("state parsing and deviation direction", () => {
  expect(stateFromAddress("123 Main St, Columbus, OH 43215")).toBe("OH");
  expect(stateFromAddress("9 Elm Rd, Austin, TX")).toBe("TX");
  expect(deviation(2300, { value: 2000, why: "", aggressive: "above" }).aggressive).toBe(true);
  expect(deviation(8, { value: 10, why: "", aggressive: "below" }).aggressive).toBe(true);
  expect(deviation(12, { value: 10, why: "", aggressive: "below" }).aggressive).toBe(false);
});

test("sale comps use price-scale adjustments and round to $1,000", () => {
  const s = { beds: 3, baths: 2, sqft: 1500 };
  const a = adjustComp(base({ amount: 300000, beds: 3, baths: 2, sqft: 1250 }), s, "sale");
  expect(a.adjSqft).toBeCloseTo(300000 * 0.6 * 0.2, 0); // +$36,000: price is more size-sensitive than rent
  const r = runComps(
    [base({ amount: 300000, beds: 3, baths: 2, sqft: 1500 }), base({ amount: 310000, beds: 3, baths: 2, sqft: 1500 }), base({ amount: 305500, beds: 3, baths: 2, sqft: 1500 })],
    s, Date.now(), "sale",
  );
  expect(r.recommended! % 1000).toBe(0);
  expect(r.recommended).toBeGreaterThanOrEqual(300000);
  expect(r.recommended).toBeLessThanOrEqual(310000);
});

test("value recommendation prefers sale comps over the AVM", () => {
  const sale = runComps([base({ amount: 250000 }), base({ amount: 255000 }), base({ amount: 260000 })], {}, Date.now(), "sale");
  const r = recommend({ units: 1, state: "OH", marketValue: 240000, comps: null, saleComps: sale, valueAvm: 240000, currentRent: 2000 });
  expect(r.marketValue!.value).toBe(255000);
  const r2 = recommend({ units: 1, state: "OH", marketValue: 240000, comps: null, saleComps: null, valueAvm: 240000, currentRent: 2000 });
  expect(r2.marketValue!.value).toBe(240000);
});
