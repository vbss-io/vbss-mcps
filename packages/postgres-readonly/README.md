# PostgreSQL Readonly MCP

MCP server read-only multi-org para PostgreSQL. Permite explorar databases, schemas, tabelas e executar queries SELECT em diferentes organizações.

## Setup

```bash
cd apps/mcps/postgres-readonly
npm install
```

Crie o arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Configure as organizações no `.env`:

```env
PG_ORGS=acme,globex

# Via URL
PG_ACME_URL=postgres://user:pass@db.acme.com:5432/postgres
PG_ACME_LABEL=Acme Corp

# Via params individuais
PG_GLOBEX_HOST=db.globex.com
PG_GLOBEX_PORT=5432
PG_GLOBEX_USER=readonly
PG_GLOBEX_PASSWORD=secret
PG_GLOBEX_LABEL=Globex Industries
PG_GLOBEX_SSL=true
```

> `DATABASE` é opcional (default: `postgres`). Use a tool `list_databases` para descobrir os bancos disponíveis e passe o parâmetro `database` em qualquer tool.

## Registrar no Claude Code

Edite o `.claude.json` (global ou do projeto) e adicione em `mcpServers`:

```json
{
  "postgres-readonly": {
    "type": "stdio",
    "command": "node",
    "args": [
      "C:/caminho/completo/apps/mcps/postgres-readonly/src/index.js"
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
| `list_databases` | Lista databases no servidor PostgreSQL |
| `list_schemas` | Lista schemas com contagem de tabelas |
| `list_tables` | Lista tabelas/views de um schema |
| `describe_table` | Colunas, tipos, PKs |
| `get_foreign_keys` | Relacionamentos FK |
| `get_indexes` | Índices de uma tabela |
| `get_table_stats` | Row counts e tamanhos estimados |
| `get_sample_data` | Preview de linhas (max 100) |
| `execute_query` | Executa SELECT/WITH/EXPLAIN read-only |

Todas as tools (exceto `list_organizations`) aceitam o parâmetro opcional `database` para conectar em qualquer banco da org dinamicamente.
