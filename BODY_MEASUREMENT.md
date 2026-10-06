# Body Measurement & Fit Engine

The Concierge body-fit foundation is designed around a strict rule: a photo estimate is useful evidence, but it is not automatically treated as tailoring-grade ground truth.

## Measurement workflow

The onboarding scan uses the customer's measured height plus three full-body views:

- front
- exact side
- back

Pose and silhouette analysis runs in the browser with MediaPipe Tasks Vision using the Full pose model. Before measurements are accepted, the scan evaluates pose visibility, full-body coverage, camera/body tilt, side-view orientation, and front/back silhouette agreement. Weak captures are rejected and must be retaken rather than being converted into a high-confidence size recommendation.

The photo-first v2 protocol now attempts to estimate:

- height (customer supplied and used as the scale reference)
- chest circumference
- bust circumference
- underbust circumference
- waist circumference
- hip / seat circumference
- inseam
- shoulder width
- arm / sleeve length
- neck circumference
- head circumference
- foot length
- foot width
- calf circumference

Not every field has the same expected precision. Torso measurements generally have stronger geometric evidence in a full-body three-view scan. Smaller-detail measurements such as head circumference, foot width, and some lower-body landmark measurements receive lower confidence unless the image geometry supports them well. The fit engine carries that confidence forward instead of treating all photo-derived numbers equally.

Chest, waist, and hip circumference use the average of the front/back torso widths plus side-view depth. The current v4 extended-anthropometry method follows the torso centerline, ignores disconnected foreground such as separated arms, searches constrained anatomical regions for relevant cross-sections, and estimates circumference from an elliptical cross-section. Shoulder width and arm length are derived from pose landmarks. These geometric improvements reduce known failure modes but still require empirical validation against physical reference measurements.

Canonical numerical measurements are stored in centimeters; metric and imperial values are display choices only.

## Review and provenance

Every measurement can carry its own provenance and confidence.

Examples:

- `customer_supplied`
- `three_view_scan_estimate`
- `customer_corrected`
- `customer_tape_verified`

The customer reviews the scan before onboarding continues. Chest, waist, and hips can be explicitly marked as tape-verified. Measurements can also be edited later under Profile → My Measurements.

The profile validation state is one of:

- `estimated`
- `reviewed`
- `partially_verified`
- `verified`

A scan-quality score is not the same thing as measurement accuracy. Tape verification is intentionally given greater trust than an image-derived estimate.

## Photo-first fallback and optional verification

The product should remain useful for customers who do not own a tape measure and cannot visit a tailor. The three-view scan therefore supplies the best plausible photo-derived estimate for category-relevant measurements when the geometry is adequate.

A physical tape or ruler is an optional confidence upgrade, not a prerequisite. If the customer supplies or verifies a better value, the app keeps the original scan baseline for validation and promotes the verified value for future fit decisions.

Some identity-style fields such as a remembered shoe size or bra size remain optional customer inputs. When a small-detail photo estimate is unavailable or too uncertain, the app can lower confidence or request better information rather than inventing precision.

## Fit recommendation hierarchy

The app prefers evidence in this order:

1. retailer/product-specific size chart
2. verified official brand size chart
3. generic profile estimate when neither chart is available

A labeled brand size is never inferred solely from the customer's body dimensions when no corresponding brand/product grading information exists.

The fit engine uses category-specific measurement requirements. Examples include:

- suits: chest, waist, height
- dress shirts: neck, chest, arm/sleeve length
- pants/jeans: waist, hips, inseam
- dresses: bust, waist, hips
- bras: bust and underbust
- shoes: foot length and width
- boots: foot length, width, and calf circumference when the chart supports it
- hats: head circumference

Brand-chart sleeve ranges are normalized to the customer's arm-length measurement so sleeve information is not silently ignored.

## Fit confidence

A recommendation returns a fit-confidence level and score based on:

- exact vs nearest chart match
- how many category-relevant measurements are present
- the confidence/provenance of those measurements
- whether important measurements were customer verified
- whether the recommendation depends mainly on an identity value such as a remembered shoe or bra size

The UI uses labels such as **High-confidence fit**, **Fit match**, **Low-confidence fit**, and **Closest brand fit** rather than calling every chart match "verified."

If a category requires a measurement that the customer has not supplied, the app pauses the fit recommendation rather than presenting an incomplete match as reliable. It tells the customer which measurement is needed. Body measurements are only matched directly against charts explicitly identified as body-measurement charts; garment or mixed-basis charts are stored for later construction/ease reasoning rather than being treated as body dimensions.

## Capture standard

For best results:

- use measured height, not estimated height
- wear fitted clothing
- remove bulky outerwear and shoes
- use a plain contrasting background
- use even lighting
- keep the full body visible
- keep the phone vertical and level around waist-to-chest height
- avoid wide-angle mode
- do not move the camera between front/side/back views
- front: face camera, stand straight, arms slightly away from torso
- side: turn as close to 90° as possible
- back: face directly away and use the same stance

## Accuracy validation requirement

The measurement layer is not considered empirically "locked" merely because the software builds and the capture safeguards work.

Before claiming validated measurement accuracy, test the system against repeated physical tape measurements on a representative real-user sample. When a customer verifies a measurement, the app can preserve the original scan baseline and create a MeasurementValidationRecord containing the physical reference and absolute error. The admin-only fitValidationSummary function aggregates available records into sample count, mean/median absolute error, 95th-percentile absolute error, mean bias, and RMSE by measurement. It also summarizes observed fit, keep/return outcomes, and exact labeled-size outcomes from fit feedback.

Repeatability still requires repeated scans of the same participants under the standardized capture protocol. Define acceptance thresholds before the validation study and do not promote a scan-derived field to verified status unless the evidence supports that threshold.

## Privacy

Pose/segmentation inference runs in the browser. Body scan images are uploaded through the app's private-file flow and rendered using short-lived signed URLs. Image retention/deletion disclosures remain important because body-scan photographs are sensitive user content.
