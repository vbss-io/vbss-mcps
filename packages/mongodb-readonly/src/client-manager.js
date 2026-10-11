import { MongoClient } from "mongodb";

export class ClientManager {
  constructor() {
    this.configs = new Map();
    this.clients = new Map();
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

  async getClient(orgKey) {
    if (this.clients.has(orgKey)) {
      return this.clients.get(orgKey);
    }
    const config = this.getOrgConfig(orgKey);
    const client = new MongoClient(config.url, {
      maxPoolSize: 3,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      ...(config.tlsAllowInvalidCertificates && { tlsAllowInvalidCertificates: true }),
    });
    await client.connect();
    this.clients.set(orgKey, client);
    return client;
  }

  getDatabase(orgKey, database) {
    return this.getClient(orgKey).then((client) => {
      const config = this.getOrgConfig(orgKey);
      const db = database || config.database;
      return client.db(db);
    });
  }

  getOrganizations() {
    return [...this.configs.entries()].map(([key, config]) => ({
      key,
      label: config.label,
      default_database: config.database,
    }));
  }

  async testConnection(orgKey) {
    try {
      const client = await this.getClient(orgKey);
      await client.db("admin").command({ ping: 1 });
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async close() {
    const promises = [...this.clients.values()].map((client) => client.close());
    await Promise.all(promises);
  }
}
