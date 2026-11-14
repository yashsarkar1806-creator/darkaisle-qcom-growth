import { generateDataset } from './data.js';
import { runAll, promoSeries, promoProfitAtDepth, allocateBudget, readout, toCSV, indexSeries } from './engine.js';

const $ = s => document.querySelector(s);
const inr = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const pct = x => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
window.dataLayer = window.dataLayer || [];
const track = (event, params = {}) => window.dataLayer.push({ event, ...params });

let ds, res, series, levers, selPromo = 0;

function load(seed) {
  ds = generateDataset(seed);
  series = indexSeries(ds);
  res = runAll(ds);
  levers = res.levers.map(l => ({ ...l }));
  selPromo = res.promos.findIndex(p => p.verdict === 'Scale'); if (selPromo < 0) selPromo = 0;
  renderAll();
  track('demo_run', { seed });
}

function renderAll() { renderHero(); renderPromos(); renderAvail(); renderRange(); renderBudget(); }

function renderHero() {
  const naive = res.promos.reduce((s, p) => s + p.naiveUplift, 0) / res.promos.length;
  const trueProfit = res.promos.reduce((s, p) => s + p.profit, 0);
  const losers = res.promos.filter(p => p.profit < 0).length;
  $('#heroStats').innerHTML = [
    [pct(naive), 'average promo uplift a "vs last week" dashboard would report'],
    [inr(trueProfit), 'actual net profit from the same 5 promos'],
    [`${losers} of ${res.promos.length}`, 'promos lost money after dip and cannibalisation'],
    [inr(res.avail.totalLostRevenue), 'revenue lost to stock-outs in 12 weeks'],
  ].map(([k, l]) => `<div><div class="k">${k}</div><div class="l">${l}</div></div>`).join('') + '<div class="fine" style="grid-column:1/-1;color:#bbb">Synthetic demo figures for a fictional brand.</div>';
}

function renderPromos() {
  const head = '<thead><tr><th class="l">Promo</th><th class="l">Platform</th><th>Depth</th><th>Naive uplift</th><th>True uplift</th><th>Post dip</th><th>Cannibalised</th><th>Spend</th><th>Net profit</th><th>ROI</th><th class="l">Verdict</th><th>Best depth</th></tr></thead>';
  const body = res.promos.map((p, i) => `<tr data-i="${i}" class="${i === selPromo ? 'sel' : ''}"><td class="l"><strong>${p.id}</strong> ${esc(p.skuName)}<br><small class="fine">${esc(p.label)}</small></td><td class="l">${p.platform}</td><td>${Math.round(p.depth * 100)}%</td><td>${pct(p.naiveUplift)}</td><td>${pct(p.uplift)}</td><td>${Math.round(p.dipUnits)}</td><td>${Math.round(p.cannibUnits)}</td><td>${inr(p.spend)}</td><td>${inr(p.profit)}</td><td>${pct(p.roi)}</td><td class="l"><span class="v ${p.verdict}">${p.verdict}</span></td><td>${p.bestDepth ? Math.round(p.bestDepth * 100) + '%' : 'none'}</td></tr>`).join('');
  $('#promoTable').innerHTML = head + '<tbody>' + body + '</tbody>';
  $('#promoTable').querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => { selPromo = +tr.dataset.i; renderPromos(); track('promo_select', { promo: res.promos[selPromo].id }); });
  drawPromoChart(); drawDepthChart();
}

function drawPromoChart() {
  const p = ds.promos[selPromo], r = res.promos[selPromo];
  const s = promoSeries(ds, p, series);
  $('#promoChartTitle').textContent = `${r.id}: ${r.skuName} on ${r.platform} (${r.stores} stores)`;
  const W = 560, H = 240, L = 44, B = 26, T = 10;
  const max = Math.max(...s.map(o => Math.max(o.actual, o.baseline))) * 1.1 || 1;
  const x = i => L + (i + 0.5) * (W - L - 10) / s.length, y = v => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - 10) / s.length;
  let g = '';
  s.forEach((o, i) => { if (o.phase === 'promo') g += `<rect x="${x(i) - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}" fill="#ffe3cc"/>`; });
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; g += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#777">${Math.round(v)}</text>`; }
  s.forEach((o, i) => { g += `<rect x="${x(i) - bw * 0.35}" y="${y(o.actual)}" width="${bw * 0.7}" height="${H - B - y(o.actual)}" fill="#6b3df5" opacity=".85"><title>Day ${o.day + 1}: ${o.actual} actual, ${Math.round(o.baseline)} baseline</title></rect>`; });
  g += `<polyline fill="none" stroke="#5b6070" stroke-width="2" stroke-dasharray="4 3" points="${s.map((o, i) => `${x(i)},${y(o.baseline)}`).join(' ')}"/>`;
  s.forEach((o, i) => { if (i % 7 === 0) g += `<text x="${x(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#777">day ${o.day + 1}</text>`; });
  $('#promoChart').innerHTML = g;
}

function drawDepthChart() {
  const p = ds.promos[selPromo], r = res.promos[selPromo], k = ds.skus.find(s => s.id === p.sku);
  const params = { base: r.baseUnits, price: k.price, margin: k.unitMargin, funded: p.brandFunded, elasticity: r.elasticity, dipRatio: r.dipRatio, cannibRatio: r.cannibRatio, fee: p.fee };
  const depths = Array.from({ length: 9 }, (_, i) => i * 0.05);
  const vals = depths.map(d => promoProfitAtDepth(params, d));
  const W = 560, H = 240, L = 60, B = 26, T = 10;
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = (hi - lo) || 1;
  const x = i => L + i * (W - L - 20) / (depths.length - 1), y = v => T + (H - T - B) * (hi - v) / span;
  let g = `<line x1="${L}" x2="${W - 20}" y1="${y(0)}" y2="${y(0)}" stroke="#999"/>`;
  [lo, hi].forEach(v => g += `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#777">${inr(v)}</text>`);
  g += `<polyline fill="none" stroke="#ff7a1a" stroke-width="3" points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
  vals.forEach((v, i) => {
    const cur = Math.abs(depths[i] - p.depth) < 1e-9, best = Math.abs(depths[i] - r.bestDepth) < 1e-9 && r.bestDepth > 0;
    g += `<circle cx="${x(i)}" cy="${y(v)}" r="${cur || best ? 6 : 3.5}" fill="${best ? '#138a52' : cur ? '#6b3df5' : '#ff7a1a'}"><title>${Math.round(depths[i] * 100)}% off: ${inr(v)}</title></circle>`;
    g += `<text x="${x(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#777">${Math.round(depths[i] * 100)}%</text>`;
  });
  $('#depthLegend').innerHTML = `<span class="sw actual"></span>Ran at ${Math.round(p.depth * 100)}% off (${inr(r.profit)})${r.bestDepth ? ` <span class="sw" style="background:#138a52"></span>Best tested depth ${Math.round(r.bestDepth * 100)}% (${inr(r.bestDepthProfit)})` : ' · no discount depth beats running no promo'}`;
  $('#depthChart').innerHTML = g;
}

function bars(el, rows, label, value, fmt, alt) {
  const max = Math.max(...rows.map(value), 1);
  el.innerHTML = rows.map(r => `<div class="row"><span>${esc(label(r))}</span><div class="bar ${alt ? 'alt' : ''}" style="width:${Math.max(2, 100 * value(r) / max)}%"></div><span class="num">${fmt(value(r))}</span></div>`).join('');
}

function renderAvail() {
  const a = res.avail, worstSku = a.bySku[0];
  const skuName = id => ds.skus.find(s => s.id === id).name;
  $('#availKpis').innerHTML = [
    [inr(a.totalLostRevenue), 'revenue lost to stock-outs (12 weeks)'],
    [inr(a.totalLostMargin), 'margin lost'],
    [Math.round(a.items.reduce((s, i) => s + i.availability, 0) / a.items.length * 100) + '%', 'average on-shelf availability'],
    [skuName(worstSku.sku), `SKU losing most (${inr(worstSku.lostRevenue)})`],
  ].map(([k, l]) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="l">${l}</div></div>`).join('');
  bars($('#availCity'), a.byCity, r => r.city, r => r.lostRevenue, inr);
  bars($('#availPlat'), a.byPlatform, r => r.platform, r => r.lostRevenue, inr, true);
  $('#availTable').innerHTML = '<thead><tr><th class="l">Store</th><th class="l">Platform</th><th class="l">SKU</th><th>Availability</th><th>Days with stock-outs</th><th>Lost units</th><th>Lost revenue</th><th>Lost margin</th></tr></thead><tbody>' +
    a.items.slice(0, 12).map(i => `<tr><td class="l">${esc(i.storeName)}</td><td class="l">${i.platform}</td><td class="l">${esc(i.skuName)}</td><td>${Math.round(i.availability * 100)}%</td><td>${i.oosDays}</td><td>${Math.round(i.lostUnits)}</td><td>${inr(i.lostRevenue)}</td><td>${inr(i.lostMargin)}</td></tr>`).join('') + '</tbody>';
}

function renderRange() {
  const sel = $('#storeSel');
  const prev = sel.value;
  sel.innerHTML = res.assort.stores.map(s => `<option value="${s.store}">${esc(s.storeName)} · ${s.platform} · ${s.gaps.length} gaps, ${s.tail.length} tail</option>`).join('');
  const withActions = res.assort.stores.find(s => s.gaps.length && s.tail.length) || res.assort.stores.find(s => s.gaps.length) || res.assort.stores[0];
  sel.value = res.assort.stores.some(s => s.store === prev) ? prev : withActions.store;
  const st = res.assort.stores.find(s => s.store === sel.value);
  bars($('#rangeListed'), st.listed, r => r.name, r => r.marginPerDay, v => inr(v) + '/day');
  const acts = [
    ...st.gaps.map(g => `<div class="action gap"><strong>Pitch listing: ${esc(g.name)}</strong><br>Sells in ${g.peerStores} same-city stores; estimated ${g.estVelocity} units and ${inr(g.estMarginPerDay)} margin a day here.</div>`),
    ...st.tail.map(t => `<div class="action"><strong>${t.action}: ${esc(t.name)}</strong><br>${t.velocity} units a day, ${inr(t.marginPerDay)} margin a day, well below same-city stores.</div>`),
  ];
  $('#rangeActions').innerHTML = (acts.join('') || '<p class="hint">No range actions for this store: listings look healthy.</p>') +
    `<p class="fine">Store size index vs city peers: ${st.storeIndex}. Across all stores: ${res.assort.totalGaps} gaps worth about ${inr(res.assort.gapMarginPerMonth)} margin a month, ${res.assort.totalTail} tail listings.</p>`;
}
$('#storeSel').onchange = () => { renderRange(); track('store_select', { store: $('#storeSel').value }); };

function plan() { return allocateBudget(+$('#budget').value, levers, { hurdle: +$('#hurdle').value || 1 }); }

function renderBudget() {
  $('#budgetOut').textContent = ' ' + inr(+$('#budget').value);
  const p = plan();
  $('#leverTable').innerHTML = '<thead><tr><th class="l">Lever</th><th>Max monthly margin (cap, ₹)</th><th>Half-spend (₹)</th><th>Allocated</th><th>Incremental margin</th><th>ROI</th></tr></thead><tbody>' +
    levers.map((l, i) => { const r = p.rows[i]; return `<tr><td class="l">${esc(l.name)}</td><td><input type="number" data-i="${i}" data-k="cap" value="${l.cap}" min="0" step="1000"></td><td><input type="number" data-i="${i}" data-k="halfSpend" value="${l.halfSpend}" min="1000" step="1000"></td><td>${inr(r.spend)}</td><td>${inr(r.incMargin)}</td><td>${r.spend ? pct(r.roi) : '–'}</td></tr>`; }).join('') + '</tbody>';
  $('#leverTable').querySelectorAll('input').forEach(inp => inp.onchange = () => { levers[+inp.dataset.i][inp.dataset.k] = Math.max(+inp.min, +inp.value || 0); renderBudget(); track('lever_edit', { lever: levers[+inp.dataset.i].name }); });
  $('#budgetKpis').innerHTML = [[inr(p.spent), 'recommended spend'], [inr(p.incMargin), 'expected incremental margin'], [inr(p.net), 'net after spend'], [inr(p.unspent), 'held back (below hurdle)']]
    .map(([k, l]) => `<div class="kpi"><div class="k">${k}</div><div class="l">${l}</div></div>`).join('');
  bars($('#budgetBars'), p.rows, r => r.name, r => r.spend, inr);
  $('#readout').textContent = readout(res, p);
}
$('#budget').oninput = renderBudget; $('#hurdle').onchange = renderBudget;

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + b.dataset.tab));
  track('demo_tab', { tab: b.dataset.tab });
});
$('#regen').onclick = () => load(+$('#seed').value || 1);
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
$('#dlRows').onclick = () => { download(`darkaisle-synthetic-${ds.seed}.csv`, toCSV(ds.rows)); track('file_download', { file: 'raw' }); };
$('#dlAvail').onclick = () => { download('darkaisle-availability-leaks.csv', toCSV(res.avail.items)); track('file_download', { file: 'availability' }); };
$('#copyReadout').onclick = async () => { try { await navigator.clipboard.writeText($('#readout').textContent); $('#copyReadout').textContent = 'Copied'; } catch { $('#copyReadout').textContent = 'Select and copy manually'; } track('readout_copy'); };
document.querySelectorAll('[data-cta]').forEach(a => a.addEventListener('click', () => track('cta_click', { cta: a.dataset.cta })));
$('#waitForm').onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const list = JSON.parse(localStorage.getItem('darkaisle_waitlist') || '[]');
  list.push({ role: f.get('role'), at: new Date().toISOString() }); // email deliberately not stored
  localStorage.setItem('darkaisle_waitlist', JSON.stringify(list));
  track('generate_lead', { role: f.get('role') });
  $('#waitMsg').textContent = `Thanks! (Concept demo: nothing was sent. Saved locally as entry #${list.length}; check window.dataLayer for the generate_lead event.)`;
  e.target.reset();
};

const params = new URLSearchParams(location.search);
const seed = +params.get('seed') || 20261114; $('#seed').value = seed;
load(seed);
if (params.get('tab')) document.querySelector(`.tabs button[data-tab="${params.get('tab')}"]`)?.click();
