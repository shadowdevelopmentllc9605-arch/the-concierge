import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

const MIN_HEIGHT_CM = 80;
const MAX_HEIGHT_CM = 230;
const MASK_THRESHOLD = 0.5;
const MIN_POSE_VISIBILITY = 0.62;

let landmarkerPromise;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.65,
        minPosePresenceConfidence: 0.65,
        outputSegmentationMasks: true,
      });
    })();
  }
  return landmarkerPromise;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load body scan image.'));
    image.src = url;
  });
}

function maskToArray(mask) {
  if (!mask) return null;
  try {
    const values = mask.getAsFloat32Array?.();
    if (!values) return null;
    return { values, width: mask.width, height: mask.height };
  } catch {
    return null;
  }
}

function getBoundingBox(mask, threshold = MASK_THRESHOLD) {
  if (!mask?.values?.length || !mask.width || !mask.height) return null;
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < mask.height; y += 1) {
    const offset = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.values[offset + x] >= threshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return maxX >= minX && maxY >= minY
    ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
}

function rowSpanAroundCenter(mask, yNormalized, xNormalized, threshold = MASK_THRESHOLD) {
  if (!mask?.values?.length || !mask.width || !mask.height) return null;
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(yNormalized * (mask.height - 1))));
  const offset = y * mask.width;
  const targetX = Math.max(0, Math.min(mask.width - 1, Math.round(xNormalized * (mask.width - 1))));

  let seed = -1;
  for (let radius = 0; radius < Math.ceil(mask.width * 0.18); radius += 1) {
    const candidates = radius === 0 ? [targetX] : [targetX - radius, targetX + radius];
    seed = candidates.find(x => x >= 0 && x < mask.width && mask.values[offset + x] >= threshold) ?? -1;
    if (seed >= 0) break;
  }
  if (seed < 0) return null;

  let left = seed;
  let right = seed;
  while (left > 0 && mask.values[offset + left - 1] >= threshold) left -= 1;
  while (right < mask.width - 1 && mask.values[offset + right + 1] >= threshold) right += 1;
  return right - left + 1;
}

function distance2d(a, b, width, height) {
  if (!a || !b) return null;
  const dx = (a.x - b.x) * width;
  const dy = (a.y - b.y) * height;
  return Math.sqrt(dx * dx + dy * dy);
}

function ellipseCircumference(widthCm, depthCm) {
  if (!(widthCm > 0) || !(depthCm > 0)) return null;
  const a = widthCm / 2;
  const b = depthCm / 2;
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function avgVisibility(landmarks, indices) {
  const values = indices
    .map(index => landmarks[index]?.visibility)
    .filter(value => Number.isFinite(value));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function closeMask(mask) {
  try {
    mask?.close?.();
  } catch {
    // no-op
  }
}

function torsoFrame(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipX = (leftHip.x + rightHip.x) / 2;
  return {
    shoulderY,
    hipY,
    shoulderX,
    hipX,
    torso: hipY - shoulderY,
  };
}

function crossSectionAtFraction(view, scale, fraction) {
  const frame = view.frame;
  const y = frame.shoulderY + frame.torso * fraction;
  const centerFraction = Math.max(0, Math.min(1, fraction));
  const x = frame.shoulderX + (frame.hipX - frame.shoulderX) * centerFraction;
  const pixels = rowSpanAroundCenter(view.mask, y, x);
  return pixels ? pixels * scale : null;
}

function selectCrossSection(front, side, back, scales, startFraction, endFraction, mode) {
  const candidates = [];
  for (let fraction = startFraction; fraction <= endFraction + 0.0001; fraction += 0.025) {
    const frontWidth = crossSectionAtFraction(front, scales.front, fraction);
    const backWidth = crossSectionAtFraction(back, scales.back, fraction);
    const sideDepth = crossSectionAtFraction(side, scales.side, fraction);
    const widths = [frontWidth, backWidth].filter(Number.isFinite);
    if (!widths.length || !Number.isFinite(sideDepth)) continue;
    const width = widths.reduce((sum, value) => sum + value, 0) / widths.length;
    const circumference = ellipseCircumference(width, sideDepth);
    if (Number.isFinite(circumference)) {
      candidates.push({ fraction, circumference, frontWidth, backWidth, sideDepth, width });
    }
  }
  if (!candidates.length) return null;
  return candidates.reduce((best, candidate) => {
    if (!best) return candidate;
    return mode === 'min'
      ? (candidate.circumference < best.circumference ? candidate : best)
      : (candidate.circumference > best.circumference ? candidate : best);
  }, null);
}

function maskValueAt(mask, yNormalized, xNormalized) {
  if (!mask?.values?.length || !mask.width || !mask.height) return 0;
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(yNormalized * (mask.height - 1))));
  const x = Math.max(0, Math.min(mask.width - 1, Math.round(xNormalized * (mask.width - 1))));
  return mask.values[y * mask.width + x] || 0;
}

function hasForegroundBetween(mask, yNormalized, xStart, xEnd, threshold = MASK_THRESHOLD) {
  if (!mask?.values?.length) return false;
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(yNormalized * (mask.height - 1))));
  const start = Math.max(0, Math.min(mask.width - 1, Math.round(Math.min(xStart, xEnd) * (mask.width - 1))));
  const end = Math.max(0, Math.min(mask.width - 1, Math.round(Math.max(xStart, xEnd) * (mask.width - 1))));
  const offset = y * mask.width;
  for (let x = start; x <= end; x += 1) {
    if (mask.values[offset + x] >= threshold) return true;
  }
  return false;
}

function detectCrotchY(view) {
  const { landmarks, mask } = view;
  const hipY = (landmarks[23].y + landmarks[24].y) / 2;
  const kneeY = (landmarks[25].y + landmarks[26].y) / 2;
  const centerX = (landmarks[23].x + landmarks[24].x) / 2;
  const leftX = Math.min(landmarks[23].x, landmarks[24].x);
  const rightX = Math.max(landmarks[23].x, landmarks[24].x);
  const hipSpan = Math.max(0.08, rightX - leftX);

  for (let y = hipY + 0.015; y < kneeY - 0.02; y += 0.003) {
    const centerIsBackground = maskValueAt(mask, y, centerX) < MASK_THRESHOLD;
    if (!centerIsBackground) continue;
    const leftLegPresent = hasForegroundBetween(mask, y, centerX - hipSpan * 1.4, centerX - 0.015);
    const rightLegPresent = hasForegroundBetween(mask, y, centerX + 0.015, centerX + hipSpan * 1.4);
    if (leftLegPresent && rightLegPresent) {
      return Math.max(hipY, y - 0.012);
    }
  }
  return null;
}

function legWidthAtFraction(view, scale, kneeIndex, ankleIndex, fraction) {
  const knee = view.landmarks[kneeIndex];
  const ankle = view.landmarks[ankleIndex];
  if (!knee || !ankle) return null;
  const y = knee.y + (ankle.y - knee.y) * fraction;
  const x = knee.x + (ankle.x - knee.x) * fraction;
  const pixels = rowSpanAroundCenter(view.mask, y, x);
  return pixels ? pixels * scale : null;
}

function estimateCalfCircumference(front, side, back, scales) {
  const candidates = [];
  for (let fraction = 0.18; fraction <= 0.72; fraction += 0.04) {
    const frontalWidths = [
      legWidthAtFraction(front, scales.front, 25, 27, fraction),
      legWidthAtFraction(front, scales.front, 26, 28, fraction),
      legWidthAtFraction(back, scales.back, 25, 27, fraction),
      legWidthAtFraction(back, scales.back, 26, 28, fraction),
    ].filter(Number.isFinite);
    const sideDepths = [
      legWidthAtFraction(side, scales.side, 25, 27, fraction),
      legWidthAtFraction(side, scales.side, 26, 28, fraction),
    ].filter(Number.isFinite);
    if (!frontalWidths.length || !sideDepths.length) continue;
    const width = frontalWidths.reduce((sum, value) => sum + value, 0) / frontalWidths.length;
    const depth = sideDepths.reduce((sum, value) => sum + value, 0) / sideDepths.length;
    const circumference = ellipseCircumference(width, depth);
    if (Number.isFinite(circumference)) candidates.push(circumference);
  }
  return candidates.length ? Math.max(...candidates) : null;
}

function imageScaleCmPerPixel(view, heightCm) {
  const imageToMaskY = view.image.naturalHeight / view.mask.height;
  return heightCm / Math.max(1, view.box.height * imageToMaskY);
}

function estimateFootLength(side, heightCm) {
  const scale = imageScaleCmPerPixel(side, heightCm);
  const values = [
    distance2d(side.landmarks[29], side.landmarks[31], side.image.naturalWidth, side.image.naturalHeight),
    distance2d(side.landmarks[30], side.landmarks[32], side.image.naturalWidth, side.image.naturalHeight),
  ]
    .filter(Number.isFinite)
    .map(value => value * scale)
    .filter(value => value >= 15 && value <= 36);
  return values.length ? Math.max(...values) : null;
}

function estimateFootWidth(front, scale) {
  const footSpecs = [[29, 31], [30, 32]];
  const widths = [];
  for (const [heelIndex, toeIndex] of footSpecs) {
    const heel = front.landmarks[heelIndex];
    const toe = front.landmarks[toeIndex];
    if (!heel || !toe) continue;
    for (let fraction = 0.45; fraction <= 0.9; fraction += 0.1) {
      const y = heel.y + (toe.y - heel.y) * fraction;
      const x = heel.x + (toe.x - heel.x) * fraction;
      const pixels = rowSpanAroundCenter(front.mask, y, x);
      if (pixels) widths.push(pixels * scale);
    }
  }
  const plausible = widths.filter(value => value >= 5 && value <= 16);
  return plausible.length ? Math.max(...plausible) : null;
}

function estimateHeadCircumference(front, side, back, scales) {
  const earYFront = (front.landmarks[7]?.y + front.landmarks[8]?.y) / 2;
  const earYSide = (side.landmarks[7]?.y + side.landmarks[8]?.y) / 2;
  const earYBack = (back.landmarks[7]?.y + back.landmarks[8]?.y) / 2;
  const earXFront = (front.landmarks[7]?.x + front.landmarks[8]?.x) / 2;
  const earXSide = (side.landmarks[7]?.x + side.landmarks[8]?.x) / 2;
  const earXBack = (back.landmarks[7]?.x + back.landmarks[8]?.x) / 2;
  if (![earYFront, earYSide, earYBack, earXFront, earXSide, earXBack].every(Number.isFinite)) return null;

  const frontWidth = rowSpanAroundCenter(front.mask, earYFront, earXFront);
  const backWidth = rowSpanAroundCenter(back.mask, earYBack, earXBack);
  const sideDepth = rowSpanAroundCenter(side.mask, earYSide, earXSide);
  const widths = [
    frontWidth ? frontWidth * scales.front : null,
    backWidth ? backWidth * scales.back : null,
  ].filter(Number.isFinite);
  if (!widths.length || !sideDepth) return null;
  const width = widths.reduce((sum, value) => sum + value, 0) / widths.length;
  return ellipseCircumference(width, sideDepth * scales.side);
}

function plausibleOrNull(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function orientationMetrics(landmarks) {
  const shoulderSep = Math.abs((landmarks[11]?.x ?? 0) - (landmarks[12]?.x ?? 0));
  const hipSep = Math.abs((landmarks[23]?.x ?? 0) - (landmarks[24]?.x ?? 0));
  const shoulderTilt = Math.abs((landmarks[11]?.y ?? 0) - (landmarks[12]?.y ?? 0));
  const hipTilt = Math.abs((landmarks[23]?.y ?? 0) - (landmarks[24]?.y ?? 0));
  return { shoulderSep, hipSep, shoulderTilt, hipTilt };
}

function scanCoverage(box, mask) {
  if (!box || !mask?.height) return 0;
  return Math.min(1, box.height / mask.height);
}

function relativeAgreement(a, b) {
  if (!(a > 0) || !(b > 0)) return 0;
  return Math.max(0, 1 - Math.abs(a - b) / ((a + b) / 2));
}

function clampScore(value) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function assertPlausible(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`The scan produced an implausible ${name} measurement. Retake the photos with the camera level and your full body visible.`);
  }
}

async function analyzeView(url, landmarker) {
  const image = await loadImage(url);
  const result = landmarker.detect(image);
  const landmarks = result.landmarks?.[0];
  const rawMask = result.segmentationMasks?.[0]?.clone?.();
  result.close?.();

  if (!landmarks || !rawMask) {
    closeMask(rawMask);
    throw new Error('A full body could not be detected in one of the photos.');
  }

  const mask = maskToArray(rawMask);
  const box = getBoundingBox(mask);
  if (!mask || !box || box.height < 50) {
    closeMask(rawMask);
    throw new Error('The full-body outline could not be isolated. Use a plain background and fitted clothing.');
  }

  return {
    image,
    landmarks,
    rawMask,
    mask,
    box,
    frame: torsoFrame(landmarks),
    orientation: orientationMetrics(landmarks),
    coverage: scanCoverage(box, mask),
  };
}

export async function measureBodyFromImages({ frontUrl, sideUrl, backUrl, heightCm }) {
  if (!frontUrl || !sideUrl || !backUrl) {
    throw new Error('Front, side, and back photos are required.');
  }

  const numericHeight = Number(heightCm);
  if (!Number.isFinite(numericHeight) || numericHeight < MIN_HEIGHT_CM || numericHeight > MAX_HEIGHT_CM) {
    throw new Error('Enter your real height before measuring.');
  }

  const landmarker = await getLandmarker();
  let front;
  let side;
  let back;

  try {
    [front, side, back] = await Promise.all([
      analyzeView(frontUrl, landmarker),
      analyzeView(sideUrl, landmarker),
      analyzeView(backUrl, landmarker),
    ]);

    const keyIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const frontVisibility = avgVisibility(front.landmarks, keyIndices);
    const sideVisibility = avgVisibility(side.landmarks, [11, 12, 23, 24, 25, 26, 27, 28, 29, 30]);
    const backVisibility = avgVisibility(back.landmarks, keyIndices);
    const poseVisibility = Math.min(frontVisibility, sideVisibility, backVisibility);

    if (poseVisibility < MIN_POSE_VISIBILITY) {
      throw new Error('Pose detection quality is too low. Retake the photos with even lighting and the full body unobstructed.');
    }

    if (front.orientation.shoulderTilt > 0.055 || front.orientation.hipTilt > 0.055) {
      throw new Error('The front photo is tilted or your stance is uneven. Keep the camera level and stand straight.');
    }
    if (back.orientation.shoulderTilt > 0.06 || back.orientation.hipTilt > 0.06) {
      throw new Error('The back photo is tilted or your stance is uneven. Keep the camera level and stand straight.');
    }

    const frontSideShoulderRatio = side.orientation.shoulderSep / Math.max(front.orientation.shoulderSep, 0.001);
    const frontSideHipRatio = side.orientation.hipSep / Math.max(front.orientation.hipSep, 0.001);
    if (frontSideShoulderRatio > 0.72 && frontSideHipRatio > 0.72) {
      throw new Error('The side photo is not close enough to 90°. Turn fully sideways and retake it.');
    }

    const silhouetteCoverage = Math.min(front.coverage, side.coverage, back.coverage);
    if (silhouetteCoverage < 0.58) {
      throw new Error('Your body is too small in the frame. Move closer while keeping your entire body visible.');
    }

    const frontScale = numericHeight / front.box.height;
    const sideScale = numericHeight / side.box.height;
    const backScale = numericHeight / back.box.height;

    const scales = { front: frontScale, side: sideScale, back: backScale };
    const chestSection = selectCrossSection(front, side, back, scales, 0.14, 0.34, 'max');
    const bustSection = selectCrossSection(front, side, back, scales, 0.20, 0.46, 'max');
    const underbustSection = selectCrossSection(front, side, back, scales, 0.36, 0.56, 'min');
    const waistSection = selectCrossSection(front, side, back, scales, 0.48, 0.82, 'min');
    const hipSection = selectCrossSection(front, side, back, scales, 0.88, 1.18, 'max');
    const neckSection = selectCrossSection(front, side, back, scales, -0.18, -0.02, 'min');

    if (!chestSection || !waistSection || !hipSection) {
      throw new Error('The torso outline was not clear enough to locate chest, waist, and hip cross-sections. Retake the photos in fitted clothing.');
    }

    const chest = chestSection.circumference;
    const bust = plausibleOrNull(bustSection?.circumference, 45, 200);
    const underbust = plausibleOrNull(underbustSection?.circumference, 40, 180);
    const waist = waistSection.circumference;
    const hips = hipSection.circumference;
    const neck = plausibleOrNull(neckSection?.circumference, 20, 70);
    const crotchY = detectCrotchY(front);
    const crotchPixelY = Number.isFinite(crotchY)
      ? crotchY * (front.mask.height - 1)
      : null;
    const inseam = plausibleOrNull(
      Number.isFinite(crotchPixelY)
        ? (front.box.maxY - crotchPixelY) * frontScale
        : null,
      35,
      125
    );
    const calfCircumference = plausibleOrNull(
      estimateCalfCircumference(front, side, back, scales),
      20,
      75
    );
    const footLength = plausibleOrNull(estimateFootLength(side, numericHeight), 15, 36);
    const footWidth = plausibleOrNull(estimateFootWidth(front, frontScale), 5, 16);
    const headCircumference = plausibleOrNull(
      estimateHeadCircumference(front, side, back, scales),
      40,
      75
    );

    const frontWidthCm = {
      chest: chestSection.frontWidth,
      waist: waistSection.frontWidth,
      hips: hipSection.frontWidth,
    };
    const backWidthCm = {
      chest: chestSection.backWidth,
      waist: waistSection.backWidth,
      hips: hipSection.backWidth,
    };

    const leftShoulder = front.landmarks[11];
    const rightShoulder = front.landmarks[12];
    const leftElbow = front.landmarks[13];
    const leftWrist = front.landmarks[15];

    const shoulderPixels = distance2d(
      leftShoulder,
      rightShoulder,
      front.image.naturalWidth,
      front.image.naturalHeight
    );
    const imageToMaskY = front.image.naturalHeight / front.mask.height;
    const shoulderScale = numericHeight / Math.max(1, front.box.height * imageToMaskY);

    const upperArm = distance2d(
      leftShoulder,
      leftElbow,
      front.image.naturalWidth,
      front.image.naturalHeight
    );
    const forearm = distance2d(
      leftElbow,
      leftWrist,
      front.image.naturalWidth,
      front.image.naturalHeight
    );

    const measurements = {
      height: numericHeight,
      chest: chest ? Number(chest.toFixed(1)) : null,
      bust: bust ? Number(bust.toFixed(1)) : null,
      underbust: underbust ? Number(underbust.toFixed(1)) : null,
      waist: waist ? Number(waist.toFixed(1)) : null,
      hips: hips ? Number(hips.toFixed(1)) : null,
      inseam: inseam ? Number(inseam.toFixed(1)) : null,
      shoulders: shoulderPixels ? Number((shoulderPixels * shoulderScale).toFixed(1)) : null,
      arm_length: upperArm && forearm
        ? Number(((upperArm + forearm) * shoulderScale).toFixed(1))
        : null,
      neck: neck ? Number(neck.toFixed(1)) : null,
      head_circumference: headCircumference ? Number(headCircumference.toFixed(1)) : null,
      foot_length: footLength ? Number(footLength.toFixed(1)) : null,
      foot_width: footWidth ? Number(footWidth.toFixed(1)) : null,
      calf_circumference: calfCircumference ? Number(calfCircumference.toFixed(1)) : null,
    };

    assertPlausible('chest', measurements.chest, 45, 190);
    assertPlausible('waist', measurements.waist, 40, 210);
    assertPlausible('hip', measurements.hips, 45, 210);

    const widthAgreement = (
      relativeAgreement(frontWidthCm.chest, backWidthCm.chest) +
      relativeAgreement(frontWidthCm.waist, backWidthCm.waist) +
      relativeAgreement(frontWidthCm.hips, backWidthCm.hips)
    ) / 3;

    const frontBackOrientationAgreement = (
      relativeAgreement(front.orientation.shoulderSep, back.orientation.shoulderSep) +
      relativeAgreement(front.orientation.hipSep, back.orientation.hipSep)
    ) / 2;

    const orientationScore = Math.min(
      1,
      Math.max(0, 1 - front.orientation.shoulderTilt / 0.08),
      Math.max(0, 1 - front.orientation.hipTilt / 0.08),
      Math.max(0, 1 - back.orientation.shoulderTilt / 0.08),
      Math.max(0, 1 - back.orientation.hipTilt / 0.08),
      Math.max(0, 1 - Math.max(frontSideShoulderRatio, frontSideHipRatio) / 0.85)
    );

    const confidence = clampScore(
      (poseVisibility * 0.32 + silhouetteCoverage * 0.22 + widthAgreement * 0.26 + orientationScore * 0.20) * 100
    );

    const torsoFieldConfidence = clampScore(confidence * (0.75 + widthAgreement * 0.25));
    const lengthFieldConfidence = clampScore(confidence * 0.88);
    const secondaryTorsoConfidence = clampScore(torsoFieldConfidence * 0.86);
    const lowerBodyConfidence = clampScore(confidence * 0.72);
    const detailConfidence = clampScore(confidence * 0.58);

    const fieldConfidence = {
      height: 100,
      chest: torsoFieldConfidence,
      bust: secondaryTorsoConfidence,
      underbust: clampScore(secondaryTorsoConfidence * 0.92),
      waist: torsoFieldConfidence,
      hips: torsoFieldConfidence,
      inseam: Number.isFinite(inseam) ? clampScore(lengthFieldConfidence * 0.82) : 0,
      shoulders: lengthFieldConfidence,
      arm_length: lengthFieldConfidence,
      neck: Number.isFinite(neck) ? secondaryTorsoConfidence : 0,
      head_circumference: Number.isFinite(headCircumference) ? detailConfidence : 0,
      foot_length: Number.isFinite(footLength) ? clampScore(confidence * 0.66) : 0,
      foot_width: Number.isFinite(footWidth) ? clampScore(confidence * 0.52) : 0,
      calf_circumference: Number.isFinite(calfCircumference) ? lowerBodyConfidence : 0,
    };

    const measurementSources = { height: 'customer_supplied' };
    for (const [key, value] of Object.entries(measurements)) {
      if (key !== 'height' && Number.isFinite(value)) {
        measurementSources[key] = 'three_view_scan_estimate';
      }
    }

    return {
      measurementsCm: measurements,
      confidence,
      fieldConfidence,
      measurementSources,
      diagnostics: {
        pose_visibility: Number((poseVisibility * 100).toFixed(1)),
        silhouette_coverage: Number((silhouetteCoverage * 100).toFixed(1)),
        front_back_width_agreement: Number((widthAgreement * 100).toFixed(1)),
        orientation_score: Number((orientationScore * 100).toFixed(1)),
        front_back_orientation_agreement: Number((frontBackOrientationAgreement * 100).toFixed(1)),
        chest_level_fraction: Number(chestSection.fraction.toFixed(3)),
        bust_level_fraction: bustSection ? Number(bustSection.fraction.toFixed(3)) : null,
        underbust_level_fraction: underbustSection ? Number(underbustSection.fraction.toFixed(3)) : null,
        waist_level_fraction: Number(waistSection.fraction.toFixed(3)),
        hip_level_fraction: Number(hipSection.fraction.toFixed(3)),
        neck_level_fraction: neckSection ? Number(neckSection.fraction.toFixed(3)) : null,
        crotch_detection: Number.isFinite(crotchY) ? 100 : 0,
      },
      method: 'mediapipe_full_three_view_extended_anthropometry_v4',
      notes: confidence >= 85
        ? 'Strong scan quality. Review the measurements before using them for high-confidence fit decisions.'
        : 'Scan quality is usable but not strong enough to treat as verified. Review or confirm key measurements with a tape.',
    };
  } finally {
    closeMask(front?.rawMask);
    closeMask(side?.rawMask);
    closeMask(back?.rawMask);
  }
}
