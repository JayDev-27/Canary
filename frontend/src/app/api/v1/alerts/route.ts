import { NextRequest, NextResponse } from 'next/server';
import { SEEDED_ALERTS } from '@/lib/data/seededData';
import { canViewSeededAlert, getDemoAlertRole, seededAlertView } from '@/lib/surveillance/seededAlertView';

export async function GET(request: NextRequest) {
  const role = getDemoAlertRole(request);
  if (!role) return NextResponse.json({ error: 'Unknown demo role.' }, { status: 400 });

  const filters = (['tier', 'hazard', 'status'] as const).map((key) =>
    [key, request.nextUrl.searchParams.get(key)?.toLowerCase()] as const
  );
  const alerts = SEEDED_ALERTS
    .filter((alert) => canViewSeededAlert(alert, role)
      && filters.every(([key, value]) => !value || value === 'all' || alert[key].toLowerCase() === value))
    .map((alert) => seededAlertView(alert, role));
  const unacknowledgedActionCount = alerts.filter((alert) => alert.tier === 'ACTION' && alert.status === 'active').length;
  return NextResponse.json(
    { alerts, total: alerts.length, unacknowledgedActionCount, activeRole: role.id },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
