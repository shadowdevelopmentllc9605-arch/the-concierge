# Verified brand sizing catalog

This repository mirrors the verified sizing reference data used by The Concierge and Concierge Pro.

- Snapshot: 2026-10-06
- Verified chart records: 51
- Normalized size rows: 602
- Brand-family / ownership relationships: 43
- Initial market focus: US sizing

## Head-to-toe coverage

The catalog supports adult and kids sizing across tops, bottoms, dresses/evening wear, suits/formalwear, underwear/bras, outerwear, headwear, and footwear/boots. Current verified chart counts by category group:

- bottoms: 6
- dresses: 1
- footwear: 10
- headwear: 5
- outerwear: 4
- suits: 2
- tops: 20
- underwear: 3

Headwear recommendations use head circumference when supplied. Footwear and boots can use either saved US shoe size or measured foot length. Bra recommendations can use saved bra size and/or bust/underbust measurements. Kids sizing uses birthday to select the kids audience and preserves boys/girls/unisex distinctions when the brand publishes them.

The shopper occasion taxonomy includes business, casual, formal, evening, outdoor, active, nightlife, and trendy. Product-specific retailer charts always override global brand charts.

## Recommendation priority

1. Retailer-supplied product size chart
2. Verified brand size chart
3. Generic profile estimate where appropriate

Official body measurements are normalized to centimeters. Each record keeps its source URL, retrieval time, audience, category group, optional child gender detail, and relationship metadata.

A brand owner or parent company is not assumed to be the physical garment manufacturer. Contract factories and sourcing partners can vary by product and season, so manufacturing relationships should only be recorded when they are publicly verifiable.

The shopper runtime does not scrape brand websites. Reference measurements are reviewed and stored in the read-only Base44 catalog, making recommendations independent of external-site availability while preserving source traceability.
