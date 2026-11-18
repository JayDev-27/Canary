import { type NextRequest, NextResponse } from 'next/server';
import { readJson, RequestBodyError } from '@/lib/api/readJson';
import { DEMO_ROLES, MONITORING_UNITS } from '@/lib/data/seededData';
import { analyzeCounts } from '@/lib/surveillance/analyzeCounts';
import { isReportCategory, MAX_CSV_BYTES } from '@/lib/surveillance/contract';
import { CountInputError, parseCounts } from '@/lib/surveillance/parseCounts';

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await readJson(request, 2 * MAX_CSV_BYTES);
  } catch (error) {
    if (!(error instanceof RequestBodyError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  if (!payload || typeof payload !== 'object' || !('csv' in payload) || !('unitId' in payload)
      || !('category' in payload) || !('role' in payload) || Object.keys(payload).length !== 4
      || typeof payload.csv !== 'string' || !isReportCategory(payload.category)) {
    return NextResponse.json({ error: 'Provide a site, count category, demo role and aggregate CSV.' }, { status: 400, headers });
  }

  const role = DEMO_ROLES.find(({ id }) => id === payload.role);
  const unit = MONITORING_UNITS.find(({ id }) => id === payload.unitId);
  if (!unit) return NextResponse.json({ error: 'Select a monitoring site from the list.' }, { status: 400, headers });
  if ((role?.id !== 'oh_lead' && role?.id !== 'hse_officer') || (role.permittedUnitIds !== 'all' && !role.permittedUnitIds.includes(unit.id))) {
    return NextResponse.json({ error: 'This site analysis is outside the selected demo role.' }, { status: 403, headers });
  }

  try {
    const rows = parseCounts(payload.csv);
    return NextResponse.json(analyzeCounts(rows, unit.id, payload.category), { headers });
  } catch (error) {
    if (!(error instanceof CountInputError)) throw error;
    return NextResponse.json({ error: error.message }, { status: 422, headers });
  }
}
