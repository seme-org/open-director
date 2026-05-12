function parseCsvRow(row: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.trim());
}

function renderBatchLine(subject: string, script: string, terms: string[]) {
  const parts = [subject, script, terms.join(", ")].map((part) => part.trim());
  while (parts.length > 0 && !parts[parts.length - 1]) {
    parts.pop();
  }
  return parts.join(" | ");
}

export function importBatchText(fileName: string, content: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (extension !== "csv") {
    return rows.join("\n");
  }

  return rows
    .map((row) => {
      const cells = parseCsvRow(row);
      if (cells.length === 0) return "";

      const subject = cells[0] ?? "";
      const script = cells[1] ?? "";
      const terms = cells.length > 2 ? cells.slice(2).filter(Boolean) : [];
      return renderBatchLine(subject, script, terms);
    })
    .filter(Boolean)
    .join("\n");
}
