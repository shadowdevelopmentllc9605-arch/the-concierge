# Verified brand sizing catalog

This repository mirrors the verified sizing reference data used by The Concierge and Concierge Pro.

- Snapshot: 2026-10-06
- Verified chart records: 32
- Normalized size rows: 399
- Brand-family / ownership relationships: 41
- Initial market focus: US sizing

## Expanded coverage

The catalog now includes verified records for adult tops and bottoms, women's extended sizing, suit separates, men's and women's underwear, bras, adult footwear, children's footwear, and children's apparel. Casual, urban/streetwear, and business-wear use the same category-aware sizing engine, with product-specific charts taking priority over brand charts.

Children's profiles are selected from birthday when available. Brand charts can distinguish boys, girls, and unisex kids sizing so the runtime does not guess between incompatible charts.

Footwear records can preserve US, UK, EU, and JP/conversion labels together with heel-to-toe length. Bra records can preserve band/cup identifiers plus bust and underbust measurements. Suit records use dedicated suit sizing rather than treating suits as ordinary tops.

## Recommendation priority

1. Retailer-supplied product size chart
2. Verified brand size chart
3. Generic profile estimate

Official body measurements are normalized to centimeters. Each record keeps its source URL, retrieval time, audience, category group, optional child gender detail, and relationship metadata.

A brand owner or parent company is not assumed to be the physical garment manufacturer. Contract factories and sourcing partners can vary by product and season, so manufacturing relationships should only be recorded when they are publicly verifiable.

The shopper runtime does not scrape brand websites. Reference measurements are reviewed and stored in the read-only Base44 catalog, making recommendations independent of external-site availability while preserving source traceability.
