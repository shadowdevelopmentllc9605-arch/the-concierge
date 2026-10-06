import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  cmToInches,
  formatHeight,
  formatLength,
  inchesToCm,
  parseHeightToCm,
  parseLengthToCm,
} from '@/lib/measurementUnits';
import { deriveGenericSuggestedSizes } from '@/lib/fitRecommendation';

const UNSURE = 'unsure';

const lengthFields = [
  { key: 'height', label: 'Height' },
  { key: 'chest', label: 'Chest' },
  { key: 'bust', label: 'Bust' },
  { key: 'underbust', label: 'Under Bust' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'inseam', label: 'Inseam' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arm_length', label: 'Arm Length' },
  { key: 'neck', label: 'Neck' },
  { key: 'head_circumference', label: 'Head Circumference' },
  { key: 'foot_length', label: 'Foot Length (larger foot)' },
  { key: 'foot_width', label: 'Foot Width (widest foot)' },
  { key: 'calf_circumference', label: 'Calf Circumference' },
];

const textFields = [
  { key: 'weight', label: 'Weight', placeholder: 'e.g. 175 lb or 79 kg' },
  { key: 'shoe_size', label: 'Shoe Size', placeholder: 'e.g. 10 US / 43 EU' },
  { key: 'shoe_width', label: 'Shoe Width', placeholder: 'e.g. D, 2E, Wide, Narrow' },
  { key: 'bra_size', label: 'Bra Size', placeholder: 'e.g. 34C' },
];

function initialLengthValue(profile, key, unit) {
  const canonical = Number(profile?.measurement_values_cm?.[key]);
  let cm = Number.isFinite(canonical) ? canonical : null;

  if (cm == null) {
    const existing = profile?.measurements?.[key];
    cm = key === 'height'
      ? parseHeightToCm(existing, profile?.measurement_unit || unit)
      : parseLengthToCm(existing, profile?.measurement_unit || unit);
  }

  if (!Number.isFinite(cm)) return '';
  return unit === 'metric' ? cm.toFixed(1) : cmToInches(cm).toFixed(1);
}

function formattedMeasurementMap(valuesCm, unit, existing = {}) {
  const next = { ...existing };
  for (const { key } of lengthFields) {
    const value = Number(valuesCm[key]);
    if (!Number.isFinite(value)) continue;
    next[key] = key === 'height'
      ? formatHeight(value, unit)
      : formatLength(value, unit);
  }
  return next;
}

export default function MeasurementsEditor({ profile, onSaved }) {
  const initialUnit = profile?.measurement_unit || 'imperial';
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(initialUnit);
  const [saving, setSaving] = useState(false);

  const [lengthValues, setLengthValues] = useState(() =>
    Object.fromEntries(lengthFields.map(({ key }) => [key, initialLengthValue(profile, key, initialUnit)]))
  );
  const [textValues, setTextValues] = useState(() =>
    Object.fromEntries(textFields.map(({ key }) => [key, profile?.measurements?.[key] || '']))
  );
  const [unsureFields, setUnsureFields] = useState(() => {
    const init = {};
    [...lengthFields, ...textFields].forEach(({ key }) => {
      if (profile?.measurements?.[key] === UNSURE) init[key] = true;
    });
    return init;
  });
  const [verifiedFields, setVerifiedFields] = useState(() => {
    const init = {};
    lengthFields.forEach(({ key }) => {
      init[key] = profile?.measurement_sources?.[key] === 'customer_tape_verified';
    });
    return init;
  });

  const scanConfidence = profile?.measurement_confidence;
  const lastUpdated = profile?.measurement_updated_at;
  const unitLabel = unit === 'metric' ? 'cm' : 'in';

  const switchUnit = (nextUnit) => {
    if (nextUnit === unit) return;
    setLengthValues(prev => {
      const converted = /** @type {Record<string, string>} */ ({});
      for (const { key } of lengthFields) {
        const current = Number(prev[key]);
        if (!Number.isFinite(current)) {
          converted[key] = '';
          continue;
        }
        converted[key] = nextUnit === 'metric'
          ? inchesToCm(current).toFixed(1)
          : cmToInches(current).toFixed(1);
      }
      return converted;
    });
    setUnit(nextUnit);
  };

  const canonicalCm = useMemo(() => {
    const values = {};
    for (const { key } of lengthFields) {
      if (unsureFields[key]) continue;
      const numeric = Number(lengthValues[key]);
      if (!Number.isFinite(numeric)) continue;
      values[key] = unit === 'metric' ? numeric : inchesToCm(numeric);
    }
    return values;
  }, [lengthValues, unit, unsureFields]);

  const toggleUnsure = (key) => {
    setUnsureFields(prev => {
      const nextUnsure = !prev[key];
      if (nextUnsure) {
        setVerifiedFields(verified => ({ ...verified, [key]: false }));
      }
      return { ...prev, [key]: nextUnsure };
    });
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const displayMeasurements = formattedMeasurementMap(
        canonicalCm,
        unit,
        profile?.measurements || {}
      );

      for (const { key } of textFields) {
        displayMeasurements[key] = unsureFields[key] ? UNSURE : textValues[key];
      }
      for (const { key } of lengthFields) {
        if (unsureFields[key]) displayMeasurements[key] = UNSURE;
      }

      const measurementSources = { ...(profile?.measurement_sources || {}) };
      const confidenceByField = { ...(profile?.measurement_confidence_by_field || {}) };

      for (const { key } of lengthFields) {
        const current = Number(canonicalCm[key]);
        const previous = Number(profile?.measurement_values_cm?.[key]);

        if (!Number.isFinite(current)) {
          delete measurementSources[key];
          delete confidenceByField[key];
          continue;
        }

        if (verifiedFields[key]) {
          measurementSources[key] = 'customer_tape_verified';
          confidenceByField[key] = 100;
          continue;
        }

        const changed = !Number.isFinite(previous) || Math.abs(current - previous) >= 0.2;
        if (changed) {
          measurementSources[key] = Number.isFinite(previous)
            ? 'customer_corrected'
            : 'customer_supplied';
          confidenceByField[key] = Math.max(Number(confidenceByField[key] || 0), 90);
        }
      }

      const verifiedCore = ['chest', 'waist', 'hips'].filter(key =>
        Number.isFinite(Number(canonicalCm[key])) && verifiedFields[key]
      );
      const anyVerified = Object.values(verifiedFields).some(Boolean);
      const validationStatus = verifiedCore.length === 3
        ? 'verified'
        : anyVerified
          ? 'partially_verified'
          : 'reviewed';

      const update = {
        measurement_unit: unit,
        measurement_values_cm: canonicalCm,
        measurements: displayMeasurements,
        measurement_sources: measurementSources,
        measurement_confidence_by_field: confidenceByField,
        measurement_validation_status: validationStatus,
        suggested_sizes: deriveGenericSuggestedSizes(canonicalCm),
        measurement_updated_at: new Date().toISOString(),
        measurement_method: profile?.body_scan_front ? 'mixed_scan_manual_review' : 'manual',
      };

      await base44.entities.UserProfile.update(profile.id, update);
      onSaved?.({ ...profile, ...update });
      setOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(value => !value)}
        className="w-full flex items-center justify-between p-4 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center">
            <Ruler className="w-5 h-5 text-[var(--color-text-primary)]" />
          </div>
          <div className="text-left">
            <p className="font-medium text-[var(--color-text-primary)]">My Measurements</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Metric or imperial • review anytime
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
        )}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-[var(--color-border-light)] px-4 pb-4 pt-3 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Display units</p>
              {scanConfidence != null && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Last scan quality: {scanConfidence}%{lastUpdated ? ' • measurements are editable' : ''}
                </p>
              )}
            </div>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => switchUnit('imperial')}
                className={`px-3 py-1.5 text-xs ${unit === 'imperial' ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]' : ''}`}
              >
                Imperial
              </button>
              <button
                type="button"
                onClick={() => switchUnit('metric')}
                className={`px-3 py-1.5 text-xs ${unit === 'metric' ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]' : ''}`}
              >
                Metric
              </button>
            </div>
          </div>

          {lengthFields.map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {field.label}
                </label>
                <button
                  type="button"
                  onClick={() => toggleUnsure(field.key)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    unsureFields[field.key]
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  Not sure
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  disabled={unsureFields[field.key]}
                  value={unsureFields[field.key] ? '' : lengthValues[field.key]}
                  onChange={(e) => setLengthValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 pr-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
                />
                {!unsureFields[field.key] && (
                  <span className="absolute right-3 top-2.5 text-xs text-[var(--color-text-secondary)]">
                    {unitLabel}
                  </span>
                )}
              </div>
              {!unsureFields[field.key] && (
                <label className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(verifiedFields[field.key])}
                    onChange={(e) => setVerifiedFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                  />
                  I verified this measurement with a tape or ruler
                </label>
              )}
            </div>
          ))}

          {textFields.map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {field.label}
                </label>
                <button
                  type="button"
                  onClick={() => toggleUnsure(field.key)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    unsureFields[field.key]
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  Not sure
                </button>
              </div>
              <input
                type="text"
                disabled={unsureFields[field.key]}
                value={unsureFields[field.key] ? '' : textValues[field.key]}
                onChange={(e) => setTextValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
              />
            </div>
          ))}

          <p className="text-xs text-[var(--color-text-secondary)]">
            Photo measurements are estimates. Mark a measurement verified only when you actually checked it with a tape or ruler. The Concierge uses that verification when deciding how confident a size recommendation should be.
          </p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 h-11 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-xl font-medium text-sm flex items-center justify-center gap-2 select-none"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Measurements'}
          </button>
        </motion.div>
      )}
    </div>
  );
}