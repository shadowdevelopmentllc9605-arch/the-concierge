import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { resolveFileUrl } from '@/lib/privateFiles';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';

const CARD_LONG_EDGE_CM = 8.56;

const FOOT_POINTS = [
  'Tap one end of the card’s LONG edge',
  'Tap the other end of the card’s LONG edge',
  'Tap the back of your heel',
  'Tap the tip of your longest toe',
  'Tap one edge of the widest part of your forefoot',
  'Tap the opposite edge of the widest part of your forefoot',
];

const HEAD_FRONT_POINTS = [
  'Tap one end of the card’s LONG edge',
  'Tap the other end of the card’s LONG edge',
  'Tap the left edge of your head at hat-band level',
  'Tap the right edge of your head at hat-band level',
];

const HEAD_SIDE_POINTS = [
  'Tap one end of the card’s LONG edge',
  'Tap the other end of the card’s LONG edge',
  'Tap the front edge of your head at hat-band level',
  'Tap the back edge of your head at hat-band level',
];

function distancePx(a, b, image) {
  if (!a || !b || !image?.naturalWidth || !image?.naturalHeight) return null;
  const dx = (a.x - b.x) * image.naturalWidth;
  const dy = (a.y - b.y) * image.naturalHeight;
  return Math.sqrt(dx * dx + dy * dy);
}

function calibratedDistance(points, startIndex, endIndex, image) {
  const cardPx = distancePx(points[0], points[1], image);
  const targetPx = distancePx(points[startIndex], points[endIndex], image);
  if (!(cardPx > 0) || !(targetPx > 0)) return null;
  return targetPx * (CARD_LONG_EDGE_CM / cardPx);
}

function ellipseCircumference(widthCm, depthCm) {
  if (!(widthCm > 0) || !(depthCm > 0)) return null;
  const a = widthCm / 2;
  const b = depthCm / 2;
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function calibrationConfidence(points, image) {
  const cardPx = distancePx(points[0], points[1], image);
  if (!(cardPx > 0) || !image?.naturalWidth || !image?.naturalHeight) return 0;
  const shortestSide = Math.min(image.naturalWidth, image.naturalHeight);
  const coverage = cardPx / shortestSide;
  const resolution = Math.min(1, shortestSide / 1200);
  const score = 78 + Math.min(8, coverage * 40) + resolution * 6;
  return Math.round(Math.max(70, Math.min(92, score)));
}

function AnnotationImage({ src, points, onPoint, labels, imageRef }) {
  return (
    <div className="space-y-3">
      <div
        className="relative bg-black rounded-2xl overflow-hidden cursor-crosshair"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          onPoint({ x, y });
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt="Precision measurement"
          className="w-full max-h-[62vh] object-contain"
        />
        {points.map((point, index) => (
          <div
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          >
            <div className="w-6 h-6 rounded-full bg-white border-2 border-black flex items-center justify-center text-[10px] font-bold">
              {index + 1}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-[var(--color-background-secondary)] p-3">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {points.length < labels.length ? labels[points.length] : 'All points marked'}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Tap carefully. You can reset and mark the points again if needed.
        </p>
      </div>
    </div>
  );
}

export default function PrecisionScan() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get('mode');
  const returnTo = params.get('return') || 'Profile';
  const productId = params.get('product');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(requestedMode === 'head' || requestedMode === 'feet' ? requestedMode : '');
  const [stage, setStage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [points, setPoints] = useState([]);
  const [results, setResults] = useState(/** @type {Record<string, any>} */ ({}));
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
        setProfile(profiles[0] || null);
      } catch (loadError) {
        console.error(loadError);
        setError('Your measurement profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mode) setStage('');
    else if (mode === 'feet') setStage('left_foot');
    else setStage('head_front');
    setPhotoUri('');
    setPhotoUrl('');
    setPoints([]);
    setResults({});
  }, [mode]);

  const currentLabels = useMemo(() => {
    if (stage === 'left_foot' || stage === 'right_foot') return FOOT_POINTS;
    if (stage === 'head_front') return HEAD_FRONT_POINTS;
    if (stage === 'head_side') return HEAD_SIDE_POINTS;
    return [];
  }, [stage]);

  const instruction = useMemo(() => {
    if (stage === 'left_foot' || stage === 'right_foot') {
      const side = stage === 'left_foot' ? 'left' : 'right';
      return `Photograph your bare ${side} foot from directly above. Put a plain ID-sized gift/loyalty card flat on the floor beside the foot. Keep the phone level so the card and foot are on the same plane.`;
    }
    if (stage === 'head_front') {
      return 'Take a close front photo from eye level. Keep hair clear of the hat line. Hold a plain ID-sized card vertically beside your temple, with the card at the same distance from the camera as the sides of your head.';
    }
    if (stage === 'head_side') {
      return 'Take a true 90° side photo from eye level. Hold the same plain card vertically at temple depth. Keep hair compressed/clear enough to show the actual head outline.';
    }
    return '';
  }, [stage]);

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const signed = await resolveFileUrl(file_uri);
      setPhotoUri(file_uri);
      setPhotoUrl(signed);
      setPoints([]);
    } catch (uploadError) {
      console.error(uploadError);
      setError('That precision photo could not be uploaded.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const acceptStage = () => {
    if (points.length !== currentLabels.length || !imageRef.current) return;
    const confidence = calibrationConfidence(points, imageRef.current);

    if (stage === 'left_foot' || stage === 'right_foot') {
      const length = calibratedDistance(points, 2, 3, imageRef.current);
      const width = calibratedDistance(points, 4, 5, imageRef.current);
      if (!(length >= 15 && length <= 36) || !(width >= 5 && width <= 16)) {
        setError('Those marks produced an implausible foot measurement. Reset the points and check the card edge, heel, toe, and widest forefoot.');
        return;
      }
      const key = stage === 'left_foot' ? 'left' : 'right';
      setResults(prev => ({
        ...prev,
        [key]: { length, width, confidence, uri: photoUri }
      }));
      setStage(stage === 'left_foot' ? 'right_foot' : 'complete_feet');
    } else if (stage === 'head_front') {
      const width = calibratedDistance(points, 2, 3, imageRef.current);
      if (!(width >= 11 && width <= 24)) {
        setError('Those marks produced an implausible head width. Reset the points and check the card and head-edge marks.');
        return;
      }
      setResults(prev => ({ ...prev, headFront: { width, confidence, uri: photoUri } }));
      setStage('head_side');
    } else if (stage === 'head_side') {
      const depth = calibratedDistance(points, 2, 3, imageRef.current);
      if (!(depth >= 14 && depth <= 28)) {
        setError('Those marks produced an implausible head depth. Reset the points and check the card and head-edge marks.');
        return;
      }
      setResults(prev => ({ ...prev, headSide: { depth, confidence, uri: photoUri } }));
      setStage('complete_head');
    }

    setPhotoUri('');
    setPhotoUrl('');
    setPoints([]);
    setError('');
  };

  const savePrecision = async () => {
    if (!profile?.id) return;
    setSaving(true);
    setError('');
    try {
      const measurements = { ...(profile.measurement_values_cm || {}) };
      const sources = { ...(profile.measurement_sources || {}) };
      const confidenceByField = { ...(profile.measurement_confidence_by_field || {}) };
      const metadata = { ...(profile.precision_measurement_metadata || {}) };
      const update = {};

      if (mode === 'feet') {
        const left = results.left;
        const right = results.right;
        if (!left || !right) throw new Error('Both foot photos are required for the precision foot scan.');

        const length = Math.max(left.length, right.length);
        const width = Math.max(left.width, right.width);
        const confidence = Math.min(left.confidence, right.confidence);

        measurements.foot_length = Number(length.toFixed(1));
        measurements.foot_width = Number(width.toFixed(1));
        sources.foot_length = 'precision_photo_card_calibrated';
        sources.foot_width = 'precision_photo_card_calibrated';
        confidenceByField.foot_length = confidence;
        confidenceByField.foot_width = Math.max(70, confidence - 4);

        update.precision_scan_foot_left = left.uri;
        update.precision_scan_foot_right = right.uri;
        Object.assign(metadata, {
          reference_type: 'ISO_ID1_long_edge',
          reference_length_cm: CARD_LONG_EDGE_CM,
          foot_left_length_cm: Number(left.length.toFixed(1)),
          foot_left_width_cm: Number(left.width.toFixed(1)),
          foot_right_length_cm: Number(right.length.toFixed(1)),
          foot_right_width_cm: Number(right.width.toFixed(1)),
          foot_confidence: confidence,
          updated_at: new Date().toISOString(),
        });
      } else {
        const front = results.headFront;
        const side = results.headSide;
        if (!front || !side) throw new Error('Front and side head photos are required for the precision head scan.');

        const circumference = ellipseCircumference(front.width, side.depth);
        if (!(circumference >= 40 && circumference <= 75)) {
          throw new Error('The calibrated photos produced an implausible head circumference. Retake the close-ups and keep the card at head depth.');
        }
        const confidence = Math.min(front.confidence, side.confidence);
        measurements.head_circumference = Number(circumference.toFixed(1));
        sources.head_circumference = 'precision_photo_card_calibrated';
        confidenceByField.head_circumference = confidence;

        update.precision_scan_head_front = front.uri;
        update.precision_scan_head_side = side.uri;
        Object.assign(metadata, {
          reference_type: 'ISO_ID1_long_edge',
          reference_length_cm: CARD_LONG_EDGE_CM,
          head_width_cm: Number(front.width.toFixed(1)),
          head_depth_cm: Number(side.depth.toFixed(1)),
          head_confidence: confidence,
          updated_at: new Date().toISOString(),
        });
      }

      await base44.entities.UserProfile.update(profile.id, {
        ...update,
        measurement_values_cm: measurements,
        measurement_sources: sources,
        measurement_confidence_by_field: confidenceByField,
        precision_measurement_metadata: metadata,
        measurement_updated_at: new Date().toISOString(),
        measurement_method: 'photo_first_plus_calibrated_precision',
      });

      navigate(productId ? createPageUrl(`ProductDetail?id=${productId}`) : createPageUrl(returnTo));
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.message || 'The precision measurement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  const complete = stage === 'complete_feet' || stage === 'complete_head';

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      <div className="max-w-xl mx-auto px-5 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-light text-[var(--color-text-primary)]">Precision Photo Scan</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Use close-up photos when the full-body scan does not have enough detail for footwear or headwear. No tape measure is required.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-900">
              Use a plain gift, loyalty, or other ID-1-sized card as the scale reference. Do not expose payment-card numbers, ID numbers, names, photos, or other sensitive information. Cover them completely if necessary.
            </div>
          </div>
        </div>

        {!mode && (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Button onClick={() => setMode('feet')} className="h-16">Improve Foot Fit</Button>
            <Button onClick={() => setMode('head')} variant="outline" className="h-16">Improve Hat Fit</Button>
          </div>
        )}

        {mode && !complete && (
          <div className="mt-6">
            <div className="rounded-2xl bg-[var(--color-surface)] p-4 mb-4">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {stage === 'left_foot' ? 'Left Foot' : stage === 'right_foot' ? 'Right Foot' : stage === 'head_front' ? 'Head — Front' : 'Head — Side'}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">{instruction}</p>
            </div>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            {!photoUrl ? (
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full h-14">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5 mr-2" />Take / Choose Photo</>}
              </Button>
            ) : (
              <>
                <AnnotationImage
                  src={photoUrl}
                  points={points}
                  onPoint={(point) => {
                    if (points.length < currentLabels.length) setPoints(prev => [...prev, point]);
                  }}
                  labels={currentLabels}
                  imageRef={imageRef}
                />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button variant="outline" onClick={() => setPoints([])}>
                    <RotateCcw className="w-4 h-4 mr-2" />Reset Points
                  </Button>
                  <Button onClick={acceptStage} disabled={points.length !== currentLabels.length}>
                    Save This Photo
                  </Button>
                </div>
              </>
            )}

            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          </div>
        )}

        {complete && (
          <div className="mt-7 rounded-2xl bg-[var(--color-surface)] p-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <h2 className="mt-3 text-xl font-medium text-[var(--color-text-primary)]">
              Precision photos complete
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              The calibrated close-up measurement will replace the lower-confidence full-body estimate for this fit category.
            </p>
            <Button onClick={savePrecision} disabled={saving} className="w-full h-12 mt-5">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Precision Measurement'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
