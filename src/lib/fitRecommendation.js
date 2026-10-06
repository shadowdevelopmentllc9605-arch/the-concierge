const CATEGORY_GROUPS = {
  tops: new Set(['vests', 'dress_shirts', 'blouse', 'tshirts', 'polos', 'jackets', 'pattern_shirts', 'graphic_tees', 'sports_jackets']),
  bottoms: new Set(['pants', 'jeans', 'shorts', 'khakis']),
  dresses: new Set(['dresses', 'dress_skirts', 'skirts', 'evening_dresses']),
  suits: new Set(['suits']),
  underwear: new Set(['underwear', 'bras', 'lingerie', 'sleepwear']),
  footwear: new Set(['shoes', 'boots']),
  headwear: new Set(['hats']),
  outerwear: new Set(['coats', 'parkas', 'outerwear']),
};

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

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

function normalizedSizeValue(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function labeledAlternateValue(value = '', label = '') {
  const text = String(value).trim();
  const pattern = new RegExp(`^us\\s*${label}\\s*`, 'i');
  return normalizedSizeValue(text.replace(pattern, ''));
}

function normalizedUsShoeSize(value = '') {
  const text = String(value).trim();
  const match = text.match(/(?:us\s*)?(\d+(?:\.\d+)?)/i);
  return match ? match[1] : normalizedSizeValue(text);
}

function normalizedWidthValue(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonicalWidthLabel(value = '') {
  const text = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!text) return '';
  if (/extra\s*wide|x\s*wide|xx\s*wide/.test(text)) return 'extrawide';
  if (/wide/.test(text)) return 'wide';
  if (/medium|standard|regular/.test(text)) return 'medium';
  if (/narrow|slim/.test(text)) return 'narrow';
  return normalizedWidthValue(text);
}

function widthMatches(row = {}, requested = '') {
  if (!requested) return false;
  const requestCode = normalizedWidthValue(requested);
  const requestLabel = canonicalWidthLabel(requested);
  return (
    normalizedWidthValue(row.width_code) === requestCode ||
    canonicalWidthLabel(row.width_label) === requestLabel
  );
}

function widthDistance(row = {}, footWidth) {
  if (!Number.isFinite(footWidth)) return Number.POSITIVE_INFINITY;
  const min = finiteNumber(row.foot_width_min_cm);
  const max = finiteNumber(row.foot_width_max_cm);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return Number.POSITIVE_INFINITY;
  const low = Number.isFinite(min) ? min : max;
  const high = Number.isFinite(max) ? max : min;
  if (footWidth < low) return low - footWidth;
  if (footWidth > high) return footWidth - high;
  return 0;
}

function chooseWidthCandidate(candidates = [], requestedWidth = '', footWidth = Number.NaN) {
  if (!candidates.length) return null;
  if (requestedWidth) {
    const exact = candidates.find(row => widthMatches(row, requestedWidth));
    if (exact) return exact;
  }
  if (Number.isFinite(footWidth)) {
    const ranked = candidates
      .map(row => ({ row, distance: widthDistance(row, footWidth) }))
      .sort((a, b) => a.distance - b.distance);
    if (Number.isFinite(ranked[0]?.distance)) return ranked[0].row;
  }
  return candidates.find(row => !row.width_code) || candidates[0];
}

function applyHalfSizeAdjustment(size, steps = 0) {
  const numeric = Number(size);
  const adjustment = Number(steps);
  if (!Number.isFinite(numeric) || !Number.isFinite(adjustment) || adjustment === 0) return String(size);
  const adjusted = numeric + adjustment * 0.5;
  return Number.isInteger(adjusted) ? String(adjusted) : String(adjusted).replace(/\.0$/, '');
}

export function recommendFromSizeChart(sizeChart = [], measurementsCm = {}, options = {}) {
  if (!Array.isArray(sizeChart) || sizeChart.length === 0) return null;

  const shoeSize = normalizedUsShoeSize(options.shoeSize);
  const footWidth = finiteNumber(measurementsCm.foot_width);
  if (shoeSize) {
    let identityCandidates = sizeChart.filter(row =>
      normalizedSizeValue(row?.us_size || row?.size) === shoeSize
    );
    if (identityCandidates.length === 0 && options.gender === 'female') {
      identityCandidates = sizeChart.filter(row =>
        /^us\s*women/i.test(String(row?.alternate_size || '')) &&
        labeledAlternateValue(row.alternate_size, 'women') === shoeSize
      );
    }
    const identityMatch = chooseWidthCandidate(identityCandidates, options.shoeWidth, footWidth);
    if (identityMatch) {
      const adjustedSize = applyHalfSizeAdjustment(identityMatch.size, options.sizeAdjustmentSteps);
      return {
        size: adjustedSize,
        baseSize: identityMatch.size,
        width: identityMatch.width_code || '',
        widthLabel: identityMatch.width_label || '',
        source: 'product_size_chart',
        matched: identityMatch,
        criteriaMatched: 1 + (identityMatch.width_code ? 1 : 0),
        matchType: 'exact',
        sizeAdjusted: adjustedSize !== String(identityMatch.size),
      };
    }
  }

  const braSize = normalizedSizeValue(options.braSize);
  if (braSize) {
    const identityMatch = sizeChart.find(row =>
      normalizedSizeValue(row?.size) === braSize ||
      normalizedSizeValue(`${row?.band_size || ''}${row?.cup_size || ''}`) === braSize
    );
    if (identityMatch) {
      return {
        size: identityMatch.size,
        source: 'product_size_chart',
        matched: identityMatch,
        criteriaMatched: 1,
        matchType: 'exact',
      };
    }
  }

  const chest = finiteNumber(measurementsCm.chest);
  const bust = finiteNumber(measurementsCm.bust);
  const user = {
    chest: Number.isFinite(chest) ? chest : bust,
    bust: Number.isFinite(bust) ? bust : chest,
    underbust: finiteNumber(measurementsCm.underbust),
    waist: finiteNumber(measurementsCm.waist),
    hips: finiteNumber(measurementsCm.hips),
    inseam: finiteNumber(measurementsCm.inseam),
    foot_length: finiteNumber(measurementsCm.foot_length),
    foot_width: footWidth,
    calf_circumference: finiteNumber(measurementsCm.calf_circumference),
    head_circumference: finiteNumber(measurementsCm.head_circumference),
    height: finiteNumber(measurementsCm.height),
    neck: finiteNumber(measurementsCm.neck),
  };

  const measurementKeys = ['chest', 'bust', 'underbust', 'waist', 'hips', 'inseam', 'foot_length', 'foot_width', 'calf_circumference', 'head_circumference', 'height', 'neck'];
  const scored = sizeChart
    .map(row => {
      let criteria = 0;
      let midpointDistance = 0;
      let outsideDistance = 0;
      let exact = true;

      for (const key of measurementKeys) {
        const value = user[key];
        const min = finiteNumber(row[`${key}_min_cm`]);
        const max = finiteNumber(row[`${key}_max_cm`]);
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

  const adjustedSize = applyHalfSizeAdjustment(best.row.size, options.sizeAdjustmentSteps);
  return {
    size: adjustedSize,
    baseSize: best.row.size,
    width: best.row.width_code || '',
    widthLabel: best.row.width_label || '',
    source: 'product_size_chart',
    matched: best.row,
    criteriaMatched: best.criteria,
    matchType: best.exact ? 'exact' : 'nearest',
    sizeAdjusted: adjustedSize !== String(best.row.size),
  };
}

export function normalizeBrandKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getSizingAudience(profile = {}) {
  if (profile?.birthday) {
    const birthday = new Date(`${profile.birthday}T00:00:00`);
    if (!Number.isNaN(birthday.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birthday.getFullYear();
      const monthDelta = today.getMonth() - birthday.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthday.getDate())) age -= 1;
      if (age >= 0 && age < 18) return 'kids';
    }
  }
  if (profile?.gender === 'male') return 'men';
  if (profile?.gender === 'female') return 'women';
  return 'unknown';
}

export function selectBrandSizeChart(brandCharts = [], product = {}, profile = {}) {
  if (!Array.isArray(brandCharts) || !product?.brand) return null;

  const brandKey = normalizeBrandKey(product.brand);
  const categoryGroup = getCategoryGroup(product.category);
  if (!brandKey || !categoryGroup) return null;

  const audience = getSizingAudience(profile);
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

  if (categoryGroup === 'footwear') {
    const requestedType = product?.footwear_type || 'all';
    if (requestedType && requestedType !== 'all') {
      const exactType = audienceCandidates.filter(chart => chart?.footwear_type === requestedType);
      const allType = audienceCandidates.filter(chart => !chart?.footwear_type || chart?.footwear_type === 'all');
      if (exactType.length) audienceCandidates = exactType;
      else if (allType.length) audienceCandidates = allType;
    }
  }

  if (audience === 'kids') {
    const childGender = profile?.gender === 'male'
      ? 'boys'
      : profile?.gender === 'female'
        ? 'girls'
        : 'unknown';

    if (childGender !== 'unknown') {
      const exactChildGender = audienceCandidates.filter(chart => chart?.gender_detail === childGender);
      const unisexKids = audienceCandidates.filter(chart => chart?.gender_detail === 'unisex');
      if (exactChildGender.length) audienceCandidates = exactChildGender;
      else if (unisexKids.length) audienceCandidates = unisexKids;
    } else {
      const unisexKids = audienceCandidates.filter(chart => chart?.gender_detail === 'unisex');
      if (unisexKids.length) {
        audienceCandidates = unisexKids;
      } else {
        const distinctKidGenders = new Set(
          audienceCandidates.map(chart => chart?.gender_detail).filter(value => value && value !== 'not_applicable')
        );
        if (distinctKidGenders.size > 1) return null;
      }
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
  const chest = finiteNumber(chestCm);
  if (!Number.isFinite(chest)) return '';
  if (chest < 86) return 'XS';
  if (chest < 94) return 'S';
  if (chest < 102) return 'M';
  if (chest < 110) return 'L';
  if (chest < 118) return 'XL';
  return 'XXL';
}

function letterSizeFromWaist(waistCm) {
  const waist = finiteNumber(waistCm);
  if (!Number.isFinite(waist)) return '';
  if (waist < 72) return 'XS';
  if (waist < 80) return 'S';
  if (waist < 88) return 'M';
  if (waist < 96) return 'L';
  if (waist < 104) return 'XL';
  return 'XXL';
}

export function deriveGenericSuggestedSizes(measurementsCm = {}) {
  const chest = finiteNumber(measurementsCm.chest);
  const waist = finiteNumber(measurementsCm.waist);
  const hips = finiteNumber(measurementsCm.hips);

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