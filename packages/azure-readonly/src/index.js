import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadOrganizations } from "./config.js";
import { ClientManager } from "./client-manager.js";
import { registerTools } from "./tools.js";

const organizations = loadOrganizations();
const clientManager = new ClientManager();
clientManager.initialize(organizations);

const server = new McpServer({
  name: "Azure Readonly MCP",
  version: "1.0.0",
});

registerTools(server, clientManager);

const transport = new StdioServerTransport();
await server.connect(transport);
