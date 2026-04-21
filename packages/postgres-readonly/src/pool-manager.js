import pg from "pg";

const { Pool } = pg;

export class PoolManager {
  constructor() {
    this.configs = new Map();
    this.pools = new Map();
  }

  initialize(organizations) {
    for (const [key, config] of organizations) {
      this.configs.set(key, config);
    }
  }

  getOrgConfig(orgKey) {
    const config = this.configs.get(orgKey);
    if (!config) {
      throw new Error(
        `Organization "${orgKey}" not found. Available: ${[...this.configs.keys()].join(", ")}`
      );
    }
    return config;
  }

  getPool(orgKey, database) {
    const config = this.getOrgConfig(orgKey);
    const db = database || config.database;
    const poolKey = `${orgKey}:${db}`;
    if (this.pools.has(poolKey)) {
      return this.pools.get(poolKey);
    }
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: db,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    this.pools.set(poolKey, pool);
    return pool;
  }

  getOrganizations() {
    return [...this.configs.entries()].map(([key, config]) => ({
      key,
      label: config.label,
      default_database: config.database,
    }));
  }

  async testConnection(orgKey, database) {
    try {
      const pool = this.getPool(orgKey, database);
      await pool.query("SELECT 1 AS ok");
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async executeReadOnly(orgKey, query, database) {
    const pool = this.getPool(orgKey, database);
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(query);
      await client.query("ROLLBACK");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    const promises = [...this.pools.values()].map((pool) => pool.end());
    await Promise.all(promises);
  }
}
