# MongoDB Readonly MCP

MCP server read-only multi-org para MongoDB (e Cosmos DB MongoDB API). Permite explorar databases, collections e executar queries `find`/`aggregate` em diferentes organizações.

## Uso via npx

Não precisa clonar nem instalar: o cliente MCP baixa e roda o pacote com `npx`. Requer Node.js 20 ou superior.

Adicione no `.mcp.json` do projeto (ou no `~/.claude.json`):

```json
{
  "mcpServers": {
    "mongodb-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vbss-ai/mcp-mongodb-readonly"
      ],
      "env": {
        "MONGO_ORGS": "acme",
        "MONGO_ACME_URL": "mongodb://readonly:senha@db.acme.com:27017/mydb?authSource=admin",
        "MONGO_ACME_LABEL": "Acme Corp"
      }
    }
  }
}
```

No Windows, use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-mongodb-readonly"]`.

Verifique a conexão:

```bash
claude mcp list
```

## Configuração

As variáveis vão no `env` do cliente MCP:

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

Use um usuário de banco só leitura. A validação de queries do servidor é uma segunda camada, não substitui a permissão no banco.

O certificado TLS é verificado por padrão. Se o servidor usa uma CA própria, aponte o certificado dela com `NODE_EXTRA_CA_CERTS` no `env`. Só em último caso desligue a verificação com `MONGO_<ORG>_TLS_VERIFY=false`.

## Rodando a partir do código

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
node packages/mongodb-readonly/src/index.js
```

Rodando do clone, as variáveis também podem ficar num `.env` em `packages/mongodb-readonly`.

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
