import { NextRequest, NextResponse } from 'next/server';
import { SEEDED_ALERTS } from '@/lib/data/seededData';
import { canViewSeededAlert, getDemoAlertRole, seededAlertView } from '@/lib/surveillance/seededAlertView';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const role = getDemoAlertRole(request);
  if (!role) return NextResponse.json({ error: 'Unknown demo role.' }, { status: 400 });

  const { alertId } = await params;
  const alert = SEEDED_ALERTS.find((item) => item.id.toLowerCase() === alertId.toLowerCase());
  if (!alert) return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
  if (!canViewSeededAlert(alert, role)) {
    return NextResponse.json({ error: 'The selected demo role does not cover this alert.' }, { status: 403 });
  }
  return NextResponse.json(seededAlertView(alert, role), { headers: { 'Cache-Control': 'no-store' } });
}
