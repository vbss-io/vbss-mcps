import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadOrganizations, getMaxDocs } from "./config.js";
import { ClientManager } from "./client-manager.js";
import { registerTools } from "./tools.js";

const organizations = loadOrganizations();
const maxDocs = getMaxDocs();
const clientManager = new ClientManager();
clientManager.initialize(organizations);

const server = new McpServer({
  name: "MongoDB Readonly MCP",
  version: "1.0.0",
});

registerTools(server, clientManager, maxDocs);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await clientManager.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await clientManager.close();
  process.exit(0);
});
