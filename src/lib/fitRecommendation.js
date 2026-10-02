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
