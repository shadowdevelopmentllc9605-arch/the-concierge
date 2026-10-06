# Verified brand sizing catalog

This repository mirrors the verified sizing reference data used by The Concierge and Concierge Pro.

- Snapshot: 2026-10-06 missing department-store brand expansion
- Verified chart records: 120
- Distinct brands with verified charts: 55
- Normalized size rows: 1730
- Width-aware footwear rows: 438
- Brand-family / ownership relationships: 47
- Initial market focus: US sizing
- Department-store/private-label expansion: 63 chart records across 37 newly covered brands
- Latest verified additions: Original Use, Art Class, Knox Rose, Colsie, Stars Above, and Cremieux

## Head-to-toe coverage

The catalog supports adult and kids sizing across tops, bottoms, dresses/evening wear, suits/formalwear, underwear/bras, swimwear, outerwear, headwear, and footwear/boots.

- bottoms: 24
- dresses: 7
- footwear: 17
- headwear: 5
- outerwear: 4
- suits: 2
- swimwear: 2
- tops: 52
- underwear: 7

## Advanced footwear fit

Footwear recommendations can use:

- saved US shoe size and brand-specific US/UK/EU/JP conversions
- measured foot length from the larger foot
- measured foot width at the widest point
- saved brand width code or semantic width such as Narrow, Medium, Wide, and Extra Wide
- footwear subtype: running, training, walking, casual sneaker, dress Oxford/Derby, loafer/slip-on, work boot, hiking boot, fashion/dress boot, sandal, heel/pump, or other
- product or brand last/family when supplied
- sock profile when supplied
- calf circumference for product-specific tall-boot charts
- explicit official/product size adjustments in half-size steps when published

The engine does **not** assume that dress shoes should always size down or athletic shoes should always size up. It applies no automatic shift unless an official brand/product chart or retailer product override supplies one.

Width systems are brand-specific. A code such as D, E, 2E, G, H, Wide, or Extra Wide is not treated as universally equivalent across manufacturers. Numeric foot-width measurements are used only where the official source publishes them.

For tall boots, calf fit is intentionally product-specific. The schema and recommendation engine can score calf circumference when a retailer or verified product chart supplies calf bounds, but the master brand catalog does not invent a universal calf-to-shoe-size adjustment.

Product-specific retailer charts and fit guidance always override the general brand catalog.

## Recommendation priority

1. Retailer-supplied product size chart / fit override
2. Verified brand size and width chart
3. Generic profile estimate where appropriate

Official measurements are normalized to centimeters. Each record preserves source URL, retrieval time, audience, category group, footwear metadata, and relationship metadata.

A brand owner or parent company is not assumed to be the physical manufacturer. Contract factories and sourcing partners can vary by product and season.

The shopper runtime does not scrape brand websites during recommendations. Reviewed reference measurements are stored in the read-only catalog so recommendations remain usable while retaining source traceability.