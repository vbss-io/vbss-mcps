# MySQL Readonly MCP

MCP server read-only multi-org para MySQL. Permite explorar databases, tabelas e executar queries `SELECT` em diferentes organizações.

## Setup

```bash
cd packages/mysql-readonly
npm install
```

Crie o arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Configure as organizações no `.env`:

```env
MYSQL_ORGS=acme,globex

# Via URL
MYSQL_ACME_URL=mysql://user:pass@db.acme.com:3306/mydb?ssl=true
MYSQL_ACME_LABEL=Acme Corp

# Via params individuais
MYSQL_GLOBEX_HOST=db.globex.com
MYSQL_GLOBEX_PORT=3306
MYSQL_GLOBEX_USER=readonly
MYSQL_GLOBEX_PASSWORD=secret
MYSQL_GLOBEX_DATABASE=production
MYSQL_GLOBEX_SSL=true
MYSQL_GLOBEX_LABEL=Globex Industries

# Opcional: limite de linhas por query (default: 1000)
MYSQL_MAX_ROWS=500
```

> `DATABASE` é opcional (default: `mysql`). Use a tool `list_databases` para descobrir bancos disponíveis e passe o parâmetro `database` em qualquer tool.

## Registrar no Claude Code

Edite o `.claude.json` (global ou do projeto) e adicione em `mcpServers`:

```json
{
  "mysql-readonly": {
    "type": "stdio",
    "command": "node",
    "args": [
      "C:/caminho/completo/packages/mysql-readonly/src/index.js"
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
| `list_databases` | Lista databases no servidor MySQL |
| `list_tables` | Lista tabelas/views de um database |
| `describe_table` | Colunas, tipos, PKs |
| `get_foreign_keys` | Relacionamentos FK |
| `get_indexes` | Índices de uma tabela |
| `get_table_stats` | Row counts e tamanhos estimados |
| `get_sample_data` | Preview de linhas (max 100) |
| `execute_query` | Executa SELECT/WITH/EXPLAIN read-only |

Todas as tools (exceto `list_organizations`) aceitam o parâmetro opcional `database` para conectar em qualquer banco da org dinamicamente.
