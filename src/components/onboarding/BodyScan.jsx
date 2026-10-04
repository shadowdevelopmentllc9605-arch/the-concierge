import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Camera, Check, ArrowRight, Loader2, RotateCcw, AlertCircle, Ruler } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';
import { measureBodyFromImages } from '@/lib/bodyMeasurement';
import { formatHeight, formatLength, parseHeightToCm } from '@/lib/measurementUnits';
import { resolveFileUrl } from '@/lib/privateFiles';
import { deriveGenericSuggestedSizes } from '@/lib/fitRecommendation';

function buildDisplayMeasurements(valuesCm, unit) {
  return {
    height: formatHeight(valuesCm.height, unit),
    chest: formatLength(valuesCm.chest, unit),
    waist: formatLength(valuesCm.waist, unit),
    hips: formatLength(valuesCm.hips, unit),
    shoulders: formatLength(valuesCm.shoulders, unit),
    arm_length: formatLength(valuesCm.arm_length, unit),
  };
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
  const [error, setError] = useState('');
  const [scanQuality, setScanQuality] = useState(null);
  const [scanPreviews, setScanPreviews] = useState({});
  const fileInputRef = useRef(null);

  // Resolve stored scan references (private files) to short-lived signed URLs for display.
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
    { key: 'front', label: 'Front View', instruction: 'Full body visible, facing camera, fitted clothing, arms slightly away from your sides' },
    { key: 'side', label: 'Side View', instruction: 'Turn exactly 90°, full body visible, arms relaxed, same camera distance' },
    { key: 'back', label: 'Back View', instruction: 'Full body visible, facing away. Saved for future fit features; front and side drive measurements today.' }
  ];

  const heightCm = useMemo(() => {
    const numeric = Number(heightValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return unit === 'metric' ? numeric : numeric * 2.54;
  }, [heightValue, unit]);

  const handleUnitChange = (nextUnit) => {
    if (nextUnit === unit) return;
    const currentHeightCm = heightCm;
    setUnit(nextUnit);
    if (currentHeightCm) {
      setHeightValue(
        nextUnit === 'metric'
          ? currentHeightCm.toFixed(1)
          : (currentHeightCm / 2.54).toFixed(1)
      );
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setScanQuality(null);
    try {
      // Body scans are intimate photos: store privately, render only via short-lived signed URLs.
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

  const handleComplete = async () => {
    if (!scans.front || !scans.side || !scans.back) return;
    if (!heightCm || heightCm < 120 || heightCm > 230) {
      setError('Enter your actual height so the photos can be calibrated to real-world measurements.');
      return;
    }

    setAnalyzing(true);
    setError('');
    try {
      const [frontUrl, sideUrl] = await Promise.all([
        resolveFileUrl(scans.front),
        resolveFileUrl(scans.side),
      ]);
      const result = await measureBodyFromImages({
        frontUrl,
        sideUrl,
        heightCm,
      });

      setScanQuality(result.confidence);

      const suggestedSizes = deriveGenericSuggestedSizes(result.measurementsCm);

      await onComplete({
        body_scan_front: scans.front,
        body_scan_side: scans.side,
        body_scan_back: scans.back,
        measurement_values_cm: result.measurementsCm,
        measurement_unit: unit,
        measurement_confidence: result.confidence,
        measurement_method: result.method,
        measurement_updated_at: new Date().toISOString(),
        measurements: buildDisplayMeasurements(result.measurementsCm, unit),
        suggested_sizes: suggestedSizes,
      });
    } catch (measurementError) {
      console.error(measurementError);
      setError(
        measurementError?.message ||
        'We could not get a reliable measurement from these photos. Retake the front and side views.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const allScansComplete = scans.front && scans.side && scans.back;
  const guideMessage = "I'll use your real height plus front and side photos to estimate your measurements. You'll be able to review or correct them.";

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
        Front and side photos are calibrated with your real height. Results are estimates and can be corrected anytime.
      </motion.p>

      <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-5 h-5 text-[#c9a962]" />
          <p className="font-medium text-[#2d2d2d]">Your height</p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <input
              type="number"
              min={unit === 'metric' ? 120 : 47}
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
          Accurate height calibration matters more than camera distance. Use your known height, not an estimate.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-sm font-semibold">On device</p>
          <p className="text-[#6b7280] text-xs">Pose analysis</p>
        </div>
        <div className="bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-sm font-semibold">2 units</p>
          <p className="text-[#6b7280] text-xs">Metric + imperial</p>
        </div>
        <div className="bg-[#f8f5f0] rounded-xl p-3 text-center">
          <p className="text-[#c9a962] text-sm font-semibold">Reviewable</p>
          <p className="text-[#6b7280] text-xs">Correct anytime</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
        <p className="text-blue-800 text-sm font-medium mb-1">For better results</p>
        <p className="text-blue-700 text-xs leading-relaxed">
          Use a plain background, fitted clothing, even lighting, the same camera position for front and side, and keep your entire body in frame.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {scanQuality != null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-medium text-emerald-800">Scan quality: {scanQuality}%</p>
          <p className="text-xs text-emerald-700 mt-1">
            This is an image-quality/confidence score, not a guarantee of measurement accuracy.
          </p>
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
          onClick={handleComplete}
          disabled={analyzing || !heightCm}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Measuring...
            </>
          ) : (
            <>
              Measure & Continue
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