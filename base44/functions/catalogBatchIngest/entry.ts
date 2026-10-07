import { createClientFromRequest } from "npm:@base44/sdk";

const SOURCE_PRIORITY: Record<string, number> = {
  official_api: 1,
  affiliate_feed: 2,
  merchant_feed: 2,
  csv_xml: 2,
  json_ld: 3,
  sitemap: 4,
  category_page: 5,
  html: 6,
  manual: 7,
  other: 8,
};

const normalizeKey = (value: any) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeId = (value: any) =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

function sourcePriority(sourceType: string) {
  return SOURCE_PRIORITY[sourceType] ?? SOURCE_PRIORITY.other;
}

function canonicalKey(product: any) {
  const brandKey = normalizeKey(product.brand_key || product.brand_name || product.brand || "unknown-brand");
  const identity =
    normalizeId(product.style_number) ||
    normalizeId(product.mpn) ||
    normalizeId(product.primary_gtin || product.gtin) ||
    normalizeKey(product.product_name || product.name || "unknown-style");
  return `${brandKey}:${identity || "unknown-style"}`;
}

function variantKey(masterId: string, variant: any) {
  const globalId =
    normalizeId(variant.gtin) ||
    normalizeId(variant.upc) ||
    normalizeId(variant.ean) ||
    normalizeId(variant.mpn);
  if (globalId) return `${masterId}:id:${globalId}`;

  const attrs = [
    normalizeKey(variant.size_label || variant.size),
    normalizeKey(variant.color_name || variant.color),
    normalizeKey(variant.width_code || variant.width),
    normalizeKey(variant.length_code || variant.length || variant.inseam_label || variant.inseam),
  ].filter(Boolean);

  if (attrs.length) return `${masterId}:attr:${attrs.join(":")}`;
  return `${masterId}:sku:${normalizeId(variant.sku) || "unspecified"}`;
}

function offerKey(masterId: string, variantId: string, offer: any) {
  const retailer = normalizeKey(offer.retailer_key || offer.retailer_name || offer.business_id || "retailer");
  const location = normalizeKey(offer.location_id || "all");
  const sellerId = normalizeId(offer.seller_product_id || offer.retailer_sku);
  return `${retailer}:${location}:${sellerId || masterId}:${variantId || "style"}`;
}

async function upsertSourceRecord(base44: any, data: any) {
  const existing = await base44.asServiceRole.entities.ProductSourceRecord.filter({
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    catalog_source_id: data.catalog_source_id,
  });
  if (existing[0]) {
    await base44.asServiceRole.entities.ProductSourceRecord.update(existing[0].id, data);
    return existing[0].id;
  }
  const created = await base44.asServiceRole.entities.ProductSourceRecord.create(data);
  return created.id;
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (user?.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const source = body?.source || {};
  const products = Array.isArray(body?.products) ? body.products : [];

  if (!source.source_key || !source.source_name || !source.source_type) {
    return Response.json({ error: "source_key, source_name, and source_type are required" }, { status: 400 });
  }
  if (!products.length) {
    return Response.json({ error: "At least one product is required" }, { status: 400 });
  }
  if (products.length > 250) {
    return Response.json({ error: "Batch limit is 250 products" }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const refreshMinutes = Math.max(15, Number(source.refresh_interval_minutes || 1440));
  const staleAfter = new Date(now.getTime() + refreshMinutes * 60 * 1000).toISOString();
  const incomingPriority = sourcePriority(source.source_type);

  const existingSources = await base44.asServiceRole.entities.CatalogSource.filter({
    source_key: source.source_key,
  });
  const sourceData = {
    source_key: source.source_key,
    source_name: source.source_name,
    owner_type: source.owner_type || "retailer",
    owner_name: source.owner_name || source.source_name,
    owner_key: source.owner_key || normalizeKey(source.owner_name || source.source_name),
    brand_key: source.brand_key || "",
    retailer_key: source.retailer_key || "",
    source_type: source.source_type,
    priority_rank: Number(source.priority_rank || incomingPriority),
    endpoint_url: source.endpoint_url || source.source_url || "",
    auth_type: source.auth_type || "none",
    refresh_interval_minutes: refreshMinutes,
    supports_products: source.supports_products !== false,
    supports_variants: source.supports_variants !== false,
    supports_price: Boolean(source.supports_price),
    supports_availability: Boolean(source.supports_availability),
    supports_images: source.supports_images !== false,
    terms_status: source.terms_status || "review_required",
    health_status: "healthy",
    last_attempt_at: nowIso,
    last_success_at: nowIso,
    consecutive_failures: 0,
    parser_version: source.parser_version || body.parser_version || "",
    notes: source.notes || "",
    enabled: true,
    active: true,
  };

  let catalogSource: any;
  if (existingSources[0]) {
    await base44.asServiceRole.entities.CatalogSource.update(existingSources[0].id, sourceData);
    catalogSource = { ...existingSources[0], ...sourceData };
  } else {
    catalogSource = await base44.asServiceRole.entities.CatalogSource.create(sourceData);
  }

  const run = await base44.asServiceRole.entities.CatalogIngestionRun.create({
    catalog_source_id: catalogSource.id,
    source_key: source.source_key,
    run_type: body.run_type || "incremental",
    status: "running",
    started_at: nowIso,
    parser_version: source.parser_version || body.parser_version || "",
  });

  const counts = {
    discovered_count: products.length,
    product_created_count: 0,
    product_updated_count: 0,
    variant_created_count: 0,
    variant_updated_count: 0,
    offer_created_count: 0,
    offer_updated_count: 0,
    duplicate_skipped_count: 0,
    failed_count: 0,
    stale_marked_count: 0,
  };

  try {
    for (const row of products) {
      const product = row.product || row;
      const brandName = product.brand_name || product.brand || "Unknown Brand";
      const brandKey = normalizeKey(product.brand_key || brandName) || "unknown-brand";
      // Retailer-side IDs (SKU, Web ID, PDP/product ID) are offer/source identity, not global ProductMaster identity.
      // Retailer-owned sources must always derive the canonical key from manufacturer/global identifiers or, as a
      // review fallback, brand + normalized product name. Non-retailer sources may provide an explicit canonical key.
      const suppliedCanonicalKey = String(product.canonical_key || "").trim();
      const key =
        source.owner_type !== "retailer" && suppliedCanonicalKey
          ? suppliedCanonicalKey
          : canonicalKey({ ...product, brand_key: brandKey });

      let masters = await base44.asServiceRole.entities.ProductMaster.filter({ canonical_key: key });
      if (!masters[0] && product.primary_gtin) {
        masters = await base44.asServiceRole.entities.ProductMaster.filter({
          brand_key: brandKey,
          primary_gtin: product.primary_gtin,
        });
      }
      if (!masters[0] && product.mpn) {
        masters = await base44.asServiceRole.entities.ProductMaster.filter({
          brand_key: brandKey,
          mpn: product.mpn,
        });
      }
      if (!masters[0] && product.style_number) {
        masters = await base44.asServiceRole.entities.ProductMaster.filter({
          brand_key: brandKey,
          style_number: product.style_number,
        });
      }

      const masterData = {
        canonical_key: key,
        brand_name: brandName,
        brand_key: brandKey,
        product_name: product.product_name || product.name || "Unnamed product",
        style_number: product.style_number || "",
        mpn: product.mpn || "",
        primary_gtin: product.primary_gtin || product.gtin || "",
        department: product.department || "",
        category: product.category || "",
        subcategory: product.subcategory || "",
        product_type: product.product_type || product.category || "",
        audiences: product.audiences || [],
        age_groups: product.age_groups || [],
        official_description: product.official_description || product.description || "",
        materials: product.materials || [],
        fit_cut: product.fit_cut || product.garment_fit?.fit_cut || "unknown",
        silhouette: product.silhouette || "",
        rise: product.rise || "",
        length_profile: product.length_profile || "",
        neckline: product.neckline || "",
        sleeve_style: product.sleeve_style || "",
        closure_type: product.closure_type || "",
        footwear_type: product.footwear_type || "all",
        season_tags: product.season_tags || [],
        occasion_tags: product.occasion_tags || [],
        activity_tags: product.activity_tags || [],
        primary_image_url: product.primary_image_url || product.image_urls?.[0] || product.images?.[0] || "",
        image_urls: product.image_urls || product.images || [],
        brand_product_url: product.brand_product_url || "",
        status: product.status || "active",
        last_seen_at: nowIso,
        canonical_confidence: Number(product.canonical_confidence ?? 1),
        dedup_status: "canonical",
        identifier_fingerprint: key,
        active: product.active !== false,
      };

      let master: any;
      if (masters[0]) {
        const provenance = await base44.asServiceRole.entities.ProductSourceRecord.filter({
          entity_type: "product_master",
          entity_id: masters[0].id,
          status: "active",
        });
        const bestExistingPriority = provenance.length
          ? Math.min(...provenance.map((r: any) => sourcePriority(r.source_type)))
          : SOURCE_PRIORITY.other;

        if (incomingPriority <= bestExistingPriority) {
          await base44.asServiceRole.entities.ProductMaster.update(masters[0].id, masterData);
          master = { ...masters[0], ...masterData };
        } else {
          await base44.asServiceRole.entities.ProductMaster.update(masters[0].id, {
            last_seen_at: nowIso,
            active: true,
          });
          master = { ...masters[0], last_seen_at: nowIso, active: true };
        }
        counts.product_updated_count += 1;
      } else {
        master = await base44.asServiceRole.entities.ProductMaster.create({
          ...masterData,
          first_seen_at: nowIso,
          legacy_product_ids: [],
          source_record_count: 0,
        });
        counts.product_created_count += 1;
      }

      await upsertSourceRecord(base44, {
        entity_type: "product_master",
        entity_id: master.id,
        catalog_source_id: catalogSource.id,
        source_type: source.source_type,
        source_owner_type: source.owner_type || "retailer",
        source_owner_name: source.owner_name || source.source_name,
        source_owner_key: source.owner_key || normalizeKey(source.owner_name || source.source_name),
        source_url: product.source_url || source.source_url || source.endpoint_url || "",
        source_identifier: product.source_identifier || product.style_number || product.mpn || product.primary_gtin || key,
        observed_at: nowIso,
        verified_at: nowIso,
        stale_after: staleAfter,
        freshness_status: "fresh",
        confidence: Number(product.source_confidence ?? 1),
        evidence_fields: product.evidence_fields || Object.keys(product),
        checksum: product.checksum || "",
        parser_version: source.parser_version || body.parser_version || "",
        status: "active",
        active: true,
      });

      const variantMap = new Map<string, string>();
      for (const variant of Array.isArray(row.variants) ? row.variants : []) {
        const vKey = variant.variant_key || variantKey(master.id, variant);
        const existingVariants = await base44.asServiceRole.entities.ProductVariant.filter({ variant_key: vKey });
        const variantData = {
          product_master_id: master.id,
          variant_key: vKey,
          sku: variant.sku || "",
          gtin: variant.gtin || "",
          upc: variant.upc || "",
          ean: variant.ean || "",
          mpn: variant.mpn || "",
          size_label: variant.size_label || variant.size || "",
          size_system: variant.size_system || "",
          size_region: variant.size_region || "US",
          color_name: variant.color_name || variant.color || "",
          color_family: variant.color_family || "",
          width_code: variant.width_code || "",
          width_label: variant.width_label || "",
          length_code: variant.length_code || variant.length || variant.inseam || "",
          inseam_label: variant.inseam_label || variant.inseam || "",
          band_size: variant.band_size || "",
          cup_size: variant.cup_size || "",
          material_variant: variant.material_variant || "",
          image_urls: variant.image_urls || [],
          status: variant.status || "active",
          last_seen_at: nowIso,
          identifier_fingerprint: vKey,
          active: variant.active !== false,
        };

        let savedVariant: any;
        if (existingVariants[0]) {
          await base44.asServiceRole.entities.ProductVariant.update(existingVariants[0].id, variantData);
          savedVariant = { ...existingVariants[0], ...variantData };
          counts.variant_updated_count += 1;
        } else {
          savedVariant = await base44.asServiceRole.entities.ProductVariant.create({
            ...variantData,
            first_seen_at: nowIso,
          });
          counts.variant_created_count += 1;
        }

        const clientKey = String(variant.client_key || variant.variant_key || variant.sku || vKey);
        variantMap.set(clientKey, savedVariant.id);

        await upsertSourceRecord(base44, {
          entity_type: "product_variant",
          entity_id: savedVariant.id,
          catalog_source_id: catalogSource.id,
          source_type: source.source_type,
          source_owner_type: source.owner_type || "retailer",
          source_owner_name: source.owner_name || source.source_name,
          source_owner_key: source.owner_key || normalizeKey(source.owner_name || source.source_name),
          source_url: variant.source_url || product.source_url || source.source_url || source.endpoint_url || "",
          source_identifier: variant.source_identifier || variant.gtin || variant.upc || variant.sku || vKey,
          observed_at: nowIso,
          verified_at: nowIso,
          stale_after: staleAfter,
          freshness_status: "fresh",
          confidence: Number(variant.source_confidence ?? product.source_confidence ?? 1),
          evidence_fields: variant.evidence_fields || Object.keys(variant),
          checksum: variant.checksum || "",
          parser_version: source.parser_version || body.parser_version || "",
          status: "active",
          active: true,
        });
      }

      for (const offer of Array.isArray(row.offers) ? row.offers : []) {
        const linkedVariantId =
          offer.product_variant_id ||
          variantMap.get(String(offer.variant_client_key || offer.variant_key || offer.variant_sku || "")) ||
          "";
        const oKey = offer.offer_key || offerKey(master.id, linkedVariantId, offer);
        const existingOffers = await base44.asServiceRole.entities.RetailerOffer.filter({ offer_key: oKey });
        const availability = offer.availability || "unknown";
        const offerData = {
          offer_key: oKey,
          product_master_id: master.id,
          product_variant_id: linkedVariantId,
          offer_scope: linkedVariantId ? "variant" : "style",
          retailer_name: offer.retailer_name || source.owner_name || source.source_name,
          retailer_key: normalizeKey(offer.retailer_key || source.retailer_key || source.owner_name || source.source_name),
          business_id: offer.business_id || "",
          location_id: offer.location_id || "",
          channel: offer.channel || "unknown",
          retailer_sku: offer.retailer_sku || "",
          seller_product_id: offer.seller_product_id || "",
          offer_url: offer.offer_url || offer.source_url || "",
          currency: offer.currency || "USD",
          regular_price: Number(offer.regular_price ?? offer.current_price ?? 0),
          current_price: Number(offer.current_price ?? offer.sale_price ?? offer.regular_price ?? 0),
          sale_price: offer.sale_price == null ? undefined : Number(offer.sale_price),
          sale_active: Boolean(offer.sale_active),
          availability,
          stock_quantity: offer.stock_quantity == null ? undefined : Number(offer.stock_quantity),
          available_online: offer.available_online,
          available_in_store: offer.available_in_store,
          fulfillment: offer.fulfillment || "unknown",
          last_seen_at: nowIso,
          price_checked_at: nowIso,
          availability_checked_at: nowIso,
          stale_after: offer.stale_after || staleAfter,
          freshness_status: "fresh",
          source_confidence: Number(offer.source_confidence ?? 1),
          active: offer.active !== false,
        };

        let savedOffer: any;
        if (existingOffers[0]) {
          await base44.asServiceRole.entities.RetailerOffer.update(existingOffers[0].id, offerData);
          savedOffer = { ...existingOffers[0], ...offerData };
          counts.offer_updated_count += 1;
        } else {
          savedOffer = await base44.asServiceRole.entities.RetailerOffer.create({
            ...offerData,
            first_seen_at: nowIso,
          });
          counts.offer_created_count += 1;
        }

        await upsertSourceRecord(base44, {
          entity_type: "retailer_offer",
          entity_id: savedOffer.id,
          catalog_source_id: catalogSource.id,
          source_type: source.source_type,
          source_owner_type: source.owner_type || "retailer",
          source_owner_name: source.owner_name || source.source_name,
          source_owner_key: source.owner_key || normalizeKey(source.owner_name || source.source_name),
          source_url: offer.source_url || offer.offer_url || source.source_url || source.endpoint_url || "",
          source_identifier: offer.source_identifier || offer.seller_product_id || offer.retailer_sku || oKey,
          observed_at: nowIso,
          verified_at: nowIso,
          stale_after: offer.stale_after || staleAfter,
          freshness_status: "fresh",
          confidence: Number(offer.source_confidence ?? 1),
          evidence_fields: offer.evidence_fields || Object.keys(offer),
          checksum: offer.checksum || "",
          parser_version: source.parser_version || body.parser_version || "",
          status: "active",
          active: true,
        });
      }
    }

    const completedAt = new Date().toISOString();
    await base44.asServiceRole.entities.CatalogIngestionRun.update(run.id, {
      ...counts,
      status: "completed",
      completed_at: completedAt,
    });
    return Response.json({ success: true, sourceId: catalogSource.id, runId: run.id, ...counts });
  } catch (error) {
    counts.failed_count += 1;
    await base44.asServiceRole.entities.CatalogIngestionRun.update(run.id, {
      ...counts,
      status: "failed",
      completed_at: new Date().toISOString(),
      error_summary: error instanceof Error ? error.message : "Catalog ingestion failed",
    });
    return Response.json(
      { error: error instanceof Error ? error.message : "Catalog ingestion failed", runId: run.id },
      { status: 500 },
    );
  }
}