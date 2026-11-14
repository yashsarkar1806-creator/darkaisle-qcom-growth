// DarkAisle analysis engine: promo ROI, availability loss, assortment and budget planning
// for FMCG brands selling through quick-commerce dark stores. Pure functions, no dependencies.

export const DOW = [0.92, 0.9, 0.93, 0.97, 1.08, 1.17, 1.13];
const r2 = x => Math.round(x * 100) / 100;
const sum = a => a.reduce((s, x) => s + x, 0);
export function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Index rows into series[store][sku] = array(days) of {units, inStock, promo} */
export function indexSeries(ds) {
  const series = {};
  for (const r of ds.rows) {
    (series[r.store] ??= {})[r.sku] ??= Array.from({ length: ds.days }, () => null);
    series[r.store][r.sku][r.day] = r;
  }
  return series;
}

/** Days per store-sku that must not be used for a baseline: own promo windows, 7-day post windows and sibling promo windows. */
export function contaminatedDays(ds, store, sku) {
  const st = ds.stores.find(s => s.id === store);
  const k = ds.skus.find(s => s.id === sku);
  const bad = new Set();
  for (const p of ds.promos) {
    if (p.platform !== st.platform) continue;
    const pk = ds.skus.find(s => s.id === p.sku);
    const own = p.sku === sku;
    if (!own && pk.category !== k.category) continue;
    const end = p.start + p.length + (own ? 7 : 0);
    for (let d = p.start; d < end; d++) bad.add(d);
  }
  return bad;
}

/**
 * Expected full-availability demand per day: day-of-week adjusted mean of clean, fully in-stock days
 * within +/- window days (local level handles slow trend).
 */
export function baseline(series, excluded, window = 21) {
  const n = series.length, out = new Array(n).fill(0);
  for (let d = 0; d < n; d++) {
    let u = 0, w = 0;
    for (let j = Math.max(0, d - window); j <= Math.min(n - 1, d + window); j++) {
      const r = series[j];
      if (!r || excluded.has(j) || r.inStock < 1) continue;
      u += r.units; w += DOW[j % 7];
    }
    out[d] = w > 0 ? (u / w) * DOW[d % 7] : 0;
  }
  return out;
}

export function promoVerdict(roi) {
  if (roi >= 0.3) return 'Scale';
  if (roi >= -0.1) return 'Rework';
  return 'Stop';
}

/** Full incremental read of one promo, net of pantry-loading dip and same-category cannibalisation. */
export function evaluatePromo(ds, promo, series = indexSeries(ds)) {
  const sku = ds.skus.find(s => s.id === promo.sku);
  const stores = ds.stores.filter(s => s.platform === promo.platform && series[s.id]?.[promo.sku]);
  const siblings = ds.skus.filter(s => s.category === sku.category && s.id !== sku.id);
  let promoUnits = 0, baseUnits = 0, dipUnits = 0, cannibUnits = 0, cannibMargin = 0, prevWeekUnits = 0;
  const end = promo.start + promo.length;
  for (const st of stores) {
    const ser = series[st.id][promo.sku];
    const b = baseline(ser, contaminatedDays(ds, st.id, promo.sku));
    for (let d = promo.start; d < end; d++) {
      promoUnits += ser[d].units; baseUnits += b[d] * ser[d].inStock;
      const pw = d - 7; if (pw >= 0) prevWeekUnits += ser[pw].units;
    }
    for (let d = end; d < Math.min(ds.days, end + 7); d++) dipUnits += b[d] * ser[d].inStock - ser[d].units;
    for (const sib of siblings) {
      const ss = series[st.id][sib.id]; if (!ss) continue;
      const sb = baseline(ss, contaminatedDays(ds, st.id, sib.id));
      for (let d = promo.start; d < end; d++) {
        const lost = sb[d] * ss[d].inStock - ss[d].units;
        cannibUnits += lost; cannibMargin += lost * sib.unitMargin;
      }
    }
  }
  const grossInc = promoUnits - baseUnits;
  const discountPerUnit = sku.price * promo.depth * promo.brandFunded;
  const discountCost = promoUnits * discountPerUnit;
  const spend = discountCost + promo.fee;
  const profit = promoUnits * (sku.unitMargin - discountPerUnit) - baseUnits * sku.unitMargin
    - dipUnits * sku.unitMargin - cannibMargin - promo.fee;
  const netIncUnits = grossInc - dipUnits;
  const uplift = baseUnits > 0 ? promoUnits / baseUnits - 1 : 0;
  const naiveUplift = prevWeekUnits > 0 ? promoUnits / prevWeekUnits - 1 : 0;
  const elasticity = promo.depth > 0 && uplift > -1 ? Math.log(1 + uplift) / promo.depth : 0;
  const roi = spend > 0 ? profit / spend : 0;
  const dipRatio = grossInc > 0 ? dipUnits / grossInc : 0;
  const cannibRatio = grossInc > 0 ? cannibMargin / (grossInc * sku.unitMargin) : 0;
  const best = bestDepth({ base: baseUnits, price: sku.price, margin: sku.unitMargin, funded: promo.brandFunded, elasticity, dipRatio, cannibRatio, fee: promo.fee });
  return {
    id: promo.id, sku: sku.id, skuName: sku.name, platform: promo.platform, label: promo.label, depth: promo.depth,
    stores: stores.length, promoUnits, baseUnits: r2(baseUnits), grossIncUnits: r2(grossInc), dipUnits: r2(dipUnits),
    cannibUnits: r2(cannibUnits), netIncUnits: r2(netIncUnits - cannibUnits), uplift: r2(uplift), naiveUplift: r2(naiveUplift),
    elasticity: r2(elasticity), discountCost: Math.round(discountCost), fee: promo.fee, spend: Math.round(spend),
    profit: Math.round(profit), roi: r2(roi), verdict: promoVerdict(roi), dipRatio: r2(dipRatio), cannibRatio: r2(cannibRatio),
    bestDepth: best.depth, bestDepthProfit: Math.round(best.profit),
    bestDepthSpend: best.depth ? Math.round(baseUnits * Math.exp(elasticity * best.depth) * sku.price * best.depth * promo.brandFunded + promo.fee) : 0,
  };
}

/** Profit for a given discount depth using the fitted elasticity and observed leakage ratios. */
export function promoProfitAtDepth({ base, price, margin, funded, elasticity, dipRatio, cannibRatio, fee }, depth) {
  if (depth === 0) return 0; // no promo, no fee, no incremental
  const units = base * Math.exp(elasticity * depth);
  const inc = units - base;
  return units * (margin - price * depth * funded) - base * margin - inc * margin * (dipRatio + cannibRatio) - fee;
}

export function bestDepth(params, grid = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) {
  let best = { depth: 0, profit: 0 };
  for (const d of grid) {
    const p = promoProfitAtDepth(params, d);
    if (p > best.profit + 1e-9) best = { depth: d, profit: p };
  }
  return best;
}

/** Lost sales from partial or full stock-outs (non-promo days), by store and SKU. */
export function availabilityLoss(ds, series = indexSeries(ds)) {
  const items = [];
  for (const st of ds.stores) {
    for (const skuId of ds.listings[st.id]) {
      const ser = series[st.id][skuId]; if (!ser) continue;
      const k = ds.skus.find(s => s.id === skuId);
      const bad = contaminatedDays(ds, st.id, skuId);
      const b = baseline(ser, bad);
      let lost = 0, avail = 0, n = 0, oosDays = 0;
      for (let d = 0; d < ds.days; d++) {
        avail += ser[d].inStock; if (ser[d].inStock < 1) oosDays++;
        if (bad.has(d)) continue;
        n++; lost += b[d] * (1 - ser[d].inStock);
      }
      items.push({ store: st.id, storeName: st.name, city: st.city, platform: st.platform, sku: skuId, skuName: k.name,
        availability: r2(avail / ds.days), oosDays, lostUnits: r2(lost), lostRevenue: Math.round(lost * k.price), lostMargin: Math.round(lost * k.unitMargin) });
    }
  }
  items.sort((a, b) => b.lostRevenue - a.lostRevenue);
  const by = key => Object.values(items.reduce((acc, it) => {
    const g = acc[it[key]] ??= { [key]: it[key], lostRevenue: 0, lostMargin: 0, n: 0, availSum: 0 };
    g.lostRevenue += it.lostRevenue; g.lostMargin += it.lostMargin; g.n++; g.availSum += it.availability; return acc;
  }, {})).map(g => ({ [key]: g[key], lostRevenue: g.lostRevenue, lostMargin: g.lostMargin, availability: r2(g.availSum / g.n) }))
    .sort((a, b) => b.lostRevenue - a.lostRevenue);
  return { items, totalLostRevenue: sum(items.map(i => i.lostRevenue)), totalLostMargin: sum(items.map(i => i.lostMargin)),
    byCity: by('city'), byPlatform: by('platform'), bySku: by('sku') };
}

/**
 * Assortment health per dark store: velocity per fully available day, tail SKUs to fix or delist,
 * and range gaps (SKUs not listed but selling well in same-city stores).
 */
export function assortment(ds, series = indexSeries(ds)) {
  const vel = {}; // vel[store][sku] = units per full-availability non-promo day
  for (const st of ds.stores) {
    vel[st.id] = {};
    for (const skuId of ds.listings[st.id]) {
      const ser = series[st.id][skuId]; if (!ser) continue;
      const bad = contaminatedDays(ds, st.id, skuId);
      let u = 0, a = 0;
      for (let d = 0; d < ds.days; d++) { if (bad.has(d)) continue; u += ser[d].units; a += ser[d].inStock * DOW[d % 7]; }
      vel[st.id][skuId] = a > 0 ? u / a : 0;
    }
  }
  // Store index: how big a store is vs city peers on SKUs they share
  const storeIndex = {};
  for (const st of ds.stores) {
    const peers = ds.stores.filter(p => p.city === st.city);
    const ratios = Object.keys(vel[st.id]).map(sku => {
      const m = median(peers.map(p => vel[p.id][sku]).filter(v => v !== undefined));
      return m > 0 ? vel[st.id][sku] / m : 1;
    });
    storeIndex[st.id] = median(ratios) || 1;
  }
  const sku = id => ds.skus.find(s => s.id === id);
  const stores = ds.stores.map(st => {
    const peers = ds.stores.filter(p => p.city === st.city && p.id !== st.id);
    const listed = Object.entries(vel[st.id]).map(([id, v]) => ({ sku: id, name: sku(id).name, velocity: r2(v), marginPerDay: r2(v * sku(id).unitMargin) }))
      .sort((a, b) => b.marginPerDay - a.marginPerDay);
    const medMargin = median(listed.map(l => l.marginPerDay));
    const tail = listed.filter(l => {
      const peerMed = median(peers.map(p => vel[p.id][l.sku]).filter(v => v !== undefined)) * storeIndex[st.id];
      return l.marginPerDay < medMargin * 0.5 && (peerMed === 0 || l.velocity < peerMed * 0.6);
    }).map(l => ({ ...l, action: 'Fix visibility or delist' }));
    const gaps = ds.skus.filter(k => !vel[st.id][k.id]).map(k => {
      const peerV = peers.map(p => vel[p.id][k.id]).filter(v => v !== undefined);
      const est = median(peerV) * storeIndex[st.id];
      return { sku: k.id, name: k.name, peerStores: peerV.length, estVelocity: r2(est), estMarginPerDay: r2(est * k.unitMargin) };
    }).filter(g => g.peerStores >= 2 && g.estMarginPerDay >= medMargin * 0.75)
      .map(g => ({ ...g, action: 'Pitch listing' }))
      .sort((a, b) => b.estMarginPerDay - a.estMarginPerDay);
    return { store: st.id, storeName: st.name, city: st.city, platform: st.platform, storeIndex: r2(storeIndex[st.id]), listed, tail, gaps };
  });
  const gapValue = sum(stores.flatMap(s => s.gaps.map(g => g.estMarginPerDay))) * 30;
  return { stores, totalGaps: sum(stores.map(s => s.gaps.length)), totalTail: sum(stores.map(s => s.tail.length)), gapMarginPerMonth: Math.round(gapValue) };
}

/** Diminishing-returns response: cap * (1 - 2^(-spend/halfSpend)) incremental margin. */
export function response(lever, spend) {
  return lever.cap * (1 - Math.pow(2, -spend / lever.halfSpend));
}

/**
 * Greedy marginal allocation of a monthly budget across levers. Stops funding when the next step
 * returns less than `hurdle` rupees of margin per rupee spent, leaving the rest unspent.
 */
export function allocateBudget(budget, levers, { step = 5000, hurdle = 1 } = {}) {
  const alloc = Object.fromEntries(levers.map(l => [l.name, 0]));
  let left = budget;
  while (left >= step) {
    let best = null, bestGain = -Infinity;
    for (const l of levers) {
      const gain = response(l, alloc[l.name] + step) - response(l, alloc[l.name]);
      if (gain > bestGain) { bestGain = gain; best = l; }
    }
    if (!best || bestGain / step < hurdle) break;
    alloc[best.name] += step; left -= step;
  }
  const rows = levers.map(l => {
    const s = alloc[l.name], m = response(l, s);
    return { name: l.name, spend: s, incMargin: Math.round(m), roi: s > 0 ? r2((m - s) / s) : 0 };
  });
  const spent = budget - left;
  const incMargin = sum(rows.map(r => r.incMargin));
  return { rows, spent, unspent: left, incMargin, net: incMargin - spent };
}

/** Default levers derived from the analysis (monthly), so the planner is grounded in the data. */
export function defaultLevers(promoResults, avail, assort, days = 84) {
  const month = 30 / days;
  const good = promoResults.filter(p => p.bestDepthProfit > 0);
  // Promo lever: gross incremental margin (profit + spend) if each promo that can pay back re-runs once a month at its best depth
  const promoSpend = sum(good.map(p => p.bestDepthSpend));
  const promoCap = sum(good.map(p => p.bestDepthProfit + p.bestDepthSpend));
  return [
    { name: 'Availability fixes (replenishment, safety stock)', cap: Math.round(avail.totalLostMargin * month * 0.7), halfSpend: 15000 },
    { name: 'Promos at recommended depth', cap: Math.round(promoCap), halfSpend: Math.max(5000, Math.round(promoSpend * 0.6)) },
    { name: 'New listings (range gaps)', cap: Math.round(assort.gapMarginPerMonth * 0.8), halfSpend: 20000 },
    { name: 'Sponsored search ads (assumption)', cap: 90000, halfSpend: 45000 },
  ];
}

/** Daily actual vs baseline (summed over the promo's stores) from 14 days before to 7 days after. */
export function promoSeries(ds, promo, series = indexSeries(ds)) {
  const stores = ds.stores.filter(s => s.platform === promo.platform && series[s.id]?.[promo.sku]);
  const from = Math.max(0, promo.start - 14), to = Math.min(ds.days, promo.start + promo.length + 7);
  const out = [];
  for (let d = from; d < to; d++) out.push({ day: d, actual: 0, baseline: 0, phase: d < promo.start ? 'pre' : d < promo.start + promo.length ? 'promo' : 'post' });
  for (const st of stores) {
    const ser = series[st.id][promo.sku];
    const b = baseline(ser, contaminatedDays(ds, st.id, promo.sku));
    for (const o of out) { o.actual += ser[o.day].units; o.baseline += b[o.day] * ser[o.day].inStock; }
  }
  return out.map(o => ({ ...o, baseline: r2(o.baseline) }));
}

export function runAll(ds) {
  const series = indexSeries(ds);
  const promos = ds.promos.map(p => evaluatePromo(ds, p, series));
  const avail = availabilityLoss(ds, series);
  const assort = assortment(ds, series);
  const levers = defaultLevers(promos, avail, assort, ds.days);
  return { promos, avail, assort, levers };
}

const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

export function readout(res, budgetPlan) {
  const lines = [];
  const scale = res.promos.filter(p => p.verdict === 'Scale'), stop = res.promos.filter(p => p.verdict === 'Stop');
  lines.push(`Promos: ${res.promos.length} analysed. Net incremental profit ${inr(sum(res.promos.map(p => p.profit)))} on ${inr(sum(res.promos.map(p => p.spend)))} of spend after pantry-loading dip and cannibalisation.`);
  if (scale.length) lines.push(`Scale: ${scale.map(p => `${p.id} ${p.skuName} (ROI ${Math.round(p.roi * 100)}%)`).join('; ')}.`);
  if (stop.length) lines.push(`Stop or redesign: ${stop.map(p => `${p.id} ${p.skuName} at ${Math.round(p.depth * 100)}% off (ROI ${Math.round(p.roi * 100)}%, ${p.bestDepth ? `try ${Math.round(p.bestDepth * 100)}% off` : 'no profitable depth found'})`).join('; ')}.`);
  const naive = res.promos.filter(p => p.naiveUplift > p.uplift + 0.1);
  if (naive.length) lines.push(`A simple "vs last week" read overstates uplift on ${naive.length} of ${res.promos.length} promos, because it ignores weekday mix and stock-outs.`);
  const top = res.avail.items[0];
  lines.push(`Availability: ${inr(res.avail.totalLostRevenue)} of revenue lost to stock-outs over the period; the worst line is ${top.skuName} at ${top.storeName} (${Math.round(top.availability * 100)}% available, ${inr(top.lostRevenue)} lost).`);
  lines.push(`Range: ${res.assort.totalGaps} listing gaps worth about ${inr(res.assort.gapMarginPerMonth)} margin a month, and ${res.assort.totalTail} tail listings to fix or swap.`);
  if (budgetPlan) lines.push(`Budget: spend ${inr(budgetPlan.spent)} of the monthly budget for about ${inr(budgetPlan.incMargin)} incremental margin; the biggest share goes to ${[...budgetPlan.rows].sort((a, b) => b.spend - a.spend)[0].name.toLowerCase()}.${budgetPlan.unspent ? ` Hold back ${inr(budgetPlan.unspent)}, the next step would not pay back.` : ''}`);
  lines.push('All figures come from synthetic data for a fictional brand.');
  return lines.join('\n');
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
