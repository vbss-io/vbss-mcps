import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });

export function loadOrganizations() {
  const orgsEnv = process.env.AZURE_ORGS;
  if (!orgsEnv) {
    throw new Error(
      "AZURE_ORGS environment variable is required. Set it to a comma-separated list of organization identifiers."
    );
  }
  const orgKeys = orgsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (orgKeys.length === 0) {
    throw new Error(
      "AZURE_ORGS must contain at least one organization identifier."
    );
  }
  const organizations = new Map();
  for (const key of orgKeys) {
    const prefix = `AZURE_${key.toUpperCase()}_`;
    const tenantId = process.env[`${prefix}TENANT_ID`];
    const clientId = process.env[`${prefix}CLIENT_ID`];
    const clientSecret = process.env[`${prefix}CLIENT_SECRET`];
    const subscriptionId = process.env[`${prefix}SUBSCRIPTION_ID`];
    const label = process.env[`${prefix}LABEL`] || key;
    if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
      throw new Error(
        `Organization "${key}" requires ${prefix}TENANT_ID, ${prefix}CLIENT_ID, ${prefix}CLIENT_SECRET, and ${prefix}SUBSCRIPTION_ID`
      );
    }
    organizations.set(key, { key, label, tenantId, clientId, clientSecret, subscriptionId });
  }
  return organizations;
}
