export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export function cmToInches(cm) {
  return Number(cm) / CM_PER_INCH;
}

export function inchesToCm(inches) {
  return Number(inches) * CM_PER_INCH;
}

export function kgToLb(kg) {
  return Number(kg) / KG_PER_LB;
}

export function lbToKg(lb) {
  return Number(lb) * KG_PER_LB;
}

export function formatLength(cm, unit = 'imperial', digits = 1) {
  if (!Number.isFinite(Number(cm))) return '';
  return unit === 'metric'
    ? `${Number(cm).toFixed(digits)} cm`
    : `${cmToInches(cm).toFixed(digits)} in`;
}

export function formatHeight(cm, unit = 'imperial') {
  if (!Number.isFinite(Number(cm))) return '';
  if (unit === 'metric') return `${Number(cm).toFixed(1)} cm`;
  const totalInches = cmToInches(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return `${feet}′ ${inches.toFixed(1)}″`;
}

export function parseHeightToCm(value, unit = 'imperial') {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return unit === 'metric' ? value : inchesToCm(value);
  }

  const text = String(value).trim().toLowerCase();
  const cmMatch = text.match(/([\d.]+)\s*cm/);
  if (cmMatch) return Number(cmMatch[1]);

  const feetInches = text.match(/(\d+)\s*(?:ft|feet|'|′)\s*(\d+(?:\.\d+)?)?\s*(?:in|inches|"|″)?/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] || 0);
    return inchesToCm(feet * 12 + inches);
  }

  const numeric = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return unit === 'metric' ? numeric : inchesToCm(numeric);
}
