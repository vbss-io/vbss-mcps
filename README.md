# VBSS MCPs

Public, reusable MCP (Model Context Protocol) servers by VBSS. Each server is published on npm under the `@vbss-ai` scope and runs over stdio through `npx`, so there is nothing to clone or install.

## Packages

| Package | Description | Node |
| ------- | ----------- | ---- |
| [`@vbss-ai/mcp-azure-readonly`](packages/azure-readonly) | Read-only multi-org Azure inventory, costs, metrics | 22+ |
| [`@vbss-ai/mcp-mongodb-readonly`](packages/mongodb-readonly) | Read-only multi-org MongoDB / Cosmos Mongo API | 20+ |
| [`@vbss-ai/mcp-mysql-readonly`](packages/mysql-readonly) | Read-only multi-org MySQL reports/KPIs | 20+ |
| [`@vbss-ai/mcp-postgres-readonly`](packages/postgres-readonly) | Read-only multi-org PostgreSQL reports/KPIs | 20+ |

## Usage

Add the server to your MCP client config (for Claude Code, the project `.mcp.json` or `~/.claude.json`):

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vbss-ai/mcp-postgres-readonly"],
      "env": {
        "PG_ORGS": "acme",
        "PG_ACME_URL": "postgres://readonly:password@db.acme.com:5432/postgres"
      }
    }
  }
}
```

On Windows, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-<name>"]`. Each package README lists its environment variables and tools.

## Alternative: run from a local clone

To run without npm, for example to try a change, clone the repository and install the dependencies:

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
```

Then point your MCP client at the server file, using the absolute path of the clone:

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/vbss-mcps/packages/postgres-readonly/src/index.js"
      ],
      "env": {
        "PG_ORGS": "acme",
        "PG_ACME_URL": "postgres://readonly:password@db.acme.com:5432/postgres"
      }
    }
  }
}
```

On Windows, use forward slashes in the path (`C:/Users/you/vbss-mcps/...`). The variables can also live in a `.env` file inside the package folder, which the server reads on startup.

To check that the configuration loads without errors, run it from the terminal. The server stays silent waiting for a client; `Ctrl+C` stops it.

```bash
npm start -w @vbss-ai/mcp-postgres-readonly
# or
node packages/postgres-readonly/src/index.js
```

## Layout

```md
packages/
  <name>/
    package.json   -- "name": "@vbss-ai/mcp-<name>", "bin", "mcp": { label, toolPattern }
    src/
      index.js     -- entrypoint (stdio MCP server)
      ...
    README.md
```

## License

[MIT](LICENSE)
