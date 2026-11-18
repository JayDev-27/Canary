import { NextRequest, NextResponse } from 'next/server';
import { readJson, RequestBodyError } from '@/lib/api/readJson';
import { DISTRICTS, MONITORING_UNITS } from '@/lib/data/seededData';
import { isReportDate } from '@/lib/surveillance/contract';

const headers = { 'Cache-Control': 'no-store' };
const unitIds = new Set([...MONITORING_UNITS, ...DISTRICTS].map(({ id }) => id));
const fields = new Set(['unit_id', 'date', 'category', 'count', 'stream', 'source', 'is_synthetic']);
const identifier = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,64}$/.test(value);

function reject(error: string, status = 400) {
  return NextResponse.json({ error, status: 'rejected' }, { status, headers });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await readJson(request, 32_768);
  } catch (error) {
    if (!(error instanceof RequestBodyError)) throw error;
    return reject(error.message, error.status);
  }

  const records: unknown[] = Array.isArray(body) ? body : [body];
  if (records.length < 1 || records.length > 200) {
    return reject('Provide between 1 and 200 sample records.');
  }
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return reject('Supply a valid aggregate object.');
    if (Object.keys(record).some((key) => !fields.has(key))) return reject('The sample contains fields outside the aggregate contract.');

    const { unit_id, date, category, count, stream, source, is_synthetic } = record as Record<string, unknown>;
    if (typeof unit_id !== 'string' || !unitIds.has(unit_id) || typeof date !== 'string' || !isReportDate(date)
        || !identifier(category) || typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100_000
        || (stream !== undefined && !identifier(stream)) || (source !== undefined && !identifier(source))
        || (is_synthetic !== undefined && typeof is_synthetic !== 'boolean')) {
      return reject('Supply a known unit, a valid date, a category identifier and a whole count from 0 to 100,000.');
    }
  }

  return NextResponse.json({
    message: 'Sample passed the aggregate contract check.',
    recordsValidated: records.length,
    status: 'accepted',
  }, { headers });
}
