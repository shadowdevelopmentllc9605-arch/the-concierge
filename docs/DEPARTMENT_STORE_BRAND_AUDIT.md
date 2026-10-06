# Department-store brand master audit

Snapshot: 2026-10-06  
Audit version: `2026-10-06-master-department-store-audit-1`

This audit tracks apparel, underwear, swimwear, headwear and footwear brands surfaced by official department-store fashion/brand directories and major owned/exclusive brand pages. Beauty, home, jewelry-only brands and uncurated third-party marketplace sellers are outside the sizing scope.

The live sizing system remains source-aware:

- **verified_loaded** — at least one official or otherwise verified numeric sizing chart is live in `BrandSizeChart`.
- **source_found_not_loaded** — sizing information was found, but it is partial, malformed, image-only, or tied to a specific fit family in a way that would be unsafe to apply generically.
- **estimate_only** — no trustworthy compatible numeric chart is live; The Concierge uses the customer's body measurements and labels the result **Estimated size**.

## Live verified catalog after this audit

- Verified chart records: **179**
- Distinct brands with verified charts: **74**
- Normalized size rows: **2,447**
- Width-aware footwear rows: **438**
- Retailers explicitly audited: **9**

## Retailer audit status

| Retailer | Brands in audited scope | Verified loaded | Source found, not safely loaded | Estimate-only |
| --- | ---: | ---: | ---: | ---: |
| Walmart | 57 | 11 | 4 | 42 |
| Target | 17 | 15 | 2 | 0 |
| Kohl's | 59 | 30 | 9 | 20 |
| Macy's | 45 priority apparel/footwear brands | 25 | 5 | 15 |
| Dillard's | 58 exclusive apparel/footwear brands | 4 | 2 | 52 |
| JCPenney | 18 featured/private apparel brands | 5 | 7 | 6 |
| Belk | 17 featured/exclusive apparel/footwear brands | 10 | 0 | 7 |
| Nordstrom | 26 priority apparel/footwear intersections | 17 | 1 | 8 |
| Bloomingdale's | 29 priority apparel/footwear intersections | 18 | 1 | 10 |

The machine-readable per-brand status is in `data/department-store-brand-audit.json`.

## Verified charts added during the master-audit pass

The pass added official/verified sizing for these previously uncovered brands:

- Champion
- Reebok
- Fruit of the Loom
- Carter's
- Crocs
- Lee
- Vans
- Tommy Hilfiger
- Crown & Ivy
- Wonderly
- Kim Rogers
- Worthington
- Jockey
- Skechers
- Eddie Bauer
- Polo Ralph Lauren
- Lauren Ralph Lauren
- Lands' End
- Dockers

Earlier department-store expansion work had already added Original Use, Art Class, Knox Rose, Colsie, Stars Above and Cremieux, along with the prior Target, Kohl's, Macy's and Dillard's private-label set.

## Why some discovered brands remain estimate-only

A brand name appearing in a retailer directory is not enough to call a fit verified. A usable verified chart needs numeric body or foot measurements that can be associated with the product's actual size system.

Examples intentionally not generalized:

- Walmart private labels such as Time & Tru, Terra & Sky, George, Wonder Nation and No Boundaries may expose product-level “Size guide” controls without a reliably retrievable numeric body table.
- Some JCPenney pages exposed only one or two size rows for brands such as a.n.a, Stafford, St. John's Bay, Arizona and Stylus. A one-row chart would cause unsafe nearest-size behavior, so it was not loaded as a general brand chart.
- Haggar and similar brands publish fit-family tables (Classic/Straight/Slim, etc.). Until product fit-family metadata is a first-class chart selector, those charts should not be collapsed into one generic brand table.
- Some retailer or brand charts are image-only or omit the numeric body dimensions needed by the current schema.

These products are still supported through the measurement-based fallback and display **Estimated size — based on your body measurements** rather than falsely showing a verified fit.

## Dynamic mega-directories

Macy's, Nordstrom and Bloomingdale's maintain large, continuously changing A-Z brand/designer directories. Their official directory URLs are stored in the audit as canonical discovery sources. The per-brand audit prioritizes retailer exclusives and apparel/footwear brands that intersect with the department stores in this project rather than claiming that every beauty, home, jewelry or marketplace listing is a clothing-sizing target.

Future refreshes should compare the official directories against `BrandSizeChart` and preserve the same three-way status model rather than silently treating new brand names as verified.
