// Writes the seeded SYNTHETIC demo dataset to data/ so it can be inspected outside the browser.
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateDataset } from '../src/data.js';
import { toCSV, runAll } from '../src/engine.js';

const seed = +(process.argv[2] || 20261114);
const ds = generateDataset(seed);
mkdirSync('data', { recursive: true });
const store = Object.fromEntries(ds.stores.map(s => [s.id, s]));
writeFileSync('data/chatkara-synthetic-qcom-daily.csv', toCSV(ds.rows.map(r => ({ day: r.day + 1, store: r.store, city: store[r.store].city, platform: store[r.store].platform, sku: r.sku, units: r.units, in_stock_share: r.inStock, promo: r.promo }))) + '\n');
writeFileSync('data/chatkara-synthetic-promos.csv', toCSV(ds.promos) + '\n');
writeFileSync('data/chatkara-synthetic-skus.csv', toCSV(ds.skus.map(({ base, ...k }) => k)) + '\n');
const res = runAll(ds);
writeFileSync('data/promo-roi-results.csv', toCSV(res.promos) + '\n');
console.log(`seed ${seed}: ${ds.rows.length} daily rows, ${ds.promos.length} promos written to data/`);
