# Azure Readonly MCP

MCP server read-only multi-org para Azure. Permite inventariar recursos, consultar custos e métricas de performance em diferentes organizações.

## Setup

```bash
cd apps/mcps/azure-readonly
npm install
```

Crie o `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Configure as organizações:

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

## Registrar no Claude Code

Edite o `.claude.json` (global ou do projeto) e adicione em `mcpServers`:

```json
{
  "azure-readonly": {
    "type": "stdio",
    "command": "node",
    "args": [
      "C:/caminho/completo/apps/mcps/azure-readonly/src/index.js"
    ],
    "env": {}
  }
}
```

> **Importante**: Não use `claude mcp add` com paths que contenham espaços. Edite o JSON diretamente.

Verifique a conexão:

```bash
claude mcp list
```

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
