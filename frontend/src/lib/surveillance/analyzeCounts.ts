import { createHash } from 'node:crypto';
import {
  addDays, BASELINE_DAYS, MIN_BASELINE_DAYS, SMALL_CELL_THRESHOLD,
  type AnalysisTier, type CountAnalysis, type DailyEvidence, type ReportCategory,
} from './contract';
import type { CountRow } from './parseCounts';

export function analyzeCounts(rows: CountRow[], unitId: string, category: ReportCategory): CountAnalysis {
  const firstDay = rows[0].date;
  const lastDay = rows[rows.length - 1].date;
  const counts = new Map(rows.map(({ date, count }) => [date, count >= SMALL_CELL_THRESHOLD ? count : null]));
  const evidence = new Map<string, DailyEvidence>();

  for (let date = firstDay; date <= lastDay; date = addDays(date, 1)) {
    const history = Array.from({ length: BASELINE_DAYS }, (_, index) => counts.get(addDays(date, -index - 1)))
      .filter((count): count is number => typeof count === 'number');
    const baselineDays = history.length;
    const mean = baselineDays >= MIN_BASELINE_DAYS
      ? history.reduce((total, count) => total + count, 0) / baselineDays : null;
    const sampleDeviation = mean === null ? null : Math.sqrt(
      history.reduce((total, count) => total + (count - mean) ** 2, 0) / (baselineDays - 1)
    );
    const spread = mean === null ? null : Math.max(sampleDeviation ?? 0, Math.sqrt(mean), 1);
    const watchThreshold = mean !== null && spread !== null ? Math.ceil(mean + 2 * spread) : null;
    const actionThreshold = mean !== null && spread !== null ? Math.ceil(mean + 5 * spread) : null;
    const observed = counts.get(date);
    const status = observed === undefined ? 'missing' : observed === null ? 'suppressed' : 'reported';

    const previousElevations = [1, 2].map((days) => evidence.get(addDays(date, -days)))
      .filter((point) => point?.observed != null && point.watchThreshold != null
        && point.observed >= point.watchThreshold).length;
    const elevated = observed != null && watchThreshold != null && observed >= watchThreshold;
    const recentElevations = previousElevations + Number(elevated);
    const comparison = `${observed} reported against an expected ${mean?.toFixed(1)}.`;

    let tier: AnalysisTier = 'UNAVAILABLE';
    let reason: string;
    if (observed === undefined) {
      reason = 'No count was reported for this day. Earlier history remains visible.';
    } else if (observed === null) {
      reason = 'The count is below the privacy threshold. This day is withheld from scoring and future baselines.';
    } else if (watchThreshold === null || actionThreshold === null) {
      reason = `Only ${baselineDays} eligible prior days are available. At least ${MIN_BASELINE_DAYS} are needed to set a baseline.`;
    } else if (observed >= actionThreshold) {
      tier = 'ACTION';
      reason = `${comparison} The count reached the Action threshold of ${actionThreshold}. Verify the report and review promptly.`;
    } else if (elevated && recentElevations >= 2) {
      tier = 'ALERT';
      reason = `${comparison} The count reached its Watch threshold of ${watchThreshold}. Counts met their daily thresholds on ${recentElevations} of the last 3 calendar days.`;
    } else if (elevated) {
      tier = 'WATCH';
      reason = `${comparison} The count reached the Watch threshold of ${watchThreshold}. A second elevated day within 3 days would meet the Alert rule.`;
    } else {
      tier = 'NOMINAL';
      reason = `${comparison} The count is below the Watch threshold of ${watchThreshold}.`;
    }

    const point: DailyEvidence = {
      date, status, observed: observed ?? null, expected: mean === null ? null : Number(mean.toFixed(1)),
      watchThreshold, actionThreshold, baselineDays, recentElevations, tier, reason,
    };
    evidence.set(date, point);
  }

  // The review fingerprint uses only evidence that is safe to display.
  const trend = [...evidence.values()].slice(-BASELINE_DAYS);
  const latest = trend[trend.length - 1];
  const reviewId = createHash('sha256')
    .update(JSON.stringify([unitId, category, trend])).digest('hex').slice(0, 32);
  return {
    unitId, category, latest, trend, reviewId: `report-${reviewId}`,
    baseFrom: addDays(lastDay, -BASELINE_DAYS), baseTo: addDays(lastDay, -1),
    withoutLatestCount: {
      ...latest, status: 'missing', observed: null, tier: 'UNAVAILABLE',
      reason: 'The latest count was withheld. Earlier history and the baseline are still available.',
      recentElevations: latest.recentElevations - Number(
        latest.observed !== null && latest.watchThreshold !== null && latest.observed >= latest.watchThreshold
      ),
    },
  };
}
