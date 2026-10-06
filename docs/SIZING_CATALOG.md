# Verified brand sizing catalog

This repository mirrors and documents the sizing reference layer used by The Concierge.

## Current live sizing database

- Snapshot: 2026-10-06 official-brand-site expansion
- Verified chart records: **248**
- Distinct verified brand keys: **90**
- Normalized size rows: **3,520**
- Brand master: **965 canonical fashion brands across 16 retailer banners**
- Sizing status: **90 verified**, **24 partial**, **851 estimate-only**

The authoritative runtime source is the live Base44 `BrandSizeChart` entity. `data/brand-sizing-live-summary.json` records the current live counts. The older full `data/brand-sizing-catalog.json` mirror can temporarily lag when a multi-megabyte export exceeds connector transport limits.

## Recommendation priority

1. Retailer/product-specific size chart and fit override
2. Compatible verified brand chart
3. Measurement-based profile estimate

The app never promotes a brand to verified sizing merely because the brand exists in the directory.

## Coverage principles

Charts are segmented by audience and category when the source supports it: men, women, kids, boys/girls where applicable, baby/toddler/youth footwear, plus/petite/tall where published, underwear/bras, swimwear, formalwear, headwear, and footwear.

Only measurements the current fit engine can interpret are loaded as recommendation-grade data. Weight-dependent children's rows are not treated as fully matched unless the engine supports weight. Bra band/cup availability charts can verify a known bra-size identity but do not masquerade as bust/underbust conversion charts.

## Latest official brand-site additions

- **Carter's**: kids underwear, baby/toddler/kids bottoms, expanded footwear, adult family tops, women's tops/dresses, headwear.
- **Playtex**: official women's bra band/cup availability.
- **Maidenform**: official women's bra band/cup availability.
- **Speedo**: women's swimwear, men's swimwear, boys' swimwear.

Existing current official-site coverage includes ASICS, Birkenstock, Saucony and many previously loaded national/private-label brands.

## Advanced footwear fit

Footwear can use saved US size, official US/UK/EU/JP conversion, measured foot length, measured foot width where published, width codes/labels, footwear subtype, sock profile, product last/family, calf circumference for product-specific tall-boot charts, and explicit official half-size adjustments.

The engine does not assume dress shoes always size down or athletic shoes always size up. Width codes are treated as brand-specific unless an official chart establishes equivalence.

## Brand-discovery layer

Brand existence is independent from sizing availability. The full canonical brand graph is documented in `docs/DEPARTMENT_STORE_BRAND_AUDIT.md` and `data/brand-catalog.json`. This separation is intentional so future style and fashion-trend layers can analyze a brand even before its numeric sizing data becomes available.
