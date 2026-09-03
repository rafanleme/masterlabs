function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera CSV com separador ';' (padrão Excel pt-BR) e BOM UTF-8.
 * headers: string[]; rows: array de arrays na mesma ordem dos headers.
 */
function toCsv(headers, rows) {
  const lines = [
    headers.map(escapeCell).join(';'),
    ...rows.map((row) => row.map(escapeCell).join(';')),
  ];
  return '﻿' + lines.join('\r\n');
}

module.exports = { toCsv };
