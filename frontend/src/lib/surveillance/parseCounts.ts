import {
  addDays, dubaiDate, isReportDate, MAX_CSV_BYTES, MAX_REPORT_DAYS,
} from './contract';

export interface CountRow {
  date: string;
  count: number;
}

export class CountInputError extends Error {}

export function parseCounts(csv: string, today = dubaiDate()): CountRow[] {
  if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
    throw new CountInputError('Use a CSV file of 16 KB or less.');
  }
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r\n|\n|\r/);
  const cells = (line: string) => line.split(',').map((value) =>
    value.trim().replace(/^"([^"]*)"$/, '$1')
  );
  const header = cells(lines[0]);
  if (header.length !== 2 || header[0] !== 'date' || header[1] !== 'count') {
    throw new CountInputError('Use exactly two columns, date and count, with the header date,count.');
  }

  const rows = new Map<string, number>();
  for (const [index, line] of lines.slice(1).entries()) {
    if (!line.trim()) continue;
    const [date, count, ...extra] = cells(line);
    const lineNumber = index + 2;
    if (extra.length || !isReportDate(date) || !/^\d{1,6}$/.test(count ?? '') || Number(count) > 100_000) {
      throw new CountInputError(`Row ${lineNumber} needs a real YYYY-MM-DD date and a whole count from 0 to 100,000.`);
    }
    if (date > today || date < addDays(today, -729)) {
      throw new CountInputError(`Row ${lineNumber} is outside the last 730 Dubai calendar days.`);
    }
    if (rows.has(date)) {
      throw new CountInputError(`Row ${lineNumber} repeats a date. Supply one count per day.`);
    }
    rows.set(date, Number(count));
  }

  const sorted = [...rows].sort(([first], [second]) => first.localeCompare(second));
  if (!sorted.length) throw new CountInputError('Add at least one daily count.');
  if (sorted[sorted.length - 1][0] > addDays(sorted[0][0], MAX_REPORT_DAYS - 1)) {
    throw new CountInputError('Keep the report within a single period of up to 366 calendar days.');
  }
  return sorted.map(([date, count]) => ({ date, count }));
}
