const BLOCKED_AGGREGATION_STAGES = ["$out", "$merge"];

export function validateAggregationPipeline(pipeline) {
  if (!Array.isArray(pipeline)) {
    return { valid: false, reason: "Pipeline must be a JSON array of stage objects" };
  }
  if (pipeline.length === 0) {
    return { valid: false, reason: "Pipeline cannot be empty" };
  }
  for (const stage of pipeline) {
    if (typeof stage !== "object" || stage === null || Array.isArray(stage)) {
      return { valid: false, reason: "Each pipeline stage must be a JSON object" };
    }
    const stageKeys = Object.keys(stage);
    for (const key of stageKeys) {
      if (BLOCKED_AGGREGATION_STAGES.includes(key)) {
        return {
          valid: false,
          reason: `Stage "${key}" is not allowed in read-only mode. Blocked stages: ${BLOCKED_AGGREGATION_STAGES.join(", ")}`,
        };
      }
    }
  }
  return { valid: true };
}

export function parseJsonSafe(input, label) {
  try {
    return { value: JSON.parse(input), error: null };
  } catch (error) {
    return { value: null, error: `Invalid JSON for ${label}: ${error.message}` };
  }
}
