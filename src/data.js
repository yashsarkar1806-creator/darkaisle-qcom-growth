// Seeded synthetic quick-commerce dataset for a FICTIONAL FMCG snack & drinks brand ("Chatkara Foods").
// Platforms are generic ("Platform A/B/C"); stores, SKUs, prices and sales are all invented.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poisson(lambda, rnd) {
  if (lambda <= 0) return 0;
  if (lambda > 40) { // normal approximation for speed
    const u = Math.max(rnd(), 1e-12), v = rnd();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
  }
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

export const SKUS = [
  { id: 'CH-MAS-50', name: 'Masala Crunch Chips 50g', category: 'Chips', price: 20, unitMargin: 9.0, base: 54.0 },
  { id: 'CH-SAL-50', name: 'Sea Salt Chips 50g', category: 'Chips', price: 20, unitMargin: 9.0, base: 36.0 },
  { id: 'CH-PER-150', name: 'Peri Peri Chips 150g', category: 'Chips', price: 60, unitMargin: 27.0, base: 21.0 },
  { id: 'NM-BHU-200', name: 'Bhujia Mix 200g', category: 'Namkeen', price: 55, unitMargin: 24.8, base: 30.0 },
  { id: 'NM-MAK-90', name: 'Roasted Makhana Pudina 90g', category: 'Namkeen', price: 99, unitMargin: 44.6, base: 14.4 },
  { id: 'NM-CHA-150', name: 'Chana Jor Garam 150g', category: 'Namkeen', price: 45, unitMargin: 20.2, base: 13.2 },
  { id: 'DR-JAL-250', name: 'Jaljeera Fizz 250ml', category: 'Drinks', price: 30, unitMargin: 13.5, base: 42.0 },
  { id: 'DR-NIM-250', name: 'Nimbu Soda 250ml', category: 'Drinks', price: 30, unitMargin: 13.5, base: 33.0 },
  { id: 'DR-KOK-200', name: 'Kokum Cooler 200ml', category: 'Drinks', price: 40, unitMargin: 18.0, base: 9.6 },
  { id: 'DR-ZER-300', name: 'Zero Sugar Cola 300ml', category: 'Drinks', price: 45, unitMargin: 20.2, base: 12.0 },
];

export const CITIES = ['Bengaluru', 'Mumbai', 'Delhi NCR'];
export const PLATFORMS = ['Platform A', 'Platform B', 'Platform C'];
export const DOW_INDEX = [0.92, 0.9, 0.93, 0.97, 1.08, 1.17, 1.13]; // Mon..Sun
export const DAYS = 84; // 12 weeks, day 0 = Monday

export const PROMOS = [
  { id: 'P1', sku: 'CH-MAS-50', platform: 'Platform A', start: 21, length: 7, depth: 0.15, brandFunded: 1.0, fee: 6000, label: '15% off, banner slot' },
  { id: 'P2', sku: 'NM-MAK-90', platform: 'Platform B', start: 28, length: 7, depth: 0.2, brandFunded: 0.7, fee: 5000, label: '20% off, search boost' },
  { id: 'P3', sku: 'DR-JAL-250', platform: 'Platform C', start: 42, length: 7, depth: 0.25, brandFunded: 1.0, fee: 6000, label: 'Buy 2 save 25%' },
  { id: 'P4', sku: 'CH-PER-150', platform: 'Platform A', start: 56, length: 7, depth: 0.1, brandFunded: 1.0, fee: 4000, label: '10% off, category carousel' },
  { id: 'P5', sku: 'DR-NIM-250', platform: 'Platform B', start: 63, length: 7, depth: 0.3, brandFunded: 1.0, fee: 9000, label: '30% off, homepage takeover' },
];

// "True" generator parameters (hidden from the analysis, used only to simulate and to test recovery)
export const TRUTH = {
  elasticity: { 'CH-MAS-50': 3.6, 'NM-MAK-90': 6.0, 'DR-JAL-250': 1.6, 'CH-PER-150': 5.5, 'DR-NIM-250': 1.3 },
  pantryDip: 0.15,      // share of promo uplift pulled forward from the next 7 days
  cannibalisation: 0.12,// share of promo uplift taken from same-category siblings
};

export function generateDataset(seed = 20261114) {
  const rnd = mulberry32(seed);
  const stores = [];
  let n = 1;
  for (const city of CITIES) {
    for (let i = 0; i < 6; i++) {
      const platform = PLATFORMS[i % 3];
      stores.push({
        id: `DS-${String(n++).padStart(2, '0')}`,
        name: `${city} dark store ${i + 1}`,
        city, platform,
        size: +(0.6 + rnd() * 0.9).toFixed(2),
      });
    }
  }
  const taste = { // city-level preference multipliers per category
    Bengaluru: { Chips: 1.0, Namkeen: 1.25, Drinks: 0.95 },
    Mumbai: { Chips: 1.1, Namkeen: 0.9, Drinks: 1.15 },
    'Delhi NCR': { Chips: 1.05, Namkeen: 1.05, Drinks: 1.0 },
  };
  // Assortment: most SKUs listed; a few gaps and weak listings on purpose
  const listings = {};
  for (const s of stores) {
    listings[s.id] = SKUS.filter((k, idx) => {
      if (k.id === 'NM-MAK-90' && s.city !== 'Bengaluru' && rnd() < 0.5) return false;
      if (k.id === 'DR-KOK-200' && s.city !== 'Mumbai' && rnd() < 0.6) return false;
      if (idx >= 5 && rnd() < 0.12) return false;
      return true;
    }).map(k => k.id);
  }
  // Per store-SKU affinity noise and availability profile
  const rows = [];
  const skuById = Object.fromEntries(SKUS.map(k => [k.id, k]));
  for (const s of stores) {
    const chronicOOS = new Set(SKUS.filter(() => rnd() < 0.12).map(k => k.id));
    for (const skuId of listings[s.id]) {
      const k = skuById[skuId];
      const aff = 0.8 + rnd() * 0.4;
      // Kokum is a Mumbai thing; makhana a Bengaluru thing
      let local = taste[s.city][k.category];
      if (skuId === 'DR-KOK-200') local *= s.city === 'Mumbai' ? 2.2 : 0.5;
      const lam0 = k.base * s.size * local * aff;
      for (let d = 0; d < DAYS; d++) {
        let lam = lam0 * DOW_INDEX[d % 7] * (1 + 0.002 * d);
        let promoId = '';
        let depth = 0;
        for (const p of PROMOS) {
          const inWin = d >= p.start && d < p.start + p.length;
          const after = d >= p.start + p.length && d < p.start + p.length + 7;
          if (p.platform !== s.platform) continue;
          const pk = skuById[p.sku];
          const upliftFactor = Math.exp(TRUTH.elasticity[p.sku] * p.depth) - 1;
          if (p.sku === skuId && inWin) { lam *= 1 + upliftFactor; promoId = p.id; depth = p.depth; }
          else if (p.sku === skuId && after) lam *= Math.max(0.3, 1 - TRUTH.pantryDip * upliftFactor);
          else if (inWin && pk.category === k.category && p.sku !== skuId) lam *= Math.max(0.5, 1 - TRUTH.cannibalisation * upliftFactor / 2);
        }
        let inStock = 1;
        const r = rnd();
        if (chronicOOS.has(skuId)) inStock = r < 0.45 ? +(0.3 + rnd() * 0.5).toFixed(2) : 1;
        else if (r < 0.06) inStock = +(0.2 + rnd() * 0.6).toFixed(2);
        const units = poisson(lam * inStock, rnd);
        rows.push({ day: d, store: s.id, sku: skuId, units, inStock, promo: promoId, depth });
      }
    }
  }
  return { seed, stores, skus: SKUS, promos: PROMOS, listings, rows, days: DAYS, synthetic: true };
}
