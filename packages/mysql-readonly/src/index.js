import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadOrganizations, getMaxRows } from "./config.js";
import { PoolManager } from "./pool-manager.js";
import { registerTools } from "./tools.js";

const organizations = loadOrganizations();
const maxRows = getMaxRows();
const poolManager = new PoolManager();
poolManager.initialize(organizations);

const server = new McpServer({
  name: "MySQL Readonly MCP",
  version: "1.0.0",
});

registerTools(server, poolManager, maxRows);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await poolManager.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await poolManager.close();
  process.exit(0);
});
