import { createClientFromRequest } from "npm:@base44/sdk";

const MEASUREMENT_FIELDS = [
  "height", "chest", "bust", "underbust", "waist", "hips", "shoulders",
  "arm_length", "inseam", "neck", "head_circumference", "foot_length",
  "foot_width", "calf_circumference"
];

function finite(value: any): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round(value: number | null, digits = 3): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function summarizeMeasurement(records: any[], field: string) {
  const samples = records
    .map(record => {
      const scan = finite(record?.scan_values_cm?.[field]);
      const reference = finite(record?.reference_values_cm?.[field]);
      if (scan == null || reference == null) return null;
      return {
        scan,
        reference,
        signedError: scan - reference,
        absoluteError: Math.abs(scan - reference),
      };
    })
    .filter(Boolean) as Array<{
      scan: number;
      reference: number;
      signedError: number;
      absoluteError: number;
    }>;

  if (!samples.length) {
    return {
      field,
      n: 0,
      mean_absolute_error_cm: null,
      median_absolute_error_cm: null,
      p95_absolute_error_cm: null,
      mean_bias_cm: null,
      rmse_cm: null,
    };
  }

  const abs = samples.map(sample => sample.absoluteError);
  const signed = samples.map(sample => sample.signedError);
  const mae = abs.reduce((sum, value) => sum + value, 0) / abs.length;
  const bias = signed.reduce((sum, value) => sum + value, 0) / signed.length;
  const rmse = Math.sqrt(
    signed.reduce((sum, value) => sum + value ** 2, 0) / signed.length
  );

  return {
    field,
    n: samples.length,
    mean_absolute_error_cm: round(mae),
    median_absolute_error_cm: round(percentile(abs, 0.5)),
    p95_absolute_error_cm: round(percentile(abs, 0.95)),
    mean_bias_cm: round(bias),
    rmse_cm: round(rmse),
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const [measurementRecords, fitFeedback] = await Promise.all([
      base44.asServiceRole.entities.MeasurementValidationRecord.list("-verification_timestamp", 500),
      base44.asServiceRole.entities.AIFeedback.filter({ feedback_type: "size_suggestion" }),
    ]);

    const measurementStats = MEASUREMENT_FIELDS
      .map(field => summarizeMeasurement(measurementRecords || [], field))
      .filter(stat => stat.n > 0);

    const fitRecords = (fitFeedback || []).filter((record: any) =>
      record.fit_result || record.actual_size_needed || record.was_helpful !== undefined
    );

    const withObservedFit = fitRecords.filter((record: any) =>
      ["too_tight", "ideal", "too_loose", "mixed"].includes(record.fit_result)
    );
    const ideal = withObservedFit.filter((record: any) => record.fit_result === "ideal").length;
    const keptKnown = fitRecords.filter((record: any) => typeof record.kept_item === "boolean");
    const kept = keptKnown.filter((record: any) => record.kept_item === true).length;
    const sizeOutcomeKnown = fitRecords.filter((record: any) =>
      record.suggested_size && record.actual_size_needed
    );
    const exactSizeOutcome = sizeOutcomeKnown.filter((record: any) =>
      String(record.suggested_size).trim().toLowerCase() ===
      String(record.actual_size_needed).trim().toLowerCase()
    ).length;

    return Response.json({
      generated_at: new Date().toISOString(),
      measurement_validation: {
        total_records: (measurementRecords || []).length,
        by_measurement: measurementStats,
        note: "Statistics compare stored scan baselines with customer-entered tape/ruler reference values. They are only as reliable as the reference measurements and sample diversity.",
      },
      fit_validation: {
        total_size_feedback_records: fitRecords.length,
        observed_fit_records: withObservedFit.length,
        ideal_fit_rate: withObservedFit.length ? round(ideal / withObservedFit.length, 4) : null,
        kept_item_records: keptKnown.length,
        kept_item_rate: keptKnown.length ? round(kept / keptKnown.length, 4) : null,
        comparable_size_outcomes: sizeOutcomeKnown.length,
        exact_labeled_size_rate: sizeOutcomeKnown.length
          ? round(exactSizeOutcome / sizeOutcomeKnown.length, 4)
          : null,
      },
    });
  } catch (error) {
    console.error("fitValidationSummary", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
