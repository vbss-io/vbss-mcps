# Excel MCP

MCP server para ler e escrever arquivos Excel (.xlsx). Funciona com arquivos existentes e cria novos.

## Setup

```bash
cd apps/mcps/excel
npm install
```

## Registrar no Claude Code

Edite o `.claude.json` e adicione em `mcpServers`:

```json
{
  "excel": {
    "type": "stdio",
    "command": "node",
    "args": [
      "C:/caminho/completo/apps/mcps/excel/src/index.js"
    ],
    "env": {}
  }
}
```

> **Importante**: Não use `claude mcp add` com paths que contenham espaços. Edite o JSON diretamente.

## Tools disponíveis

### Leitura

| Tool | Descrição |
| ---- | ----------- |
| `list_sheets` | Lista abas de um arquivo com contagem de linhas/colunas |
| `read_sheet` | Lê uma aba inteira como JSON (headers + rows) |
| `get_cell_range` | Lê um range específico (ex: A1:D10) |

### Escrita

| Tool | Descrição |
| ---- | ----------- |
| `write_sheet` | Escreve dados em uma aba (cria arquivo se necessário) |
| `append_rows` | Adiciona linhas a uma aba existente |
| `create_workbook` | Cria arquivo com múltiplas abas de uma vez |

## Uso

Aceita paths absolutos ou relativos:

```md
"O que tem nesse arquivo C:/Users/me/relatorio.xlsx?"
"Lê a aba Custos do arquivo ./dados.xlsx"
"Cria um Excel com os dados desse relatório em C:/Users/me/output.xlsx"
```
