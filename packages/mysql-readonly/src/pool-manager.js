import mysql from "mysql2/promise";

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
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: db,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: 3,
      waitForConnections: true,
      connectTimeout: 10000,
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
    const connection = await pool.getConnection();
    try {
      try {
        await connection.query("START TRANSACTION READ ONLY");
      } catch {
        await connection.query("START TRANSACTION");
      }
      const [rows, fields] = await connection.query(query);
      await connection.query("ROLLBACK");
      return { rows, fields };
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    const promises = [...this.pools.values()].map((pool) => pool.end());
    await Promise.all(promises);
  }
}
