# Excel MCP

MCP server para ler e escrever arquivos Excel (.xlsx). Funciona com arquivos existentes e cria novos.

## Uso via npx

Não precisa clonar nem instalar: o cliente MCP baixa e roda o pacote com `npx`. Requer Node.js 20 ou superior.

Adicione no `.mcp.json` do projeto (ou no `~/.claude.json`):

```json
{
  "mcpServers": {
    "excel": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@vbss-ai/mcp-excel"
      ]
    }
  }
}
```

No Windows, use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "@vbss-ai/mcp-excel"]`.

Verifique a conexão:

```bash
claude mcp list
```

## Rodando a partir do código

```bash
git clone https://github.com/vbss-io/vbss-mcps.git
cd vbss-mcps
npm install
node packages/excel/src/index.js
```

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
