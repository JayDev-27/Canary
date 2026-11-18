import { type NextRequest, NextResponse } from 'next/server';
import { DUBAI_COORDINATES } from '@/components/dashboard/DubaiMapData';
import { MONITORING_UNITS } from '@/lib/data/seededData';
import { getEnvironment } from '@/lib/surveillance/environment';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('location') ?? '';
  const site = MONITORING_UNITS.find(({ id }) => id === locationId);
  const coordinates = site ? [site.latitude, site.longitude] as const
    : Object.hasOwn(DUBAI_COORDINATES, locationId) ? DUBAI_COORDINATES[locationId] : undefined;
  if (!coordinates) return NextResponse.json({ error: 'Unknown monitoring location.' }, { status: 404, headers });
  return NextResponse.json(await getEnvironment(locationId, coordinates), { headers });
}
