# PostgreSQL Readonly MCP

MCP server read-only multi-org para PostgreSQL. Permite explorar databases, schemas, tabelas e executar queries SELECT em diferentes organizações.

## Uso via npx

Não precisa clonar nem instalar: o cliente MCP baixa e roda o pacote com `npx`. Requer Node.js 20 ou superior.

Adicione no `.mcp.json` do projeto (ou no `~/.claude.json`):

```json
{
  "mcpServers": {
    "postgres-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vbss-ai/mcp-postgres-readonly"
      ],
      "env": {
        "PG_ORGS": "acme",
        "PG_ACME_URL": "postgres://readonly:senha@db.acme.com:5432/postgres",
        "PG_ACME_LABEL": "Acme Corp"
      }
    }
  }
}
```

No Windows, use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-postgres-readonly"]`.

Verifique a conexão:

```bash
claude mcp list
```

## Configuração

As variáveis vão no `env` do cliente MCP:

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

Use um usuário de banco só leitura. A validação de queries do servidor é uma segunda camada, não substitui a permissão no banco.

TLS liga com `sslmode=require`, `verify-ca` ou `verify-full` na URL, ou com `PG_<ORG>_SSL=true`. O certificado é verificado por padrão. Se o servidor usa uma CA própria, aponte o certificado dela com `NODE_EXTRA_CA_CERTS` no `env`. Só em último caso desligue a verificação com `PG_<ORG>_SSL_VERIFY=false`.

## Rodando a partir do código

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
node packages/postgres-readonly/src/index.js
```

Rodando do clone, as variáveis também podem ficar num `.env` em `packages/postgres-readonly`.

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
