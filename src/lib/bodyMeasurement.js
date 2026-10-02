import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

let landmarkerPromise;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        numPoses: 1,
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
    return {
      values,
      width: mask.width,
      height: mask.height,
    };
  } catch {
    return null;
  }
}

function getBoundingBox(mask, threshold = 0.5) {
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

function rowSpan(mask, yNormalized, threshold = 0.5) {
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

export async function measureBodyFromImages({ frontUrl, sideUrl, heightCm }) {
  if (!frontUrl || !sideUrl) throw new Error('Front and side photos are required.');
  if (!Number.isFinite(Number(heightCm)) || Number(heightCm) < 120 || Number(heightCm) > 230) {
    throw new Error('Enter your real height before measuring.');
  }

  const [frontImage, sideImage, landmarker] = await Promise.all([
    loadImage(frontUrl),
    loadImage(sideUrl),
    getLandmarker(),
  ]);

  const frontResult = landmarker.detect(frontImage);
  const frontLandmarks = frontResult.landmarks?.[0];
  const frontMaskRaw = frontResult.segmentationMasks?.[0]?.clone?.();

  const sideResult = landmarker.detect(sideImage);
  const sideLandmarks = sideResult.landmarks?.[0];
  const sideMaskRaw = sideResult.segmentationMasks?.[0]?.clone?.();

  frontResult.close?.();
  sideResult.close?.();

  if (!frontLandmarks || !sideLandmarks) {
    closeMask(frontMaskRaw);
    closeMask(sideMaskRaw);
    throw new Error('A full body could not be detected in both photos.');
  }
  const frontMask = maskToArray(frontMaskRaw);
  const sideMask = maskToArray(sideMaskRaw);
  const frontBox = getBoundingBox(frontMask);
  const sideBox = getBoundingBox(sideMask);

  if (!frontBox || !sideBox || frontBox.height < 50 || sideBox.height < 50) {
    closeMask(frontMaskRaw);
    closeMask(sideMaskRaw);
    throw new Error('The full-body outline could not be isolated. Use a plain background and fitted clothing.');
  }

  const frontCmPerPx = Number(heightCm) / frontBox.height;
  const sideCmPerPx = Number(heightCm) / sideBox.height;

  const leftShoulder = frontLandmarks[11];
  const rightShoulder = frontLandmarks[12];
  const leftHip = frontLandmarks[23];
  const rightHip = frontLandmarks[24];
  const leftElbow = frontLandmarks[13];
  const leftWrist = frontLandmarks[15];

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const torso = hipY - shoulderY;

  const frontLevels = {
    chest: shoulderY + torso * 0.22,
    waist: shoulderY + torso * 0.62,
    hips: hipY + Math.max(0.02, torso * 0.10),
  };

  const sideLeftShoulder = sideLandmarks[11];
  const sideRightShoulder = sideLandmarks[12];
  const sideLeftHip = sideLandmarks[23];
  const sideRightHip = sideLandmarks[24];
  const sideShoulderY = (sideLeftShoulder.y + sideRightShoulder.y) / 2;
  const sideHipY = (sideLeftHip.y + sideRightHip.y) / 2;
  const sideTorso = sideHipY - sideShoulderY;
  const sideLevels = {
    chest: sideShoulderY + sideTorso * 0.22,
    waist: sideShoulderY + sideTorso * 0.62,
    hips: sideHipY + Math.max(0.02, sideTorso * 0.10),
  };

  const frontWidths = {
    chest: rowSpan(frontMask, frontLevels.chest),
    waist: rowSpan(frontMask, frontLevels.waist),
    hips: rowSpan(frontMask, frontLevels.hips),
  };
  const sideDepths = {
    chest: rowSpan(sideMask, sideLevels.chest),
    waist: rowSpan(sideMask, sideLevels.waist),
    hips: rowSpan(sideMask, sideLevels.hips),
  };

  const chest = ellipseCircumference(
    frontWidths.chest * frontCmPerPx,
    sideDepths.chest * sideCmPerPx
  );
  const waist = ellipseCircumference(
    frontWidths.waist * frontCmPerPx,
    sideDepths.waist * sideCmPerPx
  );
  const hips = ellipseCircumference(
    frontWidths.hips * frontCmPerPx,
    sideDepths.hips * sideCmPerPx
  );

  const shoulderPixels = distance2d(
    leftShoulder,
    rightShoulder,
    frontImage.naturalWidth,
    frontImage.naturalHeight
  );
  const shoulderScale = Number(heightCm) / Math.max(
    1,
    frontBox.height * (frontImage.naturalHeight / frontMask.height)
  );

  const upperArm = distance2d(
    leftShoulder,
    leftElbow,
    frontImage.naturalWidth,
    frontImage.naturalHeight
  );
  const forearm = distance2d(
    leftElbow,
    leftWrist,
    frontImage.naturalWidth,
    frontImage.naturalHeight
  );

  const visibility = Math.min(
    avgVisibility(frontLandmarks, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]),
    avgVisibility(sideLandmarks, [11, 12, 23, 24, 25, 26, 27, 28])
  );

  const silhouetteCoverage = Math.min(
    1,
    Math.min(frontBox.height / frontMask.height, sideBox.height / sideMask.height) / 0.7
  );
  const confidence = Math.round(Math.max(0, Math.min(100, visibility * silhouetteCoverage * 100)));

  const measurements = {
    height: Number(heightCm),
    chest: chest ? Number(chest.toFixed(1)) : null,
    waist: waist ? Number(waist.toFixed(1)) : null,
    hips: hips ? Number(hips.toFixed(1)) : null,
    shoulders: shoulderPixels ? Number((shoulderPixels * shoulderScale).toFixed(1)) : null,
    arm_length:
      upperArm && forearm ? Number(((upperArm + forearm) * shoulderScale).toFixed(1)) : null,
  };

  closeMask(frontMaskRaw);
  closeMask(sideMaskRaw);

  if (![measurements.chest, measurements.waist, measurements.hips].every(Number.isFinite)) {
    throw new Error('The scan did not produce reliable torso measurements. Retake the photos.');
  }

  return {
    measurementsCm: measurements,
    confidence,
    method: 'mediapipe_front_side_height_calibrated',
    notes:
      confidence >= 80
        ? 'Good scan quality. Review measurements before using them for fit decisions.'
        : 'Scan quality is limited. Retake photos or correct measurements manually.',
  };
}
