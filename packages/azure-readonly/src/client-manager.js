import { ClientSecretCredential } from "@azure/identity";
import { ResourceGraphClient } from "@azure/arm-resourcegraph";
import { ResourceManagementClient } from "@azure/arm-resources";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { MonitorClient } from "@azure/arm-monitor";

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

  getConfig(orgKey) {
    const config = this.configs.get(orgKey);
    if (!config) {
      throw new Error(
        `Organization "${orgKey}" not found. Available: ${[...this.configs.keys()].join(", ")}`
      );
    }
    return config;
  }

  getClients(orgKey) {
    if (this.clients.has(orgKey)) {
      return this.clients.get(orgKey);
    }
    const config = this.getConfig(orgKey);
    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );
    const clients = {
      credential,
      subscriptionId: config.subscriptionId,
      resourceGraph: new ResourceGraphClient(credential),
      resources: new ResourceManagementClient(credential, config.subscriptionId),
      costManagement: new CostManagementClient(credential),
      subscriptions: new SubscriptionClient(credential),
      monitor: new MonitorClient(credential, config.subscriptionId),
    };
    this.clients.set(orgKey, clients);
    return clients;
  }

  getOrganizations() {
    return [...this.configs.entries()].map(([key, config]) => ({
      key,
      label: config.label,
      subscriptionId: config.subscriptionId,
    }));
  }

  async testConnection(orgKey) {
    try {
      const { subscriptions } = this.getClients(orgKey);
      const config = this.getConfig(orgKey);
      const sub = await subscriptions.subscriptions.get(config.subscriptionId);
      return { connected: true, subscriptionName: sub.displayName, state: sub.state };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}
