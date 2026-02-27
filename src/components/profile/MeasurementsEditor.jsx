import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const UNSURE = 'unsure';

const fields = [
  { key: 'height', label: 'Height', placeholder: 'e.g. 5\'11" or 180cm', maleOnly: false, femaleOnly: false },
  { key: 'weight', label: 'Weight', placeholder: 'e.g. 175 lbs or 79 kg', maleOnly: false, femaleOnly: false },
  { key: 'chest', label: 'Chest', placeholder: 'e.g. 40"', maleOnly: false, femaleOnly: false },
  { key: 'bust', label: 'Bust', placeholder: 'e.g. 36"', maleOnly: false, femaleOnly: true },
  { key: 'waist', label: 'Waist', placeholder: 'e.g. 32"', maleOnly: false, femaleOnly: false },
  { key: 'hips', label: 'Hips', placeholder: 'e.g. 38"', maleOnly: false, femaleOnly: false },
  { key: 'inseam', label: 'Inseam', placeholder: 'e.g. 30"', maleOnly: false, femaleOnly: false },
  { key: 'neck', label: 'Neck', placeholder: 'e.g. 15.5"', maleOnly: false, femaleOnly: false },
  { key: 'shoe_size', label: 'Shoe Size', placeholder: 'e.g. 10 US / 43 EU', maleOnly: false, femaleOnly: false },
];

export default function MeasurementsEditor({ profile, onSaved }) {
  const [open, setOpen] = useState(false);
  const [measurements, setMeasurements] = useState(profile?.measurements || {});
  const [unsureFields, setUnsureFields] = useState(() => {
    const init = {};
    fields.forEach(f => {
      if (profile?.measurements?.[f.key] === UNSURE) init[f.key] = true;
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const gender = profile?.gender || 'prefer_not_to_say';

  const visibleFields = fields.filter(f => {
    if (f.femaleOnly && gender === 'male') return false;
    return true;
  });

  const handleChange = (key, value) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const toggleUnsure = (key) => {
    setUnsureFields(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) {
        setMeasurements(m => ({ ...m, [key]: UNSURE }));
      } else {
        setMeasurements(m => ({ ...m, [key]: '' }));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { measurements });
      onSaved && onSaved({ ...profile, measurements });
      setOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center">
            <Ruler className="w-5 h-5 text-[var(--color-text-primary)]" />
          </div>
          <div className="text-left">
            <p className="font-medium text-[var(--color-text-primary)]">My Measurements</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Size & fit details</p>
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
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-[var(--color-border-light)] px-4 pb-4 pt-3 space-y-3"
        >
          {gender === 'male' && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Bust measurement is marked N/A for male profiles.
            </p>
          )}

          {visibleFields.map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {field.label}
                </label>
                <button
                  onClick={() => toggleUnsure(field.key)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors select-none ${
                    unsureFields[field.key]
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  Not sure
                </button>
              </div>
              <input
                type="text"
                disabled={unsureFields[field.key]}
                value={unsureFields[field.key] ? 'Not sure' : (measurements[field.key] || '')}
                onChange={e => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          ))}

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