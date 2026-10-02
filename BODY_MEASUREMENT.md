# Body Measurement & Fit Engine

The Concierge now includes an on-device body measurement workflow intended for clothing fit assistance.

## What it does

- Uses a front and side full-body photo plus the user's real height.
- Runs pose/silhouette analysis in the browser using MediaPipe Tasks Vision.
- Estimates:
  - height
  - chest circumference
  - waist circumference
  - hip circumference
  - shoulder width
  - arm length
- Stores canonical numeric measurements in centimeters.
- Displays measurements in either metric or imperial units.
- Lets the user review and manually correct values.
- Produces a scan-quality/confidence score. This score reflects image/landmark quality, not guaranteed measurement accuracy.

## Fit recommendations

The app supports two levels of size recommendation:

1. **Product/brand size-chart match**
   - Preferred path.
   - A Product may contain a \`size_chart\` with measurement ranges in centimeters.
   - The customer's canonical measurements are compared directly with those ranges.

2. **Generic profile estimate**
   - Used only when no product size chart is available.
   - The UI labels this as a profile estimate rather than a brand-specific recommendation.

Retailer-provided product/brand size charts are required for dependable brand-specific sizing. Body measurements alone cannot establish the correct labeled size across brands because brands use different grading and ease.

## Capture guidance

For best results:
- fitted clothing
- plain contrasting background
- even lighting
- full body visible from head to feet
- front view facing the camera
- side view at 90 degrees
- same camera position/distance for front and side
- accurate known height

## Accuracy / limitations

This is a consumer fit-assistance estimate, not a medical or tailoring-grade measurement instrument. Silhouette-based circumference estimates can be affected by:
- loose clothing
- hair crossing the shoulders
- pose
- camera perspective
- lens distortion
- occlusion
- background segmentation
- body shape that is not well represented by an elliptical cross-section

Users should be able to correct measurements manually, and important fit decisions should be verified against a tape measurement when possible.

## Privacy

Pose/segmentation inference runs in the browser. The user's uploaded scan images are still stored using the app's existing Base44 upload flow, so storage/privacy disclosures and deletion handling remain important.
