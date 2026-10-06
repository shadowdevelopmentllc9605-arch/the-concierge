const CATEGORY_GROUPS = {
  tops: new Set(['suits', 'vests', 'dress_shirts', 'blouse', 'tshirts', 'polos', 'jackets', 'pattern_shirts', 'graphic_tees', 'sports_jackets']),
  bottoms: new Set(['pants', 'jeans', 'shorts', 'khakis']),
  dresses: new Set(['dresses', 'dress_skirts', 'skirts', 'evening_dresses']),
};

function within(value, min, max) {
  if (!Number.isFinite(value)) return true;
  if (Number.isFinite(min) && value < min) return false;
  if (Number.isFinite(max) && value > max) return false;
  return true;
}

export function getCategoryGroup(category) {
  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.has(category)) return group;
  }
  return null;
}

export function recommendFromSizeChart(sizeChart = [], measurementsCm = {}) {
  if (!Array.isArray(sizeChart) || sizeChart.length === 0) return null;

  const user = {
    chest: Number(measurementsCm.chest),
    waist: Number(measurementsCm.waist),
    hips: Number(measurementsCm.hips),
    inseam: Number(measurementsCm.inseam),
  };

  const scored = sizeChart
    .map(row => {
      let criteria = 0;
      let midpointDistance = 0;
      let outsideDistance = 0;
      let exact = true;

      for (const key of ['chest', 'waist', 'hips', 'inseam']) {
        const value = user[key];
        const min = Number(row[`${key}_min_cm`]);
        const max = Number(row[`${key}_max_cm`]);
        const hasMin = Number.isFinite(min);
        const hasMax = Number.isFinite(max);
        const hasBounds = hasMin || hasMax;

        if (!Number.isFinite(value) || !hasBounds) continue;
        criteria += 1;

        const low = hasMin ? min : max;
        const high = hasMax ? max : min;
        const span = Math.max(5, Math.abs(high - low));

        if (!within(value, min, max)) {
          exact = false;
          const edgeDistance = value < low ? low - value : value - high;
          outsideDistance += edgeDistance / span;
        }

        if (hasMin && hasMax) {
          const midpoint = (min + max) / 2;
          midpointDistance += Math.abs(value - midpoint) / span;
        }
      }

      return criteria > 0
        ? { row, criteria, midpointDistance, outsideDistance, exact }
        : null;
    })
    .filter(Boolean);

  const exactCandidates = scored
    .filter(candidate => candidate.exact)
    .sort((a, b) => b.criteria - a.criteria || a.midpointDistance - b.midpointDistance);

  const best = exactCandidates[0] || scored
    .sort((a, b) =>
      a.outsideDistance - b.outsideDistance ||
      b.criteria - a.criteria ||
      a.midpointDistance - b.midpointDistance
    )[0];

  if (!best) return null;

  return {
    size: best.row.size,
    source: 'product_size_chart',
    matched: best.row,
    criteriaMatched: best.criteria,
    matchType: best.exact ? 'exact' : 'nearest',
  };
}

export function normalizeBrandKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getSizingAudience(gender) {
  if (gender === 'male') return 'men';
  if (gender === 'female') return 'women';
  return 'unknown';
}

export function selectBrandSizeChart(brandCharts = [], product = {}, profile = {}) {
  if (!Array.isArray(brandCharts) || !product?.brand) return null;

  const brandKey = normalizeBrandKey(product.brand);
  const categoryGroup = getCategoryGroup(product.category);
  if (!brandKey || !categoryGroup) return null;

  const audience = getSizingAudience(profile?.gender);
  const candidates = brandCharts.filter(chart =>
    chart?.active !== false &&
    normalizeBrandKey(chart?.brand_key || chart?.brand_name) === brandKey &&
    chart?.category_group === categoryGroup &&
    Array.isArray(chart?.entries) &&
    chart.entries.length > 0
  );

  if (candidates.length === 0) return null;

  let audienceCandidates = candidates;
  if (audience !== 'unknown') {
    const exactAudience = candidates.filter(chart => chart.audience === audience);
    const unisex = candidates.filter(chart => chart.audience === 'unisex');
    audienceCandidates = exactAudience.length ? exactAudience : unisex;
    if (audienceCandidates.length === 0) return null;
  } else {
    const unisex = candidates.filter(chart => chart.audience === 'unisex');
    if (unisex.length) audienceCandidates = unisex;
    else {
      const distinctAudiences = new Set(candidates.map(chart => chart.audience).filter(Boolean));
      if (distinctAudiences.size > 1) return null;
    }
  }

  const productSizes = new Set((product?.sizes || []).map(size => String(size).toLowerCase()));
  if (productSizes.size > 0) {
    const compatible = audienceCandidates.filter(chart =>
      chart.entries.some(row => productSizes.has(String(row?.size || '').toLowerCase()))
    );
    if (compatible.length) audienceCandidates = compatible;
  }

  return audienceCandidates[0] || null;
}

export function getEffectiveSizeChart(product, profile, brandCharts = []) {
  if (Array.isArray(product?.size_chart) && product.size_chart.length > 0) {
    return {
      entries: product.size_chart,
      source: 'product_size_chart',
      chart: null,
    };
  }

  const chart = selectBrandSizeChart(brandCharts, product, profile);
  return chart
    ? { entries: chart.entries, source: 'brand_size_chart', chart }
    : { entries: [], source: 'none', chart: null };
}

export function recommendProfileSize(category, profile) {
  const group = getCategoryGroup(category);
  if (!group) return null;

  const chartRecommendation = recommendFromSizeChart(
    profile?.active_product_size_chart || [],
    profile?.measurement_values_cm || {}
  );

  if (chartRecommendation) return chartRecommendation;

  const size = profile?.suggested_sizes?.[group];
  return size ? { size, source: 'profile_estimate' } : null;
}


function letterSizeFromChest(chestCm) {
  if (!Number.isFinite(Number(chestCm))) return '';
  const chest = Number(chestCm);
  if (chest < 86) return 'XS';
  if (chest < 94) return 'S';
  if (chest < 102) return 'M';
  if (chest < 110) return 'L';
  if (chest < 118) return 'XL';
  return 'XXL';
}

function letterSizeFromWaist(waistCm) {
  if (!Number.isFinite(Number(waistCm))) return '';
  const waist = Number(waistCm);
  if (waist < 72) return 'XS';
  if (waist < 80) return 'S';
  if (waist < 88) return 'M';
  if (waist < 96) return 'L';
  if (waist < 104) return 'XL';
  return 'XXL';
}

export function deriveGenericSuggestedSizes(measurementsCm = {}) {
  const chest = Number(measurementsCm.chest);
  const waist = Number(measurementsCm.waist);
  const hips = Number(measurementsCm.hips);

  const tops = letterSizeFromChest(chest);
  const bottoms = letterSizeFromWaist(waist);

  const dressDriver = Math.max(
    Number.isFinite(chest) ? chest : 0,
    Number.isFinite(hips) ? hips : 0
  );
  const dresses = dressDriver ? letterSizeFromChest(dressDriver) : '';

  let suits = '';
  if (Number.isFinite(chest)) {
    const chestInches = chest / 2.54;
    const even = Math.max(30, Math.round(chestInches / 2) * 2);
    suits = String(even);
  }

  return { tops, bottoms, dresses, suits };
}