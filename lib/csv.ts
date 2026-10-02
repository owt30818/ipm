// CSV helpers shared by the IP export (app/actions/export-ips.ts) and the backup CSVs (/api/backups/[table])

// Spreadsheets run cells that start with = + - @ as formulas (CSV injection), so neutralize them
export function escapeCsvField(value: string): string {
  let field = value;
  if (/^[=+\-@\t\r]/.test(field)) {
    field = `'${field}`;
  }
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}
