# DarkAisle: startup brief (fictional concept)

> Portfolio exercise by Yash Sarkar. DarkAisle, the demo brand "Chatkara Foods" and every number in the demo are fictional and synthetic. Nothing here describes a real company, client or employer.

## One-liner
DarkAisle is a store-level profit lens for FMCG brands selling on quick-commerce (10–20 minute delivery) apps. It shows which promos, stock fixes and new listings actually make money, dark store by dark store, and then splits next month's trade budget.

## Problem
Quick commerce has become a big online channel for snacks, beverages and personal care in Indian metros, and rapid-delivery apps are growing in Australian cities too. Brand teams now spend real money there on discounts, banner and search slots, and listing fees. They are flying half blind:

1. **Promo reads are flattering.** Platform dashboards and agency decks compare promo week with the week before. That ignores day-of-week mix, stock-outs in the comparison week, the **post-promo dip** (shoppers stocked up) and **cannibalisation** of the brand's own sibling SKUs. A promo can show +80% and still lose money.
2. **Stock-outs are invisible lost sales.** A dark store has little backroom space. When a top SKU runs out on a Saturday evening, the shopper switches brand and no report records the sale that didn't happen.
3. **Range is decided per store.** Each dark store lists a different slice of the range. Brands rarely know where a SKU that sells well nearby is missing, or which listings just take up shelf space.
4. **Budgets are split by habit.** "Same as last quarter plus 10%" rather than by where the next rupee earns most.

## Target customer
- **Primary (beachhead):** heads of e-commerce, brand managers and trade-marketing managers at Indian D2C-born and mid-size FMCG brands (food, beverage, personal care), roughly ₹20–200 crore revenue, with 15–40% of online sales coming from quick commerce.
- **Secondary:** Australian challenger FMCG brands entering rapid-delivery apps; quick-commerce agencies and distributors that manage several brands' accounts.
- **Buyer:** Head of e-commerce / growth. **Users:** brand and category managers, key-account managers. **Blocker:** finance (needs to trust the incrementality maths), so the method is shown openly.

## Positioning
For FMCG brand teams who spend trade money on quick-commerce apps without knowing what it returns, **DarkAisle** is the store-level profit lens that shows what each promo, stock fix and listing really earns. Unlike platform dashboards and spreadsheet post-mortems, it nets out the dip and cannibalisation, puts a rupee value on stock-outs, and turns that into a budget split with a payback hurdle.

**Proof points to build:** recovered elasticity vs a known test, % of promos re-classified from "win" to "loss", rupees of stock-out leakage found in the first 2 weeks.

## Product (what the demo shows)
| Module | Question it answers | Method (in the demo) |
| --- | --- | --- |
| Promo ROI | Did this promo make money? | Store × SKU baseline from clean, fully stocked nearby days, weekday-adjusted; incremental units minus 7-day post dip and same-category cannibalisation; profit at real margin, funding share and fee; Scale / Rework / Stop |
| Depth curve | What discount should we run next time? | Fitted elasticity `ln(1+uplift)/depth` plus observed leakage ratios, profit at 0–40% off |
| Availability leaks | Where are stock-outs costing us? | Baseline × (1 − in-stock share) on non-promo days, ranked by lost revenue, cut by city and platform |
| Assortment | What to pitch, what to drop? | Velocity per fully stocked day; gaps = unlisted SKUs selling in ≥2 same-city stores (scaled by store size index); tail = low margin per day and well below peers |
| Budget planner | How should next month's trade money be split? | Diminishing-returns curve per lever, greedy ₹5,000 steps, stop below a payback hurdle |

## Go-to-market
1. **Lead magnet:** free "promo post-mortem". Upload one promo's export and get a one-page honest readout within 48 hours.
2. **Content:** LinkedIn posts and short teardown carousels on promo myths ("your +80% promo lost money: here's why"), aimed at FMCG and D2C operators.
3. **Founder-led outbound** to heads of e-commerce at 200 target brands, using the post-mortem as the opener.
4. **Channel partners:** quick-commerce agencies and distributors who already run brands' accounts; revenue share or white-label readouts.
5. **Land and expand:** start with promo ROI on one platform and city, expand to availability alerts, then range planning and the budget planner. Later, joint business plan packs for platform negotiations.
6. **Australia:** after Indian product-market fit, test with 5 Australian challenger brands through an AUD-priced pilot.

## Pricing (hypothesis to test)
| Plan | Price | Includes |
| --- | --- | --- |
| Pilot | Free for 6 weeks | 1 platform, 1 city, promo ROI + availability, weekly readout |
| Growth | ₹39,000 / month (≈ A$720) | All platforms and cities, assortment gaps, budget planner, stock-out alerts |
| Enterprise | Custom | Multi-brand portfolios, JBP packs, warehouse export, SSO |

Rationale: priced well under a junior analyst's monthly cost and anchored to value found. If the pilot finds ₹3 lakh+ of monthly leakage, ₹39k is an easy yes. Test annual prepay at 2 months free, and a success-fee variant with agencies.

## Key metrics
- **North star:** incremental margin identified per customer per month (and the share acted on).
- **Acquisition:** post-mortem requests per week; post-mortem → pilot conversion.
- **Activation:** time to first readout (< 48 h); % of pilots that act on ≥1 recommendation in week 2.
- **Conversion:** pilot → paid (target 35%).
- **Engagement:** weekly active brand users; alert action rate.
- **Retention / expansion:** logo churn < 2% per month; net revenue retention 115%+ from adding platforms, cities and brands.
- **Trust:** back-test accuracy of baselines on held-out non-promo weeks (MAPE).

## Risks and how to de-risk
- **Data access:** platforms differ in what they export. Start with CSV uploads that brands already receive; add connectors only where an official API exists.
- **Model trust:** finance teams distrust black boxes. Show the baseline, the excluded days and the maths; offer a holdout-store test for big promos.
- **Platforms build it themselves:** platform tools optimise for the platform. DarkAisle stays brand-side and cross-platform.
- **Small-brand budgets:** keep a free post-mortem tier and agency channel.

## Demo data
Seeded synthetic generator (`src/data.js`, seed `20261114`): 10 fictional SKUs across chips, namkeen and drinks; 18 dark stores in Bengaluru, Mumbai and Delhi NCR; 3 generic platforms ("Platform A/B/C"); 84 days; 5 promos with hidden "true" elasticities, a pantry-loading dip, cannibalisation and random stock-outs. Because the truth is known, the unit tests check that the engine recovers it.
