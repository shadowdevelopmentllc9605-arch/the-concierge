import {
  CATEGORY_MEASUREMENT_REQUIREMENTS,
  evaluateMeasurementReadiness,
  requirementAlternatives,
  requirementLabel,
} from './measurementDefinitions';

const CATEGORY_GROUPS = {
  tops: new Set(['vests', 'dress_shirts', 'blouse', 'tshirts', 'polos', 'jackets', 'pattern_shirts', 'graphic_tees', 'sports_jackets']),
  bottoms: new Set(['pants', 'jeans', 'shorts', 'khakis']),
  dresses: new Set(['dresses', 'dress_skirts', 'skirts', 'evening_dresses']),
  suits: new Set(['suits']),
  underwear: new Set(['underwear', 'bras', 'lingerie', 'sleepwear']),
  swimwear: new Set(['swimwear']),
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

function chartMeasurementKeys(sizeChart = []) {
  const keys = ['chest', 'bust', 'underbust', 'waist', 'hips', 'inseam', 'foot_length', 'foot_width', 'calf_circumference', 'head_circumference', 'height', 'neck'];
  const available = new Set(keys.filter(key => sizeChart.some(row =>
    Number.isFinite(finiteNumber(row?.[`${key}_min_cm`])) ||
    Number.isFinite(finiteNumber(row?.[`${key}_max_cm`]))
  )));
  const hasSleeve = sizeChart.some(row =>
    Number.isFinite(finiteNumber(row?.sleeve_min_cm)) ||
    Number.isFinite(finiteNumber(row?.sleeve_max_cm))
  );
  if (hasSleeve) available.add('arm_length');
  return available;
}

function buildFitConfidence(sizeChart, measurementsCm, options, exact, criteriaMatched, identityOnly = false) {
  const requirements = CATEGORY_MEASUREMENT_REQUIREMENTS[options.category] || [];
  const readiness = evaluateMeasurementReadiness(options.category, measurementsCm);
  const chartKeys = chartMeasurementKeys(sizeChart);

  const supportedRequirements = requirements.filter(requirement =>
    requirementAlternatives(requirement).some(key => chartKeys.has(key))
  );
  const missingChartData = requirements
    .filter(requirement => !supportedRequirements.includes(requirement))
    .map(requirementLabel);

  const measurementsUsed = readiness.present.filter(key => chartKeys.has(key));
  const fieldConfidence = options.measurementConfidenceByField || {};
  const confidenceValues = measurementsUsed
    .map(key => finiteNumber(fieldConfidence[key]))
    .filter(Number.isFinite);
  const avgFieldConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : finiteNumber(options.measurementConfidence);
  const minFieldConfidence = confidenceValues.length
    ? Math.min(...confidenceValues)
    : finiteNumber(options.measurementConfidence);

  const completeness = requirements.length
    ? (requirements.length - readiness.missing.length) / requirements.length
    : Math.min(1, Number(criteriaMatched || 0) / 2);
  const chartCoverage = requirements.length
    ? supportedRequirements.length / requirements.length
    : Math.min(1, Number(criteriaMatched || 0) / 2);

  let score = exact ? 58 : 40;
  score += completeness * 18;
  score += chartCoverage * 12;
  if (Number.isFinite(avgFieldConfidence)) score += (avgFieldConfidence / 100) * 8;
  if (options.validationStatus === 'verified') score += 6;
  else if (options.validationStatus === 'partially_verified') score += 3;
  else if (options.validationStatus === 'estimated') score -= 5;

  const blocked = readiness.missing.length > 0;
  if (identityOnly) score = Math.min(score, 72);
  if (!exact) score = Math.min(score, 74);
  if (criteriaMatched <= 1 && requirements.length > 1) score = Math.min(score, 60);
  if (Number.isFinite(minFieldConfidence) && minFieldConfidence < 45) score = Math.min(score, 49);
  else if (Number.isFinite(minFieldConfidence) && minFieldConfidence < 65) score = Math.min(score, 64);
  else if (Number.isFinite(minFieldConfidence) && minFieldConfidence < 80) score = Math.min(score, 79);
  if (blocked) score = Math.min(score, 49);
  if (missingChartData.length) score = Math.min(score, 79);

  const confidenceScore = Math.round(Math.max(0, Math.min(100, score)));
  return {
    fitConfidence: confidenceScore >= 85 ? 'high' : confidenceScore >= 65 ? 'medium' : 'low',
    confidenceScore,
    blocked,
    blockedReason: blocked
      ? `More body information is needed before this can be treated as a fit recommendation.`
      : '',
    missingMeasurements: readiness.missingLabels,
    missingChartData,
    measurementsUsed,
  };
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
    let identityCandidates = [];
    if (options.gender === 'female') {
      identityCandidates = sizeChart.filter(row =>
        /^us\s*women/i.test(String(row?.alternate_size || '')) &&
        labeledAlternateValue(row.alternate_size, 'women') === shoeSize
      );
    }
    if (identityCandidates.length === 0) {
      identityCandidates = sizeChart.filter(row =>
        normalizedSizeValue(row?.us_size || row?.size) === shoeSize
      );
    }
    const identityMatch = chooseWidthCandidate(identityCandidates, options.shoeWidth, footWidth);
    if (identityMatch) {
      const adjustedSize = applyHalfSizeAdjustment(identityMatch.size, options.sizeAdjustmentSteps);
      const criteriaMatched = 1 + (identityMatch.width_code ? 1 : 0);
      const confidence = buildFitConfidence(
        sizeChart,
        measurementsCm,
        options,
        true,
        criteriaMatched,
        true
      );
      return {
        size: adjustedSize,
        baseSize: identityMatch.size,
        width: identityMatch.width_code || '',
        widthLabel: identityMatch.width_label || '',
        source: 'product_size_chart',
        matched: identityMatch,
        criteriaMatched,
        matchType: 'exact',
        sizeAdjusted: adjustedSize !== String(identityMatch.size),
        ...confidence,
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
      const confidence = buildFitConfidence(sizeChart, measurementsCm, options, true, 1, true);
      return {
        size: identityMatch.size,
        baseSize: identityMatch.size,
        width: identityMatch.width_code || '',
        widthLabel: identityMatch.width_label || '',
        source: 'product_size_chart',
        matched: identityMatch,
        criteriaMatched: 1,
        matchType: 'exact',
        sizeAdjusted: false,
        ...confidence,
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
    arm_length: finiteNumber(measurementsCm.arm_length),
  };

  const measurementKeys = ['chest', 'bust', 'underbust', 'waist', 'hips', 'inseam', 'foot_length', 'foot_width', 'calf_circumference', 'head_circumference', 'height', 'neck', 'arm_length'];
  const scored = sizeChart
    .map(row => {
      let criteria = 0;
      let midpointDistance = 0;
      let outsideDistance = 0;
      let exact = true;

      for (const key of measurementKeys) {
        const value = user[key];
        const chartKey = key === 'arm_length' ? 'sleeve' : key;
        const min = finiteNumber(row[`${chartKey}_min_cm`]);
        const max = finiteNumber(row[`${chartKey}_max_cm`]);
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
  const confidence = buildFitConfidence(
    sizeChart,
    measurementsCm,
    options,
    best.exact,
    best.criteria,
    false
  );
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
    ...confidence,
  };
}

export function normalizeBrandKey(value = '') {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    avaviv: 'avaandviv',
    catjack: 'catandjack',
    croftbarrow: 'croftandbarrow',
    shadeshore: 'shadeandshore',
  };
  return aliases[normalized] || normalized;
}

export function getSizingAgeGroup(profile = {}) {
  if (!profile?.birthday) return 'unknown';
  const birthday = new Date(`${profile.birthday}T00:00:00`);
  if (Number.isNaN(birthday.getTime())) return 'unknown';

  const today = new Date();
  const ageYears = (today.getTime() - birthday.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  if (ageYears < 0) return 'unknown';
  if (ageYears < 2) return 'infant';
  if (ageYears < 5) return 'toddler';
  if (ageYears < 13) return 'kids';
  if (ageYears < 18) return 'youth';
  return 'adult';
}

export function getSizingAudience(profile = {}) {
  const ageGroup = getSizingAgeGroup(profile);
  if (['infant', 'toddler', 'kids', 'youth'].includes(ageGroup)) return 'kids';
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
    (!chart?.measurement_basis || chart?.measurement_basis === 'body') &&
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

  const sizingAgeGroup = getSizingAgeGroup(profile);
  if (sizingAgeGroup !== 'unknown') {
    const exactAgeGroup = audienceCandidates.filter(chart => chart?.age_group === sizingAgeGroup);
    const allAges = audienceCandidates.filter(chart =>
      !chart?.age_group || chart.age_group === 'all' || chart.age_group === 'unknown'
    );
    if (exactAgeGroup.length) audienceCandidates = exactAgeGroup;
    else if (allAges.length) audienceCandidates = allAges;
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

  const productSizes = new Set((product?.sizes || []).map(normalizedSizeValue).filter(Boolean));
  if (productSizes.size > 0) {
    const compatible = audienceCandidates.filter(chart =>
      chart.entries.some(row =>
        [row?.size, row?.numeric_equivalent, row?.us_size, row?.alternate_size]
          .map(normalizedSizeValue)
          .filter(Boolean)
          .some(value => productSizes.has(value))
      )
    );
    if (compatible.length) audienceCandidates = compatible;
    else return null;
  }

  if (audience === 'kids' && sizingAgeGroup === 'unknown') {
    const genericAgeCharts = audienceCandidates.filter(chart =>
      !chart?.age_group || chart.age_group === 'all' || chart.age_group === 'unknown'
    );
    if (genericAgeCharts.length) {
      audienceCandidates = genericAgeCharts;
    } else {
      const distinctAgeGroups = new Set(audienceCandidates.map(chart => chart?.age_group).filter(Boolean));
      if (distinctAgeGroups.size > 1) return null;
    }
  }

  return audienceCandidates[0] || null;
}

export function getEffectiveSizeChart(product, profile, brandCharts = []) {
  const productBasis = product?.size_chart_measurement_basis || 'body';
  if (
    Array.isArray(product?.size_chart) &&
    product.size_chart.length > 0 &&
    productBasis === 'body'
  ) {
    return {
      entries: product.size_chart,
      source: 'product_size_chart',
      chart: null,
      measurementBasis: productBasis,
      garmentMeasurements: product?.garment_measurements || [],
      garmentFit: product?.garment_fit || {},
    };
  }

  const chart = selectBrandSizeChart(brandCharts, product, profile);
  return chart
    ? {
        entries: chart.entries,
        source: 'brand_size_chart',
        chart,
        measurementBasis: chart.measurement_basis || 'body',
        garmentMeasurements: product?.garment_measurements || [],
        garmentFit: product?.garment_fit || {},
      }
    : {
        entries: [],
        source: productBasis === 'garment' || productBasis === 'mixed' ? 'non_body_chart_only' : 'none',
        chart: null,
        measurementBasis: productBasis,
        garmentMeasurements: product?.garment_measurements || [],
        garmentFit: product?.garment_fit || {},
      };
}

export function getFitRecommendationPresentation(source = '', matchType = '') {
  const normalizedSource = String(source || '').replace(/_nearest$/, '');
  const nearest = matchType === 'nearest' || String(source || '').endsWith('_nearest');

  if (normalizedSource === 'profile_estimate') {
    return {
      label: 'Estimated size',
      detail: 'Based on your body measurements',
      verified: false,
    };
  }

  if (normalizedSource === 'generic_brand_fallback') {
    return {
      label: 'Estimated size',
      detail: 'Generic S–XL fallback based on your body measurements; a verified product or brand chart will automatically take priority',
      verified: false,
    };
  }

  if (normalizedSource === 'product_size_chart' || normalizedSource === 'brand_size_chart') {
    return {
      label: nearest ? 'Closest verified fit' : 'Verified fit',
      detail: normalizedSource === 'product_size_chart'
        ? 'Based on this product’s sizing chart and your body measurements'
        : 'Based on verified brand sizing and your body measurements',
      verified: true,
    };
  }

  return {
    label: 'Size recommendation',
    detail: '',
    verified: false,
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

const GENERIC_ALPHA_ORDER = ['S', 'M', 'L', 'XL'];

function alphaBucket(value, upperBounds = []) {
  const numeric = finiteNumber(value);
  if (!Number.isFinite(numeric)) return '';
  for (let index = 0; index < upperBounds.length; index += 1) {
    if (numeric <= upperBounds[index]) return GENERIC_ALPHA_ORDER[index] || '';
  }
  return 'XL';
}

function largerAlphaSize(...sizes) {
  const ranked = sizes
    .map(size => GENERIC_ALPHA_ORDER.indexOf(size))
    .filter(index => index >= 0);
  return ranked.length ? GENERIC_ALPHA_ORDER[Math.max(...ranked)] : '';
}

function canonicalAlphaSize(value = '') {
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['s', 'sm', 'small'].includes(normalized)) return 'S';
  if (['m', 'md', 'med', 'medium'].includes(normalized)) return 'M';
  if (['l', 'lg', 'large'].includes(normalized)) return 'L';
  if (['xl', 'xlarge', 'extralarge', '1x'].includes(normalized)) return 'XL';
  return '';
}

function productAlphaLabel(productSizes = [], canonical = '') {
  if (!canonical) return '';
  if (!Array.isArray(productSizes) || productSizes.length === 0) return canonical;
  const match = productSizes.find(size => canonicalAlphaSize(size) === canonical);
  return match || '';
}

export function deriveGenericFallbackSize(product = {}, profile = {}) {
  const group = getCategoryGroup(product?.category);
  const supportedGroups = new Set(['tops', 'bottoms', 'dresses', 'outerwear', 'underwear', 'swimwear']);
  if (!group || !supportedGroups.has(group) || product?.category === 'bras') return null;

  const measurements = profile?.measurement_values_cm || {};
  const audience = getSizingAudience(profile);
  let canonical = '';

  if (audience === 'kids') {
    const ageGroup = getSizingAgeGroup(profile);
    if (!['kids', 'youth'].includes(ageGroup)) return null;
    canonical =
      alphaBucket(measurements.height, [122, 137, 152]) ||
      alphaBucket(measurements.chest || measurements.bust, [64, 72, 80]);
  } else if (audience === 'women') {
    const bust = measurements.bust || measurements.chest;
    const bustSize = alphaBucket(bust, [90, 98, 106]);
    const waistSize = alphaBucket(measurements.waist, [71, 79, 89]);
    const hipSize = alphaBucket(measurements.hips, [94, 102, 112]);

    if (group === 'tops' || group === 'outerwear') canonical = bustSize;
    else if (group === 'dresses') canonical = largerAlphaSize(bustSize, waistSize, hipSize);
    else canonical = largerAlphaSize(waistSize, hipSize);
  } else if (audience === 'men') {
    const chestSize = alphaBucket(measurements.chest, [94, 104, 114]);
    const waistSize = alphaBucket(measurements.waist, [81, 91, 101]);
    canonical = (group === 'tops' || group === 'outerwear') ? chestSize : waistSize;
  } else {
    const chestSize = alphaBucket(measurements.chest || measurements.bust, [94, 104, 114]);
    const waistSize = alphaBucket(measurements.waist, [81, 91, 101]);
    canonical = (group === 'tops' || group === 'outerwear') ? chestSize : largerAlphaSize(chestSize, waistSize);
  }

  const size = productAlphaLabel(product?.sizes || [], canonical);
  if (!size) return null;

  return {
    size,
    source: 'generic_brand_fallback',
    audience,
    fitConfidence: 'low',
    confidenceScore: null,
  };
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