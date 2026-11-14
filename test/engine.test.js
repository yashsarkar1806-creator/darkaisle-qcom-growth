import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset, mulberry32, TRUTH, DAYS } from '../src/data.js';
import * as E from '../src/engine.js';

const ds = generateDataset(20261114);
const res = E.runAll(ds);

test('synthetic dataset is deterministic and labelled synthetic', () => {
  const again = generateDataset(20261114);
  assert.equal(ds.synthetic, true);
  assert.equal(ds.rows.length, again.rows.length);
  assert.deepEqual(ds.rows.slice(0, 50), again.rows.slice(0, 50));
  assert.notDeepEqual(generateDataset(7).rows.slice(0, 50), ds.rows.slice(0, 50));
  assert.equal(ds.stores.length, 18);
  const a = mulberry32(1), b = mulberry32(1);
  assert.equal(a(), b());
});

test('baseline recovers a flat day-of-week series and ignores excluded / out-of-stock days', () => {
  const ser = Array.from({ length: 56 }, (_, d) => ({ units: Math.round(100 * E.DOW[d % 7]), inStock: 1 }));
  ser[10] = { units: 900, inStock: 1 }; // promo spike, excluded
  ser[20] = { units: 5, inStock: 0.1 }; // stock-out, ignored
  const b = E.baseline(ser, new Set([10]));
  for (const d of [3, 10, 20, 40]) assert.ok(Math.abs(b[d] - 100 * E.DOW[d % 7]) < 1.5, `day ${d}: ${b[d]}`);
});

test('contaminated days cover own promo + 7 post days and sibling promo windows only', () => {
  const st = ds.stores.find(s => s.platform === 'Platform A');
  const own = E.contaminatedDays(ds, st.id, 'CH-MAS-50');
  assert.ok(own.has(21) && own.has(27) && own.has(34) && !own.has(35));
  const sib = E.contaminatedDays(ds, st.id, 'CH-SAL-50');
  assert.ok(sib.has(21) && sib.has(27) && !sib.has(28));
  const other = E.contaminatedDays(ds, st.id, 'DR-JAL-250');
  assert.equal(other.size, 0); // drinks promo P3 is on Platform C
});

test('fitted promo elasticities land near the hidden generator truth', () => {
  for (const p of res.promos) {
    const truth = TRUTH.elasticity[p.sku];
    assert.ok(Math.abs(p.elasticity - truth) / truth < 0.25, `${p.id}: fitted ${p.elasticity} vs truth ${truth}`);
  }
});

test('promo read detects the pantry-loading dip and cannibalisation', () => {
  for (const p of res.promos) {
    assert.ok(p.dipUnits > 0, `${p.id} dip ${p.dipUnits}`);
    assert.ok(p.grossIncUnits > 0);
  }
  assert.ok(res.promos.reduce((s, p) => s + p.cannibUnits, 0) > 0);
});

test('promo verdicts give a realistic mix: deep drinks discounts lose money, makhana pays back', () => {
  const by = Object.fromEntries(res.promos.map(p => [p.id, p]));
  assert.equal(by.P2.verdict, 'Scale');
  assert.equal(by.P5.verdict, 'Stop');
  assert.ok(by.P5.profit < 0 && by.P2.profit > 0);
  assert.equal(E.promoVerdict(0.3), 'Scale');
  assert.equal(E.promoVerdict(0), 'Rework');
  assert.equal(E.promoVerdict(-0.5), 'Stop');
});

test('promo profit maths matches a hand calculation', () => {
  const params = { base: 100, price: 100, margin: 40, funded: 1, elasticity: 0, dipRatio: 0, cannibRatio: 0, fee: 0 };
  // No demand response: 10% off just gives away ₹10 on each of 100 units
  assert.equal(E.promoProfitAtDepth(params, 0.1), -1000);
  assert.equal(E.promoProfitAtDepth(params, 0), 0);
  const elastic = { ...params, elasticity: Math.log(2) / 0.2 }; // 20% off doubles units
  assert.ok(Math.abs(E.promoProfitAtDepth(elastic, 0.2) - (200 * 20 - 100 * 40)) < 1e-6);
  assert.equal(E.bestDepth(params).depth, 0);
  assert.ok(E.bestDepth({ ...params, elasticity: 8 }).depth > 0);
});

test('availability loss is positive, sorted and consistent across cuts', () => {
  const a = res.avail;
  assert.ok(a.totalLostRevenue > 0);
  for (let i = 1; i < a.items.length; i++) assert.ok(a.items[i - 1].lostRevenue >= a.items[i].lostRevenue);
  const cityTotal = a.byCity.reduce((s, c) => s + c.lostRevenue, 0);
  assert.equal(cityTotal, a.totalLostRevenue);
  assert.ok(a.items.every(i => i.availability > 0 && i.availability <= 1));
});

test('a fully stocked series has zero availability loss', () => {
  const mini = { ...ds, rows: ds.rows.map(r => ({ ...r, inStock: 1 })) };
  assert.equal(E.availabilityLoss(mini).totalLostRevenue, 0);
});

test('assortment finds listing gaps only for SKUs a store does not list', () => {
  const a = res.assort;
  assert.ok(a.totalGaps > 0);
  for (const s of a.stores) {
    for (const g of s.gaps) assert.ok(!ds.listings[s.store].includes(g.sku));
    for (const t of s.tail) assert.ok(ds.listings[s.store].includes(t.sku));
    for (let i = 1; i < s.listed.length; i++) assert.ok(s.listed[i - 1].marginPerDay >= s.listed[i].marginPerDay);
  }
  // Kokum Cooler is a Mumbai favourite in the generator, so gaps for it should appear in Mumbai if unlisted
  const mumbaiGaps = a.stores.filter(s => s.city === 'Mumbai').flatMap(s => s.gaps.map(g => g.sku));
  const mumbaiUnlisted = a.stores.filter(s => s.city === 'Mumbai' && !ds.listings[s.store].includes('DR-KOK-200')).length;
  if (mumbaiUnlisted) assert.ok(mumbaiGaps.includes('DR-KOK-200'));
});

test('budget allocator spends greedily, respects the hurdle and never overspends', () => {
  const levers = [{ name: 'A', cap: 100000, halfSpend: 20000 }, { name: 'B', cap: 10000, halfSpend: 20000 }];
  const p = E.allocateBudget(100000, levers, { step: 5000, hurdle: 1 });
  assert.ok(p.spent <= 100000 && p.spent + p.unspent === 100000);
  assert.equal(p.rows.find(r => r.name === 'B').spend, 0); // B never clears the hurdle
  assert.ok(p.rows.find(r => r.name === 'A').spend > 0);
  const strict = E.allocateBudget(100000, levers, { hurdle: 5 });
  assert.equal(strict.spent, 0);
  assert.ok(Math.abs(E.response({ cap: 1000, halfSpend: 50 }, 50) - 500) < 1e-9);
});

test('default levers and readout are grounded in the analysis', () => {
  assert.equal(res.levers.length, 4);
  assert.ok(res.levers.every(l => l.cap >= 0 && l.halfSpend > 0));
  const p2 = res.promos.find(p => p.id === 'P2');
  assert.ok(p2.bestDepthSpend > p2.fee); // spend at best depth includes discount cost on top of the fee
  const plan = E.allocateBudget(200000, res.levers);
  const text = E.readout(res, plan);
  assert.match(text, /Promos: 5 analysed/);
  assert.match(text, /synthetic data for a fictional brand/);
  assert.match(text, /Scale: P2/);
});

test('promo series covers pre, promo and post windows', () => {
  const s = E.promoSeries(ds, ds.promos[1]);
  assert.deepEqual([...new Set(s.map(o => o.phase))], ['pre', 'promo', 'post']);
  const promoDays = s.filter(o => o.phase === 'promo');
  assert.ok(promoDays.reduce((t, o) => t + o.actual, 0) > promoDays.reduce((t, o) => t + o.baseline, 0));
  assert.ok(s.every(o => o.day >= 0 && o.day < DAYS));
});

test('CSV export escapes commas and quotes', () => {
  const csv = E.toCSV([{ a: 'x,y', b: 'say "hi"', c: 3 }]);
  assert.equal(csv, 'a,b,c\n"x,y","say ""hi""",3');
  assert.equal(E.toCSV([]), '');
});

test('results are stable across several seeds (no NaN, mixed verdicts possible)', () => {
  for (const seed of [1, 42, 999]) {
    const r = E.runAll(generateDataset(seed));
    for (const p of r.promos) assert.ok(Number.isFinite(p.roi) && Number.isFinite(p.profit));
    assert.ok(Number.isFinite(r.avail.totalLostRevenue));
  }
});
