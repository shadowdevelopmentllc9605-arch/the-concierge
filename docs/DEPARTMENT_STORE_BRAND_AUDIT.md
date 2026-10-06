# Department-store brand master audit

Snapshot: 2026-10-06  
Audit version: `2026-10-06-brand-master-layer-1`

This audit is the brand-discovery layer for The Concierge. Brand existence and retailer presence are tracked independently from sizing-chart availability so later recommendation layers can use the same brand graph for fit, style, trends, assortment, and retailer-specific intelligence.

The audited fashion scope includes women, men, kids, intimates, activewear, accessories/headwear, and footwear. Home-only, beauty-only, furniture, cookware, and electronics brands are excluded unless they also participate in a fashion category.

## Live brand master

- Brand catalog records: **277**
- Retailer groups represented: **9**
- Brands with verified sizing charts: **74**
- Brands with partial/unsafe-to-generalize sizing sources: **25**
- Brands currently using measurement-based estimate fallback: **178**
- Verified size-chart records: **179**
- Normalized verified size rows: **2,447**

The live entity is `BrandCatalog`. A repository snapshot is stored in `data/brand-catalog.json`.

## Sizing status model

- **verified_loaded** — one or more compatible verified numeric charts are live in `BrandSizeChart`.
- **partial** — sizing information exists, but it is incomplete, malformed, image-only, or tied to a specific fit family that is unsafe to apply generically.
- **estimate_only** — the brand is still fully represented in `BrandCatalog`, but no compatible verified chart is live; The Concierge uses the customer's body measurements and labels the result **Estimated size**.

## Retailer audit status

| Retailer | Fashion brands represented | Verified loaded | Partial source | Estimate-only |
| --- | ---: | ---: | ---: | ---: |
| Walmart | 57 | 11 | 4 | 42 |
| Target | 20 | 15 | 2 | 3 |
| Kohl's | 67 | 32 | 9 | 26 |
| Macy's | 57 | 26 | 6 | 25 |
| Dillard's | 58 | 4 | 2 | 52 |
| JCPenney | 26 | 6 | 7 | 13 |
| Belk | 32 | 13 | 0 | 19 |
| Nordstrom | 42 | 18 | 1 | 23 |
| Bloomingdale's | 44 | 18 | 1 | 25 |

Because the same brand can be carried by several retailers, the retailer totals overlap; they do not sum to 277 unique brands.

The machine-readable retailer/brand/status matrix is in `data/department-store-brand-audit.json`.

## Shopper app integration

The Shop filter now loads brands from `BrandCatalog`, not from the current product inventory or only from `BrandSizeChart`. This means brands remain visible and selectable even when:

- no current retailer inventory item has been synced yet;
- no verified size chart is available yet;
- the only current sizing path is a body-measurement estimate.

The brand filter exposes the full live brand master and labels sizing availability through the brand record metadata.

## Verified sizing layer

The verified sizing catalog currently contains **179** chart records across **74** brands and **2,447** normalized rows.

Recommendation priority remains:

1. Retailer-supplied product chart / product fit override
2. Compatible verified brand chart
3. Measurement-based estimate

A verified chart is never inferred from product reviews, a one-row size snippet, generic category dimensions, or another brand's chart.

## Why some brands remain estimate-only

A retailer listing a brand does not mean a usable body-measurement chart is publicly available. Examples include retailer private labels whose product pages expose a “Size guide” control without retrievable numeric measurements, image-only charts, and product families whose Classic/Slim/Straight or other fit tables cannot safely be generalized to every product under the brand.

Those brands remain in the master brand graph and are available for future style/trend layers; only the sizing provenance remains estimate-only until a trustworthy compatible chart is added.

## Dynamic retailer directories

Macy's, Nordstrom, and Bloomingdale's maintain large, frequently changing A-Z brand/designer directories. Their current official fashion directories remain canonical discovery sources, and the brand master can be refreshed without changing the sizing engine. New brands should enter `BrandCatalog` immediately, then gain verified sizing independently if and when trustworthy measurements are available.

## Key files

- `base44/entities/BrandCatalog.jsonc` — live brand master schema
- `data/brand-catalog.json` — repository snapshot of live brand records
- `data/department-store-brand-audit.json` — retailer → brand → sizing-status matrix
- `data/brand-sizing-catalog.json` — verified numeric size-chart snapshot
- `docs/SIZING_CATALOG.md` — sizing-engine documentation
