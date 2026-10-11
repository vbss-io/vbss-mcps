import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });

function parseMysqlUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306", 10),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || "mysql",
    ssl: parsed.searchParams.get("ssl") === "true",
  };
}

export function loadOrganizations() {
  const orgsEnv = process.env.MYSQL_ORGS;
  if (!orgsEnv) {
    throw new Error(
      "MYSQL_ORGS environment variable is required. Set it to a comma-separated list of organization identifiers."
    );
  }
  const orgKeys = orgsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (orgKeys.length === 0) {
    throw new Error(
      "MYSQL_ORGS must contain at least one organization identifier."
    );
  }
  const organizations = new Map();
  for (const key of orgKeys) {
    const prefix = `MYSQL_${key.toUpperCase()}_`;
    const url = process.env[`${prefix}URL`];
    const label = process.env[`${prefix}LABEL`] || key;
    const sslVerify = process.env[`${prefix}SSL_VERIFY`] !== "false";
    if (url) {
      const parsed = parseMysqlUrl(url);
      organizations.set(key, { key, label, ...parsed, sslVerify });
      continue;
    }
    const host = process.env[`${prefix}HOST`];
    const port = parseInt(process.env[`${prefix}PORT`] || "3306", 10);
    const user = process.env[`${prefix}USER`];
    const password = process.env[`${prefix}PASSWORD`] || "";
    const database = process.env[`${prefix}DATABASE`] || "mysql";
    const ssl = process.env[`${prefix}SSL`] === "true";
    if (!host || !user) {
      throw new Error(
        `Organization "${key}" requires either ${prefix}URL or at minimum ${prefix}HOST and ${prefix}USER`
      );
    }
    organizations.set(key, { key, label, host, port, user, password, database, ssl, sslVerify });
  }
  return organizations;
}

export function getMaxRows() {
  return parseInt(process.env.MYSQL_MAX_ROWS || "1000", 10);
}
