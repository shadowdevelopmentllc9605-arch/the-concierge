import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Camera, Check, ArrowRight, Loader2, RotateCcw, AlertCircle, Ruler, ShieldCheck } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';
import { measureBodyFromImages } from '@/lib/bodyMeasurement';
import {
  cmToInches,
  formatHeight,
  formatLength,
  inchesToCm,
  parseHeightToCm,
} from '@/lib/measurementUnits';
import { resolveFileUrl } from '@/lib/privateFiles';
import { deriveGenericSuggestedSizes } from '@/lib/fitRecommendation';
import { MEASUREMENT_PROTOCOL_VERSION } from '@/lib/measurementDefinitions';

const REVIEW_FIELDS = [
  { key: 'chest', label: 'Chest', verify: true },
  { key: 'waist', label: 'Waist', verify: true },
  { key: 'hips', label: 'Hips', verify: true },
  { key: 'shoulders', label: 'Shoulder width', verify: false },
  { key: 'arm_length', label: 'Arm length', verify: false },
];

function buildDisplayMeasurements(valuesCm, unit, existing = {}) {
  const next = /** @type {Record<string, string>} */ ({ ...existing });
  next.height = formatHeight(valuesCm.height, unit);
  for (const { key } of REVIEW_FIELDS) {
    if (Number.isFinite(Number(valuesCm[key]))) {
      next[key] = formatLength(Number(valuesCm[key]), unit);
    }
  }
  return next;
}

function reviewValuesFromCm(valuesCm, unit) {
  return Object.fromEntries(REVIEW_FIELDS.map(({ key }) => {
    const value = Number(valuesCm?.[key]);
    if (!Number.isFinite(value)) return [key, ''];
    return [key, unit === 'metric' ? value.toFixed(1) : cmToInches(value).toFixed(1)];
  }));
}

export default function BodyScan({ profile, concierge, onComplete }) {
  const preferredUnit = profile?.measurement_unit || 'imperial';
  const existingHeightCm = Number(profile?.measurement_values_cm?.height) ||
    parseHeightToCm(profile?.measurements?.height, preferredUnit);

  const [scans, setScans] = useState({
    front: profile?.body_scan_front || null,
    side: profile?.body_scan_side || null,
    back: profile?.body_scan_back || null
  });
  const [currentScan, setCurrentScan] = useState('front');
  const [unit, setUnit] = useState(preferredUnit);
  const [heightValue, setHeightValue] = useState(() => {
    if (!existingHeightCm) return '';
    if (preferredUnit === 'metric') return existingHeightCm.toFixed(1);
    return (existingHeightCm / 2.54).toFixed(1);
  });
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [reviewValues, setReviewValues] = useState({});
  const [verifiedFields, setVerifiedFields] = useState({});
  const [scanPreviews, setScanPreviews] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const key of ['front', 'side', 'back']) {
        const uri = scans[key];
        if (!uri || scanPreviews[key]) continue;
        try {
          const url = await resolveFileUrl(uri);
          if (!cancelled) setScanPreviews(prev => ({ ...prev, [key]: url }));
        } catch (err) {
          console.error(err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [scans.front, scans.side, scans.back]);

  const scanSteps = [
    {
      key: 'front',
      label: 'Front View',
      instruction: 'Stand straight, face the camera, keep your full body visible, and hold your arms slightly away from your sides.'
    },
    {
      key: 'side',
      label: 'Side View',
      instruction: 'Turn exactly 90°, keep your full body visible, and keep your arms relaxed without blocking your torso.'
    },
    {
      key: 'back',
      label: 'Back View',
      instruction: 'Face directly away from the camera, stand straight, and keep the same camera position and distance.'
    }
  ];

  const heightCm = useMemo(() => {
    const numeric = Number(heightValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return unit === 'metric' ? numeric : numeric * 2.54;
  }, [heightValue, unit]);

  const handleUnitChange = (nextUnit) => {
    if (nextUnit === unit) return;
    const currentHeightCm = heightCm;

    if (scanResult) {
      setReviewValues(prev => {
        const converted = {};
        for (const { key } of REVIEW_FIELDS) {
          const numeric = Number(prev[key]);
          if (!Number.isFinite(numeric)) {
            converted[key] = '';
          } else {
            converted[key] = nextUnit === 'metric'
              ? inchesToCm(numeric).toFixed(1)
              : cmToInches(numeric).toFixed(1);
          }
        }
        return converted;
      });
    }

    setUnit(nextUnit);
    if (currentHeightCm) {
      setHeightValue(
        nextUnit === 'metric'
          ? currentHeightCm.toFixed(1)
          : (currentHeightCm / 2.54).toFixed(1)
      );
    }
  };

  const clearAnalysis = () => {
    setScanResult(null);
    setReviewValues({});
    setVerifiedFields({});
    setError('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    clearAnalysis();
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const previewUrl = await resolveFileUrl(file_uri);
      setScans(prev => ({ ...prev, [currentScan]: file_uri }));
      setScanPreviews(prev => ({ ...prev, [currentScan]: previewUrl }));

      const currentIndex = scanSteps.findIndex(step => step.key === currentScan);
      if (currentIndex < scanSteps.length - 1) {
        setTimeout(() => setCurrentScan(scanSteps[currentIndex + 1].key), 350);
      }
    } catch (uploadError) {
      console.error(uploadError);
      setError('That photo could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!scans.front || !scans.side || !scans.back) return;
    if (!heightCm || heightCm < 80 || heightCm > 230) {
      setError('Enter the customer’s actual height so the photos can be calibrated to real-world measurements.');
      return;
    }

    setAnalyzing(true);
    setError('');
    try {
      const [frontUrl, sideUrl, backUrl] = await Promise.all([
        resolveFileUrl(scans.front),
        resolveFileUrl(scans.side),
        resolveFileUrl(scans.back),
      ]);

      const result = await measureBodyFromImages({
        frontUrl,
        sideUrl,
        backUrl,
        heightCm,
      });

      setScanResult(result);
      setReviewValues(reviewValuesFromCm(result.measurementsCm, unit));
      setVerifiedFields({});
    } catch (measurementError) {
      console.error(measurementError);
      setError(
        measurementError?.message ||
        'We could not get a reliable measurement from these photos. Retake the views and try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const canonicalReviewedMeasurements = useMemo(() => {
    if (!scanResult) return null;
    const values = { height: Number(heightCm) };
    for (const { key } of REVIEW_FIELDS) {
      const numeric = Number(reviewValues[key]);
      if (!Number.isFinite(numeric)) continue;
      values[key] = unit === 'metric' ? numeric : inchesToCm(numeric);
    }
    return values;
  }, [scanResult, reviewValues, unit, heightCm]);

  const handleConfirm = async () => {
    if (!scanResult || !canonicalReviewedMeasurements) return;
    const required = ['height', 'chest', 'waist', 'hips'];
    if (!required.every(key => Number.isFinite(Number(canonicalReviewedMeasurements[key])))) {
      setError('Height, chest, waist, and hips are required for the initial fit profile.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const sources = { ...scanResult.measurementSources };
      const fieldConfidence = { ...scanResult.fieldConfidence, height: 100 };

      for (const { key } of REVIEW_FIELDS) {
        const original = Number(scanResult.measurementsCm?.[key]);
        const reviewed = Number(canonicalReviewedMeasurements[key]);
        const changed = Number.isFinite(original) && Number.isFinite(reviewed) && Math.abs(original - reviewed) >= 0.2;

        if (verifiedFields[key]) {
          sources[key] = 'customer_tape_verified';
          fieldConfidence[key] = 100;
        } else if (changed) {
          sources[key] = 'customer_corrected';
          fieldConfidence[key] = Math.max(Number(fieldConfidence[key] || 0), 90);
        }
      }

      const verifiedCoreCount = ['chest', 'waist', 'hips'].filter(key => verifiedFields[key]).length;
      const validationStatus = verifiedCoreCount === 3
        ? 'verified'
        : verifiedCoreCount > 0
          ? 'partially_verified'
          : 'reviewed';

      const suggestedSizes = deriveGenericSuggestedSizes(canonicalReviewedMeasurements);

      await onComplete({
        body_scan_front: scans.front,
        body_scan_side: scans.side,
        body_scan_back: scans.back,
        measurement_values_cm: canonicalReviewedMeasurements,
        measurement_scan_values_cm: scanResult.measurementsCm,
        measurement_protocol_version: MEASUREMENT_PROTOCOL_VERSION,
        measurement_reference_standard: MEASUREMENT_PROTOCOL_VERSION,
        measurement_unit: unit,
        measurement_confidence: scanResult.confidence,
        measurement_confidence_by_field: fieldConfidence,
        measurement_sources: sources,
        measurement_validation_status: validationStatus,
        measurement_scan_diagnostics: {
          pose_visibility: scanResult.diagnostics?.pose_visibility,
          silhouette_coverage: scanResult.diagnostics?.silhouette_coverage,
          front_back_width_agreement: scanResult.diagnostics?.front_back_width_agreement,
          orientation_score: scanResult.diagnostics?.orientation_score,
        },
        measurement_method: scanResult.method,
        measurement_updated_at: new Date().toISOString(),
        measurements: buildDisplayMeasurements(
          canonicalReviewedMeasurements,
          unit,
          profile?.measurements || {}
        ),
        suggested_sizes: suggestedSizes,
      });
    } catch (saveError) {
      console.error(saveError);
      setError('The fit profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const allScansComplete = scans.front && scans.side && scans.back;
  const guideMessage = "I'll build your fit profile from three calibrated views, then you'll review the measurements before I use them for sizing.";

  if (scanResult) {
    return (
      <div className="max-w-md mx-auto">
        <ConciergeGuide concierge={concierge} message="I have the scan measurements. Review them now so I know how much confidence to place in future size recommendations." />

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-light text-[#2d2d2d] mb-2"
        >
          Review Your Fit Profile
        </motion.h1>
        <p className="text-[#6b7280] mb-5">
          Scan quality is <strong>{scanResult.confidence}%</strong>. That score reflects image and pose quality; it is not a guarantee that every measurement is exact.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900">Accuracy safeguard</p>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                If you can, verify chest, waist, and hips with a measuring tape. Mark only measurements you actually checked. Verified values receive the highest fit confidence.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 mb-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-medium text-[#2d2d2d]">Measurements</p>
              <p className="text-xs text-[#6b7280]">Edit any value that you know is different.</p>
            </div>
            <div className="flex rounded-xl border border-[#d1d5db] overflow-hidden">
              <button
                type="button"
                onClick={() => handleUnitChange('imperial')}
                className={`px-3 py-2 text-xs ${unit === 'imperial' ? 'bg-[#2d2d2d] text-white' : 'bg-white text-[#6b7280]'}`}
              >
                in
              </button>
              <button
                type="button"
                onClick={() => handleUnitChange('metric')}
                className={`px-3 py-2 text-xs ${unit === 'metric' ? 'bg-[#2d2d2d] text-white' : 'bg-white text-[#6b7280]'}`}
              >
                cm
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-[#2d2d2d]">Height</label>
            <p className="text-sm text-[#6b7280] mt-1">{formatHeight(Number(heightCm), unit)} • customer supplied</p>
          </div>

          <div className="space-y-4">
            {REVIEW_FIELDS.map(field => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[#2d2d2d]">{field.label}</label>
                  <span className="text-[11px] text-[#6b7280]">
                    scan confidence {scanResult.fieldConfidence?.[field.key] ?? scanResult.confidence}%
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={reviewValues[field.key] ?? ''}
                    onChange={(e) => setReviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-[#d1d5db] px-3 pr-12 text-[#2d2d2d]"
                  />
                  <span className="absolute right-3 top-3 text-sm text-[#6b7280]">
                    {unit === 'metric' ? 'cm' : 'in'}
                  </span>
                </div>
                {field.verify && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-[#6b7280] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(verifiedFields[field.key])}
                      onChange={(e) => setVerifiedFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                    />
                    I verified this measurement with a tape
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={clearAnalysis}
            disabled={saving}
            className="h-12 rounded-xl"
          >
            Retake / Recheck
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="h-12 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Confirm & Continue <ArrowRight className="ml-2 w-4 h-4" /></>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <ConciergeGuide concierge={concierge} message={guideMessage} />

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-[#2d2d2d] mb-2"
      >
        Build Your Fit Profile
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[#6b7280] mb-5"
      >
        Three body views are calibrated with your real height. The app rejects weak scans instead of treating them as trustworthy measurements.
      </motion.p>

      <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-5 h-5 text-[#c9a962]" />
          <p className="font-medium text-[#2d2d2d]">Actual height</p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <input
              type="number"
              min={unit === 'metric' ? 80 : 31.5}
              max={unit === 'metric' ? 230 : 91}
              step="0.1"
              value={heightValue}
              onChange={(e) => setHeightValue(e.target.value)}
              placeholder={unit === 'metric' ? 'e.g. 178' : 'e.g. 70'}
              className="w-full h-11 rounded-xl border border-[#d1d5db] px-3 pr-12 text-[#2d2d2d]"
            />
            <span className="absolute right-3 top-3 text-sm text-[#6b7280]">
              {unit === 'metric' ? 'cm' : 'in'}
            </span>
          </div>
          <div className="flex rounded-xl border border-[#d1d5db] overflow-hidden">
            <button
              type="button"
              onClick={() => handleUnitChange('imperial')}
              className={`px-3 text-sm ${unit === 'imperial' ? 'bg-[#2d2d2d] text-white' : 'bg-white text-[#6b7280]'}`}
            >
              in
            </button>
            <button
              type="button"
              onClick={() => handleUnitChange('metric')}
              className={`px-3 text-sm ${unit === 'metric' ? 'bg-[#2d2d2d] text-white' : 'bg-white text-[#6b7280]'}`}
            >
              cm
            </button>
          </div>
        </div>
        <p className="text-xs text-[#6b7280] mt-2">
          Use measured height, not an estimate. Height is the real-world scale reference for the scan.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
        <p className="text-blue-800 text-sm font-medium mb-1">Capture standard</p>
        <p className="text-blue-700 text-xs leading-relaxed">
          Wear fitted clothing, remove bulky outerwear and shoes, use even lighting and a plain contrasting background. Keep the phone vertical and level around waist-to-chest height, avoid wide-angle mode, keep the full body in frame, and do not move the camera between views.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-center gap-4 mb-8">
        {scanSteps.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setCurrentScan(step.key)}
            className={`flex flex-col items-center gap-2 transition-all ${currentScan === step.key ? 'scale-110' : 'opacity-60'}`}
          >
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              scans[step.key]
                ? 'bg-[#c9a962]'
                : currentScan === step.key
                  ? 'bg-white ring-2 ring-[#c9a962] shadow-sm'
                  : 'bg-[#e5e7eb]'
            }`}>
              {scans[step.key] ? <Check className="w-6 h-6 text-white" /> : <Camera className="w-6 h-6 text-[#6b7280]" />}
            </div>
            <span className="text-[#6b7280] text-xs">{step.label}</span>
          </button>
        ))}
      </div>

      <div className="relative aspect-[3/4] bg-white rounded-2xl overflow-hidden mb-6 shadow-sm border border-[#e5e7eb]">
        {scans[currentScan] ? (
          <>
            {scanPreviews[currentScan] ? (
              <img
                src={scanPreviews[currentScan]}
                alt={`${currentScan} body scan`}
                className="w-full h-full object-contain bg-[#faf8f5]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#faf8f5]">
                <Loader2 className="w-6 h-6 animate-spin text-[#c9a962]" />
              </div>
            )}
            <button
              type="button"
              aria-label={`Retake ${currentScan} photo`}
              onClick={() => {
                clearAnalysis();
                setScans(prev => ({ ...prev, [currentScan]: null }));
                setScanPreviews(prev => {
                  const next = { ...prev };
                  delete next[currentScan];
                  return next;
                });
              }}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#faf8f5]">
            <div className="w-32 h-48 border-2 border-dashed border-[#d1d5db] rounded-lg mb-6 flex items-center justify-center">
              <span className="text-[#9ca3af] text-6xl">{currentScan === 'side' ? '🚶' : '🧍'}</span>
            </div>
            <p className="text-[#6b7280] text-center text-sm">
              {scanSteps.find(step => step.key === currentScan)?.instruction}
            </p>
          </div>
        )}
      </div>

      {!scans[currentScan] ? (
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-14 bg-white hover:bg-[#f5f5f5] text-[#2d2d2d] rounded-xl font-medium text-base border border-[#e5e7eb] shadow-sm"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Camera className="mr-2 w-5 h-5" />
              Capture {scanSteps.find(step => step.key === currentScan)?.label}
            </>
          )}
        </Button>
      ) : !allScansComplete ? (
        <p className="text-center text-[#9ca3af] text-sm">Choose the next view above to continue</p>
      ) : (
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !heightCm}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Checking scan quality...
            </>
          ) : (
            <>
              Analyze Measurements
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
