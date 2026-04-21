import { z } from "zod";
import XLSX from "xlsx";
import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function resolvePath(filePath) {
  const cleaned = filePath.replace(/^['"]|['"]$/g, "").trim();
  return isAbsolute(cleaned) ? cleaned : resolve(process.cwd(), cleaned);
}

function getCellValue(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell) return null;
  if (cell.v instanceof Date) return cell.v.toISOString();
  return cell.v !== undefined ? cell.v : null;
}

function getSheetRange(ws) {
  const ref = ws["!ref"];
  if (!ref) return null;
  return XLSX.utils.decode_range(ref);
}

function sheetSummary(wb, name) {
  const ws = wb.Sheets[name];
  const range = getSheetRange(ws);
  if (!range) {
    return { name, rowCount: 0, columnCount: 0 };
  }
  return {
    name,
    rowCount: range.e.r - range.s.r + 1,
    columnCount: range.e.c - range.s.c + 1,
  };
}

const MAX_OUTPUT = 80000;

function truncatedResult(data) {
  const output = JSON.stringify(data, null, 2);
  if (output.length <= MAX_OUTPUT) {
    return { content: [{ type: "text", text: output }] };
  }
  return {
    content: [{
      type: "text",
      text: output.slice(0, MAX_OUTPUT) + `\n\n... TRUNCATED (${output.length} chars). Use get_cell_range to read smaller portions.`,
    }],
  };
}

export function registerTools(server) {
  const filePathSchema = z
    .string()
    .describe("Absolute or relative path to the Excel file (e.g., C:/Users/me/report.xlsx or ./report.xlsx)");

  // ─── Read operations ───

  server.tool(
    "list_sheets",
    "List all sheets/tabs in an Excel file with their row and column counts",
    { filePath: filePathSchema },
    async ({ filePath }) => {
      try {
        const fullPath = resolvePath(filePath);
        if (!existsSync(fullPath)) {
          return errorResult(`File not found: ${fullPath}`);
        }
        const wb = XLSX.readFile(fullPath);
        const sheets = wb.SheetNames.map((name) => sheetSummary(wb, name));
        return textResult({ file: fullPath, sheets });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "read_sheet",
    "Read an entire sheet from an Excel file as JSON rows. The first row is used as column headers. For large sheets, use get_cell_range instead.",
    {
      filePath: filePathSchema,
      sheet: z
        .string()
        .optional()
        .describe("Sheet name (optional, defaults to the first sheet)"),
      maxRows: z
        .number()
        .min(1)
        .max(5000)
        .default(500)
        .describe("Maximum rows to read (default: 500, max: 5000)"),
    },
    async ({ filePath, sheet, maxRows }) => {
      try {
        const fullPath = resolvePath(filePath);
        if (!existsSync(fullPath)) {
          return errorResult(`File not found: ${fullPath}`);
        }
        const wb = XLSX.readFile(fullPath, { cellDates: true });
        const sheetName = sheet || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          return errorResult(`Sheet "${sheet}" not found. Use list_sheets to see available sheets.`);
        }
        const range = getSheetRange(ws);
        if (!range) {
          return truncatedResult({
            file: fullPath,
            sheet: sheetName,
            headers: [],
            row_count: 0,
            total_rows: 0,
            rows: [],
          });
        }
        const headers = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const val = getCellValue(ws, range.s.r, c);
          headers.push(val !== null ? String(val) : `Column${c + 1}`);
        }
        const totalRows = range.e.r - range.s.r;
        const limit = Math.min(range.s.r + maxRows, range.e.r);
        const rows = [];
        for (let r = range.s.r + 1; r <= limit; r++) {
          const obj = {};
          let hasValue = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const val = getCellValue(ws, r, c);
            const header = headers[c - range.s.c];
            obj[header] = val;
            if (val !== null) hasValue = true;
          }
          if (hasValue) rows.push(obj);
        }
        return truncatedResult({
          file: fullPath,
          sheet: sheetName,
          headers,
          row_count: rows.length,
          total_rows: totalRows,
          rows,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_cell_range",
    "Read a specific cell range from an Excel sheet (e.g., A1:D10, B2:F50)",
    {
      filePath: filePathSchema,
      range: z
        .string()
        .describe("Cell range in A1 notation (e.g., A1:D10, B2:F50)"),
      sheet: z
        .string()
        .optional()
        .describe("Sheet name (optional, defaults to the first sheet)"),
    },
    async ({ filePath, range, sheet }) => {
      try {
        const fullPath = resolvePath(filePath);
        if (!existsSync(fullPath)) {
          return errorResult(`File not found: ${fullPath}`);
        }
        const [startRef, endRef] = range.split(":");
        if (!startRef || !endRef) {
          return errorResult("Range must be in format A1:D10");
        }
        const wb = XLSX.readFile(fullPath, { cellDates: true });
        const sheetName = sheet || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          return errorResult(`Sheet "${sheet}" not found.`);
        }
        const decoded = XLSX.utils.decode_range(range);
        const data = [];
        for (let r = decoded.s.r; r <= decoded.e.r; r++) {
          const rowData = [];
          for (let c = decoded.s.c; c <= decoded.e.c; c++) {
            rowData.push(getCellValue(ws, r, c));
          }
          data.push(rowData);
        }
        return truncatedResult({
          file: fullPath,
          sheet: sheetName,
          range,
          rows: data.length,
          cols: data[0]?.length || 0,
          data,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── Write operations ───

  server.tool(
    "write_sheet",
    "Write data to a sheet in an Excel file. Creates the file if it doesn't exist. If the file exists, adds or replaces the specified sheet.",
    {
      filePath: filePathSchema,
      sheet: z
        .string()
        .default("Sheet1")
        .describe("Sheet name to create or replace"),
      headers: z
        .array(z.string())
        .describe("Column headers (e.g., ['Name', 'Cost', 'Date'])"),
      rows: z
        .array(z.array(z.any()))
        .describe("Array of rows, each row is an array of values (e.g., [['VM1', 100.5, '2026-01-01'], ['VM2', 200.3, '2026-01-02']])"),
    },
    async ({ filePath, sheet, headers, rows }) => {
      try {
        const fullPath = resolvePath(filePath);
        let wb;
        if (existsSync(fullPath)) {
          wb = XLSX.readFile(fullPath);
          const idx = wb.SheetNames.indexOf(sheet);
          if (idx !== -1) {
            wb.SheetNames.splice(idx, 1);
            delete wb.Sheets[sheet];
          }
        } else {
          wb = XLSX.utils.book_new();
        }
        const data = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = headers.map((h, i) => {
          let max = String(h).length;
          for (const row of rows) {
            const val = row[i];
            if (val !== null && val !== undefined) {
              max = Math.max(max, String(val).length);
            }
          }
          return { wch: Math.min(max + 2, 50) };
        });
        XLSX.utils.book_append_sheet(wb, ws, sheet);
        XLSX.writeFile(wb, fullPath);
        return textResult({
          file: fullPath,
          sheet,
          headers_count: headers.length,
          rows_written: rows.length,
          status: "success",
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "append_rows",
    "Append rows to an existing sheet in an Excel file. The file and sheet must already exist.",
    {
      filePath: filePathSchema,
      sheet: z
        .string()
        .optional()
        .describe("Sheet name (optional, defaults to the first sheet)"),
      rows: z
        .array(z.array(z.any()))
        .describe("Array of rows to append (e.g., [['VM3', 150.0, '2026-01-03']])"),
    },
    async ({ filePath, sheet, rows }) => {
      try {
        const fullPath = resolvePath(filePath);
        if (!existsSync(fullPath)) {
          return errorResult(`File not found: ${fullPath}. Use write_sheet to create a new file.`);
        }
        const wb = XLSX.readFile(fullPath);
        const sheetName = sheet || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          return errorResult(`Sheet "${sheetName}" not found.`);
        }
        const range = getSheetRange(ws);
        const startRow = range ? range.e.r + 1 : 0;
        XLSX.utils.sheet_add_aoa(ws, rows, { origin: startRow });
        XLSX.writeFile(wb, fullPath);
        return textResult({
          file: fullPath,
          sheet: sheetName,
          rows_appended: rows.length,
          total_rows: startRow + rows.length,
          started_at_row: startRow + 1,
          status: "success",
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "create_workbook",
    "Create a new Excel file with multiple sheets at once. Each sheet has its own headers and rows.",
    {
      filePath: filePathSchema,
      sheets: z
        .array(z.object({
          name: z.string().describe("Sheet name"),
          headers: z.array(z.string()).describe("Column headers"),
          rows: z.array(z.array(z.any())).describe("Data rows"),
        }))
        .describe("Array of sheets to create"),
    },
    async ({ filePath, sheets }) => {
      try {
        const fullPath = resolvePath(filePath);
        const wb = XLSX.utils.book_new();
        for (const sheetDef of sheets) {
          const data = [sheetDef.headers, ...sheetDef.rows];
          const ws = XLSX.utils.aoa_to_sheet(data);
          ws["!cols"] = sheetDef.headers.map((h, i) => {
            let max = String(h).length;
            for (const row of sheetDef.rows) {
              const val = row[i];
              if (val !== null && val !== undefined) {
                max = Math.max(max, String(val).length);
              }
            }
            return { wch: Math.min(max + 2, 50) };
          });
          XLSX.utils.book_append_sheet(wb, ws, sheetDef.name);
        }
        XLSX.writeFile(wb, fullPath);
        const summary = sheets.map((s) => ({
          name: s.name,
          headers: s.headers.length,
          rows: s.rows.length,
        }));
        return textResult({
          file: fullPath,
          sheets_created: summary,
          status: "success",
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );
}
