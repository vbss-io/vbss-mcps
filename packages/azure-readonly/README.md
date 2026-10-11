# Azure Readonly MCP

MCP server read-only multi-org para Azure. Permite inventariar recursos, consultar custos e métricas de performance em diferentes organizações.

## Uso via npx

Não precisa clonar nem instalar: o cliente MCP baixa e roda o pacote com `npx`. Requer Node.js 22 ou superior.

Adicione no `.mcp.json` do projeto (ou no `~/.claude.json`):

```json
{
  "mcpServers": {
    "azure-readonly": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vbss-ai/mcp-azure-readonly"
      ],
      "env": {
        "AZURE_ORGS": "acme",
        "AZURE_ACME_TENANT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "AZURE_ACME_CLIENT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "AZURE_ACME_CLIENT_SECRET": "your-client-secret",
        "AZURE_ACME_SUBSCRIPTION_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "AZURE_ACME_LABEL": "Acme Corp"
      }
    }
  }
}
```

No Windows, use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-azure-readonly"]`.

Verifique a conexão:

```bash
claude mcp list
```

## Configuração

As variáveis vão no `env` do cliente MCP:

```env
AZURE_ORGS=acme,globex

AZURE_ACME_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_ACME_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_ACME_CLIENT_SECRET=your-client-secret
AZURE_ACME_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_ACME_LABEL=Acme Corp
```

### Permissões do Service Principal

O App Registration precisa dos seguintes roles na subscription:

- **Reader** — inventário de recursos
- **Cost Management Reader** — consulta de custos
- **Monitoring Reader** — métricas de performance

## Rodando a partir do código

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
node packages/azure-readonly/src/index.js
```

Rodando do clone, as variáveis também podem ficar num `.env` em `packages/azure-readonly`.

## Tools disponíveis

### Organizações e Subscriptions

| Tool | Descrição |
| ------ | ----------- |
| `list_organizations` | Lista orgs configuradas com status de conexão |
| `list_subscriptions` | Lista subscriptions acessíveis pelo service principal |

### Inventário de Recursos

| Tool | Descrição |
| ---- | ----------- |
| `query_resources` | Query KQL no Azure Resource Graph (inventário cross-subscription) |
| `get_resource` | Detalhes de um recurso específico por ID |
| `list_resource_groups` | Lista resource groups com locations e tags |
| `list_vnets` | Lista VNets com subnets, address spaces e peerings |

### Custos

| Tool | Descrição |
| ---- | ----------- |
| `query_costs` | Query flexível de custos (agrupamento, filtros, período) |
| `get_cost_by_resource_group` | Top N resource groups mais custosos |
| `get_cost_by_service` | Top N serviços mais custosos |
| `get_daily_costs` | Breakdown diário de custos |

### Métricas de Performance

| Tool | Descrição |
| ---- | ----------- |
| `list_metric_definitions` | Descobre métricas disponíveis para um recurso |
| `query_metrics` | Consulta métricas (CPU, memória, requests, etc.) |

## Custo

Todas as APIs usadas são gratuitas (Resource Graph, Cost Management, ARM). A API de métricas (Monitor) é gratuita até 1M chamadas/mês por subscription.
