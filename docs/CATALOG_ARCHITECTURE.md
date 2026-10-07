# Canonical Catalog Architecture

The catalog now separates stable product identity from volatile retailer inventory.

## Layers
- **ProductMaster**: one canonical brand/style record.
- **ProductVariant**: confirmed size, color, width, and length combinations.
- **RetailerOffer**: retailer/location price, stock, fulfillment, and item URL.
- **ProductSourceRecord**: provenance, confidence, and freshness.
- **CatalogSource**: approved ingestion sources and their trust/priority.
- **CatalogIngestionRun**: batch-level counts, status, and errors.
- **FashionIntelligence**: AI-derived style/trend attributes kept separate from factual product data.

Legacy **Product** and **InventoryItem** remain operational and now contain canonical-link fields so migration can happen progressively.

## Source ladder
1. Official API
2. Authorized affiliate, merchant, CSV, or XML feed
3. JSON-LD structured product data
4. Product sitemap
5. Category/facet pages
6. HTML parsing
7. Manual entry

Lower-priority data must not overwrite higher-priority verified facts.

## Deduplication
Prefer identifiers in this order:
1. GTIN / UPC / EAN
2. Brand + MPN
3. Brand + style number
4. Canonical normalized brand/style key
5. Brand + product name only as a review candidate

Retailer SKU, Web ID, PDP/product ID, or other retailer-specific identifier is never treated as global ProductMaster identity. Those identifiers belong on RetailerOffer and ProductSourceRecord. A retailer-owned source cannot set ProductMaster canonical_key from its own product ID; if no manufacturer/global identifier is available, brand + normalized product name is retained only as a review candidate.

## Variant rule
Only create variants that a source explicitly confirms. Never generate every possible size/color combination just because separate size and color lists exist. A color-only or size-unselected apparel observation is source evidence, not an active ProductVariant; keep the retailer offer at style scope until a sellable variant combination is explicitly confirmed.

## Offer rule
Price, sale price, availability, stock, fulfillment, and store location live on RetailerOffer. When a store stops carrying a product, the offer is marked inactive or out of stock; ProductMaster is retained.

## Current integration
Concierge Pro catalog sync now dual-writes:
1. Existing legacy Product records for current shopper UI compatibility.
2. ProductMaster / ProductVariant / RetailerOffer records for the new architecture.

The shopper app also exposes an admin-only **catalogBatchIngest** backend function for future retailer audits. It accepts normalized batches of up to 250 products, applies source ranking and canonical deduplication, records provenance/freshness, and writes an ingestion audit record.

## Migration sequence
1. Ingest canonical products.
2. Add confirmed variants.
3. Attach retailer offers.
4. Track provenance and freshness.
5. Run FashionIntelligence only after factual data is loaded.
6. Move UI surfaces from legacy Product records to canonical records gradually.
