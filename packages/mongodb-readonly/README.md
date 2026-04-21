# MongoDB Readonly MCP

MCP server read-only multi-org para MongoDB (e Cosmos DB MongoDB API). Permite explorar databases, collections e executar queries `find`/`aggregate` em diferentes organizações.

## Setup

```bash
cd packages/mongodb-readonly
npm install
```

Crie o arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Configure as organizações no `.env`:

```env
MONGO_ORGS=acme,globex

# Via URL
MONGO_ACME_URL=mongodb://user:pass@db.acme.com:27017/mydb?authSource=admin
MONGO_ACME_LABEL=Acme Corp

# Via params individuais
MONGO_GLOBEX_HOST=db.globex.com
MONGO_GLOBEX_PORT=27017
MONGO_GLOBEX_USER=readonly
MONGO_GLOBEX_PASSWORD=secret
MONGO_GLOBEX_DATABASE=production
MONGO_GLOBEX_AUTH_SOURCE=admin
MONGO_GLOBEX_TLS=true
MONGO_GLOBEX_LABEL=Globex Industries

# Opcional: limite de documentos por query (default: 1000)
MONGO_MAX_DOCS=500
```

> `DATABASE` é opcional (default: `test`). Use a tool `list_databases` para descobrir bancos disponíveis e passe o parâmetro `database` em qualquer tool.

## Registrar no Claude Code

Edite o `.claude.json` (global ou do projeto) e adicione em `mcpServers`:

```json
{
  "mongodb-readonly": {
    "type": "stdio",
    "command": "node",
    "args": [
      "C:/caminho/completo/packages/mongodb-readonly/src/index.js"
    ],
    "env": {}
  }
}
```

> **Importante**: Não use `claude mcp add` com paths que contenham espaços — o Git Bash pode quebrar o caminho. Edite o JSON diretamente.

Verifique a conexão:

```bash
claude mcp list
```

## Tools disponíveis

| Tool | Descrição |
| ---- | ----------- |
| `list_organizations` | Lista orgs configuradas com status de conexão |
| `list_databases` | Lista databases do cluster/servidor |
| `list_collections` | Lista collections de um database |
| `describe_collection` | Schema inferido de uma sample da collection |
| `get_indexes` | Índices de uma collection |
| `get_collection_stats` | Contagem de documentos e tamanho aproximado |
| `get_sample_data` | Preview de documentos (max 100) |
| `find_documents` | Query `find` read-only com filter, projection, sort, limit |
| `aggregate` | Pipeline de aggregation read-only (sem `$out`/`$merge`) |
| `count_documents` | Contagem por filter |
| `distinct_values` | Valores distintos de um campo |

Todas as tools (exceto `list_organizations`) aceitam o parâmetro opcional `database` para consultar qualquer banco da org dinamicamente.
