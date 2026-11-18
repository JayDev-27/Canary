import { DEMO_ROLES } from '@/lib/data/seededData';
import type { AlertDetail, DemoRoleInfo } from '@/lib/types/domain';
import { SMALL_CELL_THRESHOLD } from './contract';

export function getDemoAlertRole(request: {
  nextUrl: { searchParams: URLSearchParams };
  cookies: { get(name: string): { value: string } | undefined };
}) {
  const role = request.nextUrl.searchParams.get('role') ?? request.cookies.get('canary_role')?.value ?? 'oh_lead';
  return DEMO_ROLES.find(({ id }) => id === role);
}

export function canViewSeededAlert(alert: AlertDetail, role: DemoRoleInfo) {
  return role.permittedUnitIds === 'all' || role.permittedUnitIds.includes(alert.unit.id);
}

export function seededAlertView(alert: AlertDetail, role: DemoRoleInfo): AlertDetail {
  const canViewHealth = role.hasHealthDetail;
  return {
    ...alert,
    summary: canViewHealth ? alert.summary : 'Simulated alert in the compliance view.',
    tierReason: canViewHealth ? alert.tierReason : 'The tier reflects the simulated scenario evidence. Operational roles can review the underlying signals.',
    observedVsExpected: alert.observedVsExpected
      .filter((stream) => canViewHealth || stream.category === 'Environmental Hazard')
      .map((stream) => stream.category === 'Environmental Hazard' ? stream : {
        ...stream,
        history: stream.history.map((point) => point.observed !== null && point.observed < SMALL_CELL_THRESHOLD
          ? { ...point, observed: null, isExceedance: undefined } : point),
      }),
    contributions: alert.contributions
      .filter((item) => canViewHealth || item.provenance !== 'simulated')
      .map((item) => item.provenance === 'simulated' && typeof item.observed === 'number' && item.observed < SMALL_CELL_THRESHOLD
        ? { ...item, observed: `Withheld (<${SMALL_CELL_THRESHOLD})`, expected: 'Withheld', contribution: 0 } : item),
    recommendation: canViewHealth ? alert.recommendation : {
      ...alert.recommendation,
      action: 'Refer operational follow-up to the designated owner.',
      evidence: [],
      assumptions: [],
      escalationPath: 'Contact the designated owner for the operational review.',
    },
  };
}
