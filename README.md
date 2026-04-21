# VBSS MCPs

Public, reusable MCP (Model Context Protocol) servers by VBSS.

## Packages

| Package | Description |
| ------- | ----------- |
| `@vbss/mcp-azure-readonly` | Read-only multi-org Azure inventory, costs, metrics |
| `@vbss/mcp-excel` | Read/write Excel files (.xlsx) |
| `@vbss/mcp-mongodb-readonly` | Read-only multi-org MongoDB / Cosmos Mongo API |
| `@vbss/mcp-mysql-readonly` | Read-only multi-org MySQL reports/KPIs |
| `@vbss/mcp-postgres-readonly` | Read-only multi-org PostgreSQL reports/KPIs |

## Setup

```bash
npm install
```

Installs deps for every workspace package in `packages/*`.

## Running a single MCP

```bash
npm start -w @vbss/mcp-postgres-readonly
# or
node packages/postgres-readonly/src/index.js
```

## Layout

```md
packages/
  <name>/
    package.json   -- "name": "@vbss/mcp-<name>", "mcp": { label, toolPattern }
    src/
      index.js     -- entrypoint (stdio MCP server)
      ...
    README.md
```
