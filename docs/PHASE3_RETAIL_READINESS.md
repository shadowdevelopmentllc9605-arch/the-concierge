# Proposed Phase Three — retailer integration and commercial pilot readiness

Phase Two limited virtual try-on framework passed owner-confirmed Android functional acceptance. This does not certify photorealistic rendering, fit accuracy, permanent photo storage, actual garment asset approval or measured runtime security/performance. Keep all existing release gates intact.

## Sequence
1. Shared catalog readiness: audit active product/variant/offer links, missing image references, actual stock and price freshness, source provenance and business linkage. A read-only production schema and aggregate audit was performed on November 26, 2026. Missing image references, incomplete variants, stale offers and missing registered-business links were identified. No production records were changed. Image rights and actual stock remain unverified; do not invent them.
2. Retailer catalog management: verify Concierge Pro manual inventory workflow and implement validated import/preview/rejection of malformed or duplicate records where missing. Use shared product_master, product_variant and retailer_offer, not separate inventory silos.
3. Catalog synchronization: retailer-owned offers, freshness and reconciliation, correct shopper availability and price; verified rights before imagery display. Synthetic tests are not live retailer participation.
4. In-store workflow: verify check-in, employee assignment, wishlist visibility, fitting assistance and access isolation.
5. Commerce readiness: verify inventory reservation/reconciliation, order status, refunds and subscription/commission accounting in authorized test environments. No live payment or tax activation without commercial authorization.
6. Pilot readiness: operational playbook, onboarding, support and monitoring, release checklist, representative retailer/shopper acceptance when participants are available.

Each stage must pass relevant tests before advancing. No new paid infrastructure, retailer scraping, live checkout activation, sensitive-photo storage or external AI inference is authorized by this plan. Do not create synthetic records in production to inflate readiness. Catalog provenance and imagery permissions must be supported by actual evidence. Phase Three scope is a proposed sequence based on the documented platform architecture and unresolved pilot requirements; no previously finalized Phase Three roadmap was recovered.
