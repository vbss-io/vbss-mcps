const ALLOWED_PREFIXES = ["SELECT", "WITH", "EXPLAIN", "SHOW", "DESCRIBE", "DESC"];

export function validateReadOnlyQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { valid: false, reason: "Query cannot be empty" };
  }
  const withoutStrings = trimmed.replace(/'[^']*'/g, "");
  if (withoutStrings.includes(";")) {
    return { valid: false, reason: "Multiple statements are not allowed. Remove the semicolon." };
  }
  const normalized = trimmed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").trim().toUpperCase();
  const startsWithAllowed = ALLOWED_PREFIXES.some((p) =>
    normalized.startsWith(p)
  );
  if (!startsWithAllowed) {
    return {
      valid: false,
      reason: `Only read-only queries are allowed. Query must start with: ${ALLOWED_PREFIXES.join(", ")}`,
    };
  }
  return { valid: true };
}
