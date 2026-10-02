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

  const chest = Number(measurementsCm.chest);
  const waist = Number(measurementsCm.waist);
  const hips = Number(measurementsCm.hips);
  const inseam = Number(measurementsCm.inseam);

  const matches = sizeChart.filter(row =>
    within(chest, Number(row.chest_min_cm), Number(row.chest_max_cm)) &&
    within(waist, Number(row.waist_min_cm), Number(row.waist_max_cm)) &&
    within(hips, Number(row.hips_min_cm), Number(row.hips_max_cm)) &&
    within(inseam, Number(row.inseam_min_cm), Number(row.inseam_max_cm))
  );

  if (matches.length === 0) return null;

  return {
    size: matches[0].size,
    source: 'product_size_chart',
    matched: matches[0],
  };
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
