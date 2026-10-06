export const MEASUREMENT_PROTOCOL_VERSION = 'concierge_anthropometry_v2_photo_first';

export const MEASUREMENT_DEFINITIONS = {
  height: {
    label: 'Height',
    short: 'Top of head to floor while standing naturally without shoes.',
    method: 'Stand barefoot against a wall or use a reliable measured height.',
  },
  chest: {
    label: 'Chest',
    short: 'Horizontal circumference around the fullest part of the chest, under the arms.',
    method: 'Keep the tape level and comfortably snug; do not expand the chest.',
  },
  bust: {
    label: 'Bust',
    short: 'Horizontal circumference around the fullest part of the bust.',
    method: 'Keep the tape level across the back and fullest point of the bust.',
  },
  underbust: {
    label: 'Underbust',
    short: 'Horizontal circumference directly under the bust.',
    method: 'Keep the tape level and snug without compressing.',
  },
  waist: {
    label: 'Natural Waist',
    short: 'Circumference at the natural waist, generally the narrowest torso point between ribs and hips.',
    method: 'Stand relaxed; do not suck in. Keep the tape horizontal.',
  },
  hips: {
    label: 'Hips / Seat',
    short: 'Horizontal circumference around the fullest part of the hips and seat.',
    method: 'Stand with feet together and keep the tape level around the fullest point.',
  },
  shoulders: {
    label: 'Shoulder Width',
    short: 'Straight width across the back from shoulder point to shoulder point.',
    method: 'Measure across the upper back between the outer shoulder points.',
  },
  arm_length: {
    label: 'Arm / Sleeve Length',
    short: 'Shoulder point to wrist with the arm relaxed and slightly bent.',
    method: 'Start at the shoulder point and follow the outside of the arm to the wrist.',
  },
  inseam: {
    label: 'Inseam',
    short: 'Crotch seam level to floor or desired trouser hem along the inside leg.',
    method: 'For clothing size matching, use crotch-to-floor barefoot unless the brand specifies otherwise.',
  },
  neck: {
    label: 'Neck',
    short: 'Circumference around the base of the neck where a shirt collar sits.',
    method: 'Keep one finger of ease under the tape for a dress-shirt collar measurement.',
  },
  head_circumference: {
    label: 'Head Circumference',
    short: 'Circumference around the widest part of the head.',
    method: 'Measure above the eyebrows and ears, keeping the tape level.',
  },
  foot_length: {
    label: 'Foot Length',
    short: 'Heel to longest toe on the larger foot while standing.',
    method: 'Measure both feet while bearing weight and store the larger value.',
  },
  foot_width: {
    label: 'Foot Width',
    short: 'Width across the widest part of the forefoot on the larger/wider foot.',
    method: 'Measure while standing and bearing weight.',
  },
  calf_circumference: {
    label: 'Calf Circumference',
    short: 'Circumference around the fullest part of the calf.',
    method: 'Keep the tape level and snug without compressing.',
  },
};

const any = (...keys) => ({ anyOf: keys });
const all = (...requirements) => requirements;

export const CATEGORY_MEASUREMENT_REQUIREMENTS = {
  suits: all(any('chest', 'bust'), 'waist', 'height'),
  dress_shirts: all('neck', any('chest', 'bust'), 'arm_length'),
  vests: all(any('chest', 'bust'), 'waist'),
  blouse: all('bust', 'waist'),
  jackets: all(any('chest', 'bust'), 'shoulders', 'arm_length'),
  sports_jackets: all(any('chest', 'bust'), 'shoulders', 'arm_length'),
  polos: all(any('chest', 'bust')),
  tshirts: all(any('chest', 'bust')),
  pattern_shirts: all(any('chest', 'bust'), 'arm_length'),
  graphic_tees: all(any('chest', 'bust')),
  pants: all('waist', 'hips', 'inseam'),
  jeans: all('waist', 'hips', 'inseam'),
  shorts: all('waist', 'hips'),
  khakis: all('waist', 'hips', 'inseam'),
  dresses: all('bust', 'waist', 'hips'),
  evening_dresses: all('bust', 'waist', 'hips'),
  dress_skirts: all('waist', 'hips'),
  skirts: all('waist', 'hips'),
  jumpers: all('bust', 'waist', 'hips'),
  underwear: all('waist', 'hips'),
  bras: all('bust', 'underbust'),
  lingerie: all('bust', 'underbust', 'hips'),
  sleepwear: all(any('chest', 'bust'), 'waist', 'hips'),
  hats: all('head_circumference'),
  shoes: all('foot_length', 'foot_width'),
  boots: all('foot_length', 'foot_width', 'calf_circumference'),
  coats: all(any('chest', 'bust'), 'shoulders', 'arm_length'),
  parkas: all(any('chest', 'bust'), 'shoulders', 'arm_length'),
  outerwear: all(any('chest', 'bust'), 'shoulders', 'arm_length'),
};

export function requirementAlternatives(requirement) {
  return typeof requirement === 'string'
    ? [requirement]
    : Array.isArray(requirement?.anyOf)
      ? requirement.anyOf
      : [];
}

export function requirementLabel(requirement) {
  const alternatives = requirementAlternatives(requirement);
  return alternatives
    .map(key => MEASUREMENT_DEFINITIONS[key]?.label || key.replaceAll('_', ' '))
    .join(' or ');
}

export function evaluateMeasurementReadiness(category, measurements = {}) {
  const requirements = CATEGORY_MEASUREMENT_REQUIREMENTS[category] || [];
  const missing = [];
  const present = [];
  for (const requirement of requirements) {
    const alternatives = requirementAlternatives(requirement);
    const satisfied = alternatives.find(key => Number.isFinite(Number(measurements?.[key])));
    if (satisfied) present.push(satisfied);
    else missing.push(requirement);
  }
  return {
    ready: missing.length === 0,
    missing,
    missingLabels: missing.map(requirementLabel),
    present,
    requirementCount: requirements.length,
  };
}
