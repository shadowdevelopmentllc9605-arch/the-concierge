# Department-store fashion brand master

Snapshot: 2026-10-06  
Version: `2026-10-06-full-department-store-brand-layer-4`

The Concierge now separates **brand discovery** from **verified sizing**. A brand is retained in the master even when no trustworthy numeric size chart is available, so later fit, style, trend, assortment, and retailer-intelligence layers can use the same brand graph.

## Current canonical layer

- Active BrandCatalog source records: **1,060**
- Canonical unique fashion brands after merging duplicate discoveries: **976**
- Duplicate discovery records merged by `brand_key` at runtime: **84**
- Retailer banners represented: **16**
- Unique brands with verified sizing: **91**
- Unique brands with partial official sizing information: **23**
- Unique brands currently estimate-only: **862**
- Live verified size-chart records: **253**
- Live normalized sizing rows: **3,586**

The compact authoritative live-count snapshot is `data/brand-layer-live-summary.json`.

The shopper Shop page uses cursor pagination and merges duplicate brand records at runtime, so the full current catalog can be searched rather than only the first 500 records.

## Retailer coverage

| Retailer | Fashion brands | Verified | Partial | Estimate-only |
| --- | ---: | ---: | ---: | ---: |
| Nordstrom Rack | 399 | 36 | 5 | 358 |
| Von Maur | 295 | 33 | 3 | 259 |
| Nordstrom | 144 | 28 | 1 | 115 |
| Bloomingdale's | 95 | 29 | 2 | 64 |
| Macy's | 74 | 38 | 6 | 30 |
| Saks Fifth Avenue | 72 | 8 | 0 | 64 |
| Kohl's | 67 | 34 | 7 | 26 |
| Dillard's | 58 | 4 | 2 | 52 |
| Walmart | 57 | 11 | 4 | 42 |
| JCPenney | 49 | 10 | 9 | 30 |
| Neiman Marcus | 47 | 1 | 0 | 46 |
| Bealls Florida | 42 | 16 | 1 | 25 |
| Boscov's | 40 | 13 | 4 | 23 |
| Bergdorf Goodman | 34 | 0 | 0 | 34 |
| Belk | 32 | 19 | 0 | 13 |
| Target | 20 | 15 | 2 | 3 |

Because brands are carried by multiple retailers, retailer totals overlap and do not sum to 965.

## Sizing provenance

- **verified_loaded**: one or more compatible official/verified numeric charts are live in `BrandSizeChart`.
- **partial**: the brand publishes sizing information, but the current source is incomplete, image-only, fit-family-specific, or otherwise unsafe to generalize.
- **estimate_only**: the brand is listed and usable for discovery/style layers, but fit falls back to the customer's body measurements until a compatible verified chart is available.

Product-specific retailer charts still take priority over a general brand chart.

## Official brand-site expansion

The latest pass checked brand-owned sources and added or expanded verified coverage for Carter's, Playtex, Maidenform, and Speedo. Existing official-site coverage also includes brands such as ASICS, Birkenstock, Saucony, Nike, adidas, Under Armour, New Balance, Levi's, Calvin Klein, and others.

Carter's now includes compatible data for kids underwear, baby/toddler/kids bottoms, expanded footwear, women, adult family tops, and headwear. Weight-dependent rows are not treated as verified measurements because the current fit engine does not score body weight.

Playtex and Maidenform use official band/cup availability as identity compatibility charts; they are not represented as body-measurement bra conversions.

Speedo now includes compatible men, women, and boys swimwear measurement charts.

Hanes and PUMA remain **partial** where official sites confirm multi-gender/multi-age ranges but the audit did not capture a complete trustworthy numeric body table.

## Dynamic-catalog caveat

This is a current U.S.-focused fashion snapshot, not a claim that every department store worldwide or every future assortment is permanently enumerated. Department-store catalogs change continuously. The data model is deliberately refreshable: a new brand can enter `BrandCatalog` immediately and gain verified sizing independently when an official chart becomes available.

Machine-readable files:
- `data/brand-catalog.json`
- `data/department-store-brand-audit.json`
- `data/brand-sizing-live-summary.json`
