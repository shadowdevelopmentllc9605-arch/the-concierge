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

function rowSpan(mask, yNormalized, threshold = MASK_THRESHOLD) {
  if (!mask?.values?.length || !mask.width || !mask.height) return null;
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(yNormalized * (mask.height - 1))));
  const offset = y * mask.width;
  let minX = mask.width;
  let maxX = -1;

  for (let x = 0; x < mask.width; x += 1) {
    if (mask.values[offset + x] >= threshold) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return maxX >= minX ? maxX - minX + 1 : null;
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
    const chestSection = selectCrossSection(front, side, back, scales, 0.16, 0.38, 'max');
    const waistSection = selectCrossSection(front, side, back, scales, 0.45, 0.80, 'min');
    const hipSection = selectCrossSection(front, side, back, scales, 0.88, 1.18, 'max');

    if (!chestSection || !waistSection || !hipSection) {
      throw new Error('The torso outline was not clear enough to locate chest, waist, and hip cross-sections. Retake the photos in fitted clothing.');
    }

    const chest = chestSection.circumference;
    const waist = waistSection.circumference;
    const hips = hipSection.circumference;

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
      waist: waist ? Number(waist.toFixed(1)) : null,
      hips: hips ? Number(hips.toFixed(1)) : null,
      shoulders: shoulderPixels ? Number((shoulderPixels * shoulderScale).toFixed(1)) : null,
      arm_length: upperArm && forearm
        ? Number(((upperArm + forearm) * shoulderScale).toFixed(1))
        : null,
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

    return {
      measurementsCm: measurements,
      confidence,
      fieldConfidence: {
        height: 100,
        chest: torsoFieldConfidence,
        waist: torsoFieldConfidence,
        hips: torsoFieldConfidence,
        shoulders: lengthFieldConfidence,
        arm_length: lengthFieldConfidence,
      },
      measurementSources: {
        height: 'customer_supplied',
        chest: 'three_view_scan_estimate',
        waist: 'three_view_scan_estimate',
        hips: 'three_view_scan_estimate',
        shoulders: 'three_view_scan_estimate',
        arm_length: 'three_view_scan_estimate',
      },
      diagnostics: {
        pose_visibility: Number((poseVisibility * 100).toFixed(1)),
        silhouette_coverage: Number((silhouetteCoverage * 100).toFixed(1)),
        front_back_width_agreement: Number((widthAgreement * 100).toFixed(1)),
        orientation_score: Number((orientationScore * 100).toFixed(1)),
        front_back_orientation_agreement: Number((frontBackOrientationAgreement * 100).toFixed(1)),
        chest_level_fraction: Number(chestSection.fraction.toFixed(3)),
        waist_level_fraction: Number(waistSection.fraction.toFixed(3)),
        hip_level_fraction: Number(hipSection.fraction.toFixed(3)),
      },
      method: 'mediapipe_full_three_view_contour_height_calibrated_v3',
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
