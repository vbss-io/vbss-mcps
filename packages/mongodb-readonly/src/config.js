import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

export function loadOrganizations() {
  const orgsEnv = process.env.MONGO_ORGS;
  if (!orgsEnv) {
    throw new Error(
      "MONGO_ORGS environment variable is required. Set it to a comma-separated list of organization identifiers."
    );
  }
  const orgKeys = orgsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (orgKeys.length === 0) {
    throw new Error(
      "MONGO_ORGS must contain at least one organization identifier."
    );
  }
  const organizations = new Map();
  for (const key of orgKeys) {
    const prefix = `MONGO_${key.toUpperCase()}_`;
    const url = process.env[`${prefix}URL`];
    const label = process.env[`${prefix}LABEL`] || key;
    if (url) {
      const parsed = new URL(url);
      const database = parsed.pathname.replace(/^\//, "") || "test";
      organizations.set(key, { key, label, url, database });
      continue;
    }
    const host = process.env[`${prefix}HOST`];
    const port = parseInt(process.env[`${prefix}PORT`] || "27017", 10);
    const user = process.env[`${prefix}USER`];
    const password = process.env[`${prefix}PASSWORD`] || "";
    const database = process.env[`${prefix}DATABASE`] || "test";
    const tls = process.env[`${prefix}TLS`] === "true";
    const authSource = process.env[`${prefix}AUTH_SOURCE`] || "admin";
    if (!host) {
      throw new Error(
        `Organization "${key}" requires either ${prefix}URL or at minimum ${prefix}HOST`
      );
    }
    const userPart = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : "";
    const tlsParam = tls ? "tls=true&tlsAllowInvalidCertificates=true" : "";
    const authParam = user ? `authSource=${authSource}` : "";
    const params = [tlsParam, authParam].filter(Boolean).join("&");
    const query = params ? `?${params}` : "";
    const builtUrl = `mongodb://${userPart}${host}:${port}/${database}${query}`;
    organizations.set(key, { key, label, url: builtUrl, database });
  }
  return organizations;
}

export function getMaxDocs() {
  return parseInt(process.env.MONGO_MAX_DOCS || "1000", 10);
}
