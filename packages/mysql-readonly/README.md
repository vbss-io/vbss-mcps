# MySQL Readonly MCP

MCP server read-only multi-org para MySQL. Permite explorar databases, tabelas e executar queries `SELECT` em diferentes organizações.

## Uso via npx

Não precisa clonar nem instalar: o cliente MCP baixa e roda o pacote com `npx`. Requer Node.js 20 ou superior.

Adicione no `.mcp.json` do projeto (ou no `~/.claude.json`):

```json
{
  "mcpServers": {
    "mysql-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vbss-ai/mcp-mysql-readonly"
      ],
      "env": {
        "MYSQL_ORGS": "acme",
        "MYSQL_ACME_URL": "mysql://readonly:senha@db.acme.com:3306/mydb?ssl=true",
        "MYSQL_ACME_LABEL": "Acme Corp"
      }
    }
  }
}
```

No Windows, use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-mysql-readonly"]`.

Verifique a conexão:

```bash
claude mcp list
```

## Configuração

As variáveis vão no `env` do cliente MCP:

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

Use um usuário de banco só leitura. A validação de queries do servidor é uma segunda camada, não substitui a permissão no banco.

O certificado TLS é verificado por padrão. Se o servidor usa uma CA própria, aponte o certificado dela com `NODE_EXTRA_CA_CERTS` no `env`. Só em último caso desligue a verificação com `MYSQL_<ORG>_SSL_VERIFY=false`.

## Rodando a partir do código

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
node packages/mysql-readonly/src/index.js
```

Rodando do clone, as variáveis também podem ficar num `.env` em `packages/mysql-readonly`.

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
